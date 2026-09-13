'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Aviso } from './ui/Aviso';
import { Boton } from './ui/Boton';
import { useSesion } from '@/lib/cliente/sesion';
import { ErrorApi, post } from '@/lib/cliente/api';
import { aStroops } from '@/lib/money';
import type { TratoPublico } from '@/lib/cliente/tipos';
import { Icono, type NombreIcono } from './Marca';
import { DialogoConfirmacion } from './ui/DialogoConfirmacion';

/**
 * El pago del comprador.
 *
 * Este componente es el único que llama a `/confirmar`, y lo hace en momentos
 * puntuales — nunca con un temporizador:
 *
 *   1. Antes de pagar, una vez, para no crear un segundo pago si el anterior ya
 *      había llegado a la red.
 *   2. Después de firmar, con reintentos acotados, mientras Horizon indexa la
 *      transacción (suele tardar unos segundos).
 *   3. Al volver a la página, si este navegador tiene anotado un pago de este
 *      trato que quedó sin confirmar.
 *
 * El backend no cree en el resultado del cliente: va a mirar la red. Por eso
 * reintentar siempre es seguro, y por eso un `/confirmar` que responde
 * "todavía no está" no es un error del sistema, es la respuesta correcta.
 */

/** Marca local de "ya firmé este pago". Solo sirve para reanudar la confirmación. */
const clavePago = (tratoId: string) => `caserita:pago:${tratoId}`;

function anotarPago(tratoId: string, hash: string) {
  try {
    window.localStorage.setItem(clavePago(tratoId), JSON.stringify({ hash, ts: Date.now() }));
  } catch {
    /* almacenamiento bloqueado: se pierde la reanudación, no el pago */
  }
}

function leerPago(tratoId: string): string | null {
  try {
    const crudo = window.localStorage.getItem(clavePago(tratoId));
    if (!crudo) return null;
    const { hash, ts } = JSON.parse(crudo) as { hash?: string; ts?: number };
    // Una marca vieja ya no sirve: a esa altura la confirmó el cron.
    if (!hash || !ts || Date.now() - ts > 24 * 60 * 60 * 1000) return null;
    return hash;
  } catch {
    return null;
  }
}

function olvidarPago(tratoId: string) {
  try {
    window.localStorage.removeItem(clavePago(tratoId));
  } catch {
    /* nada que hacer */
  }
}

export function PagarTrato({ trato, alActualizar }: { trato: TratoPublico; alActualizar: (t: TratoPublico) => void }) {
  const { usuario, entrar, pagar, ocupado, modoMock, config, saldoUsdc, refrescarSaldo } = useSesion();
  const [paso, setPaso] = useState<'listo' | 'pagando' | 'confirmando'>('listo');
  const [error, setError] = useState<string | null>(null);
  const [confirmandoIngreso, setConfirmandoIngreso] = useState(false);
  const reanudado = useRef(false);

  const esVendedor = trato.rol === 'vendedor';
  const tratoId = trato.id;

  const confirmarConReintentos = useCallback(
    async (hash?: string, intentos = 6): Promise<boolean> => {
      for (let i = 0; i < intentos; i++) {
        try {
          const actualizado = await post<TratoPublico>(`/api/tratos/${tratoId}/confirmar`, hash ? { hash } : {});
          if (actualizado.estado !== 'PUBLICADO') {
            olvidarPago(tratoId);
            alActualizar(actualizado);
            return true;
          }
        } catch (e) {
          // Solo "todavía no aparece" justifica esperar y reintentar. Cualquier
          // otra cosa (monto distinto, sesión caída) se muestra y se corta.
          if (e instanceof ErrorApi && e.codigo !== 'DEPOSITO_NO_ENCONTRADO') {
            setError(e.message);
            return false;
          }
        }
        await new Promise((r) => setTimeout(r, 2500));
      }
      return false;
    },
    [alActualizar, tratoId],
  );

  // Saldo al entrar: es lo que permite avisar antes de firmar en vez de dejar
  // que la red rechace el pago con un código que no le dice nada al usuario.
  useEffect(() => {
    if (usuario && !esVendedor) void refrescarSaldo();
  }, [usuario, esVendedor, refrescarSaldo]);

  // Reanudar: este navegador firmó un pago de este trato y quedó sin confirmar
  // (se cerró la pestaña, se cayó la conexión). Se intenta una sola vez.
  useEffect(() => {
    if (!usuario || esVendedor || trato.estado !== 'PUBLICADO' || reanudado.current) return;
    const hash = leerPago(tratoId);
    if (!hash) return;

    reanudado.current = true;
    setPaso('confirmando');
    void confirmarConReintentos(hash, 4)
      .then((listo) => {
        if (!listo) olvidarPago(tratoId);
      })
      .finally(() => setPaso('listo'));
  }, [usuario, esVendedor, trato.estado, tratoId, confirmarConReintentos]);

  async function ejecutar() {
    setError(null);
    setPaso('pagando');
    try {
      // 1. ¿Ya había un pago para este trato? Evita cobrar dos veces por un
      //    doble clic o por un intento anterior que sí llegó a la red.
      try {
        const existente = await post<TratoPublico>(`/api/tratos/${tratoId}/confirmar`, {});
        alActualizar(existente);
        return;
      } catch (e) {
        if (!(e instanceof ErrorApi) || e.codigo !== 'DEPOSITO_NO_ENCONTRADO') throw e;
      }

      // 2. Saldo. Si Pollar ya nos dijo cuánto USDC hay, no tiene sentido pedir
      //    una firma que la red va a rechazar.
      if (saldoUsdc !== null && aStroops(saldoUsdc) < aStroops(trato.montoUsdc)) {
        throw new Error(
          `Te faltan USDC: tienes ${Number(saldoUsdc).toFixed(2)} y este trato son ${Number(
            trato.montoUsdc,
          ).toFixed(2)}.`,
        );
      }

      // 3. Firmar y anotar el hash antes de confirmar: si la pestaña se cierra
      //    justo acá, al volver se reanuda la confirmación en vez de perderse.
      const hash = await pagar(trato);
      anotarPago(tratoId, hash);

      setPaso('confirmando');
      const listo = await confirmarConReintentos(hash);
      if (!listo) {
        setError(
          'El pago salió y quedó anotado. La red todavía no lo muestra: esta página se actualiza sola en cuanto aparezca.',
        );
      }
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

  const sinSaldo = saldoUsdc !== null && aStroops(saldoUsdc) < aStroops(trato.montoUsdc);

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

      {usuario && saldoUsdc !== null && (
        <p className="text-center text-xs text-tinta-3">
          Tu saldo: <strong className="numeros text-tinta-2">{Number(saldoUsdc).toFixed(2)} USDC</strong>
        </p>
      )}

      {error && <Aviso tono="error">{error}</Aviso>}

      {sinSaldo && config?.red === 'testnet' && (
        <Aviso tono="alerta">
          Estás en testnet y tu wallet no tiene USDC de prueba. Consigue 20 USDC gratis en
          faucet.circle.com eligiendo <strong>Stellar Testnet</strong> y pegando tu dirección.
        </Aviso>
      )}

      {!usuario ? (
        <Boton onClick={() => setConfirmandoIngreso(true)} cargando={ocupado}>
          Iniciar sesión con Google para pagar
        </Boton>
      ) : (
        <Boton onClick={() => void ejecutar()} cargando={paso !== 'listo'} disabled={sinSaldo}>
          {paso === 'pagando'
            ? 'Pagando…'
            : paso === 'confirmando'
              ? 'Confirmando en la red…'
              : sinSaldo
                ? 'Sin USDC suficiente'
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
