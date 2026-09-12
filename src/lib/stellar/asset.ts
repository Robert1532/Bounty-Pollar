import { Asset, Networks } from '@stellar/stellar-sdk';
import { serverEnv } from '../env';

/**
 * USDC en Stellar. El emisor se configura por entorno porque no es el mismo en
 * testnet que en mainnet, y confundirlos significa aceptar un token que
 * cualquiera puede emitir con el mismo codigo "USDC".
 */
export function assetUsdc(): Asset {
  const env = serverEnv();
  if (!env.USDC_ISSUER) throw new Error('USDC_ISSUER no configurado');
  return new Asset(env.USDC_CODE, env.USDC_ISSUER);
}

export function passphraseRed(): string {
  return serverEnv().STELLAR_NETWORK === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;
}

export function descripcionAsset(): { code: string; issuer: string | null } {
  const env = serverEnv();
  return { code: env.USDC_CODE, issuer: env.USDC_ISSUER ?? null };
}
