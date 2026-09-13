import type { SVGProps } from 'react';

/**
 * El símbolo: un techo que cubre una moneda. "Una casa que guarda la plata."
 *
 * La versión anterior era una casita con ventanas y una sonrisa: siete trazos
 * distintos que a 16px (el favicon, que es donde más se ve un logo) se
 * convertían en una mancha. Acá quedan dos formas y una idea. El chevron es el
 * techo, el círculo es el dinero, y el dinero está debajo del techo — que es
 * literalmente lo que hace Caserita.
 */
export function Isotipo({ className = '', tono = 'solido' }: { className?: string; tono?: 'solido' | 'claro' }) {
  return (
    <span
      aria-hidden="true"
      className={`isotipo grid place-items-center rounded-[30%] ${tono === 'claro' ? 'bg-white/15 text-white' : 'isotipo-solido text-white'} ${className}`}
    >
      <Simbolo className="h-[64%] w-[64%]" />
    </span>
  );
}

/** El símbolo suelto, sin la teja verde. Para el favicon y usos sobre color. */
export function Simbolo({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none" aria-hidden="true">
      <path
        d="M7.6 20.4 20 11.2l12.4 9.2"
        stroke="currentColor"
        strokeWidth="3.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="20" cy="26.8" r="4.9" fill="currentColor" />
    </svg>
  );
}

/**
 * El nombre tipografiado. Fraunces para la palabra, con la "i" punteada por el
 * mismo círculo del símbolo — el guiño que hace que logotipo e isotipo se lean
 * como una sola cosa.
 */
export function Logotipo({ className = '' }: { className?: string }) {
  return (
    <span className={`fuente-display text-[1.15rem] leading-none font-semibold tracking-[-0.02em] ${className}`}>
      Caserita
    </span>
  );
}

export type NombreIcono = 'escudo' | 'personas' | 'hoja' | 'enlace' | 'paquete' | 'codigo' | 'reloj' | 'check' | 'alerta' | 'info' | 'error' | 'flecha' | 'wallet' | 'ubicacion' | 'copiar' | 'whatsapp' | 'externo';

export function Icono({ nombre, ...props }: { nombre: NombreIcono } & SVGProps<SVGSVGElement>) {
  const comunes = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...comunes} {...props}>
      {nombre === 'escudo' && <><path d="M12 3 5 6v5c0 4.7 2.8 8.1 7 10 4.2-1.9 7-5.3 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-5" /></>}
      {nombre === 'personas' && <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2" /><path d="M3 19c0-3.3 2.7-6 6-6s6 2.7 6 6M15 14c3 0 5 2 5 5" /></>}
      {nombre === 'hoja' && <><path d="M20 4C11 4 5 8 5 15c0 3 2 5 5 5 7 0 10-7 10-16Z" /><path d="M4 21c3-6 7-9 12-12" /></>}
      {nombre === 'enlace' && <><path d="m10 13 4-4" /><path d="M8 17H6a4 4 0 0 1 0-8h3M16 7h2a4 4 0 0 1 0 8h-3" /></>}
      {nombre === 'paquete' && <><path d="m4 7 8-4 8 4v10l-8 4-8-4V7Z" /><path d="m4 7 8 4 8-4M12 11v10" /></>}
      {nombre === 'codigo' && <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M7 9h2M12 9h1M16 9h1M7 15h1M11 15h2M16 15h1" /></>}
      {nombre === 'reloj' && <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>}
      {nombre === 'check' && <path d="m5 12 4 4L19 6" />}
      {nombre === 'alerta' && <><path d="M12 4 3 20h18L12 4Z" /><path d="M12 9v4M12 17h.01" /></>}
      {nombre === 'info' && <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></>}
      {nombre === 'error' && <><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6M15 9l-6 6" /></>}
      {nombre === 'flecha' && <><path d="M5 12h14M14 7l5 5-5 5" /></>}
      {nombre === 'wallet' && <><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H18v16H6a2 2 0 0 1-2-2V6.5Z" /><path d="M4 7h14M14 11h7v5h-7a2.5 2.5 0 0 1 0-5Z" /></>}
      {nombre === 'ubicacion' && <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>}
      {nombre === 'copiar' && <><rect x="8" y="8" width="11" height="11" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>}
      {nombre === 'whatsapp' && <><path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.4-4A8 8 0 1 1 20 11.5Z" /><path d="M9 8.5c.5 3 2 4.5 5 5" /></>}
      {nombre === 'externo' && <><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" /></>}
    </svg>
  );
}
