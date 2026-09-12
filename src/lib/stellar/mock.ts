import { randomBytes } from 'node:crypto';
import type { DepositoEncontrado, ResultadoEnvio } from './tipos';

/**
 * Cadena simulada para poder recorrer el flujo completo sin claves de Pollar ni
 * cuenta Stellar. Vive en memoria del proceso y solo se activa con
 * MODO_MOCK=true, que la validacion de entorno prohibe en produccion.
 */

interface DepositoMock {
  memo: string;
  monto: string;
  desde: string;
  hash: string;
  creadoEn: number;
}

const globalMock = globalThis as unknown as { __caseritaMock?: DepositoMock[] };
const depositos: DepositoMock[] = (globalMock.__caseritaMock ??= []);

export function hashFalso(): string {
  return randomBytes(32).toString('hex');
}

export function registrarDepositoMock(params: { memo: string; monto: string; desde: string }): DepositoMock {
  const deposito: DepositoMock = {
    memo: params.memo,
    monto: params.monto,
    desde: params.desde,
    hash: hashFalso(),
    creadoEn: Date.now(),
  };
  depositos.push(deposito);
  return deposito;
}

export function buscarDepositoMock(memo: string): DepositoEncontrado | null {
  const encontrado = depositos.find((d) => d.memo === memo);
  if (!encontrado) return null;
  return {
    hash: encontrado.hash,
    monto: encontrado.monto,
    desde: encontrado.desde,
    memo: encontrado.memo,
    creadoEn: new Date(encontrado.creadoEn).toISOString(),
  };
}

export function enviarMock(): ResultadoEnvio {
  return { hash: hashFalso(), exitoso: true };
}

export function direccionEscrowMock(): string {
  return 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
}
