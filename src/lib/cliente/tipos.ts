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
}

export interface UsuarioSesion {
  id: string;
  direccion: string;
  nombre: string | null;
}
