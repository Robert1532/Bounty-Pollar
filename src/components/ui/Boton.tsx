'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variante = 'primario' | 'secundario' | 'fantasma' | 'peligro';

const BASE =
  'inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 text-base font-semibold transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50';

const VARIANTES: Record<Variante, string> = {
  primario: 'bg-verde text-white hover:bg-verde-oscuro',
  secundario: 'bg-papel-2 text-tinta hover:bg-borde',
  fantasma: 'border border-borde bg-superficie text-tinta hover:bg-papel-2',
  peligro: 'bg-rojo-claro text-rojo hover:bg-rojo hover:text-white',
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  cargando?: boolean;
  children: ReactNode;
}

export function Boton({ variante = 'primario', cargando, children, className = '', ...rest }: Props) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || cargando}
      className={`${BASE} ${VARIANTES[variante]} ${className}`}
    >
      {cargando && <Spinner />}
      {children}
    </button>
  );
}

export function Spinner() {
  return (
    <span
      aria-hidden
      className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}
