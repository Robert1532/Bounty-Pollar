import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { db, authNonces } from '@/db';
import { serverEnv } from '@/lib/env';
import { construirMensajeLogin } from '@/lib/sep53';
import { manejarError, ok, verificarOrigen } from '@/lib/http';
import { ipDe, limitar } from '@/lib/rate-limit';
import { ErrorApp } from '@/lib/errors';
import { direccionStellar } from '@/lib/validaciones';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VIDA_NONCE_MS = 5 * 60 * 1000;

/**
 * Paso 1 del login: el servidor emite un nonce de un solo uso y el mensaje
 * exacto a firmar. Sin esto, una firma capturada una vez serviria para siempre.
 */
export async function POST(req: Request): Promise<NextResponse> {
  try {
    verificarOrigen(req);

    const ip = ipDe(req);
    if (!limitar(`nonce:${ip}`, 20, 60_000).permitido) {
      throw new ErrorApp('DEMASIADOS_INTENTOS', 'Demasiados intentos. Espera un minuto.');
    }

    const { searchParams } = new URL(req.url);
    const direccion = direccionStellar.parse(searchParams.get('direccion') ?? '');

    const env = serverEnv();
    const nonce = randomBytes(24).toString('base64url');
    const emitidoEn = new Date().toISOString();

    await db.insert(authNonces).values({ nonce, expiraEn: new Date(Date.now() + VIDA_NONCE_MS) });

    const mensaje = construirMensajeLogin({
      dominio: new URL(env.APP_URL).host,
      direccion,
      nonce,
      red: env.STELLAR_NETWORK,
      emitidoEn,
    });

    return ok({ mensaje, nonce, expiraEn: new Date(Date.now() + VIDA_NONCE_MS).toISOString() });
  } catch (error) {
    return manejarError(error);
  }
}
