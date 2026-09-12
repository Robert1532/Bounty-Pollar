import type { ReactNode } from 'react';

const TONOS = {
  info: 'bg-azul-claro text-azul',
  ok: 'bg-verde-claro text-verde-oscuro',
  alerta: 'bg-naranja-claro text-naranja',
  error: 'bg-rojo-claro text-rojo',
} as const;

export function Aviso({
  tono = 'info',
  children,
}: {
  tono?: keyof typeof TONOS;
  children: ReactNode;
}) {
  return (
    <div role={tono === 'error' ? 'alert' : 'status'} className={`rounded-2xl px-4 py-3 text-sm ${TONOS[tono]}`}>
      {children}
    </div>
  );
}
