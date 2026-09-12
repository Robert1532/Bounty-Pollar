'use client';

/**
 * Cliente HTTP del navegador. Una sola forma de respuesta ({ ok, data } o
 * { ok, error }) para no repetir el manejo de errores en cada pantalla.
 */

export class ErrorApi extends Error {
  readonly codigo: string;
  readonly status: number;

  constructor(codigo: string, mensaje: string, status: number) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.codigo = codigo;
    this.status = status;
  }
}

interface RespuestaOk<T> {
  ok: true;
  data: T;
}
interface RespuestaError {
  ok: false;
  error: { codigo: string; mensaje: string };
}

export async function api<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  const res = await fetch(ruta, {
    ...opciones,
    headers: {
      ...(opciones.body ? { 'Content-Type': 'application/json' } : {}),
      ...opciones.headers,
    },
    credentials: 'same-origin',
  });

  let cuerpo: RespuestaOk<T> | RespuestaError;
  try {
    cuerpo = (await res.json()) as RespuestaOk<T> | RespuestaError;
  } catch {
    throw new ErrorApi('INTERNO', 'El servidor respondió algo que no entendemos.', res.status);
  }

  if (!res.ok || cuerpo.ok === false) {
    const error = 'error' in cuerpo ? cuerpo.error : undefined;
    throw new ErrorApi(error?.codigo ?? 'INTERNO', error?.mensaje ?? 'Algo salió mal.', res.status);
  }

  return cuerpo.data;
}

export const get = <T,>(ruta: string) => api<T>(ruta);
export const post = <T,>(ruta: string, cuerpo?: unknown) =>
  api<T>(ruta, { method: 'POST', body: cuerpo ? JSON.stringify(cuerpo) : undefined });
export const del = <T,>(ruta: string) => api<T>(ruta, { method: 'DELETE' });
