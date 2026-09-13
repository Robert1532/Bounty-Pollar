import { NextResponse } from 'next/server';
import { Keypair } from '@stellar/stellar-sdk';
import { z } from 'zod';
import { serverEnv } from '@/lib/env';
import { registrarWallet } from '@/lib/auth';
import { firmarSesion, guardarCookieSesion } from '@/lib/session';
import { leerJson, manejarError, ok, verificarOrigen } from '@/lib/http';
import { ErrorApp } from '@/lib/errors';
import { direccionStellar } from '@/lib/validaciones';
import { usuarioDeSesion } from '@/lib/perfil';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z
  .object({
    direccion: direccionStellar.optional(),
    nombre: z.string().trim().max(80).optional(),
  })
  .strict();

/**
 * Login simulado para el modo demo. Entrega una wallet Stellar valida (solo la
 * llave publica) sin pasar por Pollar, para poder recorrer el flujo completo
 * antes de tener claves. Con MODO_MOCK apagado responde 403.
 */
export async function POST(req: Request): Promise<NextResponse> {
  try {
    verificarOrigen(req);
    if (!serverEnv().MODO_MOCK) {
      throw new ErrorApp('SIN_PERMISO', 'Disponible solo en modo demo.');
    }

    const datos = await leerJson(req, schema).catch(() => ({}) as z.infer<typeof schema>);
    const direccion = datos.direccion ?? Keypair.random().publicKey();
    const usuario = await registrarWallet({ direccion, nombre: datos.nombre });

    await guardarCookieSesion(await firmarSesion({ userId: usuario.id, direccion }));
    return ok(usuarioDeSesion(usuario));
  } catch (error) {
    return manejarError(error);
  }
}
