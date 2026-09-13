import type { User } from '@/db';

export function urlAvatarDe(usuario: Pick<User, 'avatarRuta' | 'avatarActualizadoEn'>): string | null {
  if (!usuario.avatarRuta) return null;
  const version = usuario.avatarActualizadoEn?.getTime() ?? 0;
  return `/api/perfil/avatar?v=${version}`;
}

export function usuarioDeSesion(usuario: User) {
  return {
    id: usuario.id,
    direccion: usuario.walletAddress,
    nombre: usuario.nombre,
    avatarUrl: urlAvatarDe(usuario),
  };
}
