import { NextResponse } from 'next/server';
import { requerirUsuario } from '@/lib/auth';
import { manejarError } from '@/lib/http';
import { errores } from '@/lib/errors';
import { idTrato } from '@/lib/validaciones';
import { descargarEvidencia } from '@/lib/almacenamiento';
import { obtenerTrato } from '@/lib/tratos/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * Sirve la foto de la entrega por el camino propio.
 *
 * Es el respaldo de la URL firmada de Supabase: si firmar falla o tarda
 * demasiado, la foto igual se ve. La protección es la misma comprobación de
 * siempre —tiene que ser una de las dos partes del trato— así que pasar por
 * acá no afloja nada; solo gasta ancho de banda de la app en vez de servirla
 * directo desde Storage.
 *
 * En modo demo, este es el único camino.
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

    const archivo = await descargarEvidencia(trato.evidenciaRuta);
    if (!archivo) throw errores.noEncontrado('La foto ya no está disponible.');

    return new NextResponse(Buffer.from(archivo.datos) as unknown as BodyInit, {
      headers: {
        'Content-Type': trato.evidenciaTipo ?? archivo.tipo,
        'Content-Length': String(archivo.datos.byteLength),
        // Privada y de corta vida: la foto no se queda en ninguna caché compartida.
        'Cache-Control': 'private, max-age=60',
        'Content-Disposition': 'inline',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return manejarError(error);
  }
}
