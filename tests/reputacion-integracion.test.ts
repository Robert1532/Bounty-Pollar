import { randomBytes } from 'node:crypto';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { Keypair } from '@stellar/stellar-sdk';

/**
 * La reputación tiene que subir exactamente una vez por trato cerrado, incluso
 * si dos peticiones compiten. Se prueba contra Postgres de verdad porque la
 * garantía vive en el UPDATE condicionado, no en el código de TypeScript.
 */
const cadena = vi.hoisted(() => ({ hashSalida: 'c'.repeat(64) }));

vi.mock('@/lib/stellar', () => ({
  direccionEscrow: () => 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
  buscarDeposito: async () => ({ estado: 'NO_ENCONTRADO' }),
  consultarTx: async () => ({ exitoso: true }),
  enviarDesdeEscrow: async (params: { alConstruir?: (hash: string) => Promise<void> }) => {
    await params.alConstruir?.(cadena.hashSalida);
    return { hash: cadena.hashSalida, exitoso: true };
  },
}));

const habilitada = process.env.RUN_DB_INTEGRATION === '1' && Boolean(process.env.TEST_DATABASE_URL);
const suite = habilitada ? describe : describe.skip;

suite('reputación con PostgreSQL', () => {
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
    const { db, tratos, users } = await import('@/db');
    if (idsTratos.length) await db.delete(tratos).where(inArray(tratos.id, idsTratos.splice(0)));
    if (idsUsuarios.length) await db.delete(users).where(inArray(users.id, idsUsuarios.splice(0)));
    cadena.hashSalida = randomBytes(32).toString('hex');
  });

  async function montarTratoFinanciado(codigo: string) {
    const { db, tratos, users } = await import('@/db');
    const { hashearCodigo } = await import('@/lib/codigo');
    const { cifrar } = await import('@/lib/cripto');

    const sufijo = randomBytes(4).toString('hex');
    const vendedorId = `vend-${sufijo}`;
    const compradorId = `comp-${sufijo}`;
    const tratoId = `t${sufijo}`;
    idsUsuarios.push(vendedorId, compradorId);
    idsTratos.push(tratoId);

    const vendedor = Keypair.random().publicKey();
    const comprador = Keypair.random().publicKey();
    const filas = await db
      .insert(users)
      .values([
        { id: vendedorId, walletAddress: vendedor },
        { id: compradorId, walletAddress: comprador },
      ])
      .returning();

    await db.insert(tratos).values({
      id: tratoId,
      vendedorId,
      compradorId,
      titulo: 'Trato de reputación',
      montoUsdc: '7.5000000',
      codigoHash: await hashearCodigo(codigo),
      codigoCifrado: cifrar(codigo),
      escrowAddress: Keypair.random().publicKey(),
      memo: `CAS-${tratoId}`,
      vendedorAddress: vendedor,
      compradorAddress: comprador,
      estado: 'FINANCIADO',
      financiadoEn: new Date(),
      liberaHasta: new Date(Date.now() + 60_000),
      expiraEn: new Date(Date.now() + 120_000),
    });

    return {
      tratoId,
      vendedorId,
      compradorId,
      actor: filas.find((fila) => fila.id === vendedorId)!,
    };
  }

  it('una liberación suma una venta, una compra y el volumen', async () => {
    const { db, users } = await import('@/db');
    const { liberar } = await import('@/lib/tratos/service');
    const montaje = await montarTratoFinanciado('123456');

    const trato = await liberar({ id: montaje.tratoId, codigo: '123456', actor: montaje.actor });
    expect(trato.estado).toBe('LIBERADO');

    const [vendedor] = await db.select().from(users).where(eq(users.id, montaje.vendedorId));
    const [comprador] = await db.select().from(users).where(eq(users.id, montaje.compradorId));

    expect(vendedor?.ventasCompletadas).toBe(1);
    expect(Number(vendedor?.volumenVendidoUsdc)).toBeCloseTo(7.5, 7);
    expect(vendedor?.primerTratoEn).toBeInstanceOf(Date);
    expect(comprador?.comprasCompletadas).toBe(1);
    expect(vendedor?.devolucionesComoVendedor).toBe(0);
  });

  it('dos liberaciones simultáneas no cuentan dos ventas', async () => {
    const { db, users } = await import('@/db');
    const { liberar } = await import('@/lib/tratos/service');
    const montaje = await montarTratoFinanciado('654321');

    await Promise.all([
      liberar({ id: montaje.tratoId, codigo: '654321', actor: montaje.actor }),
      liberar({ id: montaje.tratoId, codigo: '654321', actor: montaje.actor }),
    ]);

    const [vendedor] = await db.select().from(users).where(eq(users.id, montaje.vendedorId));
    expect(vendedor?.ventasCompletadas).toBe(1);
    expect(Number(vendedor?.volumenVendidoUsdc)).toBeCloseTo(7.5, 7);
  });

  it('una devolución por plazo vencido cuenta en contra del vendedor', async () => {
    const { db, tratos, users } = await import('@/db');
    const { devolver } = await import('@/lib/tratos/service');
    const montaje = await montarTratoFinanciado('111222');

    await db
      .update(tratos)
      .set({ liberaHasta: new Date(Date.now() - 60_000) })
      .where(eq(tratos.id, montaje.tratoId));

    const trato = await devolver({ id: montaje.tratoId, motivo: 'PLAZO_VENCIDO' });
    expect(trato.estado).toBe('DEVUELTO');

    const [vendedor] = await db.select().from(users).where(eq(users.id, montaje.vendedorId));
    const [comprador] = await db.select().from(users).where(eq(users.id, montaje.compradorId));
    expect(vendedor?.devolucionesComoVendedor).toBe(1);
    expect(vendedor?.ventasCompletadas).toBe(0);
    expect(Number(vendedor?.volumenVendidoUsdc)).toBe(0);
    expect(comprador?.devolucionesComoComprador).toBe(1);
  });

  it('las estadísticas públicas cuadran con lo que hay en la base', async () => {
    const { liberar, estadisticasPublicas } = await import('@/lib/tratos/service');
    const antes = await estadisticasPublicas();
    const montaje = await montarTratoFinanciado('999888');

    const enCustodia = await estadisticasPublicas();
    expect(enCustodia.tratosEnCustodia).toBe(antes.tratosEnCustodia + 1);
    expect(Number(enCustodia.protegidoAhoraUsdc)).toBeCloseTo(Number(antes.protegidoAhoraUsdc) + 7.5, 7);

    await liberar({ id: montaje.tratoId, codigo: '999888', actor: montaje.actor });

    const despues = await estadisticasPublicas();
    expect(despues.tratosCompletados).toBe(antes.tratosCompletados + 1);
    expect(despues.tratosEnCustodia).toBe(antes.tratosEnCustodia);
    expect(despues.tasaEntrega).not.toBeNull();
  });
});
