import type { EstadoTrato } from '@/lib/cliente/tipos';

const ETIQUETAS: Record<EstadoTrato, { texto: string; clase: string }> = {
  BORRADOR: { texto: 'Borrador', clase: 'bg-papel-2 text-tinta-2' },
  PUBLICADO: { texto: 'Esperando pago', clase: 'bg-azul-claro text-azul' },
  FINANCIADO: { texto: 'Plata en custodia', clase: 'bg-verde-claro text-verde-oscuro' },
  LIBERANDO: { texto: 'Liberando…', clase: 'bg-naranja-claro text-naranja' },
  LIBERADO: { texto: 'Cobrado', clase: 'bg-verde text-white' },
  DEVOLVIENDO: { texto: 'Devolviendo…', clase: 'bg-naranja-claro text-naranja' },
  DEVUELTO: { texto: 'Devuelto', clase: 'bg-rojo-claro text-rojo' },
  EXPIRADO: { texto: 'Expirado', clase: 'bg-papel-2 text-tinta-2' },
  CANCELADO: { texto: 'Cancelado', clase: 'bg-papel-2 text-tinta-2' },
};

export function EstadoBadge({ estado }: { estado: EstadoTrato }) {
  const { texto, clase } = ETIQUETAS[estado];
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${clase}`}>
      {texto}
    </span>
  );
}
