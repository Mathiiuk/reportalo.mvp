/**
 * @file vision.ts
 * @description Detección de rostros y patentes con Google Cloud Vision (REP-3793).
 * Lógica pura: el `fetch` se recibe por parámetro para poder probarla con Vitest usando
 * respuestas de Vision controladas, sin red ni Deno.
 *
 * Qué corrige respecto de REP-2404:
 * - La foto se pasa a Base64 por partes: `String.fromCharCode(...buffer)` desbordaba la pila
 *   con cualquier foto real y la detección nunca llegaba a correr.
 * - Las coordenadas normalizadas de los objetos se multiplican por el ancho y alto reales
 *   (antes se multiplicaban por 1000).
 * - Ya no se anonimiza el auto entero por detectar `car`: solo la patente.
 * - Las patentes se buscan también por texto (formatos argentinos), sobre todo el que cae
 *   dentro de un vehículo detectado.
 * - Nunca se inventan zonas: si Vision no está configurado o falla, se lanza un error y el
 *   pipeline activa el fail-safe.
 */

import type { Zone } from './pixelate.ts';

/** Endpoint de Vision. La clave NUNCA va en la URL (ver detectSensitiveZones). */
export const VISION_ENDPOINT = 'https://vision.googleapis.com/v1/images:annotate';

/** Tiempo máximo de espera de Vision antes de abortar (y activar el fail-safe). */
export const VISION_TIMEOUT_MS = 12000;

/** Motivos de falla que se devuelven al cliente en `reason` (nunca el detalle interno). */
export type VisionFailureReason =
  | 'vision_not_configured'
  | 'vision_timeout'
  | 'vision_http_error'
  | 'vision_response_error';

/** Error de detección: siempre termina en fail-safe, nunca en una foto sin proteger. */
export class VisionError extends Error {
  reason: VisionFailureReason;
  constructor(reason: VisionFailureReason, message: string) {
    super(message);
    this.name = 'VisionError';
    this.reason = reason;
  }
}

/**
 * Pasa bytes a Base64 de a bloques de 32 KB. Con una foto de 1600 px (~400 KB) el spread de
 * todos los bytes en una sola llamada supera el máximo de argumentos y lanza RangeError.
 */
export const bytesToBase64 = (bytes: Uint8Array): string => {
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
  }
  return btoa(binary);
};

/** Cuerpo del pedido a `images:annotate`: rostros, objetos (patentes y vehículos) y texto. */
export const buildVisionRequest = (base64Image: string) => ({
  requests: [
    {
      image: { content: base64Image },
      features: [
        { type: 'FACE_DETECTION', maxResults: 50 },
        { type: 'OBJECT_LOCALIZATION', maxResults: 50 },
        { type: 'TEXT_DETECTION' },
      ],
    },
  ],
});

interface Vertex { x?: number; y?: number }
interface Box { x1: number; y1: number; x2: number; y2: number }

