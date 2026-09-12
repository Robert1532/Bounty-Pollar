/**
 * Dinero en enteros. USDC en Stellar tiene 7 decimales (stroops), asi que todo
 * se maneja internamente como bigint de stroops y solo se convierte a string
 * decimal en los bordes. Nunca un `number` en el medio de una cuenta.
 */

export const DECIMALES_USDC = 7;
const FACTOR = 10n ** BigInt(DECIMALES_USDC);

const RE_DECIMAL = /^\d{1,12}(\.\d{1,7})?$/;

export class MontoInvalido extends Error {}

/** "12.50" -> 125000000n */
export function aStroops(monto: string): bigint {
  const limpio = monto.trim();
  if (!RE_DECIMAL.test(limpio)) {
    throw new MontoInvalido(`Monto inválido: ${monto}`);
  }
  const [enteraRaw, decimalRaw = ''] = limpio.split('.');
  const entera = enteraRaw ?? '0';
  const decimal = decimalRaw.padEnd(DECIMALES_USDC, '0');
  return BigInt(entera) * FACTOR + BigInt(decimal || '0');
}

/** 125000000n -> "12.5000000" (formato que espera Stellar) */
export function aDecimal(stroops: bigint): string {
  const negativo = stroops < 0n;
  const abs = negativo ? -stroops : stroops;
  const entera = abs / FACTOR;
  const resto = (abs % FACTOR).toString().padStart(DECIMALES_USDC, '0');
  return `${negativo ? '-' : ''}${entera}.${resto}`;
}

/** Normaliza cualquier decimal valido al formato canonico de 7 decimales. */
export function normalizarMonto(monto: string): string {
  return aDecimal(aStroops(monto));
}

/** "12.5000000" -> "12.50" para mostrar en pantalla. */
export function formatearUsdc(monto: string | number): string {
  const n = typeof monto === 'number' ? monto : Number(monto);
  return n.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatearBs(monto: string | number): string {
  const n = typeof monto === 'number' ? monto : Number(monto);
  return n.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Bolivianos -> USDC, redondeado hacia arriba al centavo para no quedar corto. */
export function bsAUsdc(bs: number, tipoCambio: number): string {
  if (!Number.isFinite(bs) || bs <= 0) throw new MontoInvalido('Monto en Bs inválido');
  if (!Number.isFinite(tipoCambio) || tipoCambio <= 0) throw new MontoInvalido('Tipo de cambio inválido');
  const centavos = Math.ceil((bs / tipoCambio) * 100);
  return normalizarMonto((centavos / 100).toFixed(2));
}

export function usdcABs(usdc: string | number, tipoCambio: number): number {
  const n = typeof usdc === 'number' ? usdc : Number(usdc);
  return Math.round(n * tipoCambio * 100) / 100;
}

/** Compara dos montos decimales sin pasar por float. */
export function montosIguales(a: string, b: string): boolean {
  return aStroops(a) === aStroops(b);
}

export function montoMayorOIgual(a: string, b: string): boolean {
  return aStroops(a) >= aStroops(b);
}
