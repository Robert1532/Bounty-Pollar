'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Encabezado } from '@/components/Encabezado';
import { Aviso } from '@/components/ui/Aviso';
import { Boton, Spinner } from '@/components/ui/Boton';
import { AreaTexto, Campo } from '@/components/ui/Campo';
import { useSesion } from '@/lib/cliente/sesion';
import { post } from '@/lib/cliente/api';
import type { TratoPublico } from '@/lib/cliente/tipos';
import { Icono } from '@/components/Marca';

export default function NuevoTrato() {
  const router = useRouter();
  const { usuario, config, cargando } = useSesion();

  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [lugar, setLugar] = useState('');
  const [moneda, setMoneda] = useState<'BS' | 'USDC'>('BS');
  const [monto, setMonto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const equivalente = useMemo(() => {
    const n = Number(monto);
    if (!config || !Number.isFinite(n) || n <= 0) return null;
    return moneda === 'BS'
      ? `≈ ${(n / config.tipoCambioBs).toFixed(2)} USDC`
      : `≈ Bs ${(n * config.tipoCambioBs).toFixed(2)}`;
  }, [monto, moneda, config]);

  useEffect(() => {
    if (!cargando && !usuario) router.replace('/');
  }, [cargando, router, usuario]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const { trato } = await post<{ trato: TratoPublico; url: string }>('/api/tratos', {
        titulo,
        descripcion,
        lugarEntrega: lugar,
        moneda,
        monto: Number(monto),
      });
      router.push(`/t/${trato.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos crear el trato.');
      setEnviando(false);
    }
  }

  if (cargando || !usuario) {
    return (
      <>
        <Encabezado />
        <main className="contenedor grid place-items-center py-24">
          <Spinner />
        </main>
      </>
    );
  }

  return (
    <>
      <Encabezado />
      <main className="contenedor py-6 pb-16">
        <div className="columna">
        <div className="mb-6">
          <p className="text-xs font-black tracking-[.12em] text-verde uppercase">Vender con seguridad</p>
          <h1 className="titulo-pagina mt-1">Crea un nuevo trato</h1>
          <p className="mt-2 text-sm leading-relaxed text-tinta-2">Completa los datos y te daremos un link privado para tu comprador.</p>
        </div>

        <form onSubmit={enviar} className="tarjeta space-y-5 p-5 sm:p-6">
          <Campo
            etiqueta="Qué vendes"
            placeholder="Celular Xiaomi Redmi Note 12"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            maxLength={80}
            required
            autoFocus
          />

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="etiqueta-campo mb-0">Monto acordado</span>
              <div className="flex rounded-full border border-borde bg-papel-2 p-0.5 text-xs font-bold">
                {(['BS', 'USDC'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMoneda(m)}
                    className={`rounded-full px-3 py-1.5 transition ${moneda === m ? 'bg-superficie text-verde shadow-sm' : 'text-tinta-2'}`}
                  >
                    {m === 'BS' ? 'Bs' : 'USDC'}
                  </button>
                ))}
              </div>
            </div>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder={moneda === 'BS' ? '350' : '50'}
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              required
              className="entrada numeros text-2xl font-black text-verde-oscuro"
            />
            <div className="mt-2 flex justify-between gap-3 text-xs text-tinta-3">
              <span>{equivalente}</span>
              {config && <span>Máximo {config.montoMaximoUsdc} USDC en esta versión</span>}
            </div>
          </div>

          <Campo
            etiqueta="Dónde o cómo entregas"
            placeholder="Plaza Colón, sábado en la tarde"
            value={lugar}
            onChange={(e) => setLugar(e.target.value)}
            maxLength={120}
          />

          <AreaTexto
            etiqueta="Detalles (opcional)"
            placeholder="Estado del producto, accesorios que incluye, condiciones…"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            maxLength={500}
          />

          {error && <Aviso tono="error">{error}</Aviso>}

          <Aviso tono="info">
            <strong className="block text-tinta">Tu pago estará protegido</strong>
            Al pagar, el comprador recibe un código de 6 dígitos. Te lo muestra durante la entrega y recién entonces cobras.
          </Aviso>

          <Boton type="submit" cargando={enviando}>
            Crear trato y obtener el link <Icono nombre="flecha" className="size-5" />
          </Boton>
        </form>
        </div>
      </main>
    </>
  );
}
