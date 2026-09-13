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
import type { DepositoEncontrado, ResultadoBusquedaDeposito, ResultadoEnvio } from './tipos';

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
  montoEsperado: string;
  limite?: number;
}): Promise<ResultadoBusquedaDeposito> {
  const escrow = parEscrow().publicKey();
  const usdc = assetUsdc();
  const esperado = aStroops(params.montoEsperado);
  let montoIncorrecto: DepositoEncontrado | null = null;

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

      const deposito: DepositoEncontrado = {
        hash: registro.transaction_hash,
        monto: registro.amount,
        desde: registro.from,
        memo: params.memo,
        creadoEn: registro.created_at,
      };

      if (aStroops(registro.amount) !== esperado) {
        montoIncorrecto ??= deposito;
        log.warn('depósito con monto incorrecto', { memo: params.memo, monto: registro.amount });
        continue;
      }
      return { estado: 'ENCONTRADO', deposito };
    }

    if (pagina.records.length === 0) break;
    pagina = await pagina.next();
  }

  return montoIncorrecto
    ? { estado: 'MONTO_INCORRECTO', deposito: montoIncorrecto }
    : { estado: 'NO_ENCONTRADO' };
}

/** Busca primero por hash, pero valida todos los datos contra Horizon. */
export async function buscarDepositoPorHash(params: {
  hash: string;
  memo: string;
  montoEsperado: string;
}): Promise<ResultadoBusquedaDeposito> {
  let tx;
  try {
    tx = await horizon().transactions().transaction(params.hash).call();
  } catch {
    return { estado: 'NO_ENCONTRADO' };
  }
  if (!tx.successful || tx.memo !== params.memo) return { estado: 'NO_ENCONTRADO' };

  const escrow = parEscrow().publicKey();
  const usdc = assetUsdc();
  const pagina = await horizon().payments().forTransaction(params.hash).limit(200).call();
  for (const registro of pagina.records) {
    if (registro.type !== 'payment' || registro.to !== escrow || registro.asset_type === 'native') continue;
    if (registro.asset_code !== usdc.getCode() || registro.asset_issuer !== usdc.getIssuer()) continue;
    const deposito: DepositoEncontrado = {
      hash: registro.transaction_hash,
      monto: registro.amount,
      desde: registro.from,
      memo: params.memo,
      creadoEn: registro.created_at,
    };
    return aStroops(registro.amount) === aStroops(params.montoEsperado)
      ? { estado: 'ENCONTRADO', deposito }
      : { estado: 'MONTO_INCORRECTO', deposito };
  }
  return { estado: 'NO_ENCONTRADO' };
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
  try {
    await params.alConstruir?.(hash);
  } catch (error) {
    throw errores.cadena('No se pudo guardar la operación antes de enviarla.', {
      hash,
      resultado: 'NO_ENVIADA',
      causa: error instanceof Error ? error.message : 'desconocida',
    });
  }

  try {
    const respuesta = await horizon().submitTransaction(tx);
    return { hash: respuesta.hash, exitoso: true };
  } catch (error) {
    const detalle = extraerDetalleHorizon(error);
    log.error('fallo el envio desde la custodia', { destino: params.destino, hash, detalle });
    throw errores.cadena(mensajeAmigable(detalle), {
      hash,
      detalle,
      resultado: detalle.length > 0 ? 'FALLIDA' : 'DESCONOCIDA',
    });
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

/**
 * Radiografía de la cuenta de custodia, para /api/salud.
 *
 * Existe porque un pago que falla con `txFeeBumpInnerFailed` no dice nada útil:
 * el error de afuera solo cuenta que la transacción interna falló. Las tres
 * causas reales —la cuenta no existe, no acepta USDC, o no hay XLM para los
 * fees— se responden con una sola consulta a Horizon.
 */
export async function diagnosticoEscrow(): Promise<{
  direccion: string;
  existe: boolean;
  aceptaUsdc: boolean;
  saldoUsdc: string | null;
  saldoXlm: string | null;
}> {
  const direccion = parEscrow().publicKey();
  const usdc = assetUsdc();

  try {
    const cuenta = await horizon().loadAccount(direccion);
    const balanceUsdc = cuenta.balances.find(
      (b) =>
        'asset_code' in b &&
        b.asset_code === usdc.getCode() &&
        'asset_issuer' in b &&
        b.asset_issuer === usdc.getIssuer(),
    );
    const balanceXlm = cuenta.balances.find((b) => b.asset_type === 'native');

    return {
      direccion,
      existe: true,
      aceptaUsdc: Boolean(balanceUsdc),
      saldoUsdc: balanceUsdc?.balance ?? null,
      saldoXlm: balanceXlm?.balance ?? null,
    };
  } catch {
    return { direccion, existe: false, aceptaUsdc: false, saldoUsdc: null, saldoXlm: null };
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
