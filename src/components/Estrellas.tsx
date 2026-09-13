import type { SVGProps } from 'react';
import type { Estrellas as DatosEstrellas } from '@/lib/cliente/tipos';

/** Una estrella. Rellena, media o vacía, según la fracción que le toca. */
export function Estrella({ llenado = 1, ...props }: { llenado?: number } & SVGProps<SVGSVGElement>) {
  const id = `est-${Math.round(llenado * 100)}`;
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...props}>
      <defs>
        <linearGradient id={id}>
          <stop offset={`${Math.max(0, Math.min(1, llenado)) * 100}%`} stopColor="currentColor" />
          <stop offset={`${Math.max(0, Math.min(1, llenado)) * 100}%`} stopColor="transparent" />
        </linearGradient>
      </defs>
      <path
        d="M12 2.6l2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.45 6.19 20.5 7.3 14.03 2.6 9.45l6.5-.95L12 2.6z"
        fill={`url(#${id})`}
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Las estrellas de un vendedor.
 *
 * Cuando todavía son pocas no se muestra el promedio: con una o dos, el
 * vendedor podría deducir quién lo calificó y qué puso, y la calificación
 * dejaría de ser anónima. Se dice cuántas lleva y se explica por qué falta el
 * número, en vez de mostrar un 5.0 que no significa nada.
 */
export function Estrellas({ datos, tamano = 'normal' }: { datos: DatosEstrellas; tamano?: 'normal' | 'chico' }) {
  const clase = tamano === 'chico' ? 'size-3.5' : 'size-4';

  if (datos.promedio === null) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-tinta-3">
        <Estrella llenado={0} className={`${clase} text-tinta-3`} />
        {datos.cantidad === 0
          ? 'Sin calificaciones todavía'
          : `${datos.cantidad} ${datos.cantidad === 1 ? 'calificación' : 'calificaciones'} · el promedio aparece con ${datos.faltanParaMostrar} más`}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5" title={`${datos.promedio} de 5`}>
      <span className="flex text-naranja" aria-hidden>
        {[1, 2, 3, 4, 5].map((n) => (
          <Estrella key={n} llenado={Math.max(0, Math.min(1, (datos.promedio as number) - n + 1))} className={clase} />
        ))}
      </span>
      <span className="numeros text-xs font-bold text-tinta-2">
        {datos.promedio.toFixed(1)}
        <span className="font-semibold text-tinta-3"> ({datos.cantidad})</span>
      </span>
    </span>
  );
}
