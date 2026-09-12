'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Boton } from './ui/Boton';
import { linkWhatsApp, mensajeInvitacion } from '@/lib/wa';
import type { TratoPublico } from '@/lib/cliente/tipos';

/**
 * El link es el producto: se crea el trato y se manda por WhatsApp. Enlaces
 * wa.me pre-llenados, sin API de terceros ni infraestructura de mensajeria.
 */
export function CompartirTrato({ trato }: { trato: TratoPublico }) {
  const [url, setUrl] = useState('');
  const [qr, setQr] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    const completa = `${window.location.origin}/t/${trato.id}`;
    setUrl(completa);
    QRCode.toDataURL(completa, { width: 512, margin: 1, color: { dark: '#1c1917', light: '#ffffff' } })
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

  const mensaje = mensajeInvitacion({
    titulo: trato.titulo,
    monto: Number(trato.montoUsdc).toFixed(2),
    url,
  });

  return (
    <section className="tarjeta space-y-4 p-4">
      <h2 className="font-bold">Mándale el link a tu comprador</h2>

      {qr && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={qr}
          alt="Código QR del trato"
          className="mx-auto w-44 rounded-2xl border border-borde"
          width={176}
          height={176}
        />
      )}

      <div className="números truncate rounded-2xl bg-papel-2 px-4 py-3 text-sm text-tinta-2">{url}</div>

      <div className="grid grid-cols-2 gap-2">
        <Boton variante="fantasma" onClick={() => void copiar()}>
          {copiado ? 'Copiado' : 'Copiar link'}
        </Boton>
        <a href={linkWhatsApp(mensaje)} target="_blank" rel="noopener noreferrer">
          <Boton>WhatsApp</Boton>
        </a>
      </div>
    </section>
  );
}
