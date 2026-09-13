'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variante = 'primario' | 'secundario' | 'fantasma' | 'peligro';

export const BASE_BOTON =
  'inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-base font-extrabold shadow-sm transition duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0';

export const VARIANTES_BOTON: Record<Variante, string> = {
  primario: 'bg-verde text-white shadow-[0_9px_22px_rgba(8,115,91,0.18)] hover:bg-verde-oscuro',
  secundario: 'bg-verde-claro text-verde-oscuro hover:bg-[#d3edcd]',
  fantasma: 'border border-verde/20 bg-superficie text-verde-oscuro hover:border-verde/40 hover:bg-verde-claro/50',
  peligro: 'border border-rojo/10 bg-rojo-claro text-rojo hover:bg-rojo hover:text-white',
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  cargando?: boolean;
  children: ReactNode;
}

export function claseBoton(variante: Variante = 'primario', className = '') {
  return `${BASE_BOTON} ${VARIANTES_BOTON[variante]} ${className}`;
}

export function Boton({ variante = 'primario', cargando, children, className = '', ...rest }: Props) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || cargando}
      className={claseBoton(variante, className)}
    >
      {cargando && <Spinner />}
      <span className="inline-flex items-center justify-center gap-2">{children}</span>
    </button>
  );
}

export function Spinner() {
  return (
    <span
      aria-hidden
      className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}
