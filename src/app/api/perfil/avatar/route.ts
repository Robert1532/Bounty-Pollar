import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, users } from '@/db';
import { requerirUsuario } from '@/lib/auth';
import { manejarError, ok, verificarOrigen } from '@/lib/http';
import { ErrorApp, errores } from '@/lib/errors';
import { ipDe, limitar } from '@/lib/rate-limit';
import {
  borrarAvatar,
  descargarAvatar,
  guardarAvatar,
  MAX_BYTES_AVATAR,
} from '@/lib/almacenamiento';
import { urlAvatarDe } from '@/lib/perfil';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(): Promise<NextResponse> {
  try {
    const usuario = await requerirUsuario();
    if (!usuario.avatarRuta) throw errores.noEncontrado('Todavía no tienes foto de perfil.');
    const archivo = await descargarAvatar(usuario.avatarRuta);
    if (!archivo) throw errores.noEncontrado('La foto de perfil ya no está disponible.');

    return new NextResponse(Buffer.from(archivo.datos) as unknown as BodyInit, {
      headers: {
        'Content-Type': usuario.avatarTipo ?? archivo.tipo,
        'Content-Length': String(archivo.datos.byteLength),
        'Cache-Control': 'private, max-age=300',
        'Content-Disposition': 'inline',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return manejarError(error);
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    verificarOrigen(req);
    const usuario = await requerirUsuario();
    if (!limitar(`avatar:${usuario.id}:${ipDe(req)}`, 10, 10 * 60_000).permitido) {
      throw new ErrorApp('DEMASIADOS_INTENTOS', 'Cambiaste la foto muchas veces. Espera unos minutos.');
    }

    const declarado = Number(req.headers.get('content-length') ?? 0);
    if (declarado > MAX_BYTES_AVATAR * 1.1) {
      throw errores.datosInvalidos('La foto de perfil no puede pesar más de 2 MB.');
    }
    const formulario = await req.formData().catch(() => null);
    const foto = formulario?.get('foto');
    if (!(foto instanceof File)) throw errores.datosInvalidos('Falta la foto.');
    if (foto.size > MAX_BYTES_AVATAR) {
      throw errores.datosInvalidos('La foto de perfil no puede pesar más de 2 MB.');
    }

    const nueva = await guardarAvatar({
      usuarioId: usuario.id,
      datos: new Uint8Array(await foto.arrayBuffer()),
    });
    const ahora = new Date();
    const [actualizado] = await db
      .update(users)
      .set({ avatarRuta: nueva.ruta, avatarTipo: nueva.tipo, avatarActualizadoEn: ahora, updatedAt: ahora })
      .where(eq(users.id, usuario.id))
      .returning();
    if (!actualizado) {
      await borrarAvatar(nueva.ruta);
      throw errores.datosInvalidos('No pudimos actualizar tu perfil.');
    }
    if (usuario.avatarRuta && usuario.avatarRuta !== nueva.ruta) {
      await borrarAvatar(usuario.avatarRuta);
    }
    return ok({ avatarUrl: urlAvatarDe(actualizado) });
  } catch (error) {
    return manejarError(error);
  }
}
