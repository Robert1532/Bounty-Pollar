import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requerirUsuario } from '@/lib/auth';
import { leerJson, manejarError, ok, verificarOrigen } from '@/lib/http';
import { ipDe, limitar } from '@/lib/rate-limit';
import { ErrorApp } from '@/lib/errors';
import { idTrato } from '@/lib/validaciones';
import { calificar } from '@/lib/tratos/calificaciones';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ estrellas: z.number().int().min(1).max(5) }).strict();

/**
 * El comprador califica al vendedor: de 1 a 5 estrellas, una sola vez por
 * trato y solo con la entrega ya completada.
 *
 * La respuesta devuelve el resultado agregado del vendedor, nunca la
 * calificación individual: ni siquiera quien acaba de calificar recibe de
 * vuelta un identificador que la ate a él.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    verificarOrigen(req);
    const usuario = await requerirUsuario();
    const { id } = await ctx.params;
    const tratoId = idTrato.parse(id);

    if (!limitar(`calificar:${ipDe(req)}`, 20, 10 * 60_000).permitido) {
      throw new ErrorApp('DEMASIADOS_INTENTOS', 'Demasiados intentos. Espera unos minutos.');
    }

    const { estrellas } = await leerJson(req, schema);
    const resultado = await calificar({ tratoId, estrellas, actor: usuario });

    return ok(resultado, { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) {
    return manejarError(error);
  }
}
