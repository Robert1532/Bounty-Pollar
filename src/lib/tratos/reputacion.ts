import { eq, sql as sqlRaw } from 'drizzle-orm';
import { db, tratos, users, type Trato, type User } from '@/db';
import { log } from '../logger';
import { normalizarMonto } from '../money';
import { estrellasDe, type Estrellas } from './calificaciones';

/**
 * Reputación.
 *
 * Deliberadamente no hay estrellas ni reseñas: son fáciles de comprar y no
 * prueban nada. Lo que Caserita cuenta son hechos que ya ocurrieron y que
 * quedaron en la red — tratos liberados y devueltos — así que el número no se
 * puede inflar sin mover dinero de verdad.
 *
 * Los contadores se actualizan en la misma transición que cierra el trato, y
 * son derivables: `recalcularReputacion` los reconstruye desde la tabla
 * `tratos` si alguna vez quedan desalineados.
 */

export type NivelVendedor = 'nuevo' | 'conocido' | 'confiable' | 'recomendado';

export interface Reputacion {
  ventasCompletadas: number;
  comprasCompletadas: number;
  devolucionesComoVendedor: number;
  devolucionesComoComprador: number;
  volumenVendidoUsdc: string;
  primerTratoEn: string | null;
  nivel: NivelVendedor;
  /** Porcentaje de ventas que terminaron entregadas. `null` sin historial. */
  tasaEntrega: number | null;
  /** Estrellas de compradores anónimos. El promedio se oculta si son pocas. */
  estrellas: Estrellas;
}

const UMBRALES: [NivelVendedor, number][] = [
  ['recomendado', 10],
  ['confiable', 5],
  ['conocido', 1],
];

export function nivelDe(ventasCompletadas: number): NivelVendedor {
  for (const [nivel, minimo] of UMBRALES) {
    if (ventasCompletadas >= minimo) return nivel;
  }
  return 'nuevo';
}

export const ETIQUETA_NIVEL: Record<NivelVendedor, string> = {
  nuevo: 'Vendedor nuevo',
  conocido: 'Vendedor con historial',
  confiable: 'Vendedor confiable',
  recomendado: 'Vendedor recomendado',
};

export function reputacionDe(usuario: {
  ventasCompletadas: number;
  comprasCompletadas: number;
  devolucionesComoVendedor: number;
  devolucionesComoComprador: number;
  volumenVendidoUsdc: string;
  primerTratoEn: Date | null;
  calificacionesRecibidas: number;
  sumaEstrellas: number;
}): Reputacion {
  const cerradosComoVendedor = usuario.ventasCompletadas + usuario.devolucionesComoVendedor;
  return {
    ventasCompletadas: usuario.ventasCompletadas,
    comprasCompletadas: usuario.comprasCompletadas,
    devolucionesComoVendedor: usuario.devolucionesComoVendedor,
    devolucionesComoComprador: usuario.devolucionesComoComprador,
    volumenVendidoUsdc: normalizarMonto(usuario.volumenVendidoUsdc),
    primerTratoEn: usuario.primerTratoEn?.toISOString() ?? null,
    nivel: nivelDe(usuario.ventasCompletadas),
    tasaEntrega:
      cerradosComoVendedor === 0
        ? null
        : Math.round((usuario.ventasCompletadas / cerradosComoVendedor) * 100),
    estrellas: estrellasDe(usuario),
  };
}

/**
 * Suma el resultado de un trato al historial de las dos partes.
 *
 * Se llama una sola vez por trato, desde la transición que de verdad lo cierra
 * (la que afectó filas): si dos peticiones corren a la vez, solo una gana el
 * UPDATE condicionado y solo esa llega hasta acá. Nunca hace fallar la
 * operación principal — el dinero ya se movió, y un contador desalineado se
 * arregla recalculando.
 */
