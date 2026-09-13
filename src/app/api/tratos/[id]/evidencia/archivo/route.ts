import { NextResponse } from 'next/server';
import { requerirUsuario } from '@/lib/auth';
import { manejarError } from '@/lib/http';
import { errores } from '@/lib/errors';
import { idTrato } from '@/lib/validaciones';
import { leerEvidenciaLocal } from '@/lib/almacenamiento';
import { obtenerTrato } from '@/lib/tratos/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Sirve la foto en modo demo, cuando no hay Supabase Storage detrás.
 *
 * Con Supabase configurado esta ruta no se usa: ahí la foto se sirve con una
 * URL firmada que caduca a los 5 minutos, sin pasar por la app. Acá la
 * protección es la misma comprobación de siempre — tiene que ser una de las dos
 * partes del trato.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const usuario = await requerirUsuario();
    const { id } = await ctx.params;
    const trato = await obtenerTrato(idTrato.parse(id));

    if (trato.vendedorId !== usuario.id && trato.compradorId !== usuario.id) {
      throw errores.sinPermiso('Esta foto es de las partes del trato.');
    }
    if (!trato.evidenciaRuta) throw errores.noEncontrado('Este trato no tiene foto de entrega.');

    const archivo = leerEvidenciaLocal(trato.evidenciaRuta);
    if (!archivo) throw errores.noEncontrado('La foto ya no está disponible.');

    return new NextResponse(Buffer.from(archivo.datos) as unknown as BodyInit, {
      headers: {
        'Content-Type': archivo.tipo,
        'Content-Length': String(archivo.datos.byteLength),
        'Cache-Control': 'no-store, private',
        'Content-Disposition': 'inline',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return manejarError(error);
  }
}
