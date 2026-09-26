/**
 * @file QuarantineAnonymizeProtection.test.js
 * @description REP-3793 · Bloques 2, 3 y 4 del lado del servidor.
 * Prueba la lógica pura de la Edge Function `quarantine-anonymize` con respuestas de
 * Google Vision controladas: detección, coordenadas, pixelado efectivo y fail-safe.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  bytesToBase64,
  buildVisionRequest,
  parseVisionResponse,
  detectSensitiveZones,
  findPlateBoxesInText,
  normalizePlateText,
  ARGENTINE_PLATE,
  VisionError,
} from '../../supabase/functions/quarantine-anonymize/vision';
import {
  expandZone,
  blockSizeFor,
  pixelateZones,
  MIN_BLOCK_SIZE,
} from '../../supabase/functions/quarantine-anonymize/pixelate';
import {
  protectEvidence,
  ProtectionError,
  statusForReason,
  MAX_SERVER_SIDE,
} from '../../supabase/functions/quarantine-anonymize/protect';
import { readJpegSize } from '../../supabase/functions/quarantine-anonymize/exif';

/* ───────────────────────────── Ayudas ───────────────────────────── */

/** JPEG mínimo con un SOF0 que declara el tamaño (y un APP1 con "GPS" si se pide). */
const fakeJpeg = (width, height, { withExif = false } = {}) => {
  const parts = [0xff, 0xd8];
  if (withExif) {
    const payload = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0x47, 0x50, 0x53]; // "Exif\0\0GPS"
    parts.push(0xff, 0xe1, 0x00, payload.length + 2, ...payload);
  }
  // SOF0: longitud 11, precisión 8, alto, ancho, 1 componente
  parts.push(0xff, 0xc0, 0x00, 0x0b, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, 0x01, 0x01, 0x11, 0x00);
  // SOS mínimo, un byte de datos y fin de imagen
  parts.push(0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x00, 0xff, 0xd9);
  return new Uint8Array(parts);
};

/** Imagen RGBA con un patrón que cambia en cada píxel (para ver si un bloque se promedió). */
const patternedImage = (width, height) => {
  const bitmap = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      bitmap[i] = (x * 7) % 256;
      bitmap[i + 1] = (y * 11) % 256;
      bitmap[i + 2] = (x * y) % 256;
      bitmap[i + 3] = 255;
    }
  }
  return { width, height, bitmap };
};

const pixelAt = (image, x, y) => {
  const i = (y * image.width + x) * 4;
  return Array.from(image.bitmap.slice(i, i + 4));
};

/** Codec doble: "abre" una imagen con patrón y "guarda" un JPEG mínimo, registrando lo que recibió. */
const makeCodec = (width, height) => {
  const codec = {
    decoded: null,
    encodedWith: null,
    decode: vi.fn(async () => {
      codec.decoded = patternedImage(width, height);
      return codec.decoded;
    }),
    encode: vi.fn(async (image, quality) => {
      codec.encodedWith = { image, quality };
      return fakeJpeg(width, height, { withExif: true });
    }),
  };
  return codec;
};

/** Respuesta de Vision para una foto de 1600×1200 con una cara, un auto con patente y texto. */
const visionFixture = () => ({
  responses: [
    {
      faceAnnotations: [
        { boundingPoly: { vertices: [{ x: 100, y: 80 }, { x: 260, y: 80 }, { x: 260, y: 280 }, { x: 100, y: 280 }] } },
      ],
      localizedObjectAnnotations: [
        {
          name: 'Car',
          boundingPoly: { normalizedVertices: [{ x: 0.5, y: 0.5 }, { x: 0.9, y: 0.5 }, { x: 0.9, y: 0.9 }, { x: 0.5, y: 0.9 }] },
        },
        {
          name: 'License plate',
          boundingPoly: { normalizedVertices: [{ x: 0.65, y: 0.8 }, { x: 0.75, y: 0.8 }, { x: 0.75, y: 0.85 }, { x: 0.65, y: 0.85 }] },
        },
      ],
      textAnnotations: [
        { description: 'AB 123 CD\nPANADERIA' },
        // Patente Mercosur partida en tres palabras, dentro del auto
        { description: 'AB', boundingPoly: { vertices: [{ x: 1040, y: 960 }, { x: 1070, y: 960 }, { x: 1070, y: 1000 }, { x: 1040, y: 1000 }] } },
        { description: '123', boundingPoly: { vertices: [{ x: 1075, y: 960 }, { x: 1120, y: 960 }, { x: 1120, y: 1000 }, { x: 1075, y: 1000 }] } },
        { description: 'CD', boundingPoly: { vertices: [{ x: 1125, y: 960 }, { x: 1160, y: 960 }, { x: 1160, y: 1000 }, { x: 1125, y: 1000 }] } },
        // Un cartel: no es patente y no se toca
        { description: 'PANADERIA', boundingPoly: { vertices: [{ x: 50, y: 700 }, { x: 400, y: 700 }, { x: 400, y: 760 }, { x: 50, y: 760 }] } },
      ],
    },
  ],
});

