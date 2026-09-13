import type { ReactNode } from 'react';
import { Icono, type NombreIcono } from '../Marca';

const TONOS = {
  info: { clase: 'border-azul/10 bg-azul-claro text-azul', icono: 'info' },
  ok: { clase: 'border-verde/10 bg-verde-claro text-verde-oscuro', icono: 'check' },
  alerta: { clase: 'border-naranja/10 bg-naranja-claro text-naranja', icono: 'alerta' },
  error: { clase: 'border-rojo/10 bg-rojo-claro text-rojo', icono: 'error' },
} as const;

export function Aviso({
  tono = 'info',
  children,
}: {
  tono?: keyof typeof TONOS;
  children: ReactNode;
}) {
  const estilo = TONOS[tono];
  return (
    <div
      role={tono === 'error' ? 'alert' : 'status'}
      aria-live={tono === 'error' ? 'assertive' : 'polite'}
      className={`flex items-start gap-3 rounded-2xl border px-4 py-3.5 text-sm leading-relaxed ${estilo.clase}`}
    >
      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-white/60">
        <Icono nombre={estilo.icono as NombreIcono} className="size-4" />
      </span>
      <div className="min-w-0 pt-0.5">{children}</div>
    </div>
  );
}
