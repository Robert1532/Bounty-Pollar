import { beforeAll, describe, expect, it } from 'vitest';

describe('cifrado del código de entrega', () => {
  beforeAll(() => {
    process.env.DATABASE_URL = 'postgresql://x:y@localhost:5432/z';
    process.env.APP_URL = 'http://localhost:3000';
    process.env.SESSION_SECRET = 'un-secreto-de-pruebas-con-mas-de-32-caracteres';
    process.env.CRON_SECRET = 'secreto-de-cron-para-pruebas';
    process.env.MODO_MOCK = 'true';
  });

  it('va y vuelve', async () => {
    const { cifrar, descifrar } = await import('@/lib/cripto');
    expect(descifrar(cifrar('123456'))).toBe('123456');
  });

  it('cada cifrado es distinto aunque el código sea el mismo', async () => {
    const { cifrar } = await import('@/lib/cripto');
    expect(cifrar('123456')).not.toBe(cifrar('123456'));
  });

  it('el paquete no contiene el código en claro', async () => {
    const { cifrar } = await import('@/lib/cripto');
    expect(cifrar('123456')).not.toContain('123456');
  });

  it('detecta que lo manipularon', async () => {
    const { cifrar, descifrar } = await import('@/lib/cripto');
    const paquete = cifrar('123456');
    const partes = paquete.split('.');
    const alterado = `${partes[0]}.${partes[1]}.${Buffer.from('999999').toString('base64url')}`;
    expect(() => descifrar(alterado)).toThrow();
    expect(() => descifrar('no-es-un-paquete')).toThrow();
  });
});
