import { describe, expect, it } from 'vitest';
import {
  buscarDepositoMock,
  buscarDepositoMockPorHash,
  registrarDepositoMock,
} from '@/lib/stellar/mock';

describe('confirmación exacta de depósitos', () => {
  it('acepta el monto exacto y permite recuperar por hash', () => {
    const deposito = registrarDepositoMock({
      memo: 'CAS-EXACTO',
      monto: '10.0000000',
      desde: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    });
    expect(buscarDepositoMock('CAS-EXACTO', '10')).toMatchObject({ estado: 'ENCONTRADO' });
    expect(buscarDepositoMockPorHash(deposito.hash, '10')).toMatchObject({ estado: 'ENCONTRADO' });
  });

  it.each(['9.0000000', '11.0000000'])('rechaza el monto no exacto %s', (monto) => {
    const memo = `CAS-${monto}`;
    registrarDepositoMock({
      memo,
      monto,
      desde: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    });
    expect(buscarDepositoMock(memo, '10')).toMatchObject({ estado: 'MONTO_INCORRECTO' });
  });
});
