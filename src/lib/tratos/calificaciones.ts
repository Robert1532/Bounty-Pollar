import { and, eq, sql as sqlRaw } from 'drizzle-orm';
import { calificaciones, db, tratos, users, type Trato, type User } from '@/db';
import { errores } from '../errors';
import { registrarEvento } from '../eventos';
import { nuevoId } from '../ids';
import { log } from '../logger';

/**
 * Calificación del vendedor.
 *
 * Tres decisiones que vale la pena defender:
 *
 * 1. **Solo califica quien compró y recibió.** Un trato LIBERADO significa que
 *    hubo dinero real y una entrega confirmada con el código. No se puede
 *    calificar sin haber comprado, así que no hay reseñas de relleno.
 *
 * 2. **Es anónima de verdad.** La fila no guarda quién calificó: el permiso se
 *    valida contra `tratos.comprador_id` al escribir y ahí termina. Ni el
 *    vendedor ni nadie leyendo la tabla puede saber qué puso cada comprador.
 *
 * 3. **El promedio se oculta hasta tener suficientes.** Con una sola
 *    calificación, el vendedor sabe perfectamente de quién vino y qué dijo: el
 *    anonimato se rompe solo. Por eso hasta MINIMO_PARA_MOSTRAR se enseña la
 *    cantidad pero no la nota.
 */

export const MINIMO_PARA_MOSTRAR = 3;

export interface Estrellas {
  /** Promedio 1–5 con un decimal. `null` mientras no haya suficientes. */
  promedio: number | null;
  cantidad: number;
  /** Cuántas faltan para que el promedio deje de estar oculto. */
  faltanParaMostrar: number;
}

export function estrellasDe(usuario: {
  calificacionesRecibidas: number;
  sumaEstrellas: number;
}): Estrellas {
  const cantidad = usuario.calificacionesRecibidas;
  return {
    promedio:
      cantidad >= MINIMO_PARA_MOSTRAR ? Math.round((usuario.sumaEstrellas / cantidad) * 10) / 10 : null,
    cantidad,
    faltanParaMostrar: Math.max(0, MINIMO_PARA_MOSTRAR - cantidad),
  };
}

/** ¿Este usuario puede calificar este trato ahora mismo? */
export function puedeCalificar(trato: Trato, usuario: User | null | undefined): boolean {
  return Boolean(usuario && trato.compradorId === usuario.id && trato.estado === 'LIBERADO');
}

export async function yaFueCalificado(tratoId: string): Promise<boolean> {
  const [fila] = await db
    .select({ id: calificaciones.id })
    .from(calificaciones)
    .where(eq(calificaciones.tratoId, tratoId))
    .limit(1);
  return Boolean(fila);
}

export async function calificar(params: {
  tratoId: string;
  estrellas: number;
  actor: User;
}): Promise<Estrellas> {
  if (!Number.isInteger(params.estrellas) || params.estrellas < 1 || params.estrellas > 5) {
    throw errores.datosInvalidos('La calificación va de 1 a 5 estrellas.');
  }

  const [trato] = await db.select().from(tratos).where(eq(tratos.id, params.tratoId)).limit(1);
  if (!trato) throw errores.noEncontrado();

  if (trato.compradorId !== params.actor.id) {
    throw errores.sinPermiso('Solo quien compró puede calificar este trato.');
  }
  if (trato.estado !== 'LIBERADO') {
    throw errores.estadoInvalido('Puedes calificar cuando la entrega esté completada.');
  }

  // El índice único sobre trato_id es lo que de verdad impide calificar dos
  // veces; `onConflictDoNothing` convierte esa carrera en un no-op silencioso
  // en vez de un error feo.
  const insertadas = await db
    .insert(calificaciones)
    .values({
      id: nuevoId(),
      tratoId: trato.id,
      vendedorId: trato.vendedorId,
      estrellas: params.estrellas,
    })
    .onConflictDoNothing({ target: calificaciones.tratoId })
    .returning({ id: calificaciones.id });

  if (insertadas.length === 0) {
    throw errores.estadoInvalido('Este trato ya fue calificado.');
  }

  await db
    .update(users)
    .set({
      calificacionesRecibidas: sqlRaw`${users.calificacionesRecibidas} + 1`,
      sumaEstrellas: sqlRaw`${users.sumaEstrellas} + ${params.estrellas}`,
      updatedAt: new Date(),
    })
    .where(eq(users.id, trato.vendedorId));

  // El evento no lleva actor: el log de auditoría tampoco debe poder decir
  // quién calificó.
  await registrarEvento({
    tratoId: trato.id,
    tipo: 'CALIFICACION_RECIBIDA',
    payload: { estrellas: params.estrellas },
  });

  const [vendedor] = await db.select().from(users).where(eq(users.id, trato.vendedorId)).limit(1);
  log.info('calificación registrada', { tratoId: trato.id });
  return estrellasDe(vendedor ?? { calificacionesRecibidas: 0, sumaEstrellas: 0 });
}

/**
 * Reconstruye los contadores de estrellas desde la tabla `calificaciones`.
 * Igual que el resto de la reputación: los contadores son caché, la tabla es
 * la verdad.
 */
export async function recalcularEstrellas(): Promise<void> {
  await db.execute(sqlRaw`
    update ${users} u
    set calificaciones_recibidas = coalesce(a.cantidad, 0),
        suma_estrellas = coalesce(a.suma, 0),
        updated_at = now()
    from (
      select u2.id,
             (select count(*) from ${calificaciones} c where c.vendedor_id = u2.id) as cantidad,
             (select sum(c.estrellas) from ${calificaciones} c where c.vendedor_id = u2.id) as suma
      from ${users} u2
    ) a
    where u.id = a.id
  `);
}

/** Cuántas estrellas de cada valor tiene un vendedor. Para el perfil. */
export async function distribucionDe(vendedorId: string): Promise<Record<1 | 2 | 3 | 4 | 5, number>> {
  const filas = await db
    .select({ estrellas: calificaciones.estrellas, cantidad: sqlRaw<number>`count(*)::int` })
    .from(calificaciones)
    .where(and(eq(calificaciones.vendedorId, vendedorId)))
    .groupBy(calificaciones.estrellas);

  const base = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<1 | 2 | 3 | 4 | 5, number>;
  for (const fila of filas) {
    const valor = fila.estrellas as 1 | 2 | 3 | 4 | 5;
    if (valor >= 1 && valor <= 5) base[valor] = Number(fila.cantidad);
  }
  return base;
}
