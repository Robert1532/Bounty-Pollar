import { randomInt, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';

/**
 * El codigo de entrega de 6 digitos es la unica palanca del comprador: mientras
 * no lo entregue, la plata sigue siendo suya. Por eso:
 *   - se genera con un CSPRNG, no con Math.random
 *   - se guarda hasheado con bcrypt, nunca en claro
 *   - se limita a 5 intentos: 10^6 combinaciones se rompen en minutos si dejas
 *     que alguien pruebe sin freno.
 */

export const LARGO_CODIGO = 6;
export const MAX_INTENTOS = 5;
const ROUNDS = 10;

export function generarCodigo(): string {
  let codigo = '';
  for (let i = 0; i < LARGO_CODIGO; i++) {
    codigo += randomInt(0, 10).toString();
  }
  return codigo;
}

export function esFormatoValido(codigo: string): boolean {
  return new RegExp(`^\\d{${LARGO_CODIGO}}$`).test(codigo);
}

export async function hashearCodigo(codigo: string): Promise<string> {
  if (!esFormatoValido(codigo)) throw new Error('Formato de código inválido');
  return bcrypt.hash(codigo, ROUNDS);
}

export async function verificarCodigo(codigo: string, hash: string): Promise<boolean> {
  if (!esFormatoValido(codigo)) return false;
  return bcrypt.compare(codigo, hash);
}

/** Comparacion en tiempo constante para tokens y secretos cortos. */
export function igualSeguro(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Formato visual: 123 456 */
export function formatearCodigo(codigo: string): string {
  return `${codigo.slice(0, 3)} ${codigo.slice(3)}`;
}