/* ───────────────────────── Bloque 2 · Vision ───────────────────────── */

describe('REP-3793 Bloque 2: detección con Google Vision', () => {
  it('UT-VIS-01: pasa a Base64 una foto real sin desbordar la pila', () => {
    // 600 KB: con String.fromCharCode(...buffer) esto lanzaba RangeError
    const big = new Uint8Array(600 * 1024).map((_, i) => i % 256);
    const base64 = bytesToBase64(big);
    expect(Buffer.from(base64, 'base64').equals(Buffer.from(big))).toBe(true);
  });

  it('UT-VIS-02: pide rostros, objetos y texto', () => {
    const types = buildVisionRequest('xx').requests[0].features.map((f) => f.type);
    expect(types).toEqual(['FACE_DETECTION', 'OBJECT_LOCALIZATION', 'TEXT_DETECTION']);
  });

  it('UT-VIS-03: los rostros salen en píxeles, con la caja envolvente de todos los vértices', () => {
    const zones = parseVisionResponse(visionFixture(), 1600, 1200);
    expect(zones).toContainEqual({ x: 100, y: 80, width: 160, height: 200, type: 'face' });
  });

  it('UT-VIS-04: la patente usa el ancho y alto reales (no ×1000)', () => {
    const zones = parseVisionResponse(visionFixture(), 1600, 1200);
    // 0.65 × 1600 = 1040 · 0.8 × 1200 = 960 · ancho 0.1 × 1600 = 160 · alto 0.05 × 1200 = 60
    expect(zones).toContainEqual({ x: 1040, y: 960, width: 160, height: 60, type: 'license_plate' });
  });

  it('UT-VIS-05: el auto no se pixela entero, solo su patente', () => {
    const zones = parseVisionResponse(visionFixture(), 1600, 1200);
    // El auto ocupa 640×480 px: ninguna zona puede tener ese tamaño
    expect(zones.some((z) => z.width >= 600 && z.height >= 450)).toBe(false);
    expect(zones.every((z) => z.type === 'face' || z.type === 'license_plate')).toBe(true);
  });

  it('UT-VIS-06: arma la patente con palabras separadas ("AB" "123" "CD") y no toca carteles', () => {
    const zones = parseVisionResponse(visionFixture(), 1600, 1200);
    expect(zones).toContainEqual({ x: 1040, y: 960, width: 120, height: 40, type: 'license_plate' });
    expect(zones.some((z) => z.x === 50 && z.y === 700)).toBe(false);
  });

  it('UT-VIS-07: reconoce los formatos de patente argentinos', () => {
    ['AB123CD', 'ABC123', 'A123BCD', '123ABC'].forEach((plate) => expect(ARGENTINE_PLATE.test(plate)).toBe(true));
    ['PANADERIA', '1234', 'AB12', 'HOLA123'].forEach((text) => expect(ARGENTINE_PLATE.test(text)).toBe(false));
    expect(normalizePlateText('ab 123-cd')).toBe('AB123CD');
  });

  it('UT-VIS-08: dentro de un vehículo alcanza un fragmento de patente; fuera, no', () => {
    const car = { x1: 0, y1: 0, x2: 500, y2: 400 };
    const words = [
      { text: 'KJ45', box: { x1: 100, y1: 300, x2: 160, y2: 330 } }, // en el auto
      { text: 'KJ45', box: { x1: 700, y1: 300, x2: 760, y2: 330 } }, // fuera del auto
    ];
    const boxes = findPlateBoxesInText(words, [car]);
    expect(boxes).toEqual([words[0].box]);
  });

  it('UT-VIS-09: una foto sin datos sensibles no genera zonas (nada inventado)', () => {
    expect(parseVisionResponse({ responses: [{}] }, 1600, 1200)).toEqual([]);
  });

  it('UT-VIS-10: sin clave no inventa zonas: lanza vision_not_configured', async () => {
    const fetchImpl = vi.fn();
    await expect(detectSensitiveZones(new Uint8Array(4), 10, 10, undefined, fetchImpl)).rejects.toMatchObject({
      reason: 'vision_not_configured',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('UT-VIS-11: un error HTTP de Vision (clave inválida) lanza vision_http_error', async () => {
    const fetchImpl = vi.fn(async () => new Response('{"error":{"status":"INVALID_ARGUMENT"}}', { status: 400 }));
    await expect(detectSensitiveZones(new Uint8Array(4), 10, 10, 'k', fetchImpl)).rejects.toMatchObject({
      reason: 'vision_http_error',
    });
  });

  it('UT-VIS-12: si Vision no responde a tiempo, aborta con vision_timeout', async () => {
    const fetchImpl = vi.fn(
      (_url, { signal }) =>
        new Promise((_, reject) => signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))))
    );
    await expect(detectSensitiveZones(new Uint8Array(4), 10, 10, 'k', fetchImpl, 20)).rejects.toMatchObject({
      reason: 'vision_timeout',
    });
  });

  it('UT-VIS-13: un error dentro de la respuesta no se toma como "sin zonas"', () => {
    const data = { responses: [{ error: { code: 3, message: 'Bad image data.' } }] };
    expect(() => parseVisionResponse(data, 10, 10)).toThrow(VisionError);
  });

  it('UT-VIS-14: con respuesta correcta devuelve las zonas y manda la foto en Base64', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(visionFixture()), { status: 200 }));
    const zones = await detectSensitiveZones(new Uint8Array([1, 2, 3]), 1600, 1200, 'k', fetchImpl);
    expect(zones.length).toBeGreaterThanOrEqual(3);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(JSON.parse(init.body).requests[0].image.content).toBe('AQID');
    // La clave viaja en el header, nunca en la URL (que puede terminar en un log de error)
    expect(url).toBe('https://vision.googleapis.com/v1/images:annotate');
    expect(url).not.toContain('k');
    expect(init.headers['x-goog-api-key']).toBe('k');
  });
});

