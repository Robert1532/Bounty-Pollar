'use client';

import { useEffect, useState } from 'react';
import { Aviso } from './ui/Aviso';
import { Spinner } from './ui/Boton';
import { get } from '@/lib/cliente/api';

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
    <section className="tarjeta space-y-3 p-5 text-center">
      <p className="text-sm font-semibold text-tinta-2">Tu código de entrega</p>
      {codigo ? (
        <p className="números text-5xl font-black tracking-[0.2em] text-verde">
          {codigo.slice(0, 3)} {codigo.slice(3)}
        </p>
      ) : (
        <div className="grid h-16 place-items-center">
          <Spinner />
        </div>
      )}
      <p className="text-sm text-tinta-2">
        Muéstraselo al vendedor <span className="font-bold">solo cuando tengas el producto en la mano</span>.
        Al ingresarlo, cobra.
      </p>
    </section>
  );
}
