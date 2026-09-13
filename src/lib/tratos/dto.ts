import type { Trato, User } from '@/db';
import { normalizarMonto } from '../money';
import { MAX_INTENTOS } from '../codigo';
import { reputacionDe, type Reputacion } from './reputacion';
import { puedeCalificar } from './calificaciones';

export type RolEnTrato = 'vendedor' | 'comprador' | 'visitante';

export interface TratoPublico {
  id: string;
  titulo: string;
  descripcion: string | null;
  lugarEntrega: string | null;
  montoUsdc: string;
  montoBsReferencia: string | null;
  estado: Trato['estado'];
  escrowAddress: string;
  memo: string;
  vendedorAddress: string;
  compradorAddress: string | null;
  txDeposito: string | null;
  txLiberacion: string | null;
  txDevolucion: string | null;
  motivoDevolucion: Trato['motivoDevolucion'];
  codigoBloqueado: boolean;
  intentosRestantes: number;
  expiraEn: string;
  liberaHasta: string | null;
  financiadoEn: string | null;
  creadoEn: string;
  rol: RolEnTrato;

  /** Historial del vendedor. Es lo que el comprador mira antes de pagar. */
  vendedor: Reputacion | null;

  /** Evidencia de entrega. La foto nunca viaja acá: solo por su propia ruta. */
  tieneEvidencia: boolean;
  evidenciaSubidaEn: string | null;
  evidenciaHash: string | null;

  /** El comprador puede calificar (entrega completada y todavía sin calificar). */
  puedeCalificar: boolean;
  /** Si este trato ya tiene su calificación. Nunca se dice cuál ni de quién. */
  calificado: boolean;
}

/**
 * Lo unico que sale hacia el cliente. El hash y el cifrado del codigo no
 * aparecen en ninguna vista: el codigo viaja solo por su propio endpoint, y
 * solo al comprador.
 */
export function aTratoPublico(
  trato: Trato,
  usuario?: User | null,
  vendedor?: User | null,
  calificado = false,
): TratoPublico {
  return {
    id: trato.id,
    titulo: trato.titulo,
    descripcion: trato.descripcion,
    lugarEntrega: trato.lugarEntrega,
    montoUsdc: normalizarMonto(trato.montoUsdc),
    montoBsReferencia: trato.montoBsReferencia ?? null,
    estado: trato.estado,
    escrowAddress: trato.escrowAddress,
    memo: trato.memo,
    vendedorAddress: trato.vendedorAddress,
    compradorAddress: trato.compradorAddress,
    txDeposito: trato.txDeposito,
    txLiberacion: trato.txLiberacion,
    txDevolucion: trato.txDevolucion,
    motivoDevolucion: trato.motivoDevolucion,
    codigoBloqueado: trato.codigoBloqueado,
    intentosRestantes: Math.max(0, MAX_INTENTOS - trato.codigoIntentos),
    expiraEn: trato.expiraEn.toISOString(),
    liberaHasta: trato.liberaHasta?.toISOString() ?? null,
    financiadoEn: trato.financiadoEn?.toISOString() ?? null,
    creadoEn: trato.createdAt.toISOString(),
    rol: rolDe(trato, usuario),
    vendedor: vendedor ? reputacionDe(vendedor) : null,
    tieneEvidencia: Boolean(trato.evidenciaRuta),
    evidenciaSubidaEn: trato.evidenciaSubidaEn?.toISOString() ?? null,
    evidenciaHash: trato.evidenciaHash,
    puedeCalificar: !calificado && puedeCalificar(trato, usuario),
    calificado,
  };
}

export function rolDe(trato: Trato, usuario?: User | null): RolEnTrato {
  if (!usuario) return 'visitante';
  if (trato.vendedorId === usuario.id) return 'vendedor';
  if (trato.compradorId === usuario.id) return 'comprador';
  return 'visitante';
}

export function acortarDireccion(direccion: string): string {
  return `${direccion.slice(0, 4)}…${direccion.slice(-4)}`;
}
