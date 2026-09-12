import { describe, expect, it } from 'vitest';
import {
  aDecimal,
  aStroops,
  bsAUsdc,
  MontoInvalido,
  montoMayorOIgual,
  montosIguales,
  normalizarMonto,
  usdcABs,
} from '@/lib/money';

describe('conversion de montos', () => {
  it('convierte decimales a stroops sin perder precision', () => {
    expect(aStroops('1')).toBe(10_000_000n);
    expect(aStroops('0.0000001')).toBe(1n);
    expect(aStroops('12.5')).toBe(125_000_000n);
    expect(aStroops('1234.1234567')).toBe(12_341_234_567n);
  });

  it('vuelve de stroops al formato de Stellar', () => {
    expect(aDecimal(10_000_000n)).toBe('1.0000000');
    expect(aDecimal(1n)).toBe('0.0000001');
    expect(aDecimal(125_000_000n)).toBe('12.5000000');
  });

  it('rechaza lo que no es un monto', () => {
    for (const malo of ['', 'abc', '1.12345678', '-1', '1e5', ' 1,5 ', '1.']) {
      expect(() => aStroops(malo)).toThrow(MontoInvalido);
    }
  });

  it('normaliza al formato canonico', () => {
    expect(normalizarMonto('3')).toBe('3.0000000');
    expect(normalizarMonto('3.10')).toBe('3.1000000');
  });

  it('compara sin pasar por float', () => {
    expect(montosIguales('1.10', '1.1000000')).toBe(true);
    expect(montosIguales('1.10', '1.1000001')).toBe(false);
    expect(montoMayorOIgual('1.0000001', '1')).toBe(true);
    expect(montoMayorOIgual('0.9999999', '1')).toBe(false);
  });

  it('0.1 + 0.2 no rompe la comparacion como si fuera float', () => {
    expect(aStroops('0.1') + aStroops('0.2')).toBe(aStroops('0.3'));
  });
});

describe('bolivianos', () => {
  it('redondea hacia arriba para no quedar corto', () => {
    // 350 / 6.96 = 50.28735…  ->  50.29
    expect(bsAUsdc(350, 6.96)).toBe('50.2900000');
  });

  it('vuelve a bolivianos', () => {
    expect(usdcABs('10', 6.96)).toBe(69.6);
  });

  it('rechaza entradas absurdas', () => {
    expect(() => bsAUsdc(0, 6.96)).toThrow(MontoInvalido);
    expect(() => bsAUsdc(100, 0)).toThrow(MontoInvalido);
  });
});
