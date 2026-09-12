import { NextResponse } from 'next/server';
import { requerirUsuario } from '@/lib/auth';
import { leerJson, manejarError, ok, verificarOrigen } from '@/lib/http';
import { ipDe, limitar } from '@/lib/rate-limit';
import { ErrorApp } from '@/lib/errors';
import { idTrato, liberarSchema } from '@/lib/validaciones';
import { liberar } from '@/lib/tratos/service';
import { aTratoPublico } from '@/lib/tratos/dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * El vendedor ingresa el codigo de 6 digitos y cobra.
 *
 * Doble freno contra fuerza bruta: un limite por IP y trato en memoria, y el
 * contador de 5 intentos persistido en la base, que es el que de verdad manda.
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

    const ip = ipDe(req);
    if (!limitar(`liberar:${tratoId}:${ip}`, 10, 5 * 60_000).permitido) {
      throw new ErrorApp('DEMASIADOS_INTENTOS', 'Demasiados intentos seguidos. Espera unos minutos.');
    }

    const { codigo } = await leerJson(req, liberarSchema);
    const trato = await liberar({ id: tratoId, codigo, actor: usuario, ip });
    return ok(aTratoPublico(trato, usuario));
  } catch (error) {
    return manejarError(error);
  }
}
