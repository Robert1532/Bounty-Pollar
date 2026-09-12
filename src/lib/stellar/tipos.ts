export interface DepositoEncontrado {
  hash: string;
  /** Monto en formato decimal canonico, tal como lo reporta Horizon. */
  monto: string;
  /** Cuenta que envio el pago. Es la fuente de verdad sobre quien es el comprador. */
  desde: string;
  memo: string;
  creadoEn: string;
}

export type ResultadoBusquedaDeposito =
  | { estado: 'ENCONTRADO'; deposito: DepositoEncontrado }
  | { estado: 'MONTO_INCORRECTO'; deposito: DepositoEncontrado }
  | { estado: 'NO_ENCONTRADO' };

export interface ResultadoEnvio {
  hash: string;
  exitoso: boolean;
}
