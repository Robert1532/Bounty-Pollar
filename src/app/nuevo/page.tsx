'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, type FormEvent } from 'react';
import { Encabezado } from '@/components/Encabezado';
import { Aviso } from '@/components/ui/Aviso';
import { Boton } from '@/components/ui/Boton';
import { AreaTexto, Campo } from '@/components/ui/Campo';
import { useSesion } from '@/lib/cliente/sesion';
import { post } from '@/lib/cliente/api';
import type { TratoPublico } from '@/lib/cliente/tipos';

export default function NuevoTrato() {
  const router = useRouter();
  const { usuario, config, entrar, ocupado } = useSesion();

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

  if (!usuario) {
    return (
      <>
        <Encabezado />
        <main className="contenedor space-y-4 py-10">
          <Aviso tono="info">Entra con tu cuenta para crear un trato.</Aviso>
          <Boton onClick={() => void entrar()} cargando={ocupado}>
            Entrar con Google
          </Boton>
        </main>
      </>
    );
  }

  return (
    <>
      <Encabezado />
      <main className="contenedor py-5 pb-28">
        <h1 className="mb-5 text-2xl font-black tracking-tight">Nuevo trato</h1>

        <form onSubmit={enviar} className="space-y-4">
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
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-sm font-semibold text-tinta-2">Monto</span>
              <div className="flex rounded-full bg-papel-2 p-0.5 text-xs font-bold">
                {(['BS', 'USDC'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMoneda(m)}
                    className={`rounded-full px-3 py-1 ${moneda === m ? 'bg-superficie shadow-sm' : 'text-tinta-2'}`}
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
              className="números w-full rounded-2xl border border-borde bg-superficie px-4 py-3.5 text-2xl font-bold focus:border-verde focus:outline-none"
            />
            <div className="mt-1.5 flex justify-between text-xs text-tinta-3">
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
            Al crear el trato generamos un código de 6 dígitos. El comprador lo recibe al pagar y te lo
            muestra en la entrega: es lo que libera tu pago.
          </Aviso>

          <Boton type="submit" cargando={enviando}>
            Crear trato y obtener el link
          </Boton>
        </form>
      </main>
    </>
  );
}
