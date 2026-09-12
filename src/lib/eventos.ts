import { db, eventos, type TipoEvento } from '@/db';
import { nuevoId } from './ids';
import { log } from './logger';

/**
 * Log de auditoria. Cada transicion y cada intento fallido deja rastro; es lo
 * que permite reconstruir que paso con un trato sin adivinar.
 *
 * Nunca falla hacia afuera: si no se puede escribir el evento, la operacion
 * principal igual tiene que completarse.
 */
export async function registrarEvento(params: {
  tratoId: string;
  tipo: TipoEvento;
  payload?: Record<string, unknown>;
  actorAddr?: string | null;
  ip?: string | null;
}): Promise<void> {
  try {
    await db.insert(eventos).values({
      id: nuevoId(),
      tratoId: params.tratoId,
      tipo: params.tipo,
      payload: params.payload ?? {},
      actorAddr: params.actorAddr ?? null,
      ip: params.ip ?? null,
    });
  } catch (error) {
    log.error('no se pudo registrar el evento', { tipo: params.tipo, tratoId: params.tratoId, error });
  }
}
