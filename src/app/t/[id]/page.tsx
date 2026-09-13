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
import { get, post } from '@/lib/cliente/api';
import { useSesion } from '@/lib/cliente/sesion';
import type { TratoPublico } from '@/lib/cliente/tipos';
import { Icono } from '@/components/Marca';
import { ReputacionVendedor } from '@/components/ReputacionVendedor';
import { VerEvidencia } from '@/components/EvidenciaEntrega';
import { Calificar } from '@/components/Calificar';
import { ProblemaPedido } from '@/components/ProblemaPedido';

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

  /**
   * Sondeo del estado.
   *
   * Solo lee: `GET /api/tratos/[id]`. Antes esto llamaba a `/confirmar` en cada
   * vuelta para atrapar pagos hechos en otra pestaña, y el efecto secundario era
   * feo — una petición de verificación contra Horizon cada 6 segundos por cada
   * pestaña abierta, y un log lleno de errores para algo que todavía no había
   * pasado.
   *
   * Confirmar es una acción, no una consulta, y tiene tres disparadores
   * legítimos, todos puntuales: el comprador termina de pagar, el comprador
   * vuelve a una pestaña donde había pagado (lo maneja `PagarTrato`), o el cron
   * de vencimientos barre los tratos pendientes en el servidor. Ninguno necesita
   * un temporizador en el navegador.
   */
  useEffect(() => {
    if (!trato || !ESTADOS_VIVOS.includes(trato.estado)) return;
    const t = setInterval(() => void cargar(), 6000);
    return () => clearInterval(t);
  }, [trato, cargar]);

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

        {/* El historial del vendedor va antes del botón de pagar: es la pregunta
            que el comprador se hace justo antes de tocarlo. */}
        {!esVendedor && trato.vendedor && <ReputacionVendedor reputacion={trato.vendedor} />}

        {trato.estado === 'PUBLICADO' &&
          (esVendedor ? <CompartirTrato trato={trato} /> : <PagarTrato trato={trato} alActualizar={setTrato} />)}

        {trato.estado === 'FINANCIADO' && esComprador && !trato.reportado && <CodigoComprador tratoId={trato.id} />}

        {trato.estado === 'FINANCIADO' && esVendedor && !trato.reportado && (
          <section className="space-y-3">
            <Aviso tono="ok">
              El comprador ya pagó y la plata está en custodia. Entrega el producto y pídele su código.
            </Aviso>
            <Link href={`/t/${trato.id}/entregar`} className={claseBoton()}>
              Ya entregué: ingresar código
            </Link>
          </section>
        )}

        <ProblemaPedido trato={trato} alActualizar={setTrato} />

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

        {/* Calificar va después del aviso de "listo": primero se entera de que
            cobró/recibió, después se le pide la opinión. */}
        <Calificar trato={trato} alCalificar={() => void cargar()} />

        <VerEvidencia trato={trato} />

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

/** Comprobantes legibles primero; el hash técnico queda disponible sin dominar la pantalla. */
function Comprobantes({ trato, red }: { trato: TratoPublico; red: 'testnet' | 'mainnet' }) {
  const base = red === 'mainnet' ? 'https://stellar.expert/explorer/public' : 'https://stellar.expert/explorer/testnet';
  const filas = [
    ['Pago recibido y protegido', 'El dinero entró a la custodia de Caserita.', trato.txDeposito],
    ['Pago enviado al vendedor', 'El comprador aprobó la entrega con su código.', trato.txLiberacion],
    ['Pago devuelto al comprador', 'El dinero regresó a la wallet que pagó.', trato.txDevolucion],
  ].filter(([, , hash]) => Boolean(hash)) as [string, string, string][];

  if (filas.length === 0) return null;

  return (
    <section className="tarjeta space-y-4 p-5">
      <div className="flex items-center gap-2">
        <span className="grid size-9 place-items-center rounded-xl bg-verde-claro text-verde"><Icono nombre="escudo" className="size-5" /></span>
        <div><h2 className="font-extrabold">Comprobantes del pago</h2><p className="text-xs text-tinta-3">Confirman que el dinero se movió correctamente</p></div>
      </div>
      <p className="rounded-xl bg-verde-claro/50 px-3 py-2 text-xs leading-relaxed text-verde-oscuro">
        No necesitas entender códigos técnicos. Cada comprobante se puede verificar públicamente en Stellar.
      </p>
      {filas.map(([etiqueta, detalle, hash]) => (
        <div key={hash} className="rounded-2xl bg-papel-2 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-verde-claro text-verde"><Icono nombre="check" className="size-4" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-extrabold text-tinta">{etiqueta}</span>
              <span className="block text-xs leading-relaxed text-tinta-3">{detalle}</span>
            </span>
            <a href={`${base}/tx/${hash}`} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-verde hover:underline">
              Ver en Stellar <Icono nombre="externo" className="size-3.5" />
            </a>
          </div>
          <details className="mt-2 pl-11 text-[11px] text-tinta-3">
            <summary className="cursor-pointer select-none font-semibold">Ver código técnico</summary>
            <p className="numeros mt-1 break-all">{hash}</p>
          </details>
        </div>
      ))}
    </section>
  );
}
