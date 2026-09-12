import { describe, expect, it } from 'vitest';
import {
  esFormatoValido,
  formatearCodigo,
  generarCodigo,
  hashearCodigo,
  igualSeguro,
  verificarCodigo,
} from '@/lib/codigo';

describe('código de entrega', () => {
  it('genera siempre 6 dígitos', () => {
    for (let i = 0; i < 200; i++) {
      expect(generarCodigo()).toMatch(/^\d{6}$/);
    }
  });

  it('cubre todo el rango, incluidos los que empiezan en cero', () => {
    const muestras = new Set(Array.from({ length: 500 }, () => generarCodigo()));
    expect(muestras.size).toBeGreaterThan(400);
  });

  it('verifica el código correcto y rechaza el resto', async () => {
    const codigo = '048173';
    const hash = await hashearCodigo(codigo);
    expect(hash).not.toContain(codigo);
    await expect(verificarCodigo(codigo, hash)).resolves.toBe(true);
    await expect(verificarCodigo('048174', hash)).resolves.toBe(false);
    await expect(verificarCodigo('48173', hash)).resolves.toBe(false);
  });

  it('no acepta formatos raros', () => {
    for (const malo of ['12345', '1234567', 'abcdef', '12 34 56', '']) {
      expect(esFormatoValido(malo)).toBe(false);
    }
  });

  it('compara en tiempo constante sin romperse con largos distintos', () => {
    expect(igualSeguro('abc', 'abc')).toBe(true);
    expect(igualSeguro('abc', 'abd')).toBe(false);
    expect(igualSeguro('abc', 'abcd')).toBe(false);
  });

  it('lo formatea para leerlo de lejos', () => {
    expect(formatearCodigo('123456')).toBe('123 456');
  });
});
