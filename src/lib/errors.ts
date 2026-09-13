/**
 * Errores de dominio con codigo estable. El `mensaje` esta escrito para que se
 * pueda mostrar tal cual al usuario: nada de stack traces en la pantalla.
 *
 * Sobre los códigos HTTP: 404 queda reservado para "este recurso no existe".
 * Un trato que existe pero cuyo depósito todavía no aparece en la red NO es un
 * 404 — devolverlo así hace que el log de Next diga
 * `POST /api/tratos/XXX/confirmar 404` y parezca una ruta rota cuando en
 * realidad la ruta respondió perfecto. Eso cuesta horas de depuración.
 */
export type CodigoError =
  | 'NO_AUTENTICADO'
  | 'SIN_PERMISO'
  | 'NO_ENCONTRADO'
  | 'DATOS_INVALIDOS'
  | 'ESTADO_INVALIDO'
  | 'CODIGO_INCORRECTO'
  | 'CODIGO_BLOQUEADO'
  | 'DEPOSITO_NO_ENCONTRADO'
  | 'DEPOSITO_INSUFICIENTE'
  | 'MONTO_INCORRECTO'
  | 'DEMASIADOS_INTENTOS'
  | 'ORIGEN_INVALIDO'
  | 'CADENA'
  | 'INTERNO';

const HTTP: Record<CodigoError, number> = {
  NO_AUTENTICADO: 401,
  SIN_PERMISO: 403,
  NO_ENCONTRADO: 404,
  DATOS_INVALIDOS: 400,
  ESTADO_INVALIDO: 409,
  CODIGO_INCORRECTO: 400,
  CODIGO_BLOQUEADO: 423,
  // 409: el trato existe y la ruta funcionó; lo que falta es el depósito en la
  // red. No confundir con NO_ENCONTRADO (404), que sí es un trato inexistente.
  DEPOSITO_NO_ENCONTRADO: 409,
  DEPOSITO_INSUFICIENTE: 409,
  MONTO_INCORRECTO: 409,
  DEMASIADOS_INTENTOS: 429,
  ORIGEN_INVALIDO: 403,
  CADENA: 502,
  INTERNO: 500,
};

export class ErrorApp extends Error {
  readonly codigo: CodigoError;
  readonly status: number;
  readonly detalle?: Record<string, unknown>;

  constructor(codigo: CodigoError, mensaje: string, detalle?: Record<string, unknown>) {
    super(mensaje);
    this.name = 'ErrorApp';
    this.codigo = codigo;
    this.status = HTTP[codigo];
    this.detalle = detalle;
  }
}

export const errores = {
  noAutenticado: (m = 'Necesitas entrar con tu cuenta.') => new ErrorApp('NO_AUTENTICADO', m),
  sinPermiso: (m = 'Este trato no es tuyo.') => new ErrorApp('SIN_PERMISO', m),
  noEncontrado: (m = 'No encontramos ese trato.') => new ErrorApp('NO_ENCONTRADO', m),
  datosInvalidos: (m: string, d?: Record<string, unknown>) => new ErrorApp('DATOS_INVALIDOS', m, d),
  estadoInvalido: (m: string, d?: Record<string, unknown>) => new ErrorApp('ESTADO_INVALIDO', m, d),
  depositoNoEncontrado: (m = 'Todavía no vemos el pago en la red.') =>
    new ErrorApp('DEPOSITO_NO_ENCONTRADO', m),
  montoIncorrecto: (m: string, d?: Record<string, unknown>) => new ErrorApp('MONTO_INCORRECTO', m, d),
  cadena: (m: string, d?: Record<string, unknown>) => new ErrorApp('CADENA', m, d),
};
