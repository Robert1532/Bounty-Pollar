type Nivel = 'debug' | 'info' | 'warn' | 'error';

const ORDEN: Record<Nivel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const MINIMO: Nivel = process.env.NODE_ENV === 'production' ? 'info' : 'debug';

/** Claves que nunca deben salir en un log, ni en desarrollo. */
const PALABRAS_SENSIBLES = new Set([
  'codigo',
  'password',
  'secret',
  'authorization',
  'cookie',
  'token',
  'signature',
  'firma',
  'seed',
]);

function esClaveSensible(clave: string): boolean {
  const normalizada = clave
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_');
  const palabras = normalizada.split('_').filter(Boolean);
  return palabras.some((palabra) => PALABRAS_SENSIBLES.has(palabra)) ||
    (palabras.includes('private') && palabras.includes('key'));
}

function sanitizar(valor: unknown, profundidad = 0): unknown {
  if (profundidad > 4) return '[...]';
  if (valor instanceof Error) {
    const error = valor as Error & {
      code?: string;
      detail?: string;
      hint?: string;
      position?: string;
    };
    return {
      name: error.name,
      message: error.message,
      ...(error.code ? { code: error.code } : {}),
      ...(error.detail ? { detail: error.detail } : {}),
      ...(error.hint ? { hint: error.hint } : {}),
      ...(error.position ? { position: error.position } : {}),
      ...(error.cause ? { cause: sanitizar(error.cause, profundidad + 1) } : {}),
    };
  }
  if (Array.isArray(valor)) return valor.map((v) => sanitizar(v, profundidad + 1));
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(
      Object.entries(valor as Record<string, unknown>).map(([k, v]) => [
        k,
        esClaveSensible(k) ? '[oculto]' : sanitizar(v, profundidad + 1),
      ]),
    );
  }
  return valor;
}

function emitir(nivel: Nivel, mensaje: string, contexto?: Record<string, unknown>) {
  if (ORDEN[nivel] < ORDEN[MINIMO]) return;
  const linea = {
    ts: new Date().toISOString(),
    nivel,
    mensaje,
    ...(contexto ? { ctx: sanitizar(contexto) as Record<string, unknown> } : {}),
  };
  const salida = nivel === 'error' ? console.error : nivel === 'warn' ? console.warn : console.log;
  salida(JSON.stringify(linea));
}

export const log = {
  debug: (m: string, c?: Record<string, unknown>) => emitir('debug', m, c),
  info: (m: string, c?: Record<string, unknown>) => emitir('info', m, c),
  warn: (m: string, c?: Record<string, unknown>) => emitir('warn', m, c),
  error: (m: string, c?: Record<string, unknown>) => emitir('error', m, c),
};
