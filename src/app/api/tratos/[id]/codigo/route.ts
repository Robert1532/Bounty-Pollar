import { NextResponse } from 'next/server';
import { requerirUsuario } from '@/lib/auth';
import { manejarError, ok } from '@/lib/http';
import { ipDe, limitar } from '@/lib/rate-limit';
import { ErrorApp } from '@/lib/errors';
import { idTrato } from '@/lib/validaciones';
import { codigoParaComprador } from '@/lib/tratos/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * El codigo de entrega, y solo para el comprador autenticado. No se cachea, no
 * se manda en la vista del trato y no aparece en ningun log.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const usuario = await requerirUsuario();
    const { id } = await ctx.params;
    const tratoId = idTrato.parse(id);

    if (!limitar(`codigo:${tratoId}:${ipDe(req)}`, 30, 60_000).permitido) {
      throw new ErrorApp('DEMASIADOS_INTENTOS', 'Demasiadas consultas. Espera un momento.');
    }

    const codigo = await codigoParaComprador({ id: tratoId, actor: usuario });
    return ok({ codigo }, { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) {
    return manejarError(error);
  }
}
