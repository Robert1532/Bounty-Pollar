import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ErrorApp } from './errors';
import { log } from './logger';
import { serverEnv } from './env';

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ ok: true, data }, { status: 200, ...init });
}

export function creado<T>(data: T): NextResponse {
  return NextResponse.json({ ok: true, data }, { status: 201 });
}

export function fallo(codigo: string, mensaje: string, status: number, detalle?: unknown): NextResponse {
  return NextResponse.json({ ok: false, error: { codigo, mensaje, detalle } }, { status });
}

/**
 * Traduce cualquier excepcion a una respuesta. Los errores de dominio salen con
 * su mensaje; cualquier otra cosa sale como error generico y el detalle queda
 * en el log del servidor, no en la respuesta.
 */
export function manejarError(error: unknown): NextResponse {
  if (error instanceof ErrorApp) {
    return fallo(error.codigo, error.message, error.status, error.detalle);
  }
  if (error instanceof z.ZodError) {
    return fallo(
      'DATOS_INVALIDOS',
      'Revisa los datos del formulario.',
      400,
      error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
    );
  }
  log.error('error no controlado', { error });
  return fallo('INTERNO', 'Algo se rompió de nuestro lado. Intenta de nuevo.', 500);
}

/**
 * Chequeo de origen para toda mutacion: junto con SameSite=Lax cierra el CSRF
 * sin necesidad de un token aparte.
 */
export function verificarOrigen(req: Request): void {
  const origen = req.headers.get('origin');
  if (!origen) return; // curl, cron y same-origin sin Origin
  const permitido = serverEnv().APP_URL;
  try {
    if (new URL(origen).origin !== new URL(permitido).origin) {
      throw new ErrorApp('ORIGEN_INVALIDO', 'Origen no permitido.');
    }
  } catch (e) {
    if (e instanceof ErrorApp) throw e;
    throw new ErrorApp('ORIGEN_INVALIDO', 'Origen no permitido.');
  }
}

export async function leerJson<T>(req: Request, esquema: z.ZodType<T>): Promise<T> {
  let crudo: unknown;
  try {
    crudo = await req.json();
  } catch {
    throw new ErrorApp('DATOS_INVALIDOS', 'El cuerpo de la petición no es JSON válido.');
  }
  return esquema.parse(crudo);
}
