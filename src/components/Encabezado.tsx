'use client';

import Link from 'next/link';
import { useSesion } from '@/lib/cliente/sesion';
import { Spinner } from './ui/Boton';
import { Isotipo } from './Marca';

function acortar(direccion: string) {
  return `${direccion.slice(0, 4)}…${direccion.slice(-4)}`;
}

export function Encabezado() {
  const { usuario, entrar, salir, ocupado, cargando, config, modoMock } = useSesion();

  return (
    <header className="sticky top-0 z-20 border-b border-verde/10 bg-papel/85 backdrop-blur-xl">
      <div className="contenedor flex h-[4.35rem] items-center justify-between gap-3">
        <Link href="/" className="group flex items-center gap-2.5 font-black tracking-tight" aria-label="Caserita, ir al inicio">
          <Isotipo className="size-10 transition-transform group-hover:-rotate-3" />
          <span className="text-xl tracking-[-0.04em]">Caserita</span>
        </Link>

        <div className="flex items-center gap-2 text-sm">
          {config?.red === 'testnet' && (
            <span className="rounded-full border border-naranja/10 bg-naranja-claro px-2.5 py-1 text-[10px] font-black tracking-[0.08em] text-naranja">
              {modoMock ? 'DEMO' : 'TESTNET'}
            </span>
          )}
          {cargando ? (
            <Spinner />
          ) : usuario ? (
            <button
              onClick={() => void salir()}
              disabled={ocupado}
              className="min-h-9 rounded-full border border-borde bg-superficie px-3 py-1.5 text-xs font-bold text-tinta-2 shadow-sm transition hover:border-verde/30 hover:text-verde disabled:opacity-50"
              title={`Cerrar sesión de ${usuario.direccion}`}
            >
              {ocupado ? <Spinner /> : `Salir · ${acortar(usuario.direccion)}`}
            </button>
          ) : (
            <button
              onClick={() => void entrar()}
              disabled={ocupado}
              className="min-h-9 rounded-full bg-verde px-4 py-2 text-xs font-extrabold text-white shadow-[0_5px_14px_rgba(8,115,91,0.22)] transition hover:bg-verde-oscuro disabled:opacity-50"
            >
              {ocupado ? 'Entrando…' : 'Entrar'}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