/* ───────────────────────── Bloque 3 · Pixelado ───────────────────────── */

describe('REP-3793 Bloque 3: pixelado efectivo', () => {
  it('UT-PIX-01: agranda la zona un 12 % por lado y la recorta a la imagen', () => {
    expect(expandZone({ x: 100, y: 100, width: 100, height: 50, type: 'face' }, 1000, 1000)).toEqual({
      x: 88, y: 94, width: 124, height: 62, type: 'face',
    });
    // Pegada al borde: no se sale de la imagen
    expect(expandZone({ x: 0, y: 0, width: 100, height: 100, type: 'face' }, 105, 105)).toEqual({
      x: 0, y: 0, width: 105, height: 105, type: 'face',
    });
    // Fuera de la imagen: no hay nada que pixelar
    expect(expandZone({ x: 2000, y: 2000, width: 10, height: 10, type: 'face' }, 100, 100)).toBeNull();
  });

  it('UT-PIX-02: bloques grandes (8 por lado como máximo) y nunca menores a 10 px', () => {
    expect(blockSizeFor({ width: 160, height: 200 })).toBe(25);
    expect(blockSizeFor({ width: 30, height: 12 })).toBe(MIN_BLOCK_SIZE);
  });

  it('UT-PIX-03: cada bloque queda de un solo color y fuera de la zona no cambia nada', () => {
    const image = patternedImage(200, 200);
    const before = patternedImage(200, 200);
    const [applied] = pixelateZones(image.bitmap, 200, 200, [{ x: 50, y: 50, width: 80, height: 80, type: 'face' }]);

    const block = blockSizeFor(applied);
    // Primer bloque de la zona: todos sus píxeles iguales
    const first = pixelAt(image, applied.x, applied.y);
    for (let y = applied.y; y < applied.y + block; y++) {
      for (let x = applied.x; x < applied.x + block; x++) {
        expect(pixelAt(image, x, y)).toEqual(first);
      }
    }
    // El detalle original desapareció
    expect(pixelAt(image, applied.x + 1, applied.y)).not.toEqual(pixelAt(before, applied.x + 1, applied.y));
    // Fuera de la zona (con su margen) la imagen es idéntica
    for (const [x, y] of [[0, 0], [199, 199], [applied.x - 1, applied.y], [applied.x + applied.width, applied.y + 5]]) {
      expect(pixelAt(image, x, y)).toEqual(pixelAt(before, x, y));
    }
  });
});

