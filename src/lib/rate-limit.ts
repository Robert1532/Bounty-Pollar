import { log } from './logger';

/**
 * Limitador por ventana fija, en memoria. Sirve para una instancia y para un
 * buildathon; en varias instancias lo correcto es Redis o Upstash, y esta
 * marcado como tal en el README. Los limites que de verdad importan (intentos
 * del codigo de entrega) viven en la base, no aca.
 */

interface Cubeta {
  cuenta: number;
  reinicioEn: number;
}

const cubetas = new Map<string, Cubeta>();
const MAX_CLAVES = 10_000;

export interface ResultadoLimite {
  permitido: boolean;
  restantes: number;
  reinicioEn: number;
}

export function limitar(clave: string, maximo: number, ventanaMs: number): ResultadoLimite {
  const ahora = Date.now();
  const actual = cubetas.get(clave);

  if (!actual || actual.reinicioEn <= ahora) {
    if (cubetas.size > MAX_CLAVES) limpiar(ahora);
    const cubeta = { cuenta: 1, reinicioEn: ahora + ventanaMs };
    cubetas.set(clave, cubeta);
    return { permitido: true, restantes: maximo - 1, reinicioEn: cubeta.reinicioEn };
  }

  actual.cuenta += 1;
  const permitido = actual.cuenta <= maximo;
  if (!permitido) {
    log.warn('limite de peticiones alcanzado', { clave: clave.split(':')[0], cuenta: actual.cuenta });
  }
  return {
    permitido,
    restantes: Math.max(0, maximo - actual.cuenta),
    reinicioEn: actual.reinicioEn,
  };
}

function limpiar(ahora: number) {
  for (const [clave, cubeta] of cubetas) {
    if (cubeta.reinicioEn <= ahora) cubetas.delete(clave);
  }
  if (cubetas.size > MAX_CLAVES) cubetas.clear();
}

/** IP del cliente detras del proxy de Vercel. */
export function ipDe(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]?.trim() ?? 'desconocida';
  return req.headers.get('x-real-ip') ?? 'desconocida';
}
