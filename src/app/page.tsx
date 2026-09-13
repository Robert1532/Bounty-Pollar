'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Encabezado } from '@/components/Encabezado';
import { TratoCard } from '@/components/TratoCard';
import { Vacio } from '@/components/Vacio';
import { Aviso } from '@/components/ui/Aviso';
import { Boton, Spinner, claseBoton } from '@/components/ui/Boton';
import { useSesion } from '@/lib/cliente/sesion';
import { get } from '@/lib/cliente/api';
import type { TratoPublico } from '@/lib/cliente/tipos';
import { Icono, Isotipo, type NombreIcono } from '@/components/Marca';
import { DialogoConfirmacion } from '@/components/ui/DialogoConfirmacion';
import { PanelConfianza } from '@/components/PanelConfianza';
import { ResumenDinero } from '@/components/ResumenDinero';

type Pestana = 'vendo' | 'compro';

export default function Inicio() {
  const { usuario, cargando, entrar, ocupado, error } = useSesion();
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
      <main className="contenedor py-6 pb-28">
        <div className="columna space-y-4">
        {error && <Aviso tono="error">{error}</Aviso>}

        <div>
          <p className="antetitulo">Mis transacciones</p>
          <h1 className="mt-1 text-[1.7rem] leading-tight font-semibold">Compra y vende con tranquilidad</h1>
        </div>

        <ResumenDinero />

        <div className="flex rounded-2xl border border-borde bg-papel-2/80 p-1 text-sm font-bold">
          {(['vendo', 'compro'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPestana(p)}
              className={`flex-1 rounded-xl py-3 capitalize transition ${
                pestana === p ? 'bg-superficie text-verde shadow-sm' : 'text-tinta-2 hover:text-tinta'
              }`}
            >
              {p}
              {tratos && tratos[p].length > 0 && (
                <span className="ml-1.5 text-tinta-3">{tratos[p].length}</span>
              )}
            </button>
          ))}
        </div>

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

        <PanelConfianza />
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-verde/10 bg-papel/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
        <div className="columna px-4 py-3">
          <Link href="/nuevo" className={claseBoton()}>
            <span aria-hidden>＋</span> Nuevo trato
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
  const [confirmandoIngreso, setConfirmandoIngreso] = useState(false);

  return (
    <>
      <Encabezado />
      <main className="contenedor py-8 sm:py-12">
        <div className="grid items-center gap-10 lg:grid-cols-[1.08fr_.92fr] lg:gap-14">
          <section className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-verde/12 bg-verde-claro/70 px-3 py-1.5 text-xs font-bold text-verde-oscuro shadow-[inset_0_1px_0_rgb(255_255_255/.6)]">
              <Icono nombre="escudo" className="size-4" /> Pagos seguros entre personas
            </div>
            <div className="space-y-4">
              {/* La serif se gana el titular: es lo único de la página que tiene
                  derecho a ser grande, y la voz humana acá vale más que el peso. */}
              <h1 className="max-w-xl text-[3rem] leading-[0.97] font-semibold tracking-[-0.035em] text-tinta sm:text-[4.1rem]">
                Compra y vende{' '}
                <span className="relative inline-block text-verde">
                  sin miedo
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 200 12"
                    preserveAspectRatio="none"
                    className="absolute -bottom-1 left-0 h-[0.42em] w-full text-verde/25"
                  >
                    <path
                      d="M2 8.5C42 3.5 92 2.5 198 5.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="5"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                .
              </h1>
              <p className="max-w-lg text-base leading-relaxed text-tinta-2 sm:text-lg">
                La plata queda protegida hasta la entrega. Tú vendes por Marketplace o WhatsApp;
                Caserita se encarga de que el trato sea seguro.
              </p>
            </div>

            {error && <Aviso tono="error">{error}</Aviso>}

            <div className="max-w-md space-y-3">
              <Boton onClick={() => setConfirmandoIngreso(true)} cargando={ocupado}>
                Iniciar sesión con Google <Icono nombre="flecha" className="size-5" />
              </Boton>
              <p className="flex items-center justify-center gap-1.5 text-center text-xs text-tinta-3">
                <Icono nombre="escudo" className="size-3.5" /> Sin instalar wallets ni guardar frases semilla
              </p>
            </div>

            <div className="grid max-w-lg grid-cols-3 gap-2 pt-2">
              {([
                ['escudo', 'Plata protegida'],
                ['personas', 'De persona a persona'],
                ['hoja', 'Local y simple'],
              ] as [NombreIcono, string][]).map(([icono, texto]) => (
                <div key={texto} className="text-center text-[11px] font-bold leading-tight text-tinta-2">
                  <span className="mx-auto mb-2 grid size-9 place-items-center rounded-xl bg-verde-claro text-verde">
                    <Icono nombre={icono} className="size-5" />
                  </span>
                  {texto}
                </div>
              ))}
            </div>
          </section>

          <section className="relative">
            <div className="absolute -top-5 -right-3 size-24 rounded-full bg-verde-claro blur-2xl" />
            <div className="tarjeta relative overflow-hidden p-5 sm:p-7">
              <div className="patron-casas -mx-5 -mt-5 mb-6 flex items-center gap-3 bg-verde px-5 py-5 text-white sm:-mx-7 sm:-mt-7 sm:px-7">
                <Isotipo tono="claro" className="size-12" />
                <div>
                  <p className="text-lg font-black">Así funciona Caserita</p>
                  <p className="text-xs text-white/75">Tres pasos y un trato tranquilo</p>
                </div>
              </div>
              <ol className="space-y-5">
                {([
                  ['enlace', 'Creas y compartes', 'Define el producto, el monto y manda el link.'],
                  ['escudo', 'La plata queda en custodia', 'El pago se confirma en la red, pero aún no llega al vendedor.'],
                  ['codigo', 'Entregas y cobras', 'El código de 6 dígitos libera el pago al instante.'],
                ] as [NombreIcono, string, string][]).map(([icono, titulo, detalle], i) => (
                  <li key={titulo} className="flex gap-4">
                    <span className="relative grid size-11 shrink-0 place-items-center rounded-2xl bg-verde-claro text-verde">
                      <Icono nombre={icono} className="size-5" />
                      <span className="absolute -top-1 -right-1 grid size-4 place-items-center rounded-full bg-naranja text-[9px] font-black text-white">{i + 1}</span>
                    </span>
                    <div>
                      <p className="font-extrabold">{titulo}</p>
                      <p className="mt-0.5 text-sm leading-relaxed text-tinta-2">{detalle}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="mt-6 rounded-2xl bg-papel-2 px-4 py-3 text-center text-xs font-bold text-tinta-2">
                Lo bueno de tu comunidad, ahora en un solo lugar.
              </div>
            </div>

            <div className="mt-4">
              <PanelConfianza />
            </div>
          </section>
        </div>
      </main>
      <DialogoConfirmacion
        abierto={confirmandoIngreso}
        titulo="Iniciar sesión con Google"
        detalle={<><p>Caserita usará tu cuenta para identificarte y proteger tus tratos.</p><p className="mt-2 font-semibold text-tinta">¿Es tu cuenta y es un dispositivo de confianza?</p></>}
        confirmar="Continuar"
        cargando={ocupado}
        alCerrar={() => setConfirmandoIngreso(false)}
        alConfirmar={() => { setConfirmandoIngreso(false); void entrar(); }}
      />
    </>
  );
}
