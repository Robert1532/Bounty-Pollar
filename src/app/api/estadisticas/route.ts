import { NextResponse } from 'next/server';
import { manejarError, ok } from '@/lib/http';
import { estadisticasPublicas } from '@/lib/tratos/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Panel de confianza: agregados públicos, nunca datos de una persona.
 *
 * Un comprador que llega por un link de WhatsApp no conoce esta app. Cuánto hay
 * protegido ahora mismo, cuántos tratos se completaron y cuántos se devolvieron
 * es lo primero que le dice si vale la pena seguir. Los números chicos también
 * se muestran: esconderlos sería el primer paso para inventarlos.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const datos = await estadisticasPublicas();
    return ok(datos, {
      headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=120' },
    });
  } catch (error) {
    return manejarError(error);
  }
}
