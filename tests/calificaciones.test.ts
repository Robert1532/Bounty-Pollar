import { describe, expect, it } from 'vitest';
import { estrellasDe, MINIMO_PARA_MOSTRAR, puedeCalificar } from '@/lib/tratos/calificaciones';
import type { Trato, User } from '@/db';

const usuario = (id: string) => ({ id }) as User;
const trato = (parcial: Partial<Trato>) => ({ estado: 'LIBERADO', ...parcial }) as Trato;

describe('promedio de estrellas', () => {
  it('se oculta mientras haya pocas: con una sola, el vendedor sabría de quién vino', () => {
    for (let cantidad = 0; cantidad < MINIMO_PARA_MOSTRAR; cantidad++) {
      const e = estrellasDe({ calificacionesRecibidas: cantidad, sumaEstrellas: cantidad * 5 });
      expect(e.promedio).toBeNull();
      expect(e.cantidad).toBe(cantidad);
      expect(e.faltanParaMostrar).toBe(MINIMO_PARA_MOSTRAR - cantidad);
    }
  });

  it('aparece al llegar al mínimo', () => {
    const e = estrellasDe({ calificacionesRecibidas: 3, sumaEstrellas: 13 });
    expect(e.promedio).toBeCloseTo(4.3, 1);
    expect(e.faltanParaMostrar).toBe(0);
  });

  it('redondea a un decimal, sin inventar precisión', () => {
    expect(estrellasDe({ calificacionesRecibidas: 3, sumaEstrellas: 10 }).promedio).toBe(3.3);
    expect(estrellasDe({ calificacionesRecibidas: 4, sumaEstrellas: 20 }).promedio).toBe(5);
    expect(estrellasDe({ calificacionesRecibidas: 6, sumaEstrellas: 6 }).promedio).toBe(1);
  });
});

describe('quién puede calificar', () => {
  it('solo el comprador, y solo con la entrega completada', () => {
    const yo = usuario('u1');
    expect(puedeCalificar(trato({ compradorId: 'u1' }), yo)).toBe(true);
  });

  it('el vendedor no se califica a sí mismo', () => {
    expect(puedeCalificar(trato({ compradorId: 'otro', vendedorId: 'u1' }), usuario('u1'))).toBe(false);
  });

  it('un visitante no califica', () => {
    expect(puedeCalificar(trato({ compradorId: 'u1' }), null)).toBe(false);
  });

  it('no se califica un trato que no terminó en entrega', () => {
    for (const estado of ['PUBLICADO', 'FINANCIADO', 'DEVUELTO', 'CANCELADO', 'EXPIRADO'] as const) {
      expect(puedeCalificar(trato({ compradorId: 'u1', estado }), usuario('u1'))).toBe(false);
    }
  });
});
