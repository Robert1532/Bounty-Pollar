'use client';

import { useState } from 'react';
import { Icono } from './Marca';
import { DialogoConfirmacion } from './ui/DialogoConfirmacion';

/**
 * Soporte.
 *
 * Abre un diálogo con lo que de verdad se puede ofrecer hoy: un correo y las
 * dos respuestas que cubren casi todas las dudas. No hay chat en vivo y no se
 * finge que lo haya — un botón que promete atención inmediata y nadie contesta
 * es peor que no tenerlo.
 */
export function BotonSoporte({ correo = 'hola@caserita.app' }: { correo?: string }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className="flex w-full items-center gap-3 rounded-2xl border border-borde bg-superficie px-4 py-3.5 text-left transition hover:border-verde/30 hover:bg-verde-claro/40"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-verde-claro text-verde">
          <Icono nombre="info" className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-extrabold">¿Necesitas ayuda?</span>
          <span className="block text-xs text-tinta-3">Dudas sobre un trato o un pago</span>
        </span>
        <Icono nombre="flecha" className="size-4 shrink-0 text-tinta-3" />
      </button>

      <DialogoConfirmacion
        abierto={abierto}
        titulo="Soporte de Caserita"
        detalle={
          <div className="space-y-3 text-left">
            <p>
              <strong className="text-tinta">Mi vendedor no entregó.</strong> No hagas nada: a las 48 horas
              la plata vuelve sola a tu wallet. Si ya venció el plazo, en la página del trato tienes el
              botón para devolverla ahora.
            </p>
            <p>
              <strong className="text-tinta">Pagué y no aparece.</strong> La red tarda unos segundos en
              confirmar. La página se actualiza sola; si pasan varios minutos, escríbenos con el número de
              trato.
            </p>
            <p className="border-t border-borde pt-3">
              Escríbenos a <strong className="text-verde">{correo}</strong> con el número de trato y te
              respondemos.
            </p>
          </div>
        }
        confirmar="Entendido"
        alCerrar={() => setAbierto(false)}
        alConfirmar={() => setAbierto(false)}
      />
    </>
  );
}