/* ─────────────── Bloques 3 y 4 · Pipeline completo y fail-safe ─────────────── */

describe('REP-3793 Bloque 4: pipeline de protección y fail-safe', () => {
  it('UT-PRT-01: lee el tamaño del JPEG desde el encabezado', () => {
    expect(readJpegSize(fakeJpeg(1600, 1200))).toEqual({ width: 1600, height: 1200 });
    expect(readJpegSize(new Uint8Array([1, 2, 3]))).toBeNull();
  });

  it('UT-PRT-02: pixela las zonas detectadas, re-codifica y devuelve un JPEG sin EXIF', async () => {
    const codec = makeCodec(400, 300);
    const detect = vi.fn(async () => [{ x: 40, y: 40, width: 80, height: 80, type: 'face' }]);

    const result = await protectEvidence(fakeJpeg(400, 300, { withExif: true }), codec, detect);

    // Vision recibió la foto YA sin EXIF (el GPS no sale del servidor)
    const sentToVision = detect.mock.calls[0][0];
    expect(Buffer.from(sentToVision).includes(Buffer.from('GPS'))).toBe(false);
    // Se codificó la imagen pixelada, con calidad 85
    expect(codec.encodedWith.quality).toBe(85);
    const zone = result.zones[0];
    expect(pixelAt(codec.decoded, zone.x, zone.y)).toEqual(pixelAt(codec.decoded, zone.x + 5, zone.y + 5));
    // Segunda defensa: el resultado no conserva el APP1 que traía el codificador
    expect(Buffer.from(result.bytes).includes(Buffer.from('GPS'))).toBe(false);
    expect(result).toMatchObject({ width: 400, height: 300 });
  });

  it('UT-PRT-03: sin zonas también re-codifica (un único camino para toda evidencia)', async () => {
    const codec = makeCodec(400, 300);
    const result = await protectEvidence(fakeJpeg(400, 300), codec, async () => []);
    expect(codec.encode).toHaveBeenCalledTimes(1);
    expect(result.zones).toEqual([]);
  });

  it.each([
    ['vision_not_configured', 503],
    ['vision_timeout', 503],
    ['vision_http_error', 503],
  ])('UT-PRT-04: si Vision falla (%s) no se guarda nada y responde %i', async (reason, status) => {
    const codec = makeCodec(400, 300);
    const detect = async () => {
      throw new VisionError(reason, 'falla controlada');
    };
    const attempt = protectEvidence(fakeJpeg(400, 300), codec, detect);
    await expect(attempt).rejects.toBeInstanceOf(ProtectionError);
    await expect(attempt).rejects.toMatchObject({ reason });
    expect(codec.encode).not.toHaveBeenCalled();
    expect(statusForReason(reason)).toBe(status);
  });

  it('UT-PRT-05: rechaza una foto más grande que el máximo sin abrirla', async () => {
    const codec = makeCodec(4032, 3024);
    const detect = vi.fn();
    await expect(protectEvidence(fakeJpeg(4032, 3024), codec, detect)).rejects.toMatchObject({ reason: 'image_too_large' });
    expect(codec.decode).not.toHaveBeenCalled();
    expect(detect).not.toHaveBeenCalled();
    expect(MAX_SERVER_SIDE).toBe(2048);
    expect(statusForReason('image_too_large')).toBe(413);
  });

  it('UT-PRT-06: rechaza lo que no es JPEG', async () => {
    await expect(protectEvidence(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), makeCodec(1, 1), vi.fn())).rejects.toMatchObject({
      reason: 'not_jpeg',
    });
  });

  it('UT-PRT-07: si la foto no se puede abrir, falla aunque Vision también falle (sin rechazos sueltos)', async () => {
    const codec = makeCodec(400, 300);
    codec.decode = vi.fn(async () => {
      throw new Error('corrupta');
    });
    const detect = async () => {
      throw new VisionError('vision_timeout', 'x');
    };
    await expect(protectEvidence(fakeJpeg(400, 300), codec, detect)).rejects.toMatchObject({ reason: 'image_unreadable' });
  });

  it('UT-PRT-08: si no se puede guardar la versión pixelada, no hay evidencia', async () => {
    const codec = makeCodec(400, 300);
    codec.encode = vi.fn(async () => {
      throw new Error('sin memoria');
    });
    await expect(protectEvidence(fakeJpeg(400, 300), codec, async () => [])).rejects.toMatchObject({
      reason: 'encode_failed',
    });
  });
});
