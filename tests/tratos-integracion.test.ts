import { randomBytes } from 'node:crypto';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { Keypair } from '@stellar/stellar-sdk';

const cadena = vi.hoisted(() => ({
  depositos: new Map<string, {
    hash: string;
    monto: string;
    desde: string;
    memo: string;
    creadoEn: string;
  }>(),
  fallarBusquedas: new Set<string>(),
  consulta: null as { exitoso: boolean } | null,
  envios: 0,
  hashSalida: 'a'.repeat(64),
}));

vi.mock('@/lib/stellar', () => ({
  direccionEscrow: () => 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
  buscarDeposito: async (params: { memo: string }) => {
    if (cadena.fallarBusquedas.has(params.memo)) throw new Error('Horizon no disponible');
    const deposito = cadena.depositos.get(params.memo);
    return deposito ? { estado: 'ENCONTRADO', deposito } : { estado: 'NO_ENCONTRADO' };
  },
  consultarTx: async () => cadena.consulta,
  enviarDesdeEscrow: async (params: { alConstruir?: (hash: string) => Promise<void> }) => {
    cadena.envios += 1;
    await params.alConstruir?.(cadena.hashSalida);
    throw new Error('timeout simulado después de construir la transacción');
  },
}));

const habilitada = process.env.RUN_DB_INTEGRATION === '1' && Boolean(process.env.TEST_DATABASE_URL);
const suite = habilitada ? describe : describe.skip;

