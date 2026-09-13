import { describe, expect, it } from 'vitest';
import { rutaDeTrato } from '@/lib/cliente/trato-link';

describe('entrada del enlace de compra', () => {
  it('acepta un enlace completo y abre la ruta local', () => {
    expect(rutaDeTrato('https://caserita.example/t/ABC346XY')).toBe('/t/ABC346XY');
  });

  it('acepta la ruta o el identificador solos', () => {
    expect(rutaDeTrato('/t/ABC346XY')).toBe('/t/ABC346XY');
    expect(rutaDeTrato('ABC346XY')).toBe('/t/ABC346XY');
  });

  it('rechaza enlaces que no son de un trato', () => {
    expect(rutaDeTrato('https://ejemplo.com/robar-sesion')).toBeNull();
    expect(rutaDeTrato('')).toBeNull();
  });
});
