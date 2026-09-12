import Link from 'next/link';
import { EstadoBadge } from './EstadoBadge';
import type { TratoPublico } from '@/lib/cliente/tipos';

export function TratoCard({ trato }: { trato: TratoPublico }) {
  return (
    <Link href={`/t/${trato.id}`} className="tarjeta block p-4 transition active:scale-[0.99]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-bold">{trato.titulo}</p>
          <p className="números mt-0.5 text-sm text-tinta-2">
            {Number(trato.montoUsdc).toFixed(2)} USDC
            {trato.montoBsReferencia && (
              <span className="text-tinta-3"> · Bs {Number(trato.montoBsReferencia).toFixed(2)}</span>
            )}
          </p>
        </div>
        <EstadoBadge estado={trato.estado} />
      </div>
    </Link>
  );
}
