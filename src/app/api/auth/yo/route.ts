import { NextResponse } from 'next/server';
import { usuarioActual } from '@/lib/auth';
import { manejarError, ok } from '@/lib/http';
import { usuarioDeSesion } from '@/lib/perfil';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  try {
    const usuario = await usuarioActual();
    if (!usuario) return ok(null);
    return ok(usuarioDeSesion(usuario));
  } catch (error) {
    return manejarError(error);
  }
}
