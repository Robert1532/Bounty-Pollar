import Link from 'next/link';
import { EstadoBadge } from './EstadoBadge';
import type { TratoPublico } from '@/lib/cliente/tipos';
import { Icono } from './Marca';

export function TratoCard({ trato }: { trato: TratoPublico }) {
  return (
    <Link href={`/t/${trato.id}`} className="tarjeta group block p-4 transition duration-200 hover:-translate-y-0.5 hover:border-verde/25 hover:shadow-[0_15px_35px_rgba(21,51,43,0.08)] active:scale-[0.99]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-extrabold">{trato.titulo}</p>
          <p className="numeros mt-1 text-sm font-bold text-verde">
            {Number(trato.montoUsdc).toFixed(2)} USDC
            {trato.montoBsReferencia && (
              <span className="text-tinta-3"> · Bs {Number(trato.montoBsReferencia).toFixed(2)}</span>
            )}
          </p>
        </div>
        <EstadoBadge estado={trato.estado} />
      </div>
      <span className="mt-3 flex items-center gap-1 text-xs font-bold text-tinta-3 transition group-hover:text-verde">
        Ver detalles <Icono nombre="flecha" className="size-3.5" />
      </span>
    </Link>
  );
}
