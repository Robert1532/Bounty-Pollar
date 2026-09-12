import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { serverEnv } from './env';

/**
 * Sesion en una cookie HttpOnly firmada (JWT HS256). No hay estado de sesion en
 * base: el token lleva el id del usuario y su direccion, y dura poco.
 */

export const COOKIE_SESION = '__Host-caserita_sesion';
const DURACION_SEGUNDOS = 60 * 60 * 12; // 12 horas

export function opcionesCookieSesion(seguro: boolean, maxAge: number) {
  return {
    httpOnly: true as const,
    secure: seguro,
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}

export interface Sesion {
  userId: string;
  direccion: string;
}

function clave(): Uint8Array {
  return new TextEncoder().encode(serverEnv().SESSION_SECRET);
}

export async function firmarSesion(sesion: Sesion): Promise<string> {
  return new SignJWT({ dir: sesion.direccion })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(sesion.userId)
    .setIssuedAt()
    .setIssuer('caserita')
    .setAudience('caserita')
    .setExpirationTime(`${DURACION_SEGUNDOS}s`)
    .sign(clave());
}

export async function leerSesion(): Promise<Sesion | null> {
  const store = await cookies();
  const token = store.get(COOKIE_SESION)?.value ?? store.get('caserita_sesion')?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, clave(), {
      issuer: 'caserita',
      audience: 'caserita',
      algorithms: ['HS256'],
    });
    const direccion = typeof payload.dir === 'string' ? payload.dir : null;
    if (!payload.sub || !direccion) return null;
    return { userId: payload.sub, direccion };
  } catch {
    return null;
  }
}

/**
 * `__Host-` exige secure + path=/ + sin domain, lo que impide que un subdominio
 * comprometido plante una cookie de sesion. En http local no se puede usar, asi
 * que ahi cae al nombre sin prefijo.
 */
export function nombreCookie(): string {
  return serverEnv().APP_URL.startsWith('https://') ? COOKIE_SESION : 'caserita_sesion';
}

export async function guardarCookieSesion(token: string): Promise<void> {
  const seguro = serverEnv().APP_URL.startsWith('https://');
  const store = await cookies();
  store.set(nombreCookie(), token, opcionesCookieSesion(seguro, DURACION_SEGUNDOS));
}

export async function borrarCookieSesion(): Promise<void> {
  const store = await cookies();
  // Una cookie con prefijo __Host- también debe llevar Secure al eliminarla;
  // de lo contrario los navegadores pueden rechazar el Set-Cookie de borrado.
  store.set(COOKIE_SESION, '', opcionesCookieSesion(true, 0));
  store.set('caserita_sesion', '', opcionesCookieSesion(false, 0));
}
