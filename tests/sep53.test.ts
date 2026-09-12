import { describe, expect, it } from 'vitest';
import { Keypair } from '@stellar/stellar-sdk';
import {
  construirMensajeLogin,
  digestoSep53,
  parsearMensajeLogin,
  verificarFirmaSep53,
} from '@/lib/sep53';

function firmar(par: Keypair, mensaje: string): string {
  return Buffer.from(par.sign(digestoSep53(mensaje))).toString('base64');
}

describe('prueba de propiedad de la wallet (SEP-53)', () => {
  const par = Keypair.random();
  const mensaje = construirMensajeLogin({
    dominio: 'caserita.app',
    direccion: par.publicKey(),
    nonce: 'abc123',
    red: 'testnet',
    emitidoEn: '2026-09-12T12:00:00.000Z',
  });

  it('acepta una firma legitima', () => {
    expect(
      verificarFirmaSep53({ mensaje, firmaBase64: firmar(par, mensaje), direccion: par.publicKey() }),
    ).toBe(true);
  });

  it('rechaza la firma de otra wallet', () => {
    const otro = Keypair.random();
    expect(
      verificarFirmaSep53({ mensaje, firmaBase64: firmar(otro, mensaje), direccion: par.publicKey() }),
    ).toBe(false);
  });

  it('rechaza una firma valida sobre otro mensaje', () => {
    const otroMensaje = mensaje.replace('abc123', 'xyz789');
    expect(
      verificarFirmaSep53({ mensaje, firmaBase64: firmar(par, otroMensaje), direccion: par.publicKey() }),
    ).toBe(false);
  });

  it('rechaza basura sin explotar', () => {
    for (const firma of ['', 'no-es-base64!!', Buffer.alloc(10).toString('base64')]) {
      expect(verificarFirmaSep53({ mensaje, firmaBase64: firma, direccion: par.publicKey() })).toBe(false);
    }
    expect(verificarFirmaSep53({ mensaje, firmaBase64: firmar(par, mensaje), direccion: 'NO_ES_UNA_DIRECCION' })).toBe(
      false,
    );
  });

  it('el mensaje lleva dominio, red y nonce, y se puede volver a leer', () => {
    const campos = parsearMensajeLogin(mensaje);
    expect(campos.direccion).toBe(par.publicKey());
    expect(campos.nonce).toBe('abc123');
    expect(campos.red).toBe('testnet');
    expect(mensaje.startsWith('caserita.app ')).toBe(true);
  });
});
