import { randomBytes } from 'node:crypto';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { Keypair } from '@stellar/stellar-sdk';

/**
 * Las garantías de la calificación viven en la base —el índice único sobre
 * trato_id y el CHECK del rango—, así que se prueban contra Postgres de verdad.
 */
vi.mock('@/lib/stellar', () => ({
  direccionEscrow: () => 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
  buscarDeposito: async () => ({ estado: 'NO_ENCONTRADO' }),
  consultarTx: async () => ({ exitoso: true }),
  enviarDesdeEscrow: async () => ({ hash: 'f'.repeat(64), exitoso: true }),
}));

const habilitada = process.env.RUN_DB_INTEGRATION === '1' && Boolean(process.env.TEST_DATABASE_URL);
const suite = habilitada ? describe : describe.skip;

suite('calificaciones con PostgreSQL', () => {
  const idsTratos: string[] = [];
  const idsUsuarios: string[] = [];

  beforeAll(() => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    process.env.APP_URL = 'http://localhost:3000';
    process.env.SESSION_SECRET = 'test-session-secret-with-at-least-32-characters';
    process.env.CRON_SECRET = 'test-cron-secret-with-16-characters';
    process.env.MODO_MOCK = 'true';
  });

  afterEach(async () => {
    const { db, calificaciones, tratos, users } = await import('@/db');
    if (idsTratos.length) {
      await db.delete(calificaciones).where(inArray(calificaciones.tratoId, idsTratos));
      await db.delete(tratos).where(inArray(tratos.id, idsTratos.splice(0)));
    }
    if (idsUsuarios.length) await db.delete(users).where(inArray(users.id, idsUsuarios.splice(0)));
  });

  async function montarTratoLiberado() {
    const { db, tratos, users } = await import('@/db');
    const sufijo = randomBytes(4).toString('hex');
    const vendedorId = `vend-${sufijo}`;
    const compradorId = `comp-${sufijo}`;
    const tratoId = `t${sufijo}`;
    idsUsuarios.push(vendedorId, compradorId);
    idsTratos.push(tratoId);

    const filas = await db
      .insert(users)
      .values([
        { id: vendedorId, walletAddress: Keypair.random().publicKey() },
        { id: compradorId, walletAddress: Keypair.random().publicKey() },
      ])
      .returning();

    await db.insert(tratos).values({
      id: tratoId,
      vendedorId,
      compradorId,
      titulo: 'Trato calificable',
      montoUsdc: '3.0000000',
      codigoHash: 'no-usado',
      codigoCifrado: 'no-usado',
      escrowAddress: Keypair.random().publicKey(),
      memo: `CAS-${tratoId}`,
      vendedorAddress: Keypair.random().publicKey(),
      estado: 'LIBERADO',
      expiraEn: new Date(Date.now() + 60_000),
    });

    return {
      tratoId,
      vendedorId,
      vendedor: filas.find((f) => f.id === vendedorId)!,
      comprador: filas.find((f) => f.id === compradorId)!,
    };
  }

  it('el comprador califica y el contador del vendedor sube', async () => {
    const { db, users } = await import('@/db');
    const { calificar } = await import('@/lib/tratos/calificaciones');
    const m = await montarTratoLiberado();

    const estrellas = await calificar({ tratoId: m.tratoId, estrellas: 4, actor: m.comprador });
    expect(estrellas.cantidad).toBe(1);
    // Con una sola, el promedio sigue oculto: si no, el vendedor sabría de quién vino.
    expect(estrellas.promedio).toBeNull();

    const [vendedor] = await db.select().from(users).where(eq(users.id, m.vendedorId));
    expect(vendedor?.calificacionesRecibidas).toBe(1);
    expect(vendedor?.sumaEstrellas).toBe(4);
  });

  it('no se puede calificar dos veces el mismo trato', async () => {
    const { calificar } = await import('@/lib/tratos/calificaciones');
    const m = await montarTratoLiberado();

    await calificar({ tratoId: m.tratoId, estrellas: 5, actor: m.comprador });
    await expect(calificar({ tratoId: m.tratoId, estrellas: 1, actor: m.comprador })).rejects.toThrow(
      /ya fue calificado/i,
    );
  });

  it('el vendedor no puede calificarse a sí mismo', async () => {
    const { calificar } = await import('@/lib/tratos/calificaciones');
    const m = await montarTratoLiberado();
    await expect(calificar({ tratoId: m.tratoId, estrellas: 5, actor: m.vendedor })).rejects.toThrow(
      /Solo quien compró/i,
    );
  });

  it('la fila guardada no contiene al comprador', async () => {
    const { db, calificaciones } = await import('@/db');
    const { calificar } = await import('@/lib/tratos/calificaciones');
    const m = await montarTratoLiberado();

    await calificar({ tratoId: m.tratoId, estrellas: 3, actor: m.comprador });
    const [fila] = await db.select().from(calificaciones).where(eq(calificaciones.tratoId, m.tratoId));

    // El anonimato es estructural: no hay dónde guardar al comprador.
    expect(Object.values(fila ?? {})).not.toContain(m.comprador.id);
    expect(Object.values(fila ?? {})).not.toContain(m.comprador.walletAddress);
    expect(Object.keys(fila ?? {})).toEqual(['id', 'tratoId', 'vendedorId', 'estrellas', 'createdAt']);
  });

  it('el rango 1–5 lo hace cumplir la base, no solo el código', async () => {
    const { db, calificaciones } = await import('@/db');
    const { nuevoId } = await import('@/lib/ids');
    const m = await montarTratoLiberado();

    await expect(
      db.insert(calificaciones).values({
        id: nuevoId(),
        tratoId: m.tratoId,
        vendedorId: m.vendedorId,
        estrellas: 9,
      }),
    ).rejects.toThrow();
  });
});
