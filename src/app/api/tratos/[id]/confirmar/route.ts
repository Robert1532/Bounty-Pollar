import { NextResponse } from 'next/server';
import { requerirUsuario } from '@/lib/auth';
import { leerJson, manejarError, ok, verificarOrigen } from '@/lib/http';
import { ipDe, limitar } from '@/lib/rate-limit';
import { ErrorApp } from '@/lib/errors';
import { confirmarSchema, idTrato } from '@/lib/validaciones';
import { confirmarDeposito } from '@/lib/tratos/service';
import { aTratoPublico } from '@/lib/tratos/dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Confirma el deposito contra la red y pasa el trato a FINANCIADO.
 *
 * El cliente puede llamar a esto todas las veces que quiera: es idempotente y
 * lo unico que hace es preguntarle a Horizon. El monto y el remitente jamas
 * salen del body.
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
    if (!limitar(`confirmar:${tratoId}:${usuario.id}`, 30, 60_000).permitido) {
      throw new ErrorApp('DEMASIADOS_INTENTOS', 'Estamos mirando la red muy seguido. Espera unos segundos.');
    }

    await leerJson(req, confirmarSchema).catch(() => ({}));
    const trato = await confirmarDeposito({ id: tratoId, actor: usuario, ip });
    return ok(aTratoPublico(trato, usuario));
  } catch (error) {
    return manejarError(error);
  }
}
