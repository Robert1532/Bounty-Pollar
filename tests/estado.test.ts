import { describe, expect, it } from 'vitest';
import { ESTADOS_FINALES, esFinal, puedeTransicionar, tienePlataRetenida, TRANSICIONES } from '@/lib/tratos/estado';

describe('maquina de estados', () => {
  it('permite el camino feliz completo', () => {
    expect(puedeTransicionar('PUBLICADO', 'FINANCIADO')).toBe(true);
    expect(puedeTransicionar('FINANCIADO', 'LIBERANDO')).toBe(true);
    expect(puedeTransicionar('LIBERANDO', 'LIBERADO')).toBe(true);
  });

  it('permite el camino de la devolución', () => {
    expect(puedeTransicionar('FINANCIADO', 'DEVOLVIENDO')).toBe(true);
    expect(puedeTransicionar('DEVOLVIENDO', 'DEVUELTO')).toBe(true);
  });

  it('deja volver atrás si la red rechaza el envio', () => {
    expect(puedeTransicionar('LIBERANDO', 'FINANCIADO')).toBe(true);
    expect(puedeTransicionar('DEVOLVIENDO', 'FINANCIADO')).toBe(true);
  });

  it('no deja saltarse la custodia', () => {
    expect(puedeTransicionar('PUBLICADO', 'LIBERADO')).toBe(false);
    expect(puedeTransicionar('PUBLICADO', 'DEVUELTO')).toBe(false);
    expect(puedeTransicionar('FINANCIADO', 'LIBERADO')).toBe(false);
    expect(puedeTransicionar('FINANCIADO', 'CANCELADO')).toBe(false);
  });

  it('no deja cancelar ni expirar un trato ya pagado', () => {
    expect(puedeTransicionar('FINANCIADO', 'EXPIRADO')).toBe(false);
    expect(puedeTransicionar('LIBERADO', 'DEVUELTO')).toBe(false);
  });

  it('los estados finales no tienen salida', () => {
    for (const estado of ESTADOS_FINALES) {
      expect(TRANSICIONES[estado]).toHaveLength(0);
      expect(esFinal(estado)).toBe(true);
    }
  });

  it('sabe cuando hay plata de verdad retenida', () => {
    expect(tienePlataRetenida('FINANCIADO')).toBe(true);
    expect(tienePlataRetenida('LIBERANDO')).toBe(true);
    expect(tienePlataRetenida('DEVOLVIENDO')).toBe(true);
    expect(tienePlataRetenida('PUBLICADO')).toBe(false);
    expect(tienePlataRetenida('LIBERADO')).toBe(false);
  });

  it('ninguna transicion apunta a un estado que no existe', () => {
    const estados = Object.keys(TRANSICIONES);
    for (const destinos of Object.values(TRANSICIONES)) {
      for (const destino of destinos) expect(estados).toContain(destino);
    }
  });
});
