import { describe, expect, it } from 'vitest';
import { ErrorApp, errores } from '@/lib/errors';

/**
 * Esta prueba existe por un error real que costó horas.
 *
 * `DEPOSITO_NO_ENCONTRADO` respondía 404, así que el log de Next mostraba
 * `POST /api/tratos/XXX/confirmar 404` y parecía que la ruta no existía —
 * cuando en realidad la ruta había respondido perfecto: el trato existe, se
 * consultó Horizon, y el depósito todavía no estaba ahí.
 *
 * 404 significa "este recurso no existe" y nada más. Que el estado del mundo
 * no sea el que esperabas es 409.
 */
describe('códigos HTTP de los errores de dominio', () => {
  it('404 es solo para recursos que no existen', () => {
    expect(errores.noEncontrado().status).toBe(404);
  });

  it('un depósito que todavía no llegó NO es un 404', () => {
    const error = errores.depositoNoEncontrado();
    expect(error.status).toBe(409);
    expect(error.status).not.toBe(404);
    expect(error.codigo).toBe('DEPOSITO_NO_ENCONTRADO');
  });

  it('ningún error de "el estado no permite esto" usa 404', () => {
    for (const error of [
      errores.estadoInvalido('x'),
      errores.depositoNoEncontrado(),
      errores.montoIncorrecto('x'),
      new ErrorApp('DEPOSITO_INSUFICIENTE', 'x'),
    ]) {
      expect(error.status).toBe(409);
    }
  });

  it('el resto de los códigos mantiene su significado', () => {
    expect(errores.noAutenticado().status).toBe(401);
    expect(errores.sinPermiso().status).toBe(403);
    expect(errores.datosInvalidos('x').status).toBe(400);
    expect(errores.cadena('x').status).toBe(502);
    expect(new ErrorApp('DEMASIADOS_INTENTOS', 'x').status).toBe(429);
    expect(new ErrorApp('CODIGO_BLOQUEADO', 'x').status).toBe(423);
  });

  it('el código de dominio viaja aparte del HTTP, para que el cliente decida', () => {
    // El cliente reintenta solo con DEPOSITO_NO_ENCONTRADO; si distinguiera por
    // el status confundiría "falta el depósito" con "el trato ya cambió".
    expect(errores.depositoNoEncontrado().codigo).not.toBe(errores.estadoInvalido('x').codigo);
  });
});
