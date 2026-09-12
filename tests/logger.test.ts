import { afterEach, describe, expect, it, vi } from 'vitest';
import { log } from '@/lib/logger';

describe('logger seguro', () => {
  afterEach(() => vi.restoreAllMocks());

  it('oculta secretos en snake_case y camelCase sin ocultar métricas normales', () => {
    const salida = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    log.info('prueba', {
      depositosConfirmados: 2,
      pollarSecretKey: 'no-debe-aparecer',
      ESCROW_SECRET_KEY: 'tampoco',
      codigoCifrado: 'ni-esto',
    });

    const linea = JSON.parse(String(salida.mock.calls[0]?.[0]));
    expect(linea.ctx).toEqual({
      depositosConfirmados: 2,
      pollarSecretKey: '[oculto]',
      ESCROW_SECRET_KEY: '[oculto]',
      codigoCifrado: '[oculto]',
    });
  });
});
