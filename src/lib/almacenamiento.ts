import { createHash, randomBytes } from 'node:crypto';
import { serverEnv } from './env';
import { errores } from './errors';
import { log } from './logger';

/**
 * Guardado de archivos para la evidencia de entrega.
 *
 * Dos implementaciones detrás de la misma interfaz: Supabase Storage cuando hay
 * credenciales, y un almacén en memoria para el modo demo y las pruebas. La app
 * no sabe cuál está corriendo.
 *
 * Reglas que no se negocian:
 *   - El bucket es privado. La base guarda la ruta, nunca una URL pública.
 *   - El tipo de archivo se decide por los bytes, no por lo que diga el cliente:
 *     un `Content-Type: image/png` es un campo de texto que cualquiera escribe.
 *   - La service role key vive solo en el servidor. Si llegara al navegador, ya
 *     no habría bucket privado que valga.
 */

export const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type TipoImagen = (typeof TIPOS_PERMITIDOS)[number];

export const MAX_BYTES_EVIDENCIA = 5 * 1024 * 1024;
const SEGUNDOS_URL_FIRMADA = 300;

/** Firmas binarias. El navegador puede mentir en la cabecera; los bytes no. */
export function detectarTipoImagen(datos: Uint8Array): TipoImagen | null {
  if (datos.length < 12) return null;

  const empiezaCon = (bytes: number[], desde = 0) =>
    bytes.every((valor, i) => datos[desde + i] === valor);

  if (empiezaCon([0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (empiezaCon([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  // RIFF....WEBP
  if (empiezaCon([0x52, 0x49, 0x46, 0x46]) && empiezaCon([0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp';
  return null;
}

export function extensionDe(tipo: TipoImagen): string {
  return tipo === 'image/jpeg' ? 'jpg' : tipo === 'image/png' ? 'png' : 'webp';
}

export function hashDe(datos: Uint8Array): string {
  return createHash('sha256').update(datos).digest('hex');
}

export interface ArchivoGuardado {
  ruta: string;
  tipo: TipoImagen;
  bytes: number;
  hash: string;
}

/** ¿Se puede adjuntar evidencia en este despliegue? */
export function almacenamientoHabilitado(): boolean {
  const env = serverEnv();
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) || env.MODO_MOCK;
}

function usaSupabase(): boolean {
  const env = serverEnv();
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function guardarEvidencia(params: {
  tratoId: string;
  datos: Uint8Array;
}): Promise<ArchivoGuardado> {
  const tipo = detectarTipoImagen(params.datos);
  if (!tipo) {
    throw errores.datosInvalidos('Solo aceptamos fotos JPG, PNG o WEBP.');
  }
  if (params.datos.byteLength > MAX_BYTES_EVIDENCIA) {
    throw errores.datosInvalidos('La foto no puede pesar más de 5 MB.');
  }

  // Nombre imposible de adivinar: aunque el bucket dejara de ser privado, la
  // ruta no se deduce del id del trato.
  const ruta = `${params.tratoId}/${randomBytes(12).toString('hex')}.${extensionDe(tipo)}`;
  const archivo: ArchivoGuardado = {
    ruta,
    tipo,
    bytes: params.datos.byteLength,
    hash: hashDe(params.datos),
  };

  if (usaSupabase()) {
    await subirASupabase(ruta, params.datos, tipo);
  } else {
    memoria.set(ruta, { datos: new Uint8Array(params.datos), tipo });
  }
  return archivo;
}

/**
 * URL para mostrar la foto. Con Supabase es una URL firmada de 5 minutos; en
 * modo demo, una ruta propia que vuelve a comprobar la sesión. En los dos casos
 * caduca o está autenticada: la foto nunca queda colgada en internet.
 */
export async function urlDeEvidencia(params: { tratoId: string; ruta: string }): Promise<string> {
  if (!usaSupabase()) return `/api/tratos/${params.tratoId}/evidencia/archivo`;

  const env = serverEnv();
  const respuesta = await fetch(
    `${env.SUPABASE_URL}/storage/v1/object/sign/${env.SUPABASE_BUCKET_EVIDENCIAS}/${params.ruta}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expiresIn: SEGUNDOS_URL_FIRMADA }),
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (!respuesta.ok) {
    log.error('Supabase no firmó la URL de la evidencia', { status: respuesta.status });
    throw errores.cadena('No pudimos abrir la foto de la entrega.');
  }

  const cuerpo = (await respuesta.json()) as { signedURL?: string; signedUrl?: string };
  const firmada = cuerpo.signedURL ?? cuerpo.signedUrl;
  if (!firmada) throw errores.cadena('No pudimos abrir la foto de la entrega.');
  return `${env.SUPABASE_URL}/storage/v1${firmada.startsWith('/') ? '' : '/'}${firmada}`;
}

/** Solo para el modo demo: sirve los bytes desde la ruta autenticada. */
export function leerEvidenciaLocal(ruta: string): { datos: Uint8Array; tipo: TipoImagen } | null {
  return memoria.get(ruta) ?? null;
}

export async function borrarEvidencia(ruta: string): Promise<void> {
  if (!usaSupabase()) {
    memoria.delete(ruta);
    return;
  }
  const env = serverEnv();
  await fetch(`${env.SUPABASE_URL}/storage/v1/object/${env.SUPABASE_BUCKET_EVIDENCIAS}/${ruta}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
    signal: AbortSignal.timeout(10_000),
  }).catch((error) => log.warn('no se pudo borrar la evidencia anterior', { error }));
}

async function subirASupabase(ruta: string, datos: Uint8Array, tipo: TipoImagen): Promise<void> {
  const env = serverEnv();
  const respuesta = await fetch(
    `${env.SUPABASE_URL}/storage/v1/object/${env.SUPABASE_BUCKET_EVIDENCIAS}/${ruta}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': tipo,
        'cache-control': 'private, max-age=31536000',
        'x-upsert': 'false',
      },
      body: Buffer.from(datos) as unknown as BodyInit,
      signal: AbortSignal.timeout(20_000),
    },
  );

  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => '');
    log.error('Supabase rechazó la subida', { status: respuesta.status, detalle: detalle.slice(0, 200) });
    if (respuesta.status === 404) {
      throw errores.cadena(
        `Falta el bucket "${env.SUPABASE_BUCKET_EVIDENCIAS}" en Supabase Storage. Créalo como privado.`,
      );
    }
    throw errores.cadena('No pudimos guardar la foto. Intenta de nuevo.');
  }
}

/** Almacén del modo demo. Vive en el proceso y se pierde al reiniciar: es a propósito. */
const global_ = globalThis as unknown as {
  __caseritaArchivos?: Map<string, { datos: Uint8Array; tipo: TipoImagen }>;
};
const memoria = (global_.__caseritaArchivos ??= new Map());
