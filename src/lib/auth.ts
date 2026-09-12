import { eq } from 'drizzle-orm';
import { db, users, type User } from '@/db';
import { errores } from './errors';
import { nuevoId } from './ids';
import { leerSesion } from './session';

/**
 * Un usuario de Caserita es una wallet Stellar probada por firma. No hay
 * contrasena que robar ni que resetear.
 */

export async function usuarioPorId(id: string): Promise<User | null> {
  const [usuario] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return usuario ?? null;
}

export async function usuarioActual(): Promise<User | null> {
  const sesion = await leerSesion();
  if (!sesion) return null;

  const usuario = await usuarioPorId(sesion.userId);
  // Si la cookie apunta a otra wallet que la del usuario, la sesion no vale:
  // protege contra un token viejo despues de un cambio de wallet.
  if (!usuario || usuario.walletAddress !== sesion.direccion) return null;
  return usuario;
}

export async function requerirUsuario(): Promise<User> {
  const usuario = await usuarioActual();
  if (!usuario) throw errores.noAutenticado();
  return usuario;
}

/** Alta idempotente por direccion: el login puede repetirse sin duplicar nada. */
export async function registrarWallet(params: { direccion: string; nombre?: string }): Promise<User> {
  const [usuario] = await db
    .insert(users)
    .values({ id: nuevoId(), walletAddress: params.direccion, nombre: params.nombre ?? null })
    .onConflictDoUpdate({
      target: users.walletAddress,
      set: { nombre: params.nombre ?? null, updatedAt: new Date() },
    })
    .returning();

  if (!usuario) throw errores.datosInvalidos('No pudimos registrar tu wallet.');
  return usuario;
}

/** Igual que el anterior pero sin tocar el nombre: para el comprador detectado on-chain. */
export async function asegurarWallet(direccion: string): Promise<User> {
  const [existente] = await db.select().from(users).where(eq(users.walletAddress, direccion)).limit(1);
  if (existente) return existente;

  const [creado] = await db
    .insert(users)
    .values({ id: nuevoId(), walletAddress: direccion })
    .onConflictDoNothing({ target: users.walletAddress })
    .returning();
  if (creado) return creado;

  const [tras] = await db.select().from(users).where(eq(users.walletAddress, direccion)).limit(1);
  if (!tras) throw errores.datosInvalidos('No pudimos registrar la wallet del comprador.');
  return tras;
}
