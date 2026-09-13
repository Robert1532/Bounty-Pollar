import { NextResponse } from 'next/server';
import { requerirUsuario } from '@/lib/auth';
import { manejarError, ok, verificarOrigen } from '@/lib/http';
import { ipDe, limitar } from '@/lib/rate-limit';
import { ErrorApp, errores } from '@/lib/errors';
import { idTrato } from '@/lib/validaciones';
import { MAX_BYTES_EVIDENCIA } from '@/lib/almacenamiento';
import { adjuntarEvidencia, evidenciaDe, vistaDeTrato } from '@/lib/tratos/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * Sube la foto de la entrega. Solo el vendedor, solo con la plata en custodia.
 *
 * El tamaño se corta dos veces: acá con la cabecera, antes de leer nada, y en
 * la capa de almacenamiento con los bytes reales. Una cabecera es un campo de
 * texto que cualquiera escribe; los bytes no mienten.
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

    if (!limitar(`evidencia:${usuario.id}`, 10, 10 * 60_000).permitido) {
      throw new ErrorApp('DEMASIADOS_INTENTOS', 'Subiste muchas fotos seguidas. Espera unos minutos.');
    }

    const declarado = Number(req.headers.get('content-length') ?? 0);
    if (declarado > MAX_BYTES_EVIDENCIA * 1.1) {
      throw errores.datosInvalidos('La foto no puede pesar más de 5 MB.');
    }

    const formulario = await req.formData().catch(() => null);
    const archivo = formulario?.get('foto');
    if (!(archivo instanceof File)) {
      throw errores.datosInvalidos('Falta la foto.');
    }
    if (archivo.size > MAX_BYTES_EVIDENCIA) {
      throw errores.datosInvalidos('La foto no puede pesar más de 5 MB.');
    }

    const datos = new Uint8Array(await archivo.arrayBuffer());
    const trato = await adjuntarEvidencia({ id: tratoId, datos, actor: usuario, ip: ipDe(req) });

    return ok(await vistaDeTrato(trato, usuario));
  } catch (error) {
    return manejarError(error);
  }
}

/** La foto, con una URL que caduca, y solo para las dos partes del trato. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const usuario = await requerirUsuario();
    const { id } = await ctx.params;
    const evidencia = await evidenciaDe({ id: idTrato.parse(id), actor: usuario });
    return ok(evidencia, { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) {
    return manejarError(error);
  }
}
