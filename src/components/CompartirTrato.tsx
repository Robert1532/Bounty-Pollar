'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Boton } from './ui/Boton';
import type { TratoPublico } from '@/lib/cliente/tipos';
import { Icono } from './Marca';

/**
 * El link es el producto: se crea el trato y se comparte.
 *
 * Caserita no manda el mensaje por el vendedor ni elige por él la aplicación:
 * entrega el link y el QR, y él decide dónde pegarlo. El botón "Compartir" usa
 * el selector del propio teléfono cuando existe, así que el vendedor ve sus
 * aplicaciones, no las que nosotros hayamos decidido poner.
 */
export function CompartirTrato({ trato }: { trato: TratoPublico }) {
  const [url, setUrl] = useState('');
  const [qr, setQr] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [puedeCompartir, setPuedeCompartir] = useState(false);

  useEffect(() => {
    const completa = `${window.location.origin}/t/${trato.id}`;
    setUrl(completa);
    setPuedeCompartir(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
    QRCode.toDataURL(completa, { width: 512, margin: 2, color: { dark: '#064f40', light: '#ffffff' } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [trato.id]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  }

  async function compartir() {
    try {
      await navigator.share({
        title: `Caserita · ${trato.titulo}`,
        text: `${trato.titulo} — ${Number(trato.montoUsdc).toFixed(2)} USDC con la plata en custodia.`,
        url,
      });
    } catch {
      // El usuario canceló el selector. No es un error.
    }
  }

  return (
    <section className="tarjeta space-y-5 p-5 sm:p-6">
      <div>
        <p className="text-xs font-black tracking-[.1em] text-verde uppercase">Siguiente paso</p>
        <h2 className="mt-1 text-xl font-black">Mándale el link a tu comprador</h2>
        <p className="mt-1 text-sm text-tinta-2">Puede abrirlo desde cualquier chat o escanear el QR.</p>
      </div>

      {qr && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={qr}
          alt="Código QR del trato"
          className="mx-auto w-48 rounded-[1.4rem] border-8 border-white shadow-[0_12px_35px_rgba(21,51,43,0.12)]"
          width={176}
          height={176}
        />
      )}

      <div className="numeros truncate rounded-2xl border border-borde bg-papel-2 px-4 py-3 text-sm text-tinta-2">{url}</div>

      <div className={puedeCompartir ? 'grid grid-cols-2 gap-2' : ''}>
        <Boton variante={puedeCompartir ? 'fantasma' : 'primario'} onClick={() => void copiar()}>
          <Icono nombre={copiado ? 'check' : 'copiar'} className="size-4" /> {copiado ? 'Copiado' : 'Copiar link'}
        </Boton>
        {puedeCompartir && (
          <Boton onClick={() => void compartir()}>
            <Icono nombre="enlace" className="size-4" /> Compartir
          </Boton>
        )}
      </div>
    </section>
  );
}
