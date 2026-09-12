import { NextResponse } from 'next/server';
import { requerirUsuario } from '@/lib/auth';
import { manejarError, ok, verificarOrigen } from '@/lib/http';
import { ipDe } from '@/lib/rate-limit';
import { idTrato } from '@/lib/validaciones';
import { cancelar } from '@/lib/tratos/service';
import { aTratoPublico } from '@/lib/tratos/dto';

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
    const trato = await cancelar({ id: idTrato.parse(id), actor: usuario, ip: ipDe(req) });
    return ok(aTratoPublico(trato, usuario));
  } catch (error) {
    return manejarError(error);
  }
}
