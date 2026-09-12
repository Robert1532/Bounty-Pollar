import { createHash } from 'node:crypto';
import { Keypair, StrKey } from '@stellar/stellar-sdk';

/**
 * Verificacion SEP-53 del lado del servidor.
 *
 * Por que existe esto: el login de Pollar ocurre en el navegador, asi que el
 * backend no puede creerle al cliente cuando dice "soy G...". Lo que si puede
 * hacer es pedirle una firma sobre un nonce que emitio el propio servidor. El
 * SDK expone `client.stellar.sep53.signMessage(mensaje)` — las wallets
 * custodiadas firman del lado de Pollar, las externas con su adapter — y
 * devuelve una firma ed25519 base64 sobre
 *
 *     SHA-256("Stellar Signed Message:\n" + mensaje)
 *
 * que aca se verifica contra la llave publica G... reclamada. Sin secreto
 * compartido y sin confiar en el cliente.
 */

export const PREFIJO_SEP53 = 'Stellar Signed Message:\n';

export function digestoSep53(mensaje: string): Buffer {
  return createHash('sha256').update(Buffer.from(PREFIJO_SEP53 + mensaje, 'utf8')).digest();
}

export function esDireccionStellar(valor: string): boolean {
  return StrKey.isValidEd25519PublicKey(valor);
}

export function verificarFirmaSep53(params: {
  mensaje: string;
  firmaBase64: string;
  direccion: string;
}): boolean {
  const { mensaje, firmaBase64, direccion } = params;
  if (!esDireccionStellar(direccion)) return false;

  let firma: Buffer;
  try {
    firma = Buffer.from(firmaBase64, 'base64');
  } catch {
    return false;
  }
  if (firma.length !== 64) return false;

  try {
    return Keypair.fromPublicKey(direccion).verify(digestoSep53(mensaje), firma);
  } catch {
    return false;
  }
}

/**
 * El mensaje que se firma. Incluye dominio, red y nonce: una firma hecha para
 * caserita.app en testnet no sirve en otro dominio ni en mainnet, y el nonce
 * la vuelve de un solo uso.
 */
export function construirMensajeLogin(params: {
  dominio: string;
  direccion: string;
  nonce: string;
  red: string;
  emitidoEn: string;
}): string {
  return [
    `${params.dominio} quiere verificar que esta wallet es tuya.`,
    '',
    `Wallet: ${params.direccion}`,
    `Red: ${params.red}`,
    `Nonce: ${params.nonce}`,
    `Emitido: ${params.emitidoEn}`,
    '',
    'Firmar este mensaje no mueve fondos ni autoriza ningún pago.',
  ].join('\n');
}

/** Extrae los campos del mensaje para poder revalidarlos en el servidor. */
export function parsearMensajeLogin(mensaje: string): {
  direccion?: string;
  nonce?: string;
  red?: string;
  emitidoEn?: string;
} {
  const leer = (clave: string) => {
    const m = mensaje.match(new RegExp(`^${clave}: (.+)$`, 'm'));
    return m?.[1]?.trim();
  };
  return {
    direccion: leer('Wallet'),
    nonce: leer('Nonce'),
    red: leer('Red'),
    emitidoEn: leer('Emitido'),
  };
}
