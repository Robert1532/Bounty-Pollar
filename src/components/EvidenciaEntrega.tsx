'use client';

import { useEffect, useRef, useState } from 'react';
import { get } from '@/lib/cliente/api';
import type { Evidencia, TratoPublico } from '@/lib/cliente/tipos';
import { Aviso } from './ui/Aviso';
import { Spinner } from './ui/Boton';
import { Icono } from './Marca';

const MAX_BYTES = 5 * 1024 * 1024;
const TIPOS = 'image/jpeg,image/png,image/webp';

/**
 * Adjuntar la foto de la entrega. Opcional a propósito, y así se dice en
 * pantalla: nadie debería creer que subir una foto lo obliga a nada, ni que
 * dejar de subirla le quita su pago.
 */
export function SubirEvidencia({
  trato,
  alSubir,
}: {
  trato: TratoPublico;
  alSubir: (trato: TratoPublico) => void;
}) {
  const entrada = useRef<HTMLInputElement | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);

  // Las URLs de objeto se sueltan al desmontar: si no, el navegador se queda
  // con la foto en memoria hasta que se cierre la pestaña.
  useEffect(() => () => {
    if (vistaPrevia) URL.revokeObjectURL(vistaPrevia);
  }, [vistaPrevia]);

  async function subir(archivo: File) {
    setError(null);
    if (archivo.size > MAX_BYTES) {
      setError('La foto no puede pesar más de 5 MB.');
      return;
    }

    setSubiendo(true);
    const previa = URL.createObjectURL(archivo);
    setVistaPrevia((anterior) => {
      if (anterior) URL.revokeObjectURL(anterior);
      return previa;
    });

    try {
      const cuerpo = new FormData();
      cuerpo.append('foto', archivo);
      // Sin Content-Type manual: el navegador arma el boundary del multipart.
      const respuesta = await fetch(`/api/tratos/${trato.id}/evidencia`, {
        method: 'POST',
        body: cuerpo,
        credentials: 'same-origin',
      });
      const json = (await respuesta.json()) as
        | { ok: true; data: TratoPublico }
        | { ok: false; error: { mensaje: string } };

      if (!respuesta.ok || json.ok === false) {
        throw new Error('error' in json ? json.error.mensaje : 'No pudimos subir la foto.');
      }
      alSubir(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos subir la foto.');
      setVistaPrevia(null);
    } finally {
      setSubiendo(false);
    }
  }

  const yaTiene = trato.tieneEvidencia;

  return (
    <div className="rounded-2xl border border-dashed border-verde/25 bg-papel-2/60 p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-verde-claro text-verde">
          <Icono nombre="paquete" className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold">
            Foto de la entrega <span className="font-semibold text-tinta-3">· opcional</span>
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-tinta-2">
            Queda guardada con hora y huella digital, y el comprador también la ve. No cambia las
            reglas del pago: sirve para que después nadie discuta qué se entregó.
          </p>
        </div>
      </div>

      {(vistaPrevia || yaTiene) && (
        <div className="mt-3 flex items-center gap-3 rounded-xl bg-superficie px-3 py-2">
          {vistaPrevia ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={vistaPrevia} alt="Foto de la entrega" className="size-12 rounded-lg object-cover" />
          ) : (
            <span className="grid size-12 place-items-center rounded-lg bg-verde-claro text-verde">
              <Icono nombre="check" className="size-5" />
            </span>
          )}
          <p className="text-xs font-semibold text-verde-oscuro">
            {subiendo ? 'Subiendo…' : 'Foto adjuntada'}
          </p>
        </div>
      )}

      {error && (
        <div className="mt-3">
          <Aviso tono="error">{error}</Aviso>
        </div>
      )}

      <input
        ref={entrada}
        type="file"
        accept={TIPOS}
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          e.target.value = '';
          if (archivo) void subir(archivo);
        }}
      />

      <button
        type="button"
        disabled={subiendo}
        onClick={() => entrada.current?.click()}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-verde/20 bg-superficie py-2.5 text-sm font-bold text-verde-oscuro transition hover:bg-verde-claro/50 disabled:opacity-50"
      >
        {subiendo ? <Spinner /> : <Icono nombre="paquete" className="size-4" />}
        {yaTiene ? 'Cambiar la foto' : 'Tomar o elegir una foto'}
      </button>
    </div>
  );
}

/**
 * Ver la foto. La URL se pide al abrir y caduca: con Supabase es una URL
 * firmada de 5 minutos, y en modo demo una ruta que vuelve a comprobar la
 * sesión. La foto nunca queda colgada en internet.
 */
export function VerEvidencia({ trato }: { trato: TratoPublico }) {
  const [evidencia, setEvidencia] = useState<Evidencia | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [abierta, setAbierta] = useState(false);

  useEffect(() => {
    if (!abierta || evidencia) return;
    let vivo = true;
    get<Evidencia | null>(`/api/tratos/${trato.id}/evidencia`)
      .then((d) => vivo && setEvidencia(d))
      .catch((e) => vivo && setError(e instanceof Error ? e.message : 'No pudimos abrir la foto.'));
    return () => {
      vivo = false;
    };
  }, [abierta, evidencia, trato.id]);

  if (!trato.tieneEvidencia || trato.rol === 'visitante') return null;

  return (
    <section className="tarjeta p-5">
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-verde-claro text-verde">
          <Icono nombre="paquete" className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-extrabold">Foto de la entrega</h2>
          <p className="text-xs text-tinta-3">
            Adjuntada por el vendedor el {fecha(trato.evidenciaSubidaEn)}
          </p>
        </div>
        {!abierta && (
          <button
            onClick={() => setAbierta(true)}
            className="shrink-0 rounded-full bg-papel-2 px-3 py-1.5 text-xs font-bold text-tinta-2 hover:bg-verde-claro hover:text-verde-oscuro"
          >
            Ver
          </button>
        )}
      </div>

      {abierta && (
        <div className="mt-4">
          {error ? (
            <Aviso tono="error">{error}</Aviso>
          ) : evidencia ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={evidencia.url}
                alt="Foto de la entrega"
                className="w-full rounded-2xl border border-borde"
              />
              <p className="numeros mt-2 truncate text-[10px] text-tinta-3" title={evidencia.hash}>
                SHA-256 {evidencia.hash}
              </p>
            </>
          ) : (
            <div className="grid h-24 place-items-center">
              <Spinner />
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function fecha(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-BO', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
