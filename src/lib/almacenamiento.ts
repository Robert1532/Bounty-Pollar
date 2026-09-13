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
export const MAX_BYTES_AVATAR = 2 * 1024 * 1024;
const SEGUNDOS_URL_FIRMADA = 300;
/**
 * Tiempos generosos a propósito: con un proyecto de Supabase en otra región, o
 * recién despertando de un plan gratuito, diez segundos se quedan cortos y el
 * usuario ve un error donde en realidad solo había que esperar.
 */
const TIMEOUT_FIRMA_MS = 20_000;
const TIMEOUT_DESCARGA_MS = 30_000;

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

/** Avatar cuadrado o retrato del usuario, guardado en el mismo bucket privado. */
export async function guardarAvatar(params: {
  usuarioId: string;
  datos: Uint8Array;
}): Promise<ArchivoGuardado> {
  const tipo = detectarTipoImagen(params.datos);
  if (!tipo) throw errores.datosInvalidos('Solo aceptamos fotos JPG, PNG o WEBP.');
  if (params.datos.byteLength > MAX_BYTES_AVATAR) {
    throw errores.datosInvalidos('La foto de perfil no puede pesar más de 2 MB.');
  }

  const ruta = `perfiles/${params.usuarioId}/${randomBytes(12).toString('hex')}.${extensionDe(tipo)}`;
  const archivo: ArchivoGuardado = {
    ruta,
    tipo,
    bytes: params.datos.byteLength,
    hash: hashDe(params.datos),
  };
  if (usaSupabase()) await subirASupabase(ruta, params.datos, tipo);
  else memoria.set(ruta, { datos: new Uint8Array(params.datos), tipo });
  return archivo;
}

export const descargarAvatar = descargarEvidencia;
export const borrarAvatar = borrarEvidencia;

/**
 * Une el origen de Supabase con lo que devuelve la API de firma.
 *
 * Ese campo llega en tres formas distintas según la versión: una URL completa,
 * una ruta con barra inicial, o una ruta sin barra. Concatenar a ciegas produce
 * cosas como `https://x.supabase.co/storage/v1https://x.supabase.co/...`, que el
 * navegador muestra como imagen rota sin decir por qué.
 */
export function armarUrlFirmada(origen: string, firmada: string): string {
  if (/^https?:\/\//i.test(firmada)) return firmada;

  const base = origen.replace(/\/+$/, '');
  const ruta = firmada.replace(/^\/+/, '');
  // La API puede devolver la ruta con o sin el prefijo `storage/v1`.
  return ruta.startsWith('storage/v1/') ? `${base}/${ruta}` : `${base}/storage/v1/${ruta}`;
}

/**
 * URL para mostrar la foto.
 *
 * Con Supabase se pide una URL firmada que caduca a los 5 minutos. Si la firma
 * falla o tarda demasiado, NO se rompe la pantalla: se devuelve la ruta propia,
 * que sirve los mismos bytes comprobando la sesión. Una foto de entrega es una
 * ayuda, no una pieza crítica — que un timeout de Supabase tire un 500 en la
 * página del trato es peor que servirla por el camino lento.
 */
export async function urlDeEvidencia(params: { tratoId: string; ruta: string }): Promise<string> {
  const respaldo = `/api/tratos/${params.tratoId}/evidencia/archivo`;
  if (!usaSupabase()) return respaldo;

  const env = serverEnv();
  try {
    const respuesta = await fetch(
      `${env.SUPABASE_URL}/storage/v1/object/sign/${env.SUPABASE_BUCKET_EVIDENCIAS}/${params.ruta}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ expiresIn: SEGUNDOS_URL_FIRMADA }),
        signal: AbortSignal.timeout(TIMEOUT_FIRMA_MS),
      },
    );

    if (!respuesta.ok) {
      log.warn('Supabase no firmó la URL; se sirve por la ruta propia', { status: respuesta.status });
      return respaldo;
    }

    const cuerpo = (await respuesta.json()) as { signedURL?: string; signedUrl?: string };
    const firmada = cuerpo.signedURL ?? cuerpo.signedUrl;
    if (!firmada) return respaldo;

    return armarUrlFirmada(env.SUPABASE_URL as string, firmada);
  } catch (error) {
    log.warn('no se pudo firmar la URL de la evidencia; se sirve por la ruta propia', { error });
    return respaldo;
  }
}

/**
 * Descarga los bytes de la foto desde Supabase, para servirlos por la ruta
 * propia cuando la URL firmada no está disponible.
 */
export async function descargarEvidencia(
  ruta: string,
): Promise<{ datos: Uint8Array; tipo: string } | null> {
  if (!usaSupabase()) {
    const local = leerEvidenciaLocal(ruta);
    return local ? { datos: local.datos, tipo: local.tipo } : null;
  }

  const env = serverEnv();
  try {
    const respuesta = await fetch(
      `${env.SUPABASE_URL}/storage/v1/object/${env.SUPABASE_BUCKET_EVIDENCIAS}/${ruta}`,
      {
        headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
        signal: AbortSignal.timeout(TIMEOUT_DESCARGA_MS),
      },
    );
    if (!respuesta.ok) {
      log.error('Supabase no devolvió la evidencia', { status: respuesta.status });
      return null;
    }
    return {
      datos: new Uint8Array(await respuesta.arrayBuffer()),
      tipo: respuesta.headers.get('content-type') ?? 'image/jpeg',
    };
  } catch (error) {
    log.error('no se pudo descargar la evidencia', { error });
    return null;
  }
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
