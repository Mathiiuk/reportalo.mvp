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

/**
 * REP-3800 · Safari/iOS puede fallar al decodificar con createImageBitmap fotos grandes
 * (confirmado en staging con un iPhone 13 Pro real). Estos tests cubren el respaldo con
 * <img> (que no repite esa misma API) y la validación final de tamaño.
 */
describe('REP-3800: respaldo con <img> cuando createImageBitmap falla', () => {
  const realJpegBlob = () => new Blob([plainJpegBytes], { type: 'image/jpeg' });

  /**
   * Reemplaza global.Image por una que "decodifica" al tamaño pedido, sin tocar el DOM real.
   * jsdom no implementa URL.createObjectURL/revokeObjectURL (a diferencia de un navegador
   * real): se agregan acá para que prepareEvidenceImage pueda usar el camino con <img>.
   *
   * Acepta una secuencia de dimensiones: cada `new Image()` sucesivo devuelve la siguiente
   * (se repite la última si se piden más de las que se pasaron) — hace falta porque
   * `prepareEvidenceImage` decodifica dos veces con <img> cuando cae a este respaldo: una
   * vez para reducir la foto original y otra al final, para verificar el tamaño ya reducido.
   */
  const mockImageElement = (...dimsSequence) => {
    let callIndex = 0;
    class FakeImage {
      set src(_value) {
        const dims = dimsSequence[Math.min(callIndex, dimsSequence.length - 1)];
        callIndex += 1;
        queueMicrotask(() => {
          this.naturalWidth = dims.width;
          this.naturalHeight = dims.height;
          this.onload?.();
        });
      }
    }
    vi.stubGlobal('Image', FakeImage);
    URL.createObjectURL = vi.fn(() => 'blob:fake-url');
    URL.revokeObjectURL = vi.fn();
  };

  afterEach(() => {
    vi.unstubAllGlobals();
    delete global.createImageBitmap;
    delete URL.createObjectURL;
    delete URL.revokeObjectURL;
    vi.restoreAllMocks();
  });

  it('UT-RSZ-08: si createImageBitmap falla, <img> reduce igual la foto (no se manda a tamaño completo)', async () => {
    const file = realJpegBlob();
    global.createImageBitmap = vi.fn().mockRejectedValue(new Error('createImageBitmap no soportado'));
    // 1ra decodificación (foto original, dentro del respaldo <img>): 4032x3024.
    // 2da (verificación final del resultado ya reducido): 1600x1200, dentro del límite.
    mockImageElement({ width: 4032, height: 3024 }, { width: 1600, height: 1200 });
    const { canvas, outBlob } = mockCanvas();

    const result = await prepareEvidenceImage(file);

    expect(result).toBe(outBlob);
    expect(canvas.width).toBe(1600);
    expect(canvas.height).toBe(1200);
  });

  it('UT-RSZ-09: si ni createImageBitmap ni <img> pueden reducirla, lanza IMAGE_TOO_LARGE_CLIENT en vez de mandarla igual', async () => {
    const file = realJpegBlob();
    global.createImageBitmap = vi.fn().mockRejectedValue(new Error('createImageBitmap no soportado'));
    // <img> "decodifica" pero el canvas de reducción no está disponible (getContext null):
    // ninguno de los dos caminos logra bajarla del límite.
    mockImageElement({ width: 4032, height: 3024 });
    vi.spyOn(document, 'createElement').mockReturnValue({
      width: 0,
      height: 0,
      getContext: () => null,
      toBlob: vi.fn(),
    });

    await expect(prepareEvidenceImage(file)).rejects.toMatchObject({ code: 'IMAGE_TOO_LARGE_CLIENT' });
  });
});
