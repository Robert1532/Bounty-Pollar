'use client';

import Link from 'next/link';
import { use, useCallback, useEffect, useState } from 'react';
import { Encabezado } from '@/components/Encabezado';
import { EstadoBadge } from '@/components/EstadoBadge';
import { CompartirTrato } from '@/components/CompartirTrato';
import { PagarTrato } from '@/components/PagarTrato';
import { CodigoComprador } from '@/components/CodigoComprador';
import { Aviso } from '@/components/ui/Aviso';
import { Boton, Spinner, claseBoton } from '@/components/ui/Boton';
import { ErrorApi, get, post } from '@/lib/cliente/api';
import { useSesion } from '@/lib/cliente/sesion';
import type { TratoPublico } from '@/lib/cliente/tipos';
import { Icono } from '@/components/Marca';

const ESTADOS_VIVOS = ['PUBLICADO', 'FINANCIADO', 'LIBERANDO', 'DEVOLVIENDO'];

export default function PaginaTrato({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { usuario, config } = useSesion();

  const [trato, setTrato] = useState<TratoPublico | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accion, setAccion] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setTrato(await get<TratoPublico>(`/api/tratos/${id}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No encontramos ese trato.');
    }
  }, [id]);

  useEffect(() => {
    void cargar();
  }, [cargar, usuario?.id]);

  // En PUBLICADO el sondeo vuelve a consultar Horizon, no solo la base. Esto
  // recupera pagos que se confirmaron después de cerrar o refrescar la página.
  useEffect(() => {
    if (!trato || !ESTADOS_VIVOS.includes(trato.estado)) return;
    const revisar = async () => {
      if (trato.estado === 'PUBLICADO' && usuario) {
        try {
          setTrato(await post<TratoPublico>(`/api/tratos/${trato.id}/confirmar`, {}));
          return;
        } catch (e) {
          if (!(e instanceof ErrorApi) || e.codigo !== 'DEPOSITO_NO_ENCONTRADO') return;
        }
      }
      await cargar();
    };
    const t = setInterval(() => void revisar(), 6000);
    return () => clearInterval(t);
  }, [trato, cargar, usuario]);

  if (error) {
    return (
      <>
        <Encabezado />
        <main className="contenedor mx-auto max-w-2xl space-y-4 py-10">
          <Aviso tono="error">{error}</Aviso>
          <Link href="/" className={claseBoton('fantasma')}>
            Ir al inicio
          </Link>
        </main>
      </>
    );
  }

  if (!trato) {
    return (
      <>
        <Encabezado />
        <main className="contenedor grid place-items-center py-24">
          <Spinner />
        </main>
      </>
    );
  }

  async function ejecutar(ruta: string, etiqueta: string) {
    setAccion(etiqueta);
    try {
      setTrato(await post<TratoPublico>(ruta, {}));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar la acción.');
    } finally {
      setAccion(null);
    }
  }

  const esVendedor = trato.rol === 'vendedor';
  const esComprador = trato.rol === 'comprador';
  const red = config?.red ?? 'testnet';
  const plazoVencido = Boolean(trato.liberaHasta && new Date(trato.liberaHasta).getTime() <= Date.now());

  return (
    <>
      <Encabezado />
      <main className="contenedor py-6 pb-16">
        <div className="mx-auto max-w-2xl space-y-4">
        <section className="tarjeta relative overflow-hidden p-5 sm:p-7">
          <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-verde via-[#65ad65] to-[#d8eaaa]" />
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="mb-1 text-[10px] font-black tracking-[.12em] text-tinta-3 uppercase">Trato #{trato.id}</p>
              <h1 className="text-xl leading-tight font-black sm:text-2xl">{trato.titulo}</h1>
            </div>
            <EstadoBadge estado={trato.estado} />
          </div>

          <div className="mt-5 rounded-2xl bg-verde-claro/60 p-4">
            <p className="numeros text-4xl font-black tracking-tight text-verde-oscuro sm:text-5xl">
              {Number(trato.montoUsdc).toFixed(2)} <span className="text-lg text-verde/70 sm:text-xl">USDC</span>
            </p>
          {trato.montoBsReferencia && (
              <p className="mt-1 text-sm font-semibold text-tinta-3">≈ Bs {Number(trato.montoBsReferencia).toFixed(2)}</p>
          )}
          </div>

          {trato.descripcion && <p className="mt-4 text-sm leading-relaxed text-tinta-2">{trato.descripcion}</p>}
          {trato.lugarEntrega && (
            <p className="mt-4 flex items-start gap-2 text-sm text-tinta-2">
              <Icono nombre="ubicacion" className="mt-0.5 size-4 shrink-0 text-verde" />
              <span><strong className="text-tinta">Entrega:</strong> {trato.lugarEntrega}</span>
            </p>
          )}

          {trato.liberaHasta && trato.estado === 'FINANCIADO' && (
            <p className="mt-4 flex items-start gap-2 border-t border-borde pt-4 text-sm text-naranja">
              <Icono nombre="reloj" className="mt-0.5 size-4 shrink-0" />
              Si no hay entrega, la plata vuelve al comprador el {fechaCorta(trato.liberaHasta)}.
            </p>
          )}
        </section>

        {trato.estado === 'PUBLICADO' &&
          (esVendedor ? <CompartirTrato trato={trato} /> : <PagarTrato trato={trato} alActualizar={setTrato} />)}

        {trato.estado === 'FINANCIADO' && esComprador && <CodigoComprador tratoId={trato.id} />}

        {trato.estado === 'FINANCIADO' && esVendedor && (
          <section className="space-y-3">
            <Aviso tono="ok">
              El comprador ya pagó y la plata está en custodia. Entrega el producto y pídele su código.
            </Aviso>
            <Link href={`/t/${trato.id}/entregar`} className={claseBoton()}>
              Ya entregué: ingresar código
            </Link>
          </section>
        )}

        {trato.estado === 'FINANCIADO' && esComprador && plazoVencido && (
          <Boton
            variante="fantasma"
            cargando={accion === 'devolver'}
            onClick={() => {
              if (window.confirm('El plazo venció. ¿Confirmas que quieres devolver el pago a tu wallet?')) {
                void ejecutar(`/api/tratos/${trato.id}/devolver`, 'devolver');
              }
            }}
          >
            Plazo vencido: devolver mi plata
          </Boton>
        )}

        {trato.estado === 'PUBLICADO' && esVendedor && (
          <Boton
            variante="peligro"
            cargando={accion === 'cancelar'}
            onClick={() => void ejecutar(`/api/tratos/${trato.id}/cancelar`, 'cancelar')}
          >
            Cancelar trato
          </Boton>
        )}

        {(trato.estado === 'LIBERADO' || trato.estado === 'DEVUELTO') && (
          <Aviso tono={trato.estado === 'LIBERADO' ? 'ok' : 'alerta'}>
            {trato.estado === 'LIBERADO'
              ? 'Listo. El pago se liberó al vendedor.'
              : trato.motivoDevolucion === 'PLAZO_VENCIDO'
                ? 'Venció el plazo sin entrega: la plata volvió al comprador.'
                : 'La plata volvió al comprador.'}
          </Aviso>
        )}

        <Comprobantes trato={trato} red={red} />
        </div>
      </main>
    </>
  );
}

/** Fecha corta y legible: "14 sept, 02:32". */
function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleString('es-BO', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** El historial on-chain es el comprobante que hoy nadie tiene. */
function Comprobantes({ trato, red }: { trato: TratoPublico; red: 'testnet' | 'mainnet' }) {
  const base = red === 'mainnet' ? 'https://stellar.expert/explorer/public' : 'https://stellar.expert/explorer/testnet';
  const filas = [
    ['Depósito del comprador', trato.txDeposito],
    ['Liberación al vendedor', trato.txLiberacion],
    ['Devolución al comprador', trato.txDevolucion],
  ].filter(([, hash]) => Boolean(hash)) as [string, string][];

  if (filas.length === 0) return null;

  return (
    <section className="tarjeta space-y-3 p-5">
      <div className="flex items-center gap-2">
        <span className="grid size-9 place-items-center rounded-xl bg-verde-claro text-verde"><Icono nombre="escudo" className="size-5" /></span>
        <div><h2 className="font-extrabold">Comprobantes en la red</h2><p className="text-xs text-tinta-3">Transacciones verificables en Stellar</p></div>
      </div>
      {filas.map(([etiqueta, hash]) => (
        <a
          key={hash}
          href={`${base}/tx/${hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-3 rounded-2xl bg-papel-2 px-4 py-3 text-xs transition hover:bg-verde-claro/60"
        >
          <span className="min-w-0 flex-1"><span className="block font-bold text-tinta-2">{etiqueta}</span><span className="numeros block truncate text-tinta-3">{hash}</span></span>
          <Icono nombre="externo" className="size-4 shrink-0 text-tinta-3 group-hover:text-verde" />
        </a>
      ))}
    </section>
  );
}
