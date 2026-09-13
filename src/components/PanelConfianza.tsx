'use client';

import { useEffect, useState } from 'react';
import { get } from '@/lib/cliente/api';
import type { Estadisticas } from '@/lib/cliente/tipos';
import { Icono, type NombreIcono } from './Marca';

/**
 * Panel de confianza.
 *
 * Un comprador que llega por un link de WhatsApp no conoce esta app. Estos tres
 * números son lo primero que le dicen si vale la pena seguir: cuánta plata está
 * protegida ahora mismo, cuántos tratos terminaron entregados y cuántos se
 * devolvieron.
 *
 * Las devoluciones se muestran a propósito. Un panel que solo enseña los éxitos
 * no es un panel de confianza, es publicidad — y el número que falta es
 * justamente el que un comprador desconfiado quiere ver.
 */
export function PanelConfianza({ compacto = false }: { compacto?: boolean }) {
  const [datos, setDatos] = useState<Estadisticas | null>(null);

  useEffect(() => {
    let vivo = true;
    get<Estadisticas>('/api/estadisticas')
      .then((d) => vivo && setDatos(d))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);

  if (!datos || datos.tratosTotales === 0) return null;

  const celdas: { icono: NombreIcono; valor: string; unidad?: string; etiqueta: string; tono: string }[] = [
    {
      icono: 'escudo',
      valor: redondear(datos.protegidoAhoraUsdc),
      // La unidad va aparte: en tres columnas a 390px, "80,49 USDC" se parte por
      // la mitad y el monto deja de leerse de un vistazo, que es lo único que
      // esta celda tiene que lograr.
      unidad: 'USDC',
      etiqueta: datos.tratosEnCustodia === 1 ? 'protegidos en 1 trato' : `protegidos en ${datos.tratosEnCustodia} tratos`,
      tono: 'text-verde',
    },
    {
      icono: 'check',
      valor: String(datos.tratosCompletados),
      etiqueta: datos.tratosCompletados === 1 ? 'entrega completada' : 'entregas completadas',
      tono: 'text-verde',
    },
    {
      icono: 'reloj',
      valor: String(datos.tratosDevueltos),
      etiqueta: datos.tratosDevueltos === 1 ? 'devolución automática' : 'devoluciones automáticas',
      tono: 'text-naranja',
    },
  ];

  return (
    <section className={compacto ? '' : 'tarjeta p-5 sm:p-6'}>
      {!compacto && (
        <div className="mb-4 flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-verde-claro text-verde">
            <Icono nombre="escudo" className="size-5" />
          </span>
          <div>
            <h2 className="font-extrabold">Caserita en números</h2>
            <p className="text-xs text-tinta-3">Todo verificable en la red Stellar</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {celdas.map((celda) => (
          <div key={celda.etiqueta} className="rounded-2xl bg-papel-2 px-3 py-4 text-center">
            <Icono nombre={celda.icono} className={`mx-auto mb-1.5 size-5 ${celda.tono}`} />
            <p className="numeros text-lg leading-tight font-black whitespace-nowrap sm:text-xl">
              {celda.valor}
              {celda.unidad && <span className="ml-1 text-[0.6em] font-bold text-tinta-3">{celda.unidad}</span>}
            </p>
            <p className="mt-1 text-[11px] leading-tight font-semibold text-tinta-3">{celda.etiqueta}</p>
          </div>
        ))}
      </div>

      {datos.tasaEntrega !== null && (
        <p className="mt-3 text-center text-xs text-tinta-3">
          <strong className="text-tinta-2">{datos.tasaEntrega}%</strong> de los tratos cerrados terminaron
          en entrega. El resto volvió solo al comprador.
        </p>
      )}
    </section>
  );
}

function redondear(monto: string): string {
  return Number(monto).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
