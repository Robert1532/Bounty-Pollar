'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useSesion } from '@/lib/cliente/sesion';
import { Spinner } from './ui/Boton';
import { Isotipo, Logotipo } from './Marca';
import { DialogoConfirmacion } from './ui/DialogoConfirmacion';

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
              className="grid size-9 place-items-center rounded-full border border-borde bg-superficie text-xs font-black text-verde shadow-sm transition hover:border-verde/30"
              title="Tu perfil"
              aria-label="Tu perfil"
            >
              {(usuario.nombre ?? 'C').slice(0, 1).toUpperCase()}
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
