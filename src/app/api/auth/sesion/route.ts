import { NextResponse } from 'next/server';
import { and, eq, gt, isNull, lt } from 'drizzle-orm';
import { db, authNonces } from '@/db';
import { serverEnv } from '@/lib/env';
import { registrarWallet } from '@/lib/auth';
import { borrarCookieSesion, firmarSesion, guardarCookieSesion } from '@/lib/session';
import { parsearMensajeLogin, verificarFirmaSep53 } from '@/lib/sep53';
import { leerJson, manejarError, ok, verificarOrigen } from '@/lib/http';
import { ipDe, limitar } from '@/lib/rate-limit';
import { ErrorApp, errores } from '@/lib/errors';
import { sesionSchema } from '@/lib/validaciones';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Paso 2 del login: se verifica la firma SEP-53 contra la direccion reclamada.
 *
 * Esto es lo que hace que el backend no tenga que creerle al navegador. Pollar
 * autentica al usuario y le da una wallet; aca se comprueba criptograficamente
 * que quien dice ser dueno de esa wallet efectivamente puede firmar con ella,
 * y recien entonces se emite la cookie de sesion.
 */
export async function POST(req: Request): Promise<NextResponse> {
  try {
    verificarOrigen(req);

    const ip = ipDe(req);
    if (!limitar(`sesion:${ip}`, 20, 60_000).permitido) {
      throw new ErrorApp('DEMASIADOS_INTENTOS', 'Demasiados intentos. Espera un minuto.');
    }

    const env = serverEnv();
    const body = await leerJson(req, sesionSchema);
    const campos = parsearMensajeLogin(body.mensaje);

    if (campos.direccion !== body.direccion) {
      throw errores.datosInvalidos('El mensaje firmado no corresponde a esa wallet.');
    }
    if (campos.red !== env.STELLAR_NETWORK) {
      throw errores.datosInvalidos('El mensaje fue firmado para otra red.');
    }
    if (!body.mensaje.startsWith(`${new URL(env.APP_URL).host} `)) {
      throw errores.datosInvalidos('El mensaje fue firmado para otro dominio.');
    }
    if (!campos.nonce) {
      throw errores.datosInvalidos('Al mensaje le falta el nonce.');
    }

    // Quemar el nonce: un solo uso, y solo si sigue vigente.
    const quemado = await db
      .update(authNonces)
      .set({ usadoEn: new Date() })
      .where(
        and(
          eq(authNonces.nonce, campos.nonce),
          isNull(authNonces.usadoEn),
          gt(authNonces.expiraEn, new Date()),
        ),
      )
      .returning({ nonce: authNonces.nonce });
    if (quemado.length === 0) {
      throw errores.datosInvalidos('Ese pedido de firma venció. Intenta entrar de nuevo.');
    }

    const valida = verificarFirmaSep53({
      mensaje: body.mensaje,
      firmaBase64: body.firma,
      direccion: body.direccion,
    });
    if (!valida) {
      log.warn('firma SEP-53 inválida', { direccion: body.direccion, ip });
      throw errores.datosInvalidos('La firma no corresponde a esa wallet.');
    }

    const usuario = await registrarWallet({ direccion: body.direccion, nombre: body.nombre });
    await guardarCookieSesion(await firmarSesion({ userId: usuario.id, direccion: usuario.walletAddress }));

    // Limpieza oportunista de nonces viejos.
    void db
      .delete(authNonces)
      .where(lt(authNonces.expiraEn, new Date(Date.now() - 60 * 60 * 1000)))
      .catch(() => undefined);

    return ok({ id: usuario.id, direccion: usuario.walletAddress, nombre: usuario.nombre });
  } catch (error) {
    return manejarError(error);
  }
}

export async function DELETE(req: Request): Promise<NextResponse> {
  try {
    verificarOrigen(req);
    await borrarCookieSesion();
    return ok({ cerrada: true });
  } catch (error) {
    return manejarError(error);
  }
}
