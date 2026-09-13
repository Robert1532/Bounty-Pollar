import { NextResponse } from 'next/server';
import { requerirUsuario } from '@/lib/auth';
import { leerJson, manejarError, ok, verificarOrigen } from '@/lib/http';
import { reputacionDe } from '@/lib/tratos/reputacion';
import { distribucionDe } from '@/lib/tratos/calificaciones';
import { resumenDeUsuario } from '@/lib/tratos/service';
import { db, users } from '@/db';
import { eq } from 'drizzle-orm';
import { perfilSchema } from '@/lib/validaciones';
import { usuarioDeSesion, urlAvatarDe } from '@/lib/perfil';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * El perfil del usuario: su wallet, su historial y sus estrellas.
 *
 * Solo el propio. Un perfil público de otra persona expondría su actividad
 * comercial completa a cualquiera con el link, y eso no hace falta para que
 * Caserita funcione: lo que el comprador necesita saber de un vendedor ya va
 * en la página del trato.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const usuario = await requerirUsuario();
    const [resumen, distribucion] = await Promise.all([
      resumenDeUsuario(usuario),
      distribucionDe(usuario.id),
    ]);

    return ok(
      {
        direccion: usuario.walletAddress,
        nombre: usuario.nombre,
        avatarUrl: urlAvatarDe(usuario),
        desde: usuario.createdAt.toISOString(),
        reputacion: reputacionDe(usuario),
        resumen,
        distribucion,
      },
      { headers: { 'Cache-Control': 'no-store, private' } },
    );
  } catch (error) {
    return manejarError(error);
  }
}

export async function PATCH(req: Request): Promise<NextResponse> {
  try {
    verificarOrigen(req);
    const usuario = await requerirUsuario();
    const datos = await leerJson(req, perfilSchema);
    const [actualizado] = await db
      .update(users)
      .set({ nombre: datos.nombre, updatedAt: new Date() })
      .where(eq(users.id, usuario.id))
      .returning();
    return ok(usuarioDeSesion(actualizado ?? usuario));
  } catch (error) {
    return manejarError(error);
  }
}
