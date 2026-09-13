import { NextResponse } from 'next/server';
import { requerirUsuario } from '@/lib/auth';
import { manejarError, ok } from '@/lib/http';
import { resumenDeUsuario } from '@/lib/tratos/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Cuánta plata tiene el usuario en Caserita.
 *
 * Solo lo suyo, y solo lo que esta app puede afirmar: lo que tiene por cobrar,
 * lo que tiene protegido como comprador, y lo que ya movió. El saldo de la
 * wallet no viene de acá — ese lo lee Pollar directamente de la red, porque es
 * el único que puede decirlo de verdad.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const usuario = await requerirUsuario();
    const resumen = await resumenDeUsuario(usuario);
    return ok(resumen, { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) {
    return manejarError(error);
  }
}
