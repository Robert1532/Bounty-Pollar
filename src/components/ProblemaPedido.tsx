'use client';

import { useState } from 'react';
import type { TratoPublico } from '@/lib/cliente/tipos';
import { post } from '@/lib/cliente/api';
import { Aviso } from './ui/Aviso';
import { Boton, claseBoton } from './ui/Boton';

const MOTIVOS = {
  PRODUCTO_DANADO: 'El producto llegó dañado',
  PRODUCTO_INCORRECTO: 'Me entregaron otro producto',
  PEDIDO_INCOMPLETO: 'El pedido está incompleto',
  OTRO: 'Otro problema',
} as const;

type Motivo = keyof typeof MOTIVOS;

export function ProblemaPedido({
  trato,
  alActualizar,
}: {
  trato: TratoPublico;
  alActualizar: (trato: TratoPublico) => void;
}) {
  const [formulario, setFormulario] = useState(false);
  const [motivo, setMotivo] = useState<Motivo>('PRODUCTO_DANADO');
  const [detalle, setDetalle] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const correo = `mailto:hola@caserita.app?subject=${encodeURIComponent(`Problema con trato ${trato.id}`)}&body=${encodeURIComponent(
    `Hola, necesito ayuda con el trato ${trato.id}.\n\nProblema: ${trato.reporteMotivo ? MOTIVOS[trato.reporteMotivo as Motivo] ?? trato.reporteMotivo : ''}\nDetalle: ${trato.reporteDetalle ?? ''}`,
  )}`;

  async function reportar() {
    setCargando(true);
    setError(null);
    try {
      const actualizado = await post<TratoPublico>(`/api/tratos/${trato.id}/reportar`, { motivo, detalle });
      alActualizar(actualizado);
      setFormulario(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos registrar el problema.');
    } finally {
      setCargando(false);
    }
  }

  async function confirmarDevolucion() {
    if (!window.confirm('Confirma solo si ya recibiste el producto devuelto. El pago volverá a la wallet del comprador.')) return;
    setCargando(true);
    setError(null);
    try {
      alActualizar(await post<TratoPublico>(`/api/tratos/${trato.id}/devolver`, { motivo: 'ACORDADA' }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos devolver el pago.');
    } finally {
      setCargando(false);
    }
  }

  if (trato.reportado) {
    return (
      <section className="tarjeta space-y-4 border border-naranja/20 p-5">
        <Aviso tono="alerta">
          <strong>Problema reportado:</strong>{' '}
          {MOTIVOS[trato.reporteMotivo as Motivo] ?? 'el comprador solicitó ayuda'}.
          {trato.estado === 'FINANCIADO'
            ? ' El código quedó bloqueado y el pago sigue protegido.'
            : ' El pago ya había sido liberado y no puede revertirse automáticamente.'}
        </Aviso>
        {trato.reporteDetalle && <p className="rounded-xl bg-papel-2 p-3 text-sm text-tinta-2">“{trato.reporteDetalle}”</p>}

        {trato.estado === 'FINANCIADO' && trato.rol === 'comprador' && (
          <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-tinta-2">
            <li>No compartas el código de entrega.</li>
            <li>Coordina con el vendedor cómo devolver físicamente el producto.</li>
            <li>Cuando el vendedor lo reciba, debe confirmar la devolución para que tu pago vuelva. Si no hay acuerdo, al vencer el plazo podrás recuperarlo.</li>
          </ol>
        )}

        {trato.estado === 'FINANCIADO' && trato.rol === 'vendedor' && (
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-tinta-2">
              Coordina la devolución del producto. Confirma abajo únicamente después de recibirlo; la app devolverá el pago al comprador.
            </p>
            <Boton variante="peligro" cargando={cargando} onClick={() => void confirmarDevolucion()}>
              Ya recibí el producto: reembolsar
            </Boton>
          </div>
        )}

        <a href={correo} className={claseBoton('fantasma')}>
          Contactar a soporte
        </a>
        {error && <Aviso tono="error">{error}</Aviso>}
      </section>
    );
  }

  if (trato.rol !== 'comprador' || (trato.estado !== 'FINANCIADO' && trato.estado !== 'LIBERADO')) return null;

  if (!formulario) {
    return (
      <button
        type="button"
        onClick={() => setFormulario(true)}
        className="w-full rounded-2xl border border-rojo/15 bg-rojo-claro/50 px-5 py-4 text-left text-sm font-extrabold text-rojo transition hover:bg-rojo-claro"
      >
        ¿El producto llegó dañado, incorrecto o incompleto? Reportar problema
      </button>
    );
  }

  return (
    <section className="tarjeta space-y-4 border border-rojo/15 p-5">
      <div>
        <h2 className="font-black">Reportar un problema</h2>
        <p className="mt-1 text-sm leading-relaxed text-tinta-2">
          {trato.estado === 'FINANCIADO'
            ? 'No compartas el código. Al reportar, el pago quedará congelado mientras coordinas la devolución.'
            : 'El pago ya fue liberado. Registraremos el caso para soporte, pero no podemos revertir automáticamente una transferencia confirmada.'}
        </p>
      </div>
      <label className="block text-sm font-bold">
        ¿Qué pasó?
        <select
          value={motivo}
          onChange={(e) => setMotivo(e.target.value as Motivo)}
          className="mt-2 w-full rounded-xl border border-borde bg-superficie px-3 py-3 font-medium outline-none focus:border-verde"
        >
          {Object.entries(MOTIVOS).map(([valor, texto]) => <option key={valor} value={valor}>{texto}</option>)}
        </select>
      </label>
      <label className="block text-sm font-bold">
        Cuéntanos un poco más (opcional)
        <textarea
          value={detalle}
          onChange={(e) => setDetalle(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="Ej.: la pantalla llegó rota y la caja estaba golpeada"
          className="mt-2 w-full resize-none rounded-xl border border-borde bg-superficie px-3 py-3 font-medium outline-none focus:border-verde"
        />
      </label>
      {error && <Aviso tono="error">{error}</Aviso>}
      <div className="grid grid-cols-2 gap-2">
        <Boton variante="fantasma" disabled={cargando} onClick={() => setFormulario(false)}>Cancelar</Boton>
        <Boton variante="peligro" cargando={cargando} onClick={() => void reportar()}>Confirmar reporte</Boton>
      </div>
    </section>
  );
}
