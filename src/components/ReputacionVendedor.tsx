import type { Reputacion } from '@/lib/cliente/tipos';
import { Icono } from './Marca';

/**
 * El historial del vendedor, en la página pública del trato.
 *
 * Va arriba del botón de pagar porque es la pregunta que el comprador se hace
 * justo antes de tocarlo: "¿este tipo cumple?". Y no son estrellas ni reseñas
 * —que se compran— sino tratos que de verdad se cerraron moviendo dinero.
 *
 * Un vendedor sin historial se muestra como tal, sin maquillaje: es honesto, y
 * de todos modos la custodia protege igual al comprador. Eso también hay que
 * decirlo, porque es justamente el argumento de venta.
 */
const ESTILOS = {
  nuevo: { etiqueta: 'Vendedor nuevo', clase: 'bg-papel-2 text-tinta-2' },
  conocido: { etiqueta: 'Vendedor con historial', clase: 'bg-azul-claro text-azul' },
  confiable: { etiqueta: 'Vendedor confiable', clase: 'bg-verde-claro text-verde-oscuro' },
  recomendado: { etiqueta: 'Vendedor recomendado', clase: 'bg-verde text-white' },
} as const;

export function ReputacionVendedor({ reputacion }: { reputacion: Reputacion }) {
  const estilo = ESTILOS[reputacion.nivel];
  const sinHistorial = reputacion.ventasCompletadas === 0 && reputacion.devolucionesComoVendedor === 0;

  return (
    <section className="tarjeta p-5">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-verde-claro text-verde">
          <Icono nombre="personas" className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          {/* La insignia envuelve a la línea de abajo en pantallas angostas en
              vez de aplastar el título: es donde vive de verdad este producto. */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h2 className="text-sm font-extrabold">El vendedor</h2>
            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${estilo.clase}`}>
              {estilo.etiqueta}
            </span>
          </div>
          {reputacion.primerTratoEn && (
            <p className="mt-0.5 text-xs text-tinta-3">En Caserita desde {mes(reputacion.primerTratoEn)}</p>
          )}
        </div>
      </div>

      {sinHistorial ? (
        <p className="mt-4 rounded-2xl bg-papel-2 px-4 py-3 text-sm leading-relaxed text-tinta-2">
          Es su primer trato acá, así que todavía no tiene historial.{' '}
          <strong className="text-tinta">Igual tu plata está protegida:</strong> queda en custodia hasta que
          entregue, y si no entrega vuelve sola.
        </p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Dato valor={String(reputacion.ventasCompletadas)} etiqueta="entregas cumplidas" />
            <Dato
              valor={Number(reputacion.volumenVendidoUsdc).toFixed(0)}
              etiqueta="USDC cobrados"
            />
            <Dato
              valor={String(reputacion.devolucionesComoVendedor)}
              etiqueta="devoluciones"
              tono={reputacion.devolucionesComoVendedor > 0 ? 'text-naranja' : undefined}
            />
          </div>
          {reputacion.tasaEntrega !== null && (
            <p className="mt-3 text-center text-xs text-tinta-3">
              Cumplió el <strong className="text-tinta-2">{reputacion.tasaEntrega}%</strong> de sus tratos.
            </p>
          )}
        </>
      )}
    </section>
  );
}

function Dato({ valor, etiqueta, tono }: { valor: string; etiqueta: string; tono?: string }) {
  return (
    <div className="rounded-2xl bg-papel-2 px-2 py-3 text-center">
      <p className={`numeros text-xl font-black ${tono ?? 'text-verde-oscuro'}`}>{valor}</p>
      <p className="mt-0.5 text-[11px] leading-tight font-semibold text-tinta-3">{etiqueta}</p>
    </div>
  );
}

function mes(iso: string): string {
  // Mes corto: el largo ("septiembre de 2026") rompe el encabezado en un móvil.
  return new Date(iso).toLocaleDateString('es-BO', { month: 'short', year: 'numeric' });
}
