export type DecisionRecuperacion = 'CONFIRMAR' | 'REINTENTAR' | 'ESPERAR';

/** Una respuesta ambigua nunca habilita otra transferencia. */
export function decidirRecuperacion(estado: { exitoso: boolean } | null): DecisionRecuperacion {
  if (!estado) return 'ESPERAR';
  return estado.exitoso ? 'CONFIRMAR' : 'REINTENTAR';
}

export function plazoDevolucionVencido(liberaHasta: Date | null, ahora = new Date()): boolean {
  return Boolean(liberaHasta && liberaHasta <= ahora);
}
