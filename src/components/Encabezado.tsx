'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useSesion } from '@/lib/cliente/sesion';
import { Spinner } from './ui/Boton';
import { Isotipo } from './Marca';
import { DialogoConfirmacion } from './ui/DialogoConfirmacion';

export function Encabezado() {
  const { usuario, salir, ocupado, cargando, config, modoMock } = useSesion();
  const [confirmandoSalida, setConfirmandoSalida] = useState(false);

  return (
    <>
    <header className="sticky top-0 z-20 border-b border-verde/10 bg-papel/85 backdrop-blur-xl">
      <div className="contenedor flex h-[4.35rem] items-center justify-between gap-3">
        <Link href="/" className="group flex items-center gap-2.5 font-black tracking-tight" aria-label="Caserita, ir al inicio">
          <Isotipo className="size-10 transition-transform group-hover:-rotate-3" />
          <span className="text-xl tracking-[-0.04em]">Caserita</span>
        </Link>

        <div className="flex items-center gap-2 text-sm">
          {config?.red === 'testnet' && (
            <>
              <span className="rounded-full border border-naranja/10 bg-naranja-claro px-2 py-1 text-[9px] font-black tracking-[0.06em] text-naranja sm:hidden" title="Entorno de prueba: no se utiliza dinero real">PRUEBA</span>
              <span className="hidden rounded-full border border-naranja/10 bg-naranja-claro px-2.5 py-1 text-[10px] font-black tracking-[0.06em] text-naranja sm:inline-flex" title="Entorno de prueba: no se utiliza dinero real">
                {modoMock ? 'MODO DEMO' : 'PRUEBA · SIN DINERO REAL'}
              </span>
            </>
          )}
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
