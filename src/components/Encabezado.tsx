'use client';

import Link from 'next/link';
import { useSesion } from '@/lib/cliente/sesion';
import { Spinner } from './ui/Boton';

function acortar(direccion: string) {
  return `${direccion.slice(0, 4)}…${direccion.slice(-4)}`;
}

export function Encabezado() {
  const { usuario, entrar, salir, ocupado, cargando, config, modoMock } = useSesion();

  return (
    <header className="sticky top-0 z-10 border-b border-borde bg-papel/90 backdrop-blur">
      <div className="contenedor flex h-14 items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2 font-black tracking-tight">
          <span className="grid size-7 place-items-center rounded-lg bg-verde text-sm text-white">C</span>
          <span>Caserita</span>
        </Link>

        <div className="flex items-center gap-2 text-sm">
          {config?.red === 'testnet' && (
            <span className="rounded-full bg-naranja-claro px-2 py-0.5 text-[11px] font-bold text-naranja">
              {modoMock ? 'DEMO' : 'TESTNET'}
            </span>
          )}
          {cargando ? (
            <Spinner />
          ) : usuario ? (
            <button
              onClick={() => void salir()}
              className="números rounded-full bg-papel-2 px-3 py-1.5 text-xs font-semibold text-tinta-2"
              title={usuario.direccion}
            >
              {acortar(usuario.direccion)}
            </button>
          ) : (
            <button
              onClick={() => void entrar()}
              disabled={ocupado}
              className="rounded-full bg-verde px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              {ocupado ? 'Entrando…' : 'Entrar'}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
