/**
 * @file EvidenceImageResize.test.js
 * @description REP-3793 · Bloque 1. La foto se reduce en el cliente antes de subirla,
 * para que la Edge Function pueda pixelarla dentro de su límite de CPU (medido en el
 * Bloque 0: 1600 px entra con margen, 4032 px la tira abajo).
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  prepareEvidenceImage,
  EVIDENCE_MAX_SIDE,
  EVIDENCE_JPEG_QUALITY,
} from '../services/metadataSanitizer';

/** JPEG mínimo sin EXIF (orientación normal). */
const plainJpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

/** Archivo de prueba con arrayBuffer(), que jsdom no siempre provee. */
const makeFile = (type = 'image/jpeg', bytes = plainJpegBytes) => ({
  name: 'foto.jpg',
  type,
  arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
});

/** Monta un canvas falso y devuelve lo que se dibujó en él. */
const mockCanvas = () => {
  const outBlob = { type: 'image/jpeg', size: 10 };
  const canvas = {
    width: 0,
    height: 0,
    drawImage: vi.fn(),
    toBlob: vi.fn((callback) => callback(outBlob)),
  };
  vi.spyOn(document, 'createElement').mockReturnValue({
    get width() { return canvas.width; },
    set width(v) { canvas.width = v; },
    get height() { return canvas.height; },
    set height(v) { canvas.height = v; },
    getContext: () => ({ drawImage: canvas.drawImage, fillRect: vi.fn(), fillStyle: '' }),
    toBlob: canvas.toBlob,
  });
  return { canvas, outBlob };
};

describe('REP-3793 Bloque 1: prepareEvidenceImage', () => {
  afterEach(() => {
    delete global.createImageBitmap;
    vi.restoreAllMocks();
  });

  it('UT-RSZ-01: el tamaño máximo es 1600 px y la calidad 0,85', () => {
    expect(EVIDENCE_MAX_SIDE).toBe(1600);
    expect(EVIDENCE_JPEG_QUALITY).toBe(0.85);
  });

  it('UT-RSZ-02: una foto horizontal de celular (4032×3024) baja a 1600×1200', async () => {
    const file = makeFile();
    global.createImageBitmap = vi.fn().mockResolvedValue({ width: 4032, height: 3024, close: vi.fn() });
    const { canvas, outBlob } = mockCanvas();

    const result = await prepareEvidenceImage(file);

    expect(result).toBe(outBlob);
    expect(canvas.width).toBe(1600);
    expect(canvas.height).toBe(1200);
    // La reducción la hace drawImage con el tamaño destino
    expect(canvas.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1600, 1200);
    expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.85);
  });

  it('UT-RSZ-03: una foto vertical (3024×4032) baja a 1200×1600', async () => {
    global.createImageBitmap = vi.fn().mockResolvedValue({ width: 3024, height: 4032, close: vi.fn() });
    const { canvas } = mockCanvas();

    await prepareEvidenceImage(makeFile());

    expect(canvas.width).toBe(1200);
    expect(canvas.height).toBe(1600);
  });

  it('UT-RSZ-04: un JPEG chico y derecho pasa sin re-comprimir (no se agranda)', async () => {
    const file = makeFile();
    global.createImageBitmap = vi.fn().mockResolvedValue({ width: 800, height: 600, close: vi.fn() });
    const createElement = vi.spyOn(document, 'createElement');

    expect(await prepareEvidenceImage(file)).toBe(file);
    expect(createElement).not.toHaveBeenCalled();
  });

  it('UT-RSZ-05: un PNG chico se convierte a JPEG sin agrandarlo', async () => {
    global.createImageBitmap = vi.fn().mockResolvedValue({ width: 640, height: 480, close: vi.fn() });
    const { canvas, outBlob } = mockCanvas();

    const result = await prepareEvidenceImage(makeFile('image/png'));

    expect(result).toBe(outBlob);
    expect(canvas.width).toBe(640);
    expect(canvas.height).toBe(480);
  });

  it('UT-RSZ-06: si no se puede decodificar devuelve el original, nunca pierde la evidencia', async () => {
    const file = makeFile();
    global.createImageBitmap = vi.fn().mockRejectedValue(new Error('decode error'));

    expect(await prepareEvidenceImage(file)).toBe(file);
  });

  it('UT-RSZ-07: sin canvas (jsdom) degrada al camino anterior sin romper', async () => {
    const file = makeFile();
    expect(await prepareEvidenceImage(file)).toBe(file);
    expect(await prepareEvidenceImage(null)).toBeNull();
  });
});