/** Caja envolvente de un polígono en píxeles (Vision omite x o y cuando valen 0). */
const boxFromVertices = (vertices: Vertex[] = []): Box | null => {
  if (vertices.length === 0) return null;
  const xs = vertices.map((v) => v.x ?? 0);
  const ys = vertices.map((v) => v.y ?? 0);
  const box = { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
  return box.x2 > box.x1 && box.y2 > box.y1 ? box : null;
};

/** Caja envolvente de un polígono normalizado (0 a 1), llevada a píxeles de la imagen real. */
const boxFromNormalized = (vertices: Vertex[] = [], width: number, height: number): Box | null =>
  boxFromVertices(vertices.map((v) => ({ x: (v.x ?? 0) * width, y: (v.y ?? 0) * height })));

const toZone = (box: Box, type: Zone['type']): Zone => ({
  x: Math.round(box.x1),
  y: Math.round(box.y1),
  width: Math.round(box.x2 - box.x1),
  height: Math.round(box.y2 - box.y1),
  type,
});

const union = (a: Box, b: Box): Box => ({
  x1: Math.min(a.x1, b.x1),
  y1: Math.min(a.y1, b.y1),
  x2: Math.max(a.x2, b.x2),
  y2: Math.max(a.y2, b.y2),
});

/** ¿El centro de la caja cae dentro de la otra? */
const centerInside = (inner: Box, outer: Box): boolean => {
  const cx = (inner.x1 + inner.x2) / 2;
  const cy = (inner.y1 + inner.y2) / 2;
  return cx >= outer.x1 && cx <= outer.x2 && cy >= outer.y1 && cy <= outer.y2;
};

/** Objetos que Vision devuelve para un vehículo: sirven para asociar el texto de la patente. */
const VEHICLE_NAMES = /^(car|vehicle|truck|bus|van|motorcycle|taxi|land vehicle|pickup truck)$/i;

/** Nombre del objeto que Vision usa para la patente. */
const PLATE_NAME = /license plate|licence plate|number plate/i;

/**
 * Formatos de patente argentina, sin espacios ni guiones:
 * - AB123CD  Mercosur autos (desde 2016)
 * - ABC123   autos anterior
 * - A123BCD  Mercosur motos
 * - 123ABC   motos anterior
 */
export const ARGENTINE_PLATE = /^([A-Z]{2}\d{3}[A-Z]{2}|[A-Z]{3}\d{3}|[A-Z]\d{3}[A-Z]{3}|\d{3}[A-Z]{3})$/;

/** Texto que parece parte de una patente (letras y números cortos, con al menos un número). */
const LOOSE_PLATE_FRAGMENT = /^(?=.*\d)[A-Z0-9]{3,8}$/;

/** Deja solo letras y números en mayúsculas ("ab 123-cd" → "AB123CD"). */
export const normalizePlateText = (text: string): string =>
  (text || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

interface Word { text: string; box: Box }

/**
 * Busca patentes en el texto detectado. Una patente suele venir partida en varias palabras
 * ("AB 123 CD"), así que además de cada palabra se prueban dos y tres palabras seguidas.
 * Dentro de un vehículo alcanza con un fragmento parecido a una patente: una patente leída a
 * medias igual identifica al auto.
 */
export const findPlateBoxesInText = (words: Word[], vehicles: Box[]): Box[] => {
  const found: Box[] = [];
  const used = new Set<number>();

  // 1. Formato completo en una, dos o tres palabras seguidas (de la más larga a la más corta)
  for (const span of [3, 2, 1]) {
    for (let i = 0; i + span <= words.length; i++) {
      const indexes = Array.from({ length: span }, (_, k) => i + k);
      if (indexes.some((idx) => used.has(idx))) continue;
      const joined = indexes.map((idx) => normalizePlateText(words[idx].text)).join('');
      if (!ARGENTINE_PLATE.test(joined)) continue;
      found.push(indexes.map((idx) => words[idx].box).reduce(union));
      indexes.forEach((idx) => used.add(idx));
    }
  }

  // 2. Fragmentos dentro de un vehículo detectado
  words.forEach((word, idx) => {
    if (used.has(idx)) return;
    if (!LOOSE_PLATE_FRAGMENT.test(normalizePlateText(word.text))) return;
    if (vehicles.some((vehicle) => centerInside(word.box, vehicle))) {
      found.push(word.box);
      used.add(idx);
    }
  });

  return found;
};

/**
 * Convierte la respuesta de Vision en zonas a pixelar, en píxeles reales de la imagen.
 * Lanza VisionError si la respuesta trae un error: una detección parcial no es confiable.
 */
export const parseVisionResponse = (data: any, width: number, height: number): Zone[] => {
  const result = data?.responses?.[0];
  if (!result) throw new VisionError('vision_response_error', 'Vision devolvió una respuesta vacía.');
  if (result.error) {
    throw new VisionError('vision_response_error', `Vision devolvió un error: ${result.error.message || result.error.code}`);
  }

  const zones: Zone[] = [];

  // Rostros: boundingPoly incluye la cabeza entera (fdBoundingPoly es solo la cara)
  for (const face of result.faceAnnotations || []) {
    const box = boxFromVertices(face.boundingPoly?.vertices);
    if (box) zones.push(toZone(box, 'face'));
  }

  // Objetos: patentes a pixelar y vehículos para asociar el texto (el vehículo NO se pixela)
  const vehicles: Box[] = [];
  for (const obj of result.localizedObjectAnnotations || []) {
    const box = boxFromNormalized(obj.boundingPoly?.normalizedVertices, width, height);
    if (!box) continue;
    const name = obj.name || '';
    if (PLATE_NAME.test(name)) zones.push(toZone(box, 'license_plate'));
    else if (VEHICLE_NAMES.test(name)) vehicles.push(box);
  }

  // Texto: la primera anotación es el texto completo; las siguientes, palabra por palabra
  const words: Word[] = [];
  for (const annotation of (result.textAnnotations || []).slice(1)) {
    const box = boxFromVertices(annotation.boundingPoly?.vertices);
    if (box && annotation.description) words.push({ text: annotation.description, box });
  }
  for (const box of findPlateBoxesInText(words, vehicles)) {
    zones.push(toZone(box, 'license_plate'));
  }

  return zones;
};

/**
 * Llama a Vision y devuelve las zonas sensibles. Nunca devuelve zonas inventadas: ante
 * cualquier problema lanza VisionError y el pipeline no guarda la foto.
 */
export const detectSensitiveZones = async (
  imageBytes: Uint8Array,
  width: number,
  height: number,
  apiKey: string | undefined,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = VISION_TIMEOUT_MS
): Promise<Zone[]> => {
  if (!apiKey) {
    throw new VisionError('vision_not_configured', 'Falta el secreto GOOGLE_VISION_API_KEY.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    // La clave va en el header y no en la URL: los errores de red de Deno incluyen la URL
    // en el mensaje, y ese mensaje termina en los logs de la función
    response = await fetchImpl(VISION_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(buildVisionRequest(bytesToBase64(imageBytes))),
      signal: controller.signal,
    });
  } catch (error) {
    const aborted = (error as Error)?.name === 'AbortError';
    throw new VisionError(
      aborted ? 'vision_timeout' : 'vision_http_error',
      aborted ? `Vision no respondió en ${timeoutMs} ms.` : `No se pudo llamar a Vision: ${(error as Error)?.message}`
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    // El cuerpo puede traer el motivo (clave inválida, API deshabilitada); nunca trae la clave
    const detail = await response.text().catch(() => '');
    throw new VisionError('vision_http_error', `Vision respondió ${response.status}: ${detail.slice(0, 300)}`);
  }

  return parseVisionResponse(await response.json(), width, height);
};
