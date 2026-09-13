'use client';

import { useEffect, useState } from 'react';
import { Aviso } from './ui/Aviso';
import { Spinner } from './ui/Boton';
import { get } from '@/lib/cliente/api';
import { Icono } from './Marca';

/**
 * El codigo de entrega, en pantalla grande para mostrarlo en la mano. Es la
 * unica palanca del comprador: mientras no lo entregue, la plata sigue siendo
 * suya.
 */
export function CodigoComprador({ tratoId }: { tratoId: string }) {
  const [codigo, setCodigo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    get<{ codigo: string }>(`/api/tratos/${tratoId}/codigo`)
      .then((d) => vivo && setCodigo(d.codigo))
      .catch((e) => vivo && setError(e instanceof Error ? e.message : 'No pudimos traer tu código.'));
    return () => {
      vivo = false;
    };
  }, [tratoId]);

  if (error) return <Aviso tono="error">{error}</Aviso>;

  return (
    <section className="tarjeta overflow-hidden text-center">
      <div className="patron-casas bg-verde px-5 py-4 text-white">
        <span className="mx-auto mb-2 grid size-10 place-items-center rounded-xl bg-white/15"><Icono nombre="codigo" className="size-5" /></span>
        <p className="text-sm font-extrabold">Tu código de entrega</p>
      </div>
      <div className="space-y-4 p-5 sm:p-7">
      {codigo ? (
        <p className="numeros text-4xl font-black tracking-[0.12em] text-verde sm:text-5xl">
          {codigo.slice(0, 3)} {codigo.slice(3)}
        </p>
      ) : (
        <div className="grid h-16 place-items-center">
          <Spinner />
        </div>
      )}
      <p className="mx-auto max-w-md text-sm leading-relaxed text-tinta-2">
        Muéstraselo al vendedor <span className="font-bold">solo cuando tengas el producto en la mano</span>.
        Al ingresarlo, cobra.
      </p>
      </div>
    </section>
  );
}
