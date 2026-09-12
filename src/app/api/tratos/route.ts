import { NextResponse } from 'next/server';
import { requerirUsuario } from '@/lib/auth';
import { creado, leerJson, manejarError, ok, verificarOrigen } from '@/lib/http';
import { ipDe, limitar } from '@/lib/rate-limit';
import { ErrorApp } from '@/lib/errors';
import { crearTratoSchema } from '@/lib/validaciones';
import { crearTrato, listarTratosDe } from '@/lib/tratos/service';
import { aTratoPublico } from '@/lib/tratos/dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  try {
    const usuario = await requerirUsuario();
    const { vendo, compro } = await listarTratosDe(usuario.id);
    return ok({
      vendo: vendo.map((t) => aTratoPublico(t, usuario)),
      compro: compro.map((t) => aTratoPublico(t, usuario)),
    });
  } catch (error) {
    return manejarError(error);
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    verificarOrigen(req);
    const usuario = await requerirUsuario();

    const ip = ipDe(req);
    if (!limitar(`crear:${usuario.id}`, 20, 60 * 60_000).permitido) {
      throw new ErrorApp('DEMASIADOS_INTENTOS', 'Creaste muchos tratos seguidos. Espera un rato.');
    }

    const datos = await leerJson(req, crearTratoSchema);
    const { trato, url } = await crearTrato({ vendedor: usuario, datos, ip });

    return creado({ trato: aTratoPublico(trato, usuario), url });
  } catch (error) {
    return manejarError(error);
  }
}
