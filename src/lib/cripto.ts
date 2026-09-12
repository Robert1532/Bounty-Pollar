import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { serverEnv } from './env';

/**
 * Cifrado simetrico para el codigo de entrega.
 *
 * Por que cifrar y no solo hashear: el comprador tiene que poder volver a ver
 * su codigo si cierra la pagina o cambia de telefono, y un hash no se deshace.
 * Asi que el codigo se guarda de las dos formas y cada una sirve a un camino
 * distinto:
 *   - bcrypt  -> verificar lo que ingresa el vendedor.
 *   - AES-GCM -> volver a mostrarselo al comprador, y solo a el.
 * La clave nunca esta en la base: un dump sin el entorno no sirve de nada.
 */

const ALGORITMO = 'aes-256-gcm';
const LARGO_IV = 12;

function clave(): Buffer {
  // HKDF simplificado: la clave de cifrado no es literalmente el secreto del
  // entorno, y esta separada por proposito.
  return createHash('sha256').update(`caserita:codigo:${serverEnv().SESSION_SECRET}`).digest();
}

export function cifrar(texto: string): string {
  const iv = randomBytes(LARGO_IV);
  const cipher = createCipheriv(ALGORITMO, clave(), iv);
  const datos = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${datos.toString('base64url')}`;
}

export function descifrar(paquete: string): string {
  const partes = paquete.split('.');
  if (partes.length !== 3) throw new Error('Paquete cifrado inválido');
  const [ivRaw, tagRaw, datosRaw] = partes as [string, string, string];

  const decipher = createDecipheriv(ALGORITMO, clave(), Buffer.from(ivRaw, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(datosRaw, 'base64url')), decipher.final()]).toString('utf8');
}
