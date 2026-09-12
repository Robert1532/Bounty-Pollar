import type { EstadoTrato } from '@/db';

/**
 * La maquina de estados, en un solo lugar y sin excepciones.
 *
 *   PUBLICADO ──paga──► FINANCIADO ──codigo──► LIBERANDO ──► LIBERADO
 *       │                   │
 *       │                   └──48h / acuerdo──► DEVOLVIENDO ──► DEVUELTO
 *       ├──7 dias sin comprador──► EXPIRADO
 *       └──el vendedor cancela──► CANCELADO
 *
 * LIBERANDO y DEVOLVIENDO existen a proposito: son el candado que impide que
 * dos peticiones simultaneas manden el mismo dinero dos veces. Se entra a ellos
 * con un UPDATE condicional, y recien despues se toca la red.
 *
 * No hay estado EN_DISPUTA. El plazo de 48 horas *es* el sistema de disputas de
 * la v1, y eso se dice en voz alta en vez de improvisar un arbitro que no
 * existe.
 */

export const TRANSICIONES: Record<EstadoTrato, readonly EstadoTrato[]> = {
  BORRADOR: ['PUBLICADO', 'CANCELADO'],
  PUBLICADO: ['FINANCIADO', 'EXPIRADO', 'CANCELADO'],
  FINANCIADO: ['LIBERANDO', 'DEVOLVIENDO'],
  LIBERANDO: ['LIBERADO', 'FINANCIADO'],
  DEVOLVIENDO: ['DEVUELTO', 'FINANCIADO'],
  LIBERADO: [],
  DEVUELTO: [],
  EXPIRADO: [],
  CANCELADO: [],
};

export function puedeTransicionar(desde: EstadoTrato, hacia: EstadoTrato): boolean {
  return TRANSICIONES[desde].includes(hacia);
}

export const ESTADOS_FINALES: readonly EstadoTrato[] = ['LIBERADO', 'DEVUELTO', 'EXPIRADO', 'CANCELADO'];

export function esFinal(estado: EstadoTrato): boolean {
  return ESTADOS_FINALES.includes(estado);
}

/** Estados en los que hay plata de verdad retenida en la custodia. */
export function tienePlataRetenida(estado: EstadoTrato): boolean {
  return estado === 'FINANCIADO' || estado === 'LIBERANDO' || estado === 'DEVOLVIENDO';
}

interface Presentacion {
  etiqueta: string;
  detalle: string;
  tono: 'neutral' | 'espera' | 'ok' | 'alerta';
}

export const PRESENTACION: Record<EstadoTrato, Presentacion> = {
  BORRADOR: { etiqueta: 'Borrador', detalle: 'Todavía no publicado.', tono: 'neutral' },
  PUBLICADO: {
    etiqueta: 'Esperando pago',
    detalle: 'Manda el link al comprador. La plata todavía no se movió.',
    tono: 'espera',
  },
  FINANCIADO: {
    etiqueta: 'Plata en custodia',
    detalle: 'El pago está retenido. Se libera cuando el vendedor ingresa el código.',
    tono: 'ok',
  },
  LIBERANDO: { etiqueta: 'Liberando', detalle: 'Mandando el pago al vendedor.', tono: 'espera' },
  LIBERADO: { etiqueta: 'Liberado', detalle: 'El vendedor ya cobró.', tono: 'ok' },
  DEVOLVIENDO: { etiqueta: 'Devolviendo', detalle: 'Devolviendo la plata al comprador.', tono: 'espera' },
  DEVUELTO: { etiqueta: 'Devuelto', detalle: 'La plata volvió al comprador.', tono: 'alerta' },
  EXPIRADO: { etiqueta: 'Expirado', detalle: 'Nadie pagó dentro del plazo.', tono: 'neutral' },
  CANCELADO: { etiqueta: 'Cancelado', detalle: 'El vendedor canceló el trato.', tono: 'neutral' },
};
