import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorApp } from '@/lib/errors';

const dobles = vi.hoisted(() => ({
  usuario: {
    id: 'usuario-prueba',
    walletAddress: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
  },
  confirmar: vi.fn(),
  devolver: vi.fn(),
  // La vista pública añade el historial del vendedor; acá se devuelve el trato
  // tal cual para que la prueba siga midiendo solo la ruta.
  vista: vi.fn(async (trato: unknown) => trato),
}));

vi.mock('@/lib/auth', () => ({
  requerirUsuario: vi.fn(async () => dobles.usuario),
}));

vi.mock('@/lib/tratos/service', () => ({
  confirmarDeposito: dobles.confirmar,
  devolver: dobles.devolver,
  vistaDeTrato: dobles.vista,
}));

vi.mock('@/lib/tratos/dto', () => ({
  aTratoPublico: (trato: unknown) => trato,
}));

vi.mock('@/lib/rate-limit', () => ({
  ipDe: () => '127.0.0.1',
  limitar: () => ({ permitido: true, restantes: 1 }),
}));

import { POST as confirmar } from '@/app/api/tratos/[id]/confirmar/route';
import { POST as devolver } from '@/app/api/tratos/[id]/devolver/route';

const contexto = { params: Promise.resolve({ id: 'trato123' }) };

describe('rutas financieras', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dobles.confirmar.mockResolvedValue({ id: 'trato123', estado: 'FINANCIADO' });
    dobles.devolver.mockResolvedValue({ id: 'trato123', estado: 'DEVUELTO' });
  });

  it('pasa el hash a la verificación on-chain', async () => {
    const hash = 'a'.repeat(64);
    const respuesta = await confirmar(
      new Request('http://localhost/api/tratos/trato123/confirmar', {
        method: 'POST',
        body: JSON.stringify({ hash }),
        headers: { 'content-type': 'application/json' },
      }),
      contexto,
    );

    expect(respuesta.status).toBe(200);
    expect(dobles.confirmar).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'trato123', hash, actor: dobles.usuario }),
    );
  });

  it('rechaza cuerpos inválidos sin consultar la cadena', async () => {
    const respuesta = await confirmar(
      new Request('http://localhost/api/tratos/trato123/confirmar', {
        method: 'POST',
        body: JSON.stringify({ hash: 'corto', campoInesperado: true }),
        headers: { 'content-type': 'application/json' },
      }),
      contexto,
    );

    expect(respuesta.status).toBe(400);
    expect(dobles.confirmar).not.toHaveBeenCalled();
  });

  it('no permite restaurar la devolución anticipada desde el cliente', async () => {
    const respuesta = await devolver(
      new Request('http://localhost/api/tratos/trato123/devolver', {
        method: 'POST',
        body: JSON.stringify({ motivo: 'ACORDADA' }),
        headers: { 'content-type': 'application/json' },
      }),
      contexto,
    );

    expect(respuesta.status).toBe(400);
    expect(dobles.devolver).not.toHaveBeenCalled();
  });

  it('conserva el código y estado HTTP de los errores de dominio', async () => {
    dobles.confirmar.mockRejectedValue(new ErrorApp('MONTO_INCORRECTO', 'Monto incorrecto'));
    const respuesta = await confirmar(
      new Request('http://localhost/api/tratos/trato123/confirmar', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'content-type': 'application/json' },
      }),
      contexto,
    );

    expect(respuesta.status).toBe(409);
    await expect(respuesta.json()).resolves.toMatchObject({
      ok: false,
      error: { codigo: 'MONTO_INCORRECTO' },
    });
  });
});
