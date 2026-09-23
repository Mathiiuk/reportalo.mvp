import { describe, it, expect } from 'vitest';
import {
  isJpeg,
  isUuid,
  isOwnQuarantinePath,
  stripExifMetadata,
} from '../../supabase/functions/quarantine-anonymize/exif';

// REP-2501: la evidencia guardada no debe conservar metadatos de la foto original.
// Se arma un JPEG mínimo a mano para poder poner cada segmento en su lugar.
const bytes = (...values) => new Uint8Array(values);
const segment = (marker, payload) => {
  const length = payload.length + 2;
  return bytes(0xff, marker, length >> 8, length & 0xff, ...payload);
};
const text = (value) => Array.from(value).map((char) => char.charCodeAt(0));
const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let position = 0;
  parts.forEach((part) => {
    out.set(part, position);
    position += part.length;
  });
  return out;
};
const contains = (haystack, needle) => {
  const target = text(needle);
  for (let i = 0; i <= haystack.length - target.length; i += 1) {
    if (target.every((value, j) => haystack[i + j] === value)) return true;
  }
  return false;
};

const SOI = bytes(0xff, 0xd8);
const EOI = bytes(0xff, 0xd9);
const SOS = segment(0xda, [0x01, 0x01, 0x00, 0x00, 0x3f, 0x00]);
// Datos de imagen: incluye un 0xFF 0x00 (relleno) que no es un marcador
const SCAN = bytes(0x11, 0x22, 0xff, 0x00, 0x33);

describe('REP-2501: stripExifMetadata', () => {
  it('UT-EVI-01: quita EXIF/GPS (APP1) y conserva el resto de la imagen', () => {
    const jpeg = concat(
      SOI,
      segment(0xe0, text('JFIF\0')),
      segment(0xe1, text('Exif\0\0GPS-LAT-34.6')),
      segment(0xdb, [0x00, 0x01, 0x02]),
      SOS,
      SCAN,
      EOI
    );

    const clean = stripExifMetadata(jpeg);

    expect(contains(clean, 'GPS-LAT-34.6')).toBe(false);
    expect(contains(clean, 'JFIF')).toBe(true);
    expect(isJpeg(clean)).toBe(true);
    expect(Array.from(clean.slice(-2))).toEqual([0xff, 0xd9]);
  });

  it('UT-EVI-02: quita también IPTC/XMP (APP13/APP1) y comentarios, no solo APP1', () => {
    const jpeg = concat(
      SOI,
      segment(0xed, text('Photoshop 3.0\0AUTOR-JUAN-PEREZ')),
      segment(0xfe, text('COMENTARIO-PRIVADO')),
      segment(0xe2, text('MPF\0PUNTERO-A-OTRA-FOTO')),
      SOS,
      SCAN,
      EOI
    );

    const clean = stripExifMetadata(jpeg);

    expect(contains(clean, 'AUTOR-JUAN-PEREZ')).toBe(false);
    expect(contains(clean, 'COMENTARIO-PRIVADO')).toBe(false);
    expect(contains(clean, 'PUNTERO-A-OTRA-FOTO')).toBe(false);
  });

  it('UT-EVI-03: descarta la miniatura JFXX, que sería una copia sin anonimizar', () => {
    const jpeg = concat(SOI, segment(0xe0, text('JFXX\0MINIATURA-SIN-DIFUMINAR')), SOS, SCAN, EOI);
    expect(contains(stripExifMetadata(jpeg), 'MINIATURA-SIN-DIFUMINAR')).toBe(false);
  });

  it('UT-EVI-04: corta lo que venga después del fin de imagen (mapa de ganancia / segunda foto)', () => {
    const jpeg = concat(
      SOI,
      SOS,
      SCAN,
      EOI,
      SOI,
      segment(0xe1, text('Exif\0\0SEGUNDA-IMAGEN-CON-EXIF')),
      EOI
    );

    const clean = stripExifMetadata(jpeg);

    expect(contains(clean, 'SEGUNDA-IMAGEN-CON-EXIF')).toBe(false);
    expect(Array.from(clean.slice(-2))).toEqual([0xff, 0xd9]);
  });

  it('UT-EVI-05: no toma el 0xFF 0x00 de los datos de imagen por el fin de imagen', () => {
    const jpeg = concat(SOI, SOS, bytes(0xaa, 0xff, 0x00, 0xbb, 0xcc), EOI);
    // Sin metadatos que quitar, la imagen debe salir idéntica
    expect(Array.from(stripExifMetadata(jpeg))).toEqual(Array.from(jpeg));
  });

  it('UT-EVI-06: si el JPEG está corrupto lanza error en vez de guardar algo sin verificar', () => {
    // Longitud de segmento que se pasa del final del archivo
    const corrupt = concat(SOI, bytes(0xff, 0xe1, 0xff, 0xff, 0x00));
    expect(() => stripExifMetadata(corrupt)).toThrow();
  });

  it('UT-EVI-07: lanza error si el archivo no es JPEG (no se puede limpiar sin re-codificar)', () => {
    const png = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    expect(isJpeg(png)).toBe(false);
    expect(() => stripExifMetadata(png)).toThrow(/JPEG/i);
  });
});

describe('REP-2501: validación de la ruta de cuarentena', () => {
  const userId = '3f6c1c1e-8f0a-4b0e-9d5c-1a2b3c4d5e6f';

  it('UT-EVI-08: acepta solo rutas dentro de la carpeta del propio usuario', () => {
    expect(isOwnQuarantinePath(`${userId}/temp_abc_1.jpg`, userId)).toBe(true);
    expect(isOwnQuarantinePath('otro-usuario/temp_abc_1.jpg', userId)).toBe(false);
    expect(isOwnQuarantinePath('temp_abc_1.jpg', userId)).toBe(false);
  });

  it('UT-EVI-09: rechaza intentos de salirse de la carpeta', () => {
    expect(isOwnQuarantinePath(`${userId}/../otro/temp.jpg`, userId)).toBe(false);
    expect(isOwnQuarantinePath(`${userId}/sub/temp.jpg`, userId)).toBe(false);
    expect(isOwnQuarantinePath(`${userId}/`, userId)).toBe(false);
  });

  it('UT-EVI-10: valida que el client_side_id sea un UUID', () => {
    expect(isUuid(userId)).toBe(true);
    expect(isUuid('../../etc')).toBe(false);
    expect(isUuid('')).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });
});
