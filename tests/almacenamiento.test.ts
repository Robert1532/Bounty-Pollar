import { beforeAll, describe, expect, it } from 'vitest';
import { detectarTipoImagen, extensionDe, hashDe } from '@/lib/almacenamiento';

/**
 * El tipo de archivo se decide por los bytes. La cabecera `Content-Type` la
 * escribe el cliente, así que confiar en ella es dejar que cualquiera suba lo
 * que quiera con solo cambiar una cadena de texto.
 */
function conCabecera(cabecera: number[], largo = 64): Uint8Array {
  const datos = new Uint8Array(largo);
  datos.set(cabecera, 0);
  return datos;
}

const JPEG = conCabecera([0xff, 0xd8, 0xff, 0xe0]);
const PNG = conCabecera([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP = (() => {
  const datos = conCabecera([0x52, 0x49, 0x46, 0x46]);
  datos.set([0x57, 0x45, 0x42, 0x50], 8);
  return datos;
})();

beforeAll(() => {
  process.env.DATABASE_URL = 'postgresql://x:y@localhost:5432/z';
  process.env.APP_URL = 'http://localhost:3000';
  process.env.SESSION_SECRET = 'un-secreto-de-pruebas-con-mas-de-32-caracteres';
  process.env.CRON_SECRET = 'secreto-de-cron-para-pruebas';
  process.env.MODO_MOCK = 'true';
});

describe('detección de imágenes por firma binaria', () => {
  it('reconoce los tres formatos que aceptamos', () => {
    expect(detectarTipoImagen(JPEG)).toBe('image/jpeg');
    expect(detectarTipoImagen(PNG)).toBe('image/png');
    expect(detectarTipoImagen(WEBP)).toBe('image/webp');
  });

  it('rechaza lo que no es imagen, aunque venga con nombre de foto', () => {
    const guionPeligroso = new TextEncoder().encode('<?php system($_GET["c"]); ?>'.padEnd(64, ' '));
    expect(detectarTipoImagen(guionPeligroso)).toBeNull();
    expect(detectarTipoImagen(new TextEncoder().encode('GIF89a'.padEnd(64, '\0')))).toBeNull();
    expect(detectarTipoImagen(conCabecera([0x25, 0x50, 0x44, 0x46]))).toBeNull(); // PDF
  });

  it('no explota con archivos vacíos o truncados', () => {
    expect(detectarTipoImagen(new Uint8Array(0))).toBeNull();
    expect(detectarTipoImagen(new Uint8Array([0xff, 0xd8]))).toBeNull();
  });

  it('un RIFF que no es WEBP no pasa', () => {
    const riffWave = conCabecera([0x52, 0x49, 0x46, 0x46]);
    riffWave.set([0x57, 0x41, 0x56, 0x45], 8); // "WAVE"
    expect(detectarTipoImagen(riffWave)).toBeNull();
  });

  it('la extensión sale del tipo detectado, nunca del nombre del archivo', () => {
    expect(extensionDe('image/jpeg')).toBe('jpg');
    expect(extensionDe('image/png')).toBe('png');
    expect(extensionDe('image/webp')).toBe('webp');
  });
});

describe('huella de la evidencia', () => {
  it('el hash es estable y distingue un byte de diferencia', () => {
    expect(hashDe(JPEG)).toBe(hashDe(new Uint8Array(JPEG)));
    expect(hashDe(JPEG)).toHaveLength(64);

    const alterada = new Uint8Array(JPEG);
    alterada[40] = 1;
    expect(hashDe(alterada)).not.toBe(hashDe(JPEG));
  });
});
