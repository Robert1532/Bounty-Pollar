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
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] ${clase}`}>
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {texto}
    </span>
  );
}
