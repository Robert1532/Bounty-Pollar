import { NextResponse } from 'next/server';
import { requerirUsuario } from '@/lib/auth';
import { leerJson, manejarError, ok, verificarOrigen } from '@/lib/http';
import { ipDe } from '@/lib/rate-limit';
import { devolverSchema, idTrato } from '@/lib/validaciones';
import { devolver } from '@/lib/tratos/service';
import { aTratoPublico } from '@/lib/tratos/dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Devolucion acordada: el comprador suelta la plata antes del plazo porque el
 * vendedor no entrego y los dos lo aceptan. La devolucion por plazo vencido la
 * dispara el cron, no esta ruta.
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

    const { motivo } = await leerJson(req, devolverSchema).catch(() => ({ motivo: 'ACORDADA' as const }));
    const trato = await devolver({
      id: tratoId,
      motivo: motivo === 'PLAZO_VENCIDO' ? 'PLAZO_VENCIDO' : 'ACORDADA',
      actor: usuario,
      ip: ipDe(req),
    });
    return ok(aTratoPublico(trato, usuario));
  } catch (error) {
    return manejarError(error);
  }
}
