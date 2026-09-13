import { NextResponse } from 'next/server';
import { requerirUsuario } from '@/lib/auth';
import { leerJson, manejarError, ok, verificarOrigen } from '@/lib/http';
import { ipDe } from '@/lib/rate-limit';
import { devolverSchema, idTrato } from '@/lib/validaciones';
import { devolver, vistaDeTrato } from '@/lib/tratos/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Permite a una de las partes empujar una devolución cuando el plazo ya
 * venció. La misma regla temporal protege la ruta y el cron.
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

    await leerJson(req, devolverSchema);
    const trato = await devolver({
      id: tratoId,
      motivo: 'PLAZO_VENCIDO',
      actor: usuario,
      ip: ipDe(req),
    });
    return ok(await vistaDeTrato(trato, usuario));
  } catch (error) {
    return manejarError(error);
  }
}