suite('servicio de tratos con PostgreSQL', () => {
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
    cadena.depositos.clear();
    cadena.fallarBusquedas.clear();
    cadena.consulta = null;
    cadena.envios = 0;
    cadena.hashSalida = 'a'.repeat(64);
  });

  it('confirma una sola vez aunque dos peticiones compitan', async () => {
    const { db, eventos, tratos, users } = await import('@/db');
    const { confirmarDeposito } = await import('@/lib/tratos/service');
    const sufijo = randomBytes(4).toString('hex');
    const vendedorId = `vend-${sufijo}`;
    const compradorId = `comp-${sufijo}`;
    const tratoId = `t${sufijo}`;
    idsUsuarios.push(vendedorId, compradorId);
    idsTratos.push(tratoId);

    const vendedor = Keypair.random().publicKey();
    const comprador = Keypair.random().publicKey();
    await db.insert(users).values([
      { id: vendedorId, walletAddress: vendedor },
      { id: compradorId, walletAddress: comprador },
    ]);
    await db.insert(tratos).values({
      id: tratoId,
      vendedorId,
      titulo: 'Prueba concurrente',
      montoUsdc: '1.0000000',
      codigoHash: 'no-usado',
      codigoCifrado: 'no-usado',
      escrowAddress: Keypair.random().publicKey(),
      memo: `CAS-${tratoId}`,
      vendedorAddress: vendedor,
      expiraEn: new Date(Date.now() + 60_000),
    });
    cadena.depositos.set(`CAS-${tratoId}`, {
      hash: 'b'.repeat(64),
      monto: '1.0000000',
      desde: comprador,
      memo: `CAS-${tratoId}`,
      creadoEn: new Date().toISOString(),
    });

    const [uno, dos] = await Promise.all([
      confirmarDeposito({ id: tratoId }),
      confirmarDeposito({ id: tratoId }),
    ]);

    expect(uno.estado).toBe('FINANCIADO');
    expect(dos.estado).toBe('FINANCIADO');
    const registrados = await db
      .select()
      .from(eventos)
      .where(eq(eventos.tratoId, tratoId));
    expect(registrados.filter((evento) => evento.tipo === 'DEPOSITO_DETECTADO')).toHaveLength(1);
  });

  it('no reenvía dinero mientras el resultado de la red sea ambiguo', async () => {
    const { db, tratos, users } = await import('@/db');
    const { hashearCodigo } = await import('@/lib/codigo');
    const { liberar } = await import('@/lib/tratos/service');
    const sufijo = randomBytes(4).toString('hex');
    const vendedorId = `vend-${sufijo}`;
    const compradorId = `comp-${sufijo}`;
    const tratoId = `t${sufijo}`;
    idsUsuarios.push(vendedorId, compradorId);
    idsTratos.push(tratoId);

    const vendedor = Keypair.random().publicKey();
    const comprador = Keypair.random().publicKey();
    const [actor] = await db
      .insert(users)
      .values([
        { id: vendedorId, walletAddress: vendedor },
        { id: compradorId, walletAddress: comprador },
      ])
      .returning();
    if (!actor) throw new Error('No se creó el vendedor de prueba.');
    await db.insert(tratos).values({
      id: tratoId,
      vendedorId,
      compradorId,
      titulo: 'Salida ambigua',
      montoUsdc: '1.0000000',
      codigoHash: await hashearCodigo('123456'),
      codigoCifrado: 'no-usado',
      escrowAddress: Keypair.random().publicKey(),
      memo: `CAS-${tratoId}`,
      compradorAddress: comprador,
      vendedorAddress: vendedor,
      txDeposito: 'c'.repeat(64),
      estado: 'FINANCIADO',
      expiraEn: new Date(Date.now() + 60_000),
      liberaHasta: new Date(Date.now() + 60_000),
    });

    const competidores = await Promise.allSettled([
      liberar({ id: tratoId, codigo: '123456', actor }),
      liberar({ id: tratoId, codigo: '123456', actor }),
    ]);
    expect(cadena.envios).toBe(1);
    expect(competidores.some((resultado) => resultado.status === 'rejected')).toBe(true);

    const [ambiguo] = await db.select().from(tratos).where(eq(tratos.id, tratoId));
    expect(ambiguo?.estado).toBe('LIBERANDO');
    expect(ambiguo?.txLiberacion).toBe(cadena.hashSalida);

    await expect(liberar({ id: tratoId, codigo: '123456', actor })).rejects.toMatchObject({
      codigo: 'CADENA',
      detalle: { estado: 'DESCONOCIDA' },
    });
    expect(cadena.envios).toBe(1);

    cadena.consulta = { exitoso: true };
    const recuperado = await liberar({ id: tratoId, codigo: '123456', actor });
    expect(recuperado.estado).toBe('LIBERADO');
    expect(recuperado.txLiberacion).toBe(cadena.hashSalida);
    expect(cadena.envios).toBe(1);
  });

  it('no expira un trato si Horizon falló antes de comprobar su depósito', async () => {
    const { db, tratos, users } = await import('@/db');
    const { procesarVencimientos } = await import('@/lib/tratos/service');
    const sufijo = randomBytes(4).toString('hex');
    const vendedorId = `vend-${sufijo}`;
    const tratoSeguro = `s${sufijo}`;
    const tratoExpirable = `e${sufijo}`;
    idsUsuarios.push(vendedorId);
    idsTratos.push(tratoSeguro, tratoExpirable);

    const vendedor = Keypair.random().publicKey();
    await db.insert(users).values({ id: vendedorId, walletAddress: vendedor });
    const base = {
      vendedorId,
      titulo: 'Vencimiento seguro',
      montoUsdc: '1.0000000',
      codigoHash: 'no-usado',
      codigoCifrado: 'no-usado',
      escrowAddress: Keypair.random().publicKey(),
      vendedorAddress: vendedor,
      expiraEn: new Date(Date.now() - 60_000),
    };
    await db.insert(tratos).values([
      { ...base, id: tratoSeguro, memo: `CAS-${tratoSeguro}` },
      { ...base, id: tratoExpirable, memo: `CAS-${tratoExpirable}` },
    ]);
    cadena.fallarBusquedas.add(`CAS-${tratoSeguro}`);

    const resultado = await procesarVencimientos();
    const filas = await db.select().from(tratos).where(inArray(tratos.id, [tratoSeguro, tratoExpirable]));
    const porId = new Map(filas.map((trato) => [trato.id, trato.estado]));

    expect(porId.get(tratoSeguro)).toBe('PUBLICADO');
    expect(porId.get(tratoExpirable)).toBe('EXPIRADO');
    expect(resultado.expirados).toBe(1);
  });
});
