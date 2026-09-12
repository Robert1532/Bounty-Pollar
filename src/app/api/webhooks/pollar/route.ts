import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { serverEnv } from '@/lib/env';
import { manejarError, ok } from '@/lib/http';
import { ErrorApp } from '@/lib/errors';
import { log } from '@/lib/logger';
import { eq } from 'drizzle-orm';
import { db, tratos } from '@/db';
import { confirmarDeposito } from '@/lib/tratos/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Webhooks de Pollar.
 *
 * En la documentacion siguen marcados como "upcoming", asi que la maquina de
 * estados esta disenada para funcionar con polling y cron: esta ruta es una
 * mejora, no un cimiento. Si los eventos se activan, lo unico que hacen es
 * adelantar la confirmacion que igual se haria sola, y la verificacion del
 * deposito sigue siendo contra la red.
 */
export async function POST(req: Request): Promise<NextResponse> {
  try {
    const env = serverEnv();
    const secreto = env.POLLAR_WEBHOOK_SECRET;
    if (!secreto) {
      throw new ErrorApp('SIN_PERMISO', 'Webhooks no configurados.');
    }

    const crudo = await req.text();
    const firma = req.headers.get('x-pollar-signature') ?? '';
    const esperada = createHmac('sha256', secreto).update(crudo).digest('hex');

    const a = Buffer.from(firma.replace(/^sha256=/, ''), 'utf8');
    const b = Buffer.from(esperada, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      log.warn('webhook con firma inválida');
      throw new ErrorApp('SIN_PERMISO', 'Firma inválida.');
    }

    const evento = JSON.parse(crudo) as { type?: string; data?: { memo?: string } };
    log.info('webhook de Pollar recibido', { tipo: evento.type });

    const memo = evento.data?.memo;
    if (memo) {
      const [trato] = await db.select({ id: tratos.id }).from(tratos).where(eq(tratos.memo, memo)).limit(1);
      if (trato) {
        // Igual se verifica contra la red: el webhook solo adelanta el momento.
        await confirmarDeposito({ id: trato.id }).catch((error) =>
          log.warn('el webhook no pudo confirmar todavia', { tratoId: trato.id, error }),
        );
      }
    }

    return ok({ recibido: true });
  } catch (error) {
    return manejarError(error);
  }
}
