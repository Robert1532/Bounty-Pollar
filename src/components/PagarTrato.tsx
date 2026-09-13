'use client';

import { useState } from 'react';
import { Aviso } from './ui/Aviso';
import { Boton } from './ui/Boton';
import { useSesion } from '@/lib/cliente/sesion';
import { ErrorApi, post } from '@/lib/cliente/api';
import type { TratoPublico } from '@/lib/cliente/tipos';
import { Icono, type NombreIcono } from './Marca';
import { DialogoConfirmacion } from './ui/DialogoConfirmacion';

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
  const [confirmandoIngreso, setConfirmandoIngreso] = useState(false);

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
      <div className="tarjeta p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-verde-claro text-verde"><Icono nombre="escudo" className="size-6" /></span>
          <div><p className="font-black text-tinta">Pagar con seguridad</p><p className="text-xs text-tinta-3">Tu dinero queda protegido</p></div>
        </div>
        <ol className="space-y-4 text-sm text-tinta-2">
          {([
            ['wallet', 'Pagas con USDC desde tu wallet Pollar.'],
            ['escudo', 'El dinero queda en custodia, no va al vendedor.'],
            ['codigo', 'Recibes un código y lo muestras al recibir.'],
            ['reloj', 'Sin entrega, vuelve a tu wallet al vencer el plazo.'],
          ] as [NombreIcono, string][]).map(([icono, texto], i) => (
            <li key={texto} className="flex items-center gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-papel-2 text-verde"><Icono nombre={icono} className="size-4" /></span><span><strong className="text-tinta">{i + 1}.</strong> {texto}</span></li>
          ))}
        </ol>
      </div>

      {error && <Aviso tono="error">{error}</Aviso>}

      {!usuario ? (
        <Boton onClick={() => setConfirmandoIngreso(true)} cargando={ocupado}>
          Iniciar sesión con Google para pagar
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
      <DialogoConfirmacion
        abierto={confirmandoIngreso}
        titulo="Iniciar sesión para pagar"
        detalle={<><p>Caserita usará tu cuenta de Google para crear o recuperar tu wallet segura.</p><p className="mt-2 font-semibold text-tinta">Continúa solamente si esta es tu cuenta.</p></>}
        confirmar="Continuar"
        cargando={ocupado}
        alCerrar={() => setConfirmandoIngreso(false)}
        alConfirmar={() => { setConfirmandoIngreso(false); void entrar(); }}
      />
    </section>
  );
}
