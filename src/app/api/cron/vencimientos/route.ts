import { NextResponse } from 'next/server';
import { serverEnv } from '@/lib/env';
import { igualSeguro } from '@/lib/codigo';
import { manejarError, ok } from '@/lib/http';
import { ErrorApp } from '@/lib/errors';
import { procesarVencimientos } from '@/lib/tratos/service';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Corre cada 15 minutos (Vercel Cron): expira lo que nadie pago y devuelve lo
 * que paso el plazo de entrega.
 *
 * Esta ruta *es* el sistema de disputas de la v1. Por eso esta protegida con un
 * secreto y no con la sesion: la dispara la plataforma, no una persona.
 */
async function correr(req: Request): Promise<NextResponse> {
  try {
    const env = serverEnv();
    const cabecera = req.headers.get('authorization') ?? '';
    const esperado = `Bearer ${env.CRON_SECRET}`;

    if (!igualSeguro(cabecera, esperado)) {
      log.warn('intento de cron sin autorizacion');
      throw new ErrorApp('SIN_PERMISO', 'No autorizado.');
    }

    const resultado = await procesarVencimientos();
    return ok(resultado);
  } catch (error) {
    return manejarError(error);
  }
}

export const GET = correr;
export const POST = correr;
