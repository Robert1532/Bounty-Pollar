import {
  Asset,
  BASE_FEE,
  Horizon,
  Keypair,
  Memo,
  Operation,
  TransactionBuilder,
} from '@stellar/stellar-sdk';
import { horizonUrl, serverEnv } from '../env';
import { log } from '../logger';
import { errores } from '../errors';
import { aStroops } from '../money';
import { assetUsdc, passphraseRed } from './asset';
import type { DepositoEncontrado, ResultadoEnvio } from './tipos';

let servidor: Horizon.Server | null = null;

export function horizon(): Horizon.Server {
  servidor ??= new Horizon.Server(horizonUrl());
  return servidor;
}

export function parEscrow(): Keypair {
  const secreto = serverEnv().ESCROW_SECRET_KEY;
  if (!secreto) throw new Error('ESCROW_SECRET_KEY no configurado');
  return Keypair.fromSecret(secreto);
}

/**
 * Busca un deposito de USDC hacia la cuenta de custodia con el memo del trato.
 *
 * Esta funcion es el corazon de la seguridad del producto: el monto y el
 * remitente salen de Horizon, no del cliente. Un comprador puede mentir en el
 * body de la peticion; no puede mentirle a la red.
 */
export async function buscarDeposito(params: {
  memo: string;
  montoMinimo: string;
  limite?: number;
}): Promise<DepositoEncontrado | null> {
  const escrow = parEscrow().publicKey();
  const usdc = assetUsdc();
  const minimo = aStroops(params.montoMinimo);

  let pagina = await horizon()
    .payments()
    .forAccount(escrow)
    .order('desc')
    .limit(params.limite ?? 100)
    .join('transactions')
    .call();

  // Hasta 3 paginas: alcanza de sobra para un trato reciente y acota el gasto
  // si la cuenta de custodia tiene mucho movimiento.
  for (let vuelta = 0; vuelta < 3; vuelta++) {
    for (const registro of pagina.records) {
      if (registro.type !== 'payment') continue;
      if (registro.to !== escrow) continue;
      if (registro.asset_type === 'native') continue;
      if (registro.asset_code !== usdc.getCode()) continue;
      if (registro.asset_issuer !== usdc.getIssuer()) continue;

      const tx = (registro as unknown as { transaction?: { memo?: string; memo_type?: string; successful?: boolean } })
        .transaction;
      if (tx && tx.successful === false) continue;
      const memo = tx?.memo;
      if (memo !== params.memo) continue;

      if (aStroops(registro.amount) < minimo) {
        log.warn('depósito con monto insuficiente', { memo: params.memo, monto: registro.amount });
        continue;
      }

      return {
        hash: registro.transaction_hash,
        monto: registro.amount,
        desde: registro.from,
        memo: params.memo,
        creadoEn: registro.created_at,
      };
    }

    if (pagina.records.length === 0) break;
    pagina = await pagina.next();
  }

  return null;
}

/**
 * Envia USDC desde la cuenta de custodia. Firma el backend con la clave de la
 * app: es el modelo de custodia gestionada de la v1, declarado como tal.
 *
 * Se construye la transaccion, se calcula su hash *antes* de enviarla y se
 * devuelve siempre: si el envio se corta por timeout, el hash permite
 * averiguar despues si en realidad entro, en vez de pagar dos veces.
 */
export async function enviarDesdeEscrow(params: {
  destino: string;
  monto: string;
  memo: string;
  alConstruir?: (hash: string) => Promise<void>;
}): Promise<ResultadoEnvio> {
  const par = parEscrow();
  const usdc: Asset = assetUsdc();

  const cuenta = await horizon().loadAccount(par.publicKey());
  const fee = await tarifaSegura();

  const tx = new TransactionBuilder(cuenta, {
    fee,
    networkPassphrase: passphraseRed(),
  })
    .addOperation(
      Operation.payment({
        destination: params.destino,
        asset: usdc,
        amount: params.monto,
      }),
    )
    .addMemo(Memo.text(params.memo.slice(0, 28)))
    .setTimeout(120)
    .build();

  tx.sign(par);
  const hash = Buffer.from(tx.hash()).toString('hex');
  await params.alConstruir?.(hash);

  try {
    const respuesta = await horizon().submitTransaction(tx);
    return { hash: respuesta.hash, exitoso: true };
  } catch (error) {
    const detalle = extraerDetalleHorizon(error);
    log.error('fallo el envio desde la custodia', { destino: params.destino, hash, detalle });
    throw errores.cadena(mensajeAmigable(detalle), { hash, detalle });
  }
}

export async function consultarTx(hash: string): Promise<{ exitoso: boolean } | null> {
  try {
    const tx = await horizon().transactions().transaction(hash).call();
    return { exitoso: tx.successful };
  } catch {
    return null;
  }
}

export async function tieneTrustlineUsdc(direccion: string): Promise<boolean> {
  const usdc = assetUsdc();
  try {
    const cuenta = await horizon().loadAccount(direccion);
    return cuenta.balances.some(
      (b) =>
        'asset_code' in b &&
        b.asset_code === usdc.getCode() &&
        'asset_issuer' in b &&
        b.asset_issuer === usdc.getIssuer(),
    );
  } catch {
    return false;
  }
}

export async function saldoEscrow(): Promise<{ usdc: string; xlm: string }> {
  const usdc = assetUsdc();
  const cuenta = await horizon().loadAccount(parEscrow().publicKey());
  const balanceUsdc = cuenta.balances.find(
    (b) => 'asset_code' in b && b.asset_code === usdc.getCode() && 'asset_issuer' in b && b.asset_issuer === usdc.getIssuer(),
  );
  const balanceXlm = cuenta.balances.find((b) => b.asset_type === 'native');
  return { usdc: balanceUsdc?.balance ?? '0', xlm: balanceXlm?.balance ?? '0' };
}

/** Tarifa con margen: una tarifa base justa hace que la tx quede colgada. */
async function tarifaSegura(): Promise<string> {
  try {
    const base = await horizon().fetchBaseFee();
    return String(Math.max(base * 10, Number(BASE_FEE) * 10));
  } catch {
    return String(Number(BASE_FEE) * 10);
  }
}

function extraerDetalleHorizon(error: unknown): string[] {
  const posible = error as {
    response?: { data?: { extras?: { result_codes?: { transaction?: string; operations?: string[] } } } };
  };
  const codigos = posible?.response?.data?.extras?.result_codes;
  if (!codigos) return [];
  return [codigos.transaction, ...(codigos.operations ?? [])].filter(Boolean) as string[];
}

function mensajeAmigable(detalle: string[]): string {
  if (detalle.includes('op_no_trust')) {
    return 'La wallet de destino todavía no acepta USDC. Que entre a la app una vez y vuelva a intentar.';
  }
  if (detalle.includes('op_underfunded') || detalle.includes('tx_insufficient_balance')) {
    return 'La cuenta de custodia no tiene saldo suficiente para este movimiento.';
  }
  if (detalle.includes('tx_bad_auth')) {
    return 'La cuenta de custodia está mal configurada. Revisa ESCROW_SECRET_KEY.';
  }
  return 'La red no aceptó la transacción. Intenta de nuevo en unos segundos.';
}
