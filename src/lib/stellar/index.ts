import { serverEnv } from '../env';
import * as horizon from './horizon';
import * as mock from './mock';
import type { ResultadoBusquedaDeposito, ResultadoEnvio } from './tipos';

export type { DepositoEncontrado, ResultadoBusquedaDeposito, ResultadoEnvio } from './tipos';

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
  montoEsperado: string;
  hash?: string;
}): Promise<ResultadoBusquedaDeposito> {
  if (esMock()) {
    return params.hash
      ? mock.buscarDepositoMockPorHash(params.hash, params.montoEsperado)
      : mock.buscarDepositoMock(params.memo, params.montoEsperado);
  }
  if (params.hash) return horizon.buscarDepositoPorHash({ ...params, hash: params.hash });
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
    try {
      await params.alConstruir?.(resultado.hash);
    } catch (error) {
      const { errores } = await import('../errors');
      throw errores.cadena('No se pudo guardar la operación antes de enviarla.', {
        hash: resultado.hash,
        resultado: 'NO_ENVIADA',
        causa: error instanceof Error ? error.message : 'desconocida',
      });
    }
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

export async function diagnosticoEscrow(): Promise<{
  direccion: string;
  existe: boolean;
  aceptaUsdc: boolean;
  saldoUsdc: string | null;
  saldoXlm: string | null;
}> {
  if (esMock()) {
    return {
      direccion: mock.direccionEscrowMock(),
      existe: true,
      aceptaUsdc: true,
      saldoUsdc: '0',
      saldoXlm: '0',
    };
  }
  return horizon.diagnosticoEscrow();
}

export { registrarDepositoMock } from './mock';
