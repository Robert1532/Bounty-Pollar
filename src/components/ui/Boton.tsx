'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variante = 'primario' | 'secundario' | 'fantasma' | 'peligro';

/*
 * El botón tiene masa.
 *
 * Sube 2px al pasar el mouse y se hunde al 97% al apretarlo, con la curva
 * `--ease-suave` (que arranca rápido y frena largo, como algo que pesa) en vez
 * del `ease` de fábrica. La diferencia entre un botón que se siente barato y
 * uno que se siente caro es exactamente esto: el hundido al apretar, y que la
 * sombra se achique con él en lugar de quedarse flotando.
 */
export const BASE_BOTON =
  'inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-base font-bold transition-[transform,box-shadow,background-color,border-color,color] duration-300 ease-suave will-change-transform hover:-translate-y-[2px] active:translate-y-[1px] active:scale-[0.97] active:duration-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:active:scale-100';

export const VARIANTES_BOTON: Record<Variante, string> = {
  primario:
    'bg-gradient-to-b from-[#0a8468] to-verde text-white shadow-[inset_0_1px_0_rgb(255_255_255/.22),0_1px_2px_rgb(5_77_62/.25),0_12px_26px_-10px_rgb(8_115_91/.55)] hover:shadow-[inset_0_1px_0_rgb(255_255_255/.22),0_2px_4px_rgb(5_77_62/.22),0_18px_34px_-12px_rgb(8_115_91/.6)] active:shadow-[inset_0_2px_4px_rgb(5_77_62/.3)]',
  secundario:
    'bg-verde-claro text-verde-oscuro shadow-[inset_0_1px_0_rgb(255_255_255/.7),0_1px_2px_rgb(20_49_42/.05)] hover:bg-[#d3edcd] active:shadow-[inset_0_2px_4px_rgb(8_115_91/.14)]',
  fantasma:
    'border border-verde/18 bg-superficie text-verde-oscuro shadow-[0_1px_2px_rgb(20_49_42/.05)] hover:border-verde/40 hover:bg-verde-claro/50 active:shadow-[inset_0_2px_4px_rgb(8_115_91/.1)]',
  peligro:
    'border border-rojo/10 bg-rojo-claro text-rojo shadow-[inset_0_1px_0_rgb(255_255_255/.6)] hover:bg-rojo hover:text-white hover:border-rojo active:shadow-[inset_0_2px_4px_rgb(120_20_20/.25)]',
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
