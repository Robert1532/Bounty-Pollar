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
  puedeCalificar: boolean;
  calificado: boolean;
}

/** Estrellas de compradores anónimos. El promedio se oculta si son pocas. */
export interface Estrellas {
  promedio: number | null;
  cantidad: number;
  faltanParaMostrar: number;
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
  estrellas: Estrellas;
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

/** Cuánta plata tiene el usuario en Caserita. El saldo de wallet va aparte. */
export interface ResumenDinero {
  porCobrarUsdc: string;
  tratosPorCobrar: number;
  protegidoUsdc: string;
  tratosProtegidos: number;
  cobradoUsdc: string;
  gastadoUsdc: string;
  ventasCompletadas: number;
  comprasCompletadas: number;
}

export interface Perfil {
  direccion: string;
  nombre: string | null;
  desde: string;
  reputacion: Reputacion;
  resumen: ResumenDinero;
  distribucion: Record<'1' | '2' | '3' | '4' | '5', number>;
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
