import { NextResponse } from 'next/server';
import { usuarioActual } from '@/lib/auth';
import { manejarError, ok } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  try {
    const usuario = await usuarioActual();
    if (!usuario) return ok(null);
    return ok({ id: usuario.id, direccion: usuario.walletAddress, nombre: usuario.nombre });
  } catch (error) {
    return manejarError(error);
  }
}
