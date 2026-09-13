import { NextResponse } from 'next/server';
import { requerirUsuario } from '@/lib/auth';
import { leerJson, manejarError, ok, verificarOrigen } from '@/lib/http';
import { ipDe } from '@/lib/rate-limit';
import { idTrato, reportarProblemaSchema } from '@/lib/validaciones';
import { reportarProblema, vistaDeTrato } from '@/lib/tratos/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    verificarOrigen(req);
    const usuario = await requerirUsuario();
    const { id } = await ctx.params;
    const datos = await leerJson(req, reportarProblemaSchema);
    const trato = await reportarProblema({
      id: idTrato.parse(id),
      datos,
      actor: usuario,
      ip: ipDe(req),
    });
    return ok(await vistaDeTrato(trato, usuario));
  } catch (error) {
    return manejarError(error);
  }
}
