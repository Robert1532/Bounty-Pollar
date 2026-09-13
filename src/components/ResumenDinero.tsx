'use client';

import { useEffect, useState } from 'react';
import { get } from '@/lib/cliente/api';
import { useSesion } from '@/lib/cliente/sesion';
import type { ResumenDinero as Resumen } from '@/lib/cliente/tipos';
import { Icono, type NombreIcono } from './Marca';
import { Spinner } from './ui/Boton';

/**
 * "¿Cuánta plata tengo?", respondido sin mentir.
 *
 * Son tres números que vienen de dos fuentes distintas y nunca se suman en uno
 * solo, a propósito:
 *
 *   - **En tu wallet**: saldo USDC on-chain. Lo lee Pollar de la red. Es tuyo y
 *     lo puedes mover cuando quieras.
 *   - **Por cobrar**: ventas pagadas que esperan tu entrega. Todavía no es tuyo.
 *   - **Protegido**: compras que pagaste y están en custodia. Es tuyo, retenido.
 *
 * Un "total" único los mezclaría y diría algo falso: plata que todavía no
 * cobraste no está en tu bolsillo, y plata que pagaste tampoco. Por eso se
 * muestran separados, con la suma de lo que de verdad es tuyo abajo.
 */
export function ResumenDinero() {
  const { usuario, saldoUsdc, refrescarSaldo, modoMock } = useSesion();
  const [resumen, setResumen] = useState<Resumen | null>(null);
  // El saldo on-chain puede no llegar nunca (modo demo, wallet externa). Tras
  // unos segundos se muestra un guion en vez de un spinner eterno: una rueda
  // que no para dice "esto está roto", y no lo está.
  const [esperandoSaldo, setEsperandoSaldo] = useState(true);

  useEffect(() => {
    if (!usuario) return;
    let vivo = true;
    void refrescarSaldo();
    get<Resumen>('/api/resumen')
      .then((d) => vivo && setResumen(d))
      .catch(() => undefined);
    const reloj = setTimeout(() => vivo && setEsperandoSaldo(false), 3000);
    return () => {
      vivo = false;
      clearTimeout(reloj);
    };
  }, [usuario, refrescarSaldo]);

  useEffect(() => {
    if (saldoUsdc !== null) setEsperandoSaldo(false);
  }, [saldoUsdc]);

  if (!usuario) return null;

  const enWallet = saldoUsdc === null ? null : Number(saldoUsdc);
  const protegido = Number(resumen?.protegidoUsdc ?? 0);
  const porCobrar = Number(resumen?.porCobrarUsdc ?? 0);

  // "Tuyo ahora" = lo que puedes gastar + lo que está retenido a tu favor.
  // Lo por cobrar queda fuera: todavía depende de que entregues.
  const tuyo = enWallet === null ? null : enWallet + protegido;

  const celdas: { icono: NombreIcono; valor: number | null; etiqueta: string; detalle: string; tono: string }[] = [
    {
      icono: 'wallet',
      valor: enWallet,
      etiqueta: 'En tu wallet',
      detalle: 'disponible ahora',
      tono: 'text-verde-oscuro',
    },
    {
      icono: 'escudo',
      valor: protegido,
      etiqueta: 'Protegido',
      detalle:
        resumen && resumen.tratosProtegidos > 0
          ? `${resumen.tratosProtegidos} ${resumen.tratosProtegidos === 1 ? 'compra' : 'compras'}`
          : 'compras en custodia',
      tono: 'text-azul',
    },
    {
      icono: 'reloj',
      valor: porCobrar,
      etiqueta: 'Por cobrar',
      detalle:
        resumen && resumen.tratosPorCobrar > 0
          ? `${resumen.tratosPorCobrar} ${resumen.tratosPorCobrar === 1 ? 'entrega' : 'entregas'} pendiente${resumen.tratosPorCobrar === 1 ? '' : 's'}`
          : 'al entregar',
      tono: 'text-naranja',
    },
  ];

  return (
    <section className="tarjeta overflow-hidden">
      <div className="flex items-baseline justify-between gap-3 bg-verde px-5 py-4 text-white">
        <div>
          <p className="text-[11px] font-black tracking-[.12em] text-white/70 uppercase">Tu plata</p>
          <p className="numeros mt-0.5 text-3xl font-black">
            {(tuyo ?? protegido).toFixed(2)} <span className="text-base text-white/70">USDC</span>
          </p>
        </div>
        {/* Si no se pudo leer la wallet no se inventa un total: se dice qué se
            está sumando y qué falta. */}
        <p className="max-w-[8.5rem] text-right text-[11px] leading-tight text-white/70">
          {tuyo === null ? 'Solo lo que tienes en custodia' : 'Tu wallet más lo que tienes en custodia'}
        </p>
      </div>

      <div className="grid grid-cols-3 divide-x divide-borde">
        {celdas.map((celda) => (
          <div key={celda.etiqueta} className="px-2 py-4 text-center">
            <Icono nombre={celda.icono} className={`mx-auto mb-1.5 size-4 ${celda.tono}`} />
            <p className="numeros flex h-[1.125rem] items-center justify-center text-lg leading-none font-black">
              {celda.valor === null ? (esperandoSaldo ? <Spinner /> : '—') : celda.valor.toFixed(2)}
            </p>
            <p className="mt-1.5 text-[11px] leading-tight font-bold text-tinta-2">{celda.etiqueta}</p>
            <p className="text-[10px] leading-tight text-tinta-3">{celda.detalle}</p>
          </div>
        ))}
      </div>

      {resumen && (resumen.ventasCompletadas > 0 || resumen.comprasCompletadas > 0) && (
        <p className="border-t border-borde bg-papel-2/60 px-5 py-3 text-center text-xs text-tinta-3">
          Histórico: cobraste{' '}
          <strong className="numeros text-tinta-2">{Number(resumen.cobradoUsdc).toFixed(2)} USDC</strong> en{' '}
          {resumen.ventasCompletadas} {resumen.ventasCompletadas === 1 ? 'venta' : 'ventas'}
          {resumen.comprasCompletadas > 0 && (
            <>
              {' '}· gastaste{' '}
              <strong className="numeros text-tinta-2">{Number(resumen.gastadoUsdc).toFixed(2)} USDC</strong> en{' '}
              {resumen.comprasCompletadas} {resumen.comprasCompletadas === 1 ? 'compra' : 'compras'}
            </>
          )}
        </p>
      )}

      {modoMock && (
        <p className="border-t border-borde px-5 py-2 text-center text-[11px] text-tinta-3">
          Modo demo: el saldo de wallet no se simula.
        </p>
      )}
    </section>
  );
}
