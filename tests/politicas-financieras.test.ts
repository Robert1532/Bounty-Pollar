import { describe, expect, it } from 'vitest';
import { decidirRecuperacion, plazoDevolucionVencido } from '@/lib/tratos/politicas';

describe('recuperación de movimientos monetarios', () => {
  it('confirma una transacción que la red reconoce como exitosa', () => {
    expect(decidirRecuperacion({ exitoso: true })).toBe('CONFIRMAR');
  });

  it('solo permite reintentar una transacción confirmada como fallida', () => {
    expect(decidirRecuperacion({ exitoso: false })).toBe('REINTENTAR');
  });

  it('bloquea el reintento cuando el resultado sigue siendo ambiguo', () => {
    expect(decidirRecuperacion(null)).toBe('ESPERAR');
  });
});

describe('política de devolución', () => {
  const ahora = new Date('2026-09-12T12:00:00Z');

  it('no permite devolución antes del plazo ni sin plazo', () => {
    expect(plazoDevolucionVencido(null, ahora)).toBe(false);
    expect(plazoDevolucionVencido(new Date('2026-09-12T12:00:01Z'), ahora)).toBe(false);
  });

  it('permite devolución al vencer el plazo', () => {
    expect(plazoDevolucionVencido(new Date('2026-09-12T12:00:00Z'), ahora)).toBe(true);
    expect(plazoDevolucionVencido(new Date('2026-09-12T11:59:59Z'), ahora)).toBe(true);
  });
});
