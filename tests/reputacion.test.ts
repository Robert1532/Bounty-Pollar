import { describe, expect, it } from 'vitest';
import { ETIQUETA_NIVEL, nivelDe, reputacionDe } from '@/lib/tratos/reputacion';

function usuario(parcial: Partial<Parameters<typeof reputacionDe>[0]> = {}) {
  return {
    ventasCompletadas: 0,
    comprasCompletadas: 0,
    devolucionesComoVendedor: 0,
    devolucionesComoComprador: 0,
    volumenVendidoUsdc: '0',
    primerTratoEn: null,
    calificacionesRecibidas: 0,
    sumaEstrellas: 0,
    ...parcial,
  };
}

describe('niveles de vendedor', () => {
  it('sube por tratos cumplidos, no por antigüedad', () => {
    expect(nivelDe(0)).toBe('nuevo');
    expect(nivelDe(1)).toBe('conocido');
    expect(nivelDe(4)).toBe('conocido');
    expect(nivelDe(5)).toBe('confiable');
    expect(nivelDe(9)).toBe('confiable');
    expect(nivelDe(10)).toBe('recomendado');
    expect(nivelDe(500)).toBe('recomendado');
  });

  it('todos los niveles tienen etiqueta', () => {
    for (const ventas of [0, 1, 5, 10]) {
      expect(ETIQUETA_NIVEL[nivelDe(ventas)]).toBeTruthy();
    }
  });
});

describe('reputación', () => {
  it('un vendedor sin historial no aparenta tenerlo', () => {
    const r = reputacionDe(usuario());
    expect(r.nivel).toBe('nuevo');
    expect(r.tasaEntrega).toBeNull();
    expect(r.ventasCompletadas).toBe(0);
  });

  it('la tasa de entrega cuenta las devoluciones en contra', () => {
    expect(reputacionDe(usuario({ ventasCompletadas: 9, devolucionesComoVendedor: 1 })).tasaEntrega).toBe(90);
    expect(reputacionDe(usuario({ ventasCompletadas: 1, devolucionesComoVendedor: 1 })).tasaEntrega).toBe(50);
    expect(reputacionDe(usuario({ ventasCompletadas: 3 })).tasaEntrega).toBe(100);
  });

  it('las compras no inflan la reputación de vendedor', () => {
    const r = reputacionDe(usuario({ comprasCompletadas: 40 }));
    expect(r.nivel).toBe('nuevo');
    expect(r.tasaEntrega).toBeNull();
  });

  it('normaliza el volumen al formato de Stellar', () => {
    expect(reputacionDe(usuario({ volumenVendidoUsdc: '12.5' })).volumenVendidoUsdc).toBe('12.5000000');
    expect(reputacionDe(usuario({ volumenVendidoUsdc: '0' })).volumenVendidoUsdc).toBe('0.0000000');
  });

  it('las estrellas viajan con la reputación', () => {
    expect(reputacionDe(usuario()).estrellas.cantidad).toBe(0);
    expect(reputacionDe(usuario()).estrellas.promedio).toBeNull();

    const conEstrellas = reputacionDe(usuario({ calificacionesRecibidas: 4, sumaEstrellas: 18 }));
    expect(conEstrellas.estrellas.promedio).toBe(4.5);
    expect(conEstrellas.estrellas.cantidad).toBe(4);
  });

  it('expone la fecha del primer trato en ISO', () => {
    const fecha = new Date('2026-09-13T12:00:00.000Z');
    expect(reputacionDe(usuario({ primerTratoEn: fecha })).primerTratoEn).toBe(fecha.toISOString());
  });
});