export async function registrarResultado(params: {
  trato: Trato;
  resultado: 'LIBERADO' | 'DEVUELTO';
}): Promise<void> {
  const { trato, resultado } = params;
  const ahora = new Date();

  try {
    if (resultado === 'LIBERADO') {
      await db
        .update(users)
        .set({
          ventasCompletadas: sqlRaw`${users.ventasCompletadas} + 1`,
          // Los tipos se declaran explícitamente: sin el cast, el driver manda
          // el monto como texto y la fecha como objeto, y Postgres rechaza los
          // dos. Es el tipo de error que solo aparece contra una base real.
          volumenVendidoUsdc: sqlRaw`${users.volumenVendidoUsdc} + ${normalizarMonto(trato.montoUsdc)}::numeric`,
          primerTratoEn: sqlRaw`coalesce(${users.primerTratoEn}, ${ahora.toISOString()}::timestamptz)`,
          updatedAt: ahora,
        })
        .where(eq(users.id, trato.vendedorId));

      if (trato.compradorId) {
        await db
          .update(users)
          .set({
            comprasCompletadas: sqlRaw`${users.comprasCompletadas} + 1`,
            primerTratoEn: sqlRaw`coalesce(${users.primerTratoEn}, ${ahora.toISOString()}::timestamptz)`,
            updatedAt: ahora,
          })
          .where(eq(users.id, trato.compradorId));
      }
      return;
    }

    await db
      .update(users)
      .set({
        devolucionesComoVendedor: sqlRaw`${users.devolucionesComoVendedor} + 1`,
        updatedAt: ahora,
      })
      .where(eq(users.id, trato.vendedorId));

    if (trato.compradorId) {
      await db
        .update(users)
        .set({
          devolucionesComoComprador: sqlRaw`${users.devolucionesComoComprador} + 1`,
          updatedAt: ahora,
        })
        .where(eq(users.id, trato.compradorId));
    }
  } catch (error) {
    log.error('no se pudo actualizar la reputación', { tratoId: trato.id, resultado, error });
  }
}

/** La reputación de un usuario por su id. */
export async function reputacionDeUsuario(userId: string): Promise<Reputacion | null> {
  const [usuario] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return usuario ? reputacionDe(usuario) : null;
}

export function reputacionDeUser(usuario: User): Reputacion {
  return reputacionDe(usuario);
}

/**
 * Reconstruye todos los contadores desde la tabla `tratos`. Los contadores son
 * una caché, no la verdad: esto lo demuestra y los deja consistentes.
 */
export async function recalcularReputacion(): Promise<{ usuarios: number }> {
  const resultado = await db.execute(sqlRaw`
    with cerrados as (
      select vendedor_id, comprador_id, estado, monto_usdc, cerrado_en
      from ${tratos}
      where estado in ('LIBERADO', 'DEVUELTO')
    ),
    agregados as (
      select
        u.id,
        coalesce((select count(*) from cerrados c where c.vendedor_id = u.id and c.estado = 'LIBERADO'), 0) as ventas,
        coalesce((select count(*) from cerrados c where c.comprador_id = u.id and c.estado = 'LIBERADO'), 0) as compras,
        coalesce((select count(*) from cerrados c where c.vendedor_id = u.id and c.estado = 'DEVUELTO'), 0) as dev_vend,
        coalesce((select count(*) from cerrados c where c.comprador_id = u.id and c.estado = 'DEVUELTO'), 0) as dev_comp,
        coalesce((select sum(c.monto_usdc) from cerrados c where c.vendedor_id = u.id and c.estado = 'LIBERADO'), 0) as volumen,
        (select min(c.cerrado_en) from cerrados c where c.vendedor_id = u.id or c.comprador_id = u.id) as primero
      from ${users} u
    )
    update ${users} u
    set ventas_completadas = a.ventas,
        compras_completadas = a.compras,
        devoluciones_como_vendedor = a.dev_vend,
        devoluciones_como_comprador = a.dev_comp,
        volumen_vendido_usdc = a.volumen,
        primer_trato_en = a.primero,
        updated_at = now()
    from agregados a
    where u.id = a.id
  `);

  // postgres.js devuelve un Array con `count` encima: en un UPDATE sin
  // RETURNING el array va vacío y la cuenta real vive en esa propiedad.
  const usuarios = (resultado as unknown as { count?: number }).count ?? 0;
  log.info('reputación recalculada', { usuarios });
  return { usuarios };
}
