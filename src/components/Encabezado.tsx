'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useSesion } from '@/lib/cliente/sesion';
import { Spinner } from './ui/Boton';
import { Isotipo, Logotipo } from './Marca';
import { DialogoConfirmacion } from './ui/DialogoConfirmacion';
import { AvatarUsuario } from './AvatarUsuario';

export function Encabezado() {
  const { usuario, salir, ocupado, cargando } = useSesion();
  const [confirmandoSalida, setConfirmandoSalida] = useState(false);

  return (
    <>
    <header className="sticky top-0 z-20 border-b border-verde/10 bg-papel/85 backdrop-blur-xl">
      <div className="contenedor flex h-[4.35rem] items-center justify-between gap-3">
        <Link href="/" className="group flex items-center gap-2.5" aria-label="Caserita, ir al inicio">
          <Isotipo className="size-9 transition-transform duration-300 ease-suave group-hover:-translate-y-0.5" />
          <Logotipo className="text-[1.3rem]" />
        </Link>

        <div className="flex items-center gap-2 text-sm">
          {cargando ? (
            <Spinner />
          ) : usuario ? (
            <>
            <Link
              href="/perfil"
              className="flex min-h-11 items-center gap-2 rounded-2xl border border-borde bg-superficie p-1.5 pr-3 shadow-sm transition hover:-translate-y-0.5 hover:border-verde/30 hover:shadow-md"
              title="Tu perfil"
              aria-label="Tu perfil"
            >
              <AvatarUsuario nombre={usuario.nombre} url={usuario.avatarUrl} className="size-8 text-xs" />
              <span className="min-w-0 text-left leading-tight">
                <span className="block max-w-28 truncate text-xs font-extrabold text-tinta">
                  {usuario.nombre || 'Mi cuenta'}
                </span>
                <span className="block text-[10px] font-semibold text-tinta-3">Ver perfil</span>
              </span>
            </Link>
            <button
              onClick={() => setConfirmandoSalida(true)}
              disabled={ocupado}
              className="min-h-9 rounded-full border border-borde bg-superficie px-3 py-1.5 text-xs font-bold text-tinta-2 shadow-sm transition hover:border-verde/30 hover:text-verde disabled:opacity-50"
              title="Opciones de tu cuenta"
            >
              {ocupado ? <Spinner /> : 'Cerrar sesión'}
            </button>
            </>
          ) : null}
        </div>
      </div>
    </header>
      <DialogoConfirmacion
        abierto={confirmandoSalida}
        titulo="¿Cerrar tu sesión?"
        detalle="Tendrás que iniciar sesión nuevamente para ver tus tratos. Ningún pago ni trato será cancelado."
        confirmar="Sí, salir"
        icono="alerta"
        peligro
        cargando={ocupado}
        alCerrar={() => setConfirmandoSalida(false)}
        alConfirmar={() => { setConfirmandoSalida(false); void salir(); }}
      />
    </>
  );
}
