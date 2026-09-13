import { NextResponse } from 'next/server';
import { usuarioActual } from '@/lib/auth';
import { manejarError, ok } from '@/lib/http';
import { idTrato } from '@/lib/validaciones';
import { obtenerTrato, vistaDeTrato } from '@/lib/tratos/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** La pagina del trato es publica: quien tiene el link puede verla y pagar. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await ctx.params;
    const trato = await obtenerTrato(idTrato.parse(id));
    const usuario = await usuarioActual();
    return ok(await vistaDeTrato(trato, usuario));
  } catch (error) {
    return manejarError(error);
  }
}
