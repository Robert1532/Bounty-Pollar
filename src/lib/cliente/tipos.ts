export type EstadoTrato =
  | 'BORRADOR'
  | 'PUBLICADO'
  | 'FINANCIADO'
  | 'LIBERANDO'
  | 'LIBERADO'
  | 'DEVOLVIENDO'
  | 'DEVUELTO'
  | 'EXPIRADO'
  | 'CANCELADO';

export interface TratoPublico {
  id: string;
  titulo: string;
  descripcion: string | null;
  lugarEntrega: string | null;
  montoUsdc: string;
  montoBsReferencia: string | null;
  estado: EstadoTrato;
  escrowAddress: string;
  memo: string;
  vendedorAddress: string;
  compradorAddress: string | null;
  txDeposito: string | null;
  txLiberacion: string | null;
  txDevolucion: string | null;
  motivoDevolucion: 'PLAZO_VENCIDO' | 'ACORDADA' | null;
  codigoBloqueado: boolean;
  intentosRestantes: number;
  expiraEn: string;
  liberaHasta: string | null;
  financiadoEn: string | null;
  creadoEn: string;
  rol: 'vendedor' | 'comprador' | 'visitante';
  vendedor: Reputacion | null;
  tieneEvidencia: boolean;
  evidenciaSubidaEn: string | null;
  evidenciaHash: string | null;
}

export type NivelVendedor = 'nuevo' | 'conocido' | 'confiable' | 'recomendado';

/** Hechos, no estrellas: todo lo de acá ocurrió y quedó en la red. */
export interface Reputacion {
  ventasCompletadas: number;
  comprasCompletadas: number;
  devolucionesComoVendedor: number;
  devolucionesComoComprador: number;
  volumenVendidoUsdc: string;
  primerTratoEn: string | null;
  nivel: NivelVendedor;
  tasaEntrega: number | null;
}

/** Agregados públicos del panel de confianza. Nunca datos de una persona. */
export interface Estadisticas {
  protegidoAhoraUsdc: string;
  tratosEnCustodia: number;
  tratosCompletados: number;
  volumenCompletadoUsdc: string;
  tratosDevueltos: number;
  tratosTotales: number;
  personas: number;
  tasaEntrega: number | null;
}

export interface Evidencia {
  url: string;
  hash: string;
  subidaEn: string;
  tipo: string;
}

export interface ConfigPublica {
  red: 'testnet' | 'mainnet';
  escrowAddress: string;
  asset: { code: string; issuer: string | null };
  montoMaximoUsdc: number;
  montoMinimoUsdc: number;
  horasParaEntregar: number;
  tipoCambioBs: number;
  modoMock: boolean;
  evidenciaHabilitada: boolean;
}

export interface UsuarioSesion {
  id: string;
  direccion: string;
  nombre: string | null;
}
