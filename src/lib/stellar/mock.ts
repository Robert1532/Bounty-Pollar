import { randomBytes } from 'node:crypto';
import { aStroops } from '../money';
import type { DepositoEncontrado, ResultadoBusquedaDeposito, ResultadoEnvio } from './tipos';

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

function resultadoDeposito(encontrado: DepositoMock | undefined, montoEsperado: string): ResultadoBusquedaDeposito {
  if (!encontrado) return { estado: 'NO_ENCONTRADO' };
  const deposito: DepositoEncontrado = {
    hash: encontrado.hash,
    monto: encontrado.monto,
    desde: encontrado.desde,
    memo: encontrado.memo,
    creadoEn: new Date(encontrado.creadoEn).toISOString(),
  };
  return aStroops(encontrado.monto) === aStroops(montoEsperado)
    ? { estado: 'ENCONTRADO', deposito }
    : { estado: 'MONTO_INCORRECTO', deposito };
}

export function buscarDepositoMock(memo: string, montoEsperado: string): ResultadoBusquedaDeposito {
  return resultadoDeposito(depositos.find((d) => d.memo === memo), montoEsperado);
}

export function buscarDepositoMockPorHash(hash: string, montoEsperado: string): ResultadoBusquedaDeposito {
  return resultadoDeposito(depositos.find((d) => d.hash === hash), montoEsperado);
}

export function enviarMock(): ResultadoEnvio {
  return { hash: hashFalso(), exitoso: true };
}

export function direccionEscrowMock(): string {
  return 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
}
