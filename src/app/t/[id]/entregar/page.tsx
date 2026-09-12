'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useEffect, useRef, useState, type FormEvent } from 'react';
import { Encabezado } from '@/components/Encabezado';
import { Aviso } from '@/components/ui/Aviso';
import { Boton, Spinner } from '@/components/ui/Boton';
import { get, post } from '@/lib/cliente/api';
import { useSesion } from '@/lib/cliente/sesion';
import type { TratoPublico } from '@/lib/cliente/tipos';

/**
 * La pantalla de la entrega. El vendedor ingresa los 6 digitos que le muestra
 * el comprador y el pago se libera. Seis casillas grandes porque esto se usa de
 * pie, en la calle, con una mano ocupada.
 */
export default function Entregar({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { usuario, cargando } = useSesion();

  const [trato, setTrato] = useState<TratoPublico | null>(null);
  const [digitos, setDigitos] = useState<string[]>(Array(6).fill(''));
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    get<TratoPublico>(`/api/tratos/${id}`)
      .then(setTrato)
      .catch((e) => setError(e instanceof Error ? e.message : 'No encontramos ese trato.'));
  }, [id]);

  useEffect(() => {
    if (!cargando && !usuario) router.replace('/');
  }, [cargando, router, usuario]);

  function escribir(indice: number, valor: string) {
    const limpio = valor.replace(/\D/g, '');
    if (!limpio) {
      setDigitos((d) => d.map((v, i) => (i === indice ? '' : v)));
      return;
    }
    setDigitos((d) => {
      const copia = [...d];
      // Permite pegar el codigo completo en cualquier casilla.
      for (let i = 0; i < limpio.length && indice + i < 6; i++) copia[indice + i] = limpio[i] as string;
      return copia;
    });
    const siguiente = Math.min(indice + limpio.length, 5);
    refs.current[siguiente]?.focus();
  }

  function retroceder(indice: number, tecla: string) {
    if (tecla === 'Backspace' && !digitos[indice] && indice > 0) refs.current[indice - 1]?.focus();
  }

  const codigo = digitos.join('');

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (codigo.length !== 6) return;
    setError(null);
    setEnviando(true);
    try {
      await post<TratoPublico>(`/api/tratos/${id}/liberar`, { codigo });
      router.push(`/t/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos liberar el pago.');
      setDigitos(Array(6).fill(''));
      refs.current[0]?.focus();
      setEnviando(false);
    }
  }

  if (cargando || !usuario || !trato) {
    return (
      <>
        <Encabezado />
        <main className="contenedor grid place-items-center py-24">
          {error ? <Aviso tono="error">{error}</Aviso> : <Spinner />}
        </main>
      </>
    );
  }

  if (trato.estado !== 'FINANCIADO') {
    return (
      <>
        <Encabezado />
        <main className="contenedor space-y-4 py-10">
          <Aviso tono="alerta">Este trato no tiene plata lista para liberar.</Aviso>
          <Link href={`/t/${id}`}>
            <Boton variante="fantasma">Volver al trato</Boton>
          </Link>
        </main>
      </>
    );
  }

  return (
    <>
      <Encabezado />
      <main className="contenedor space-y-5 py-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Ingresa el código</h1>
          <p className="mt-1 text-sm text-tinta-2">
            Pídele al comprador su código de 6 dígitos <span className="font-semibold">después</span> de
            entregarle {trato.titulo}.
          </p>
        </div>

        <form onSubmit={enviar} className="space-y-4">
          <div className="flex justify-between gap-2">
            {digitos.map((digito, i) => (
              <input
                key={i}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                value={digito}
                onChange={(e) => escribir(i, e.target.value)}
                onKeyDown={(e) => retroceder(i, e.key)}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                aria-label={`Dígito ${i + 1}`}
                className="números h-16 w-full rounded-2xl border border-borde bg-superficie text-center text-2xl font-black focus:border-verde focus:outline-none"
              />
            ))}
          </div>

          {error && <Aviso tono="error">{error}</Aviso>}

          {trato.intentosRestantes <= 2 && !trato.codigoBloqueado && (
            <Aviso tono="alerta">
              Te quedan {trato.intentosRestantes} intentos. A los 5 fallidos el trato se bloquea y la
              plata vuelve al comprador al vencer el plazo.
            </Aviso>
          )}

          <Boton type="submit" cargando={enviando} disabled={codigo.length !== 6}>
            Liberar mi pago
          </Boton>
        </form>

        <Link href={`/t/${id}`} className="block text-center text-sm text-tinta-2 underline">
          Volver al trato
        </Link>
      </main>
    </>
  );
}
