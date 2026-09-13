import { NextResponse } from 'next/server';
import { serverEnv } from '@/lib/env';
import { descripcionAsset } from '@/lib/stellar/asset';
import { direccionEscrow } from '@/lib/stellar';
import { almacenamientoHabilitado } from '@/lib/almacenamiento';
import { manejarError } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Configuracion publica que el cliente necesita para poder pagar: a que cuenta,
 * con que asset y con que topes. Nada de esto es secreto; el secreto es la
 * clave que firma, y esa no sale nunca de las rutas de servidor.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const env = serverEnv();
    const asset = descripcionAsset();
    return NextResponse.json({
      ok: true,
      data: {
        red: env.STELLAR_NETWORK,
        escrowAddress: direccionEscrow(),
        asset,
        montoMaximoUsdc: env.MONTO_MAXIMO_USDC,
        montoMinimoUsdc: env.MONTO_MINIMO_USDC,
        horasParaEntregar: env.HORAS_PARA_ENTREGAR,
        tipoCambioBs: env.TIPO_CAMBIO_BS,
        modoMock: env.MODO_MOCK,
        evidenciaHabilitada: almacenamientoHabilitado(),
      },
    });
  } catch (error) {
    return manejarError(error);
  }
}
