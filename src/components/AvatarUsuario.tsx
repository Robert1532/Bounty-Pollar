'use client';

import { useEffect, useState } from 'react';

export function AvatarUsuario({
  nombre,
  url,
  className = 'size-9',
}: {
  nombre: string | null;
  url: string | null;
  className?: string;
}) {
  const [fallo, setFallo] = useState(false);
  useEffect(() => setFallo(false), [url]);

  const clase = `${className} grid shrink-0 place-items-center overflow-hidden rounded-full bg-verde-claro font-black text-verde-oscuro`;
  if (url && !fallo) {
    // La URL es una ruta autenticada del mismo origen, no una imagen pública.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="Foto de perfil" className={`${clase} object-cover`} onError={() => setFallo(true)} />;
  }
  return <span className={clase}>{(nombre?.trim() || 'C').slice(0, 1).toUpperCase()}</span>;
}
