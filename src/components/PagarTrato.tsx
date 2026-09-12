'use client';

import { useState } from 'react';
import { Aviso } from './ui/Aviso';
import { Boton } from './ui/Boton';
import { useSesion } from '@/lib/cliente/sesion';
import { ErrorApi, post } from '@/lib/cliente/api';
import type { TratoPublico } from '@/lib/cliente/tipos';

/**
 * El pago del comprador.
 *
 * Se manda el USDC a la cuenta de custodia con el memo del trato y despues se
 * le pide al backend que lo confirme. El backend no cree en el resultado del
 * cliente: va a mirar la red. Por eso, si el pago salio pero la confirmacion
 * tarda, reintentar es seguro.
 */
export function PagarTrato({ trato, alActualizar }: { trato: TratoPublico; alActualizar: (t: TratoPublico) => void }) {
  const { usuario, entrar, pagar, ocupado, modoMock } = useSesion();
  const [paso, setPaso] = useState<'listo' | 'pagando' | 'confirmando'>('listo');
  const [error, setError] = useState<string | null>(null);

  const esVendedor = trato.rol === 'vendedor';

  async function confirmarConReintentos(hash?: string, intentos = 6): Promise<void> {
    for (let i = 0; i < intentos; i++) {
      try {
        const actualizado = await post<TratoPublico>(`/api/tratos/${trato.id}/confirmar`, hash ? { hash } : {});
        if (actualizado.estado !== 'PUBLICADO') {
          alActualizar(actualizado);
          return;
        }
      } catch {
        /* todavia no aparece en la red: se reintenta */
      }
      await new Promise((r) => setTimeout(r, 2500));
    }
    setError('El pago salió, pero todavía no lo vemos confirmado. Refresca en unos segundos.');
  }

  async function ejecutar() {
    setError(null);
    setPaso('pagando');
    try {
      // Antes de crear otro pago, se comprueba si uno anterior ya llegó. Solo
      // DEPOSITO_NO_ENCONTRADO habilita una transferencia nueva.
      try {
        const existente = await post<TratoPublico>(`/api/tratos/${trato.id}/confirmar`, {});
        alActualizar(existente);
        return;
      } catch (e) {
        if (!(e instanceof ErrorApi) || e.codigo !== 'DEPOSITO_NO_ENCONTRADO') throw e;
      }

      const hash = await pagar(trato);
      setPaso('confirmando');
      await confirmarConReintentos(hash);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos completar el pago.');
    } finally {
      setPaso('listo');
    }
  }

  if (esVendedor) {
    return (
      <Aviso tono="info">
        Este es tu trato. Cuando el comprador pague te avisamos y aparece el botón para entregar.
      </Aviso>
    );
  }

  return (
    <section className="space-y-3">
      <div className="tarjeta space-y-2 p-4 text-sm text-tinta-2">
        <p className="font-bold text-tinta">Qué pasa cuando pagas</p>
        <p>
          Tu plata no le llega al vendedor: queda retenida. Recibes un código de 6 dígitos y solo
          cuando se lo muestres en la entrega se libera el pago.
        </p>
        <p>Si no hay entrega, a las 48 horas el dinero vuelve solo a tu wallet.</p>
      </div>

      {error && <Aviso tono="error">{error}</Aviso>}

      {!usuario ? (
        <Boton onClick={() => void entrar()} cargando={ocupado}>
          Entrar con Google para pagar
        </Boton>
      ) : (
        <Boton onClick={() => void ejecutar()} cargando={paso !== 'listo'}>
          {paso === 'pagando'
            ? 'Pagando…'
            : paso === 'confirmando'
              ? 'Confirmando en la red…'
              : `Pagar ${Number(trato.montoUsdc).toFixed(2)} USDC`}
        </Boton>
      )}

      {modoMock && (
        <p className="text-center text-xs text-tinta-3">
          Modo demo: el pago se simula, no se mueve dinero real.
        </p>
      )}
    </section>
  );
}
