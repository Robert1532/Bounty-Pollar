'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Encabezado } from '@/components/Encabezado';
import { TratoCard } from '@/components/TratoCard';
import { Vacio } from '@/components/Vacio';
import { Aviso } from '@/components/ui/Aviso';
import { Boton, Spinner } from '@/components/ui/Boton';
import { useSesion } from '@/lib/cliente/sesion';
import { get } from '@/lib/cliente/api';
import type { TratoPublico } from '@/lib/cliente/tipos';

type Pestana = 'vendo' | 'compro';

export default function Inicio() {
  const { usuario, cargando, entrar, ocupado, error, abrirHistorial } = useSesion();
  const [tratos, setTratos] = useState<{ vendo: TratoPublico[]; compro: TratoPublico[] } | null>(null);
  const [pestana, setPestana] = useState<Pestana>('vendo');

  const cargar = useCallback(async () => {
    if (!usuario) return;
    const datos = await get<{ vendo: TratoPublico[]; compro: TratoPublico[] }>('/api/tratos');
    setTratos(datos);
    if (datos.vendo.length === 0 && datos.compro.length > 0) setPestana('compro');
  }, [usuario]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (cargando) {
    return (
      <>
        <Encabezado />
        <main className="contenedor grid place-items-center py-24">
          <Spinner />
        </main>
      </>
    );
  }

  if (!usuario) return <Presentacion entrar={entrar} ocupado={ocupado} error={error} />;

  const lista = tratos?.[pestana] ?? [];

  return (
    <>
      <Encabezado />
      <main className="contenedor space-y-4 py-5 pb-28">
        <div className="flex rounded-2xl bg-papel-2 p-1 text-sm font-semibold">
          {(['vendo', 'compro'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPestana(p)}
              className={`flex-1 rounded-xl py-2.5 capitalize transition ${
                pestana === p ? 'bg-superficie text-tinta shadow-sm' : 'text-tinta-2'
              }`}
            >
              {p}
              {tratos && tratos[p].length > 0 && (
                <span className="ml-1.5 text-tinta-3">{tratos[p].length}</span>
              )}
            </button>
          ))}
        </div>

        {abrirHistorial && (
          <button
            onClick={abrirHistorial}
            className="w-full rounded-2xl border border-borde bg-superficie py-3 text-sm font-semibold text-tinta-2"
          >
            Ver mis movimientos en Stellar
          </button>
        )}

        {!tratos ? (
          <div className="grid place-items-center py-16">
            <Spinner />
          </div>
        ) : lista.length === 0 ? (
          <Vacio
            titulo={pestana === 'vendo' ? 'Todavía no vendes nada acá' : 'Todavía no compraste nada'}
            detalle={
              pestana === 'vendo'
                ? 'Crea un trato y mándale el link a tu comprador por WhatsApp.'
                : 'Cuando te pasen un link de Caserita y pagues, aparece acá.'
            }
          />
        ) : (
          <div className="space-y-3">
            {lista.map((t) => (
              <TratoCard key={t.id} trato={t} />
            ))}
          </div>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 border-t border-borde bg-papel/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="contenedor py-3">
          <Link href="/nuevo">
            <Boton>+ Nuevo trato</Boton>
          </Link>
        </div>
      </div>
    </>
  );
}

function Presentacion({
  entrar,
  ocupado,
  error,
}: {
  entrar: () => Promise<void>;
  ocupado: boolean;
  error: string | null;
}) {
  return (
    <>
      <Encabezado />
      <main className="contenedor space-y-7 py-10">
        <div className="space-y-3">
          <h1 className="text-3xl leading-tight font-black tracking-tight">
            Compra y vende sin miedo por Marketplace y WhatsApp.
          </h1>
          <p className="text-tinta-2">
            La plata del comprador queda en custodia. El vendedor cobra recien cuando entrega y el
            comprador le muestra un código de 6 dígitos. Si no hay entrega, el dinero vuelve solo.
          </p>
        </div>

        <ol className="space-y-3">
          {[
            ['Creas el trato', 'Título, monto y lugar de entrega. Te damos un link corto.'],
            ['Lo mandas por WhatsApp', 'El comprador paga desde su celular, entrando con Google.'],
            ['Entregas y cobras', 'Te muestra su código, lo ingresas y la plata cae al instante.'],
          ].map(([titulo, detalle], i) => (
            <li key={titulo} className="tarjeta flex gap-3 p-4">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-verde-claro text-sm font-bold text-verde-oscuro">
                {i + 1}
              </span>
              <div>
                <p className="font-bold">{titulo}</p>
                <p className="text-sm text-tinta-2">{detalle}</p>
              </div>
            </li>
          ))}
        </ol>

        {error && <Aviso tono="error">{error}</Aviso>}

        <div className="space-y-3">
          <Boton onClick={() => void entrar()} cargando={ocupado}>
            Entrar con Google
          </Boton>
          <p className="text-center text-xs text-tinta-3">
            Sin instalar wallets, sin frase semilla, sin conseguir XLM.
          </p>
        </div>
      </main>
    </>
  );
}
