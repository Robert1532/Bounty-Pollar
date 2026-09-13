'use client';

import { useEffect, type ReactNode } from 'react';
import { Boton } from './Boton';
import { Icono, type NombreIcono } from '../Marca';

export function DialogoConfirmacion({
  abierto,
  titulo,
  detalle,
  confirmar,
  icono = 'escudo',
  peligro = false,
  cargando = false,
  alCerrar,
  alConfirmar,
}: {
  abierto: boolean;
  titulo: string;
  detalle: ReactNode;
  confirmar: string;
  icono?: NombreIcono;
  peligro?: boolean;
  cargando?: boolean;
  alCerrar: () => void;
  alConfirmar: () => void;
}) {
  useEffect(() => {
    if (!abierto) return;
    const cerrarConEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !cargando) alCerrar();
    };
    document.addEventListener('keydown', cerrarConEscape);
    return () => document.removeEventListener('keydown', cerrarConEscape);
  }, [abierto, cargando, alCerrar]);

  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-verde-oscuro/35 p-4 backdrop-blur-sm" onMouseDown={() => !cargando && alCerrar()}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-dialogo"
        className="tarjeta w-full max-w-sm p-5 shadow-[0_24px_70px_rgba(6,79,64,.25)] sm:p-6"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <span className={`mb-4 grid size-12 place-items-center rounded-2xl ${peligro ? 'bg-rojo-claro text-rojo' : 'bg-verde-claro text-verde'}`}>
          <Icono nombre={icono} className="size-6" />
        </span>
        <h2 id="titulo-dialogo" className="text-xl font-black tracking-tight">{titulo}</h2>
        <div className="mt-2 text-sm leading-relaxed text-tinta-2">{detalle}</div>
        <div className="mt-6 grid grid-cols-2 gap-2">
          <Boton variante="fantasma" onClick={alCerrar} disabled={cargando}>Cancelar</Boton>
          <Boton variante={peligro ? 'peligro' : 'primario'} onClick={alConfirmar} cargando={cargando}>{confirmar}</Boton>
        </div>
      </section>
    </div>
  );
}
