import { NextResponse } from 'next/server';
import { serverEnv } from '@/lib/env';
import { descripcionAsset } from '@/lib/stellar/asset';
import { diagnosticoEscrow } from '@/lib/stellar';
import { almacenamientoHabilitado } from '@/lib/almacenamiento';
import { manejarError, ok } from '@/lib/http';
import { db, tratos } from '@/db';
import { count } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Chequeo de salud del despliegue.
 *
 * Existe por una razón concreta: cuando un pago falla con
 * `txFeeBumpInnerFailed`, ese error solo dice que la transacción interna
 * falló, y no cuál de las tres causas posibles fue. Esta ruta las responde
 * todas de una vez:
 *
 *   - ¿Existe la cuenta de custodia en la red que dice el entorno?
 *   - ¿Acepta USDC del emisor configurado? (sin trustline, todo pago rebota)
 *   - ¿Tiene XLM para pagar los fees de liberación y devolución?
 *   - ¿La base responde?
 *
 * No expone secretos: la dirección de la custodia ya es pública (va en cada
 * pago) y el resto son booleanos y saldos que cualquiera puede ver en el
 * explorador de Stellar.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const env = serverEnv();

    // Se mide la latencia de la base: "todo va lento" no es accionable,
    // "tu base responde en 11 segundos" sí — y suele significar que el proyecto
    // está en otra región o despertando de un plan gratuito.
    const arranque = Date.now();
    const [escrow, base] = await Promise.all([
      diagnosticoEscrow().catch(() => null),
      db
        .select({ cantidad: count() })
        .from(tratos)
        .then(() => true)
        .catch(() => false),
    ]);
    const latenciaBaseMs = Date.now() - arranque;

    const problemas: string[] = [];
    if (!base) problemas.push('La base de datos no responde. Revisa DATABASE_URL.');
    else if (latenciaBaseMs > 3000) {
      problemas.push(
        `La base tarda ${(latenciaBaseMs / 1000).toFixed(1)} s en responder. Usa la conexión pooler de Supabase y, si puedes, un proyecto en una región cercana: con esta latencia toda la app se siente rota.`,
      );
    }
    if (!escrow) {
      problemas.push('No pudimos consultar la cuenta de custodia. Revisa ESCROW_SECRET_KEY y HORIZON_URL.');
    } else {
      if (!escrow.existe) {
        problemas.push(
          `La cuenta de custodia ${escrow.direccion} no existe en ${env.STELLAR_NETWORK}. Fóndeala antes de recibir pagos.`,
        );
      } else {
        if (!escrow.aceptaUsdc) {
          problemas.push(
            'La cuenta de custodia no tiene la trustline de USDC del emisor configurado: todo pago del comprador va a rebotar.',
          );
        }
        if (!env.MODO_MOCK && Number(escrow.saldoXlm ?? 0) < 2) {
          problemas.push('A la cuenta de custodia le queda poco XLM para los fees de liberación y devolución.');
        }
      }
    }

    // Lo opcional no es un problema, pero sí hay que poder ver por qué está
    // apagado: una función que no aparece en pantalla sin explicación se
    // confunde con una función rota.
    const pistas: string[] = [];
    if (!almacenamientoHabilitado()) {
      pistas.push(
        'La foto de entrega está apagada: faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY. Corre también supabase/002_reputacion_y_evidencia.sql para crear el bucket privado "evidencias".',
      );
    }
    if (!env.POLLAR_SECRET_KEY) {
      pistas.push('Sin POLLAR_SECRET_KEY no se puede activar wallets en funding mode Deferred.');
    }

    return ok(
      {
        listo: problemas.length === 0,
        red: env.STELLAR_NETWORK,
        modoMock: env.MODO_MOCK,
        asset: descripcionAsset(),
        escrow,
        baseDeDatos: base,
        latenciaBaseMs,
        evidencia: almacenamientoHabilitado(),
        problemas,
        pistas,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return manejarError(error);
  }
}
