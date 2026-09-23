/**
 * @file ImageOrientation.test.js
 * @description Pruebas de la normalizacion de orientacion (fix de fotos
 * acostadas). El pipeline de privacidad borra el segmento APP1 para eliminar el
 * GPS, y con el se va la etiqueta Orientation: por eso hay que rotar los
 * pixeles antes de subir.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { normalizeImageOrientation, readExifOrientation, ensureJpeg } from '../services/metadataSanitizer';

/** JPEG minimo con un APP1/EXIF que declara Orientation = 6 (rotar 90 grados). */
const buildJpegWithOrientation = (orientation) => {
  const exif = [
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // "Exif\0\0"
    0x4d, 0x4d, 0x00, 0x2a,             // big-endian + magic 42
    0x00, 0x00, 0x00, 0x08,             // offset al IFD0
    0x00, 0x01,                         // 1 entrada
    0x01, 0x12,                         // tag 0x0112 = Orientation
    0x00, 0x03,                         // tipo SHORT
    0x00, 0x00, 0x00, 0x01,             // count 1
    (orientation >> 8) & 0xff, orientation & 0xff, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,             // fin del IFD
  ];
  const length = exif.length + 2;
  return new Uint8Array([
    0xff, 0xd8,                          // SOI
    0xff, 0xe1, (length >> 8) & 0xff, length & 0xff,
    ...exif,
    0xff, 0xd9,                          // EOI
  ]);
};

/** Blob de prueba con arrayBuffer(), que jsdom no siempre provee. */
const makeFile = (bytes) => ({
  name: 'foto.jpg',
  type: 'image/jpeg',
  arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
});

describe('Fix de fotos acostadas: normalizeImageOrientation', () => {
  afterEach(() => {
    delete global.createImageBitmap;
    vi.restoreAllMocks();
  });

  it('UT-ORI-01: readExifOrientation lee la etiqueta del APP1', () => {
    expect(readExifOrientation(buildJpegWithOrientation(6))).toBe(6);
    expect(readExifOrientation(buildJpegWithOrientation(1))).toBe(1);
  });

  it('UT-ORI-02: con orientacion normal devuelve el archivo sin re-encodear', async () => {
    // Evita perder calidad re-comprimiendo una foto que ya esta derecha.
    const file = makeFile(buildJpegWithOrientation(1));
    global.createImageBitmap = vi.fn();

    const result = await normalizeImageOrientation(file);

    expect(result).toBe(file);
    expect(global.createImageBitmap).not.toHaveBeenCalled();
  });

  it('UT-ORI-03: con orientacion rotada decodifica aplicando el EXIF', async () => {
    const file = makeFile(buildJpegWithOrientation(6));
    const rotatedBlob = { type: 'image/jpeg', size: 10 };

    global.createImageBitmap = vi.fn().mockResolvedValue({ width: 600, height: 800, close: vi.fn() });
    vi.spyOn(document, 'createElement').mockReturnValue({
      width: 0,
      height: 0,
      getContext: () => ({ drawImage: vi.fn() }),
      toBlob: (cb) => cb(rotatedBlob),
    });

    const result = await normalizeImageOrientation(file);

    // 'from-image' es lo que hace que el navegador aplique la rotacion EXIF.
    expect(global.createImageBitmap).toHaveBeenCalledWith(file, { imageOrientation: 'from-image' });
    expect(result).toBe(rotatedBlob);
  });

  it('UT-ORI-04: si la rotacion falla devuelve el original, nunca pierde la evidencia', async () => {
    const file = makeFile(buildJpegWithOrientation(6));
    global.createImageBitmap = vi.fn().mockRejectedValue(new Error('decode error'));

    expect(await normalizeImageOrientation(file)).toBe(file);
  });

  it('UT-ORI-05: sin createImageBitmap degrada al comportamiento anterior', async () => {
    const file = makeFile(buildJpegWithOrientation(6));
    // jsdom o navegadores viejos: se devuelve tal cual, sin romper el flujo.
    expect(await normalizeImageOrientation(file)).toBe(file);
  });

  it('UT-ORI-06: tolera entradas invalidas', async () => {
    expect(await normalizeImageOrientation(null)).toBeNull();
    expect(await normalizeImageOrientation({})).toEqual({});
  });
});

// REP-2501: el servidor solo acepta JPEG (no puede limpiar PNG/WebP sin re-codificar),
// así que el cliente convierte lo que no sea JPEG antes de subirlo a cuarentena.
describe('REP-2501: ensureJpeg', () => {
  afterEach(() => {
    delete global.createImageBitmap;
    vi.restoreAllMocks();
  });

  it('UT-JPG-01: un JPEG pasa sin re-codificar', async () => {
    const file = { name: 'foto.jpg', type: 'image/jpeg' };
    global.createImageBitmap = vi.fn();

    expect(await ensureJpeg(file)).toBe(file);
    expect(global.createImageBitmap).not.toHaveBeenCalled();
  });

  it('UT-JPG-02: un PNG se convierte a JPEG (sobre fondo blanco, sin transparencia)', async () => {
    const png = { name: 'captura.png', type: 'image/png' };
    const jpegBlob = { type: 'image/jpeg', size: 10 };
    const drawImage = vi.fn();
    const fillRect = vi.fn();
    const toBlob = vi.fn((callback) => callback(jpegBlob));

    global.createImageBitmap = vi.fn().mockResolvedValue({ width: 300, height: 200, close: vi.fn() });
    vi.spyOn(document, 'createElement').mockReturnValue({
      width: 0,
      height: 0,
      getContext: () => ({ drawImage, fillRect, fillStyle: '' }),
      toBlob,
    });

    const result = await ensureJpeg(png);

    expect(result).toBe(jpegBlob);
    expect(fillRect).toHaveBeenCalled();
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.92);
  });

  it('UT-JPG-03: si no puede convertir devuelve el original (el servidor lo rechaza y lo purga)', async () => {
    const webp = { name: 'foto.webp', type: 'image/webp' };
    global.createImageBitmap = vi.fn().mockRejectedValue(new Error('decode error'));

    expect(await ensureJpeg(webp)).toBe(webp);
  });

  it('UT-JPG-04: tolera entradas inválidas y entornos sin canvas', async () => {
    expect(await ensureJpeg(null)).toBeNull();
    const webp = { name: 'foto.webp', type: 'image/webp' };
    expect(await ensureJpeg(webp)).toBe(webp);
  });
});
