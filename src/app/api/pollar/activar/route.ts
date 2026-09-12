import { NextResponse } from 'next/server';
import { requerirUsuario } from '@/lib/auth';
import { serverEnv } from '@/lib/env';
import { manejarError, ok, verificarOrigen } from '@/lib/http';
import { ErrorApp } from '@/lib/errors';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Activacion de la wallet en modo Deferred (Pollar server API).
 *
 * Con funding mode Immediate esto no hace falta: Pollar deja la cuenta lista al
 * hacer login. Con Deferred la G... se crea sin reserva y hay que pedir el
 * patrocinio desde el backend — que es donde vive la clave secreta, porque
 * mandarla al navegador seria regalarla.
 *
 * Es idempotente del lado de Pollar: un 409 significa "ya estaba fondeada" y se
 * trata como exito.
 */
export async function POST(req: Request): Promise<NextResponse> {
  try {
    verificarOrigen(req);
    const usuario = await requerirUsuario();
    const env = serverEnv();

    if (env.MODO_MOCK) return ok({ activada: true, modo: 'demo' });
    if (!env.POLLAR_SECRET_KEY) {
      throw new ErrorApp('INTERNO', 'Falta POLLAR_SECRET_KEY en el servidor.');
    }

    const respuesta = await fetch('https://server.api.pollar.xyz/v1/wallets/fund', {
      method: 'POST',
      headers: {
        'x-pollar-api-key': env.POLLAR_SECRET_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ publicKey: usuario.walletAddress }),
      signal: AbortSignal.timeout(15_000),
    });

    if (respuesta.status === 409) return ok({ activada: true, yaEstaba: true });

    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => '');
      log.error('Pollar no pudo fondear la wallet', { status: respuesta.status, detalle: detalle.slice(0, 300) });
      if (respuesta.status === 402) {
        throw new ErrorApp('INTERNO', 'La wallet de gas de la app se quedo sin XLM.');
      }
      throw new ErrorApp('INTERNO', 'No pudimos activar tu wallet. Intenta de nuevo.');
    }

    return ok({ activada: true });
  } catch (error) {
    return manejarError(error);
  }
}
