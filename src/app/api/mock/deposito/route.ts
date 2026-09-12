import { NextResponse } from 'next/server';
import { serverEnv } from '@/lib/env';
import { leerJson, manejarError, ok, verificarOrigen } from '@/lib/http';
import { ErrorApp } from '@/lib/errors';
import { depositoMockSchema } from '@/lib/validaciones';
import { registrarDepositoMock } from '@/lib/stellar';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Simula el deposito del comprador. Existe solo para poder recorrer el flujo
 * completo sin claves de Pollar ni cuenta Stellar; con MODO_MOCK apagado
 * responde 403, y la validacion de entorno prohibe MODO_MOCK en produccion.
 */
export async function POST(req: Request): Promise<NextResponse> {
  try {
    verificarOrigen(req);
    if (!serverEnv().MODO_MOCK) {
      throw new ErrorApp('SIN_PERMISO', 'Disponible solo en modo demo.');
    }
    const datos = await leerJson(req, depositoMockSchema);
    const deposito = registrarDepositoMock(datos);
    return ok(deposito);
  } catch (error) {
    return manejarError(error);
  }
}
