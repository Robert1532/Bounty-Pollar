import { serverEnv } from '../env';
import * as horizon from './horizon';
import * as mock from './mock';
import type { DepositoEncontrado, ResultadoEnvio } from './tipos';

export type { DepositoEncontrado, ResultadoEnvio } from './tipos';

/**
 * Fachada de la cadena. Todo el resto de la app habla con estas cuatro
 * funciones y no sabe si detras hay Horizon o la simulacion: eso mantiene el
 * modo demo honesto (mismo camino de codigo) y deja un solo lugar por donde
 * pasa el dinero.
 */

function esMock(): boolean {
  return serverEnv().MODO_MOCK;
}

export function direccionEscrow(): string {
  return esMock() ? mock.direccionEscrowMock() : horizon.parEscrow().publicKey();
}

export async function buscarDeposito(params: {
  memo: string;
  montoMinimo: string;
}): Promise<DepositoEncontrado | null> {
  if (esMock()) return mock.buscarDepositoMock(params.memo);
  return horizon.buscarDeposito(params);
}

export async function enviarDesdeEscrow(params: {
  destino: string;
  monto: string;
  memo: string;
  alConstruir?: (hash: string) => Promise<void>;
}): Promise<ResultadoEnvio> {
  if (esMock()) {
    const resultado = mock.enviarMock();
    await params.alConstruir?.(resultado.hash);
    return resultado;
  }
  return horizon.enviarDesdeEscrow(params);
}

export async function consultarTx(hash: string): Promise<{ exitoso: boolean } | null> {
  if (esMock()) return { exitoso: true };
  return horizon.consultarTx(hash);
}

export async function saldoEscrow(): Promise<{ usdc: string; xlm: string }> {
  if (esMock()) return { usdc: '0', xlm: '0' };
  return horizon.saldoEscrow();
}

export { registrarDepositoMock } from './mock';
