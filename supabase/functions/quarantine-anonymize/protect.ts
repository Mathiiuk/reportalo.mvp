/**
 * @file protect.ts
 * @description Pipeline de protección de la evidencia (REP-3793), sin Deno ni red.
 *
 * foto en cuarentena → validar JPEG y tamaño → quitar EXIF → detectar (Vision) → abrir →
 * pixelar → volver a codificar → quitar EXIF otra vez → versión protegida
 *
 * Todo lo que no sale bien lanza ProtectionError con un motivo explícito. Quien llama
 * (index.ts) no guarda nada en ese caso: el fail-safe es no persistir, nunca guardar la
 * foto sin proteger. Se vuelve a codificar aunque no haya zonas, para que toda evidencia
 * pase por el mismo camino.
 */

import { isJpeg, readJpegSize, stripExifMetadata } from './exif.ts';
import { pixelateZones, type Zone } from './pixelate.ts';
import { VisionError, type VisionFailureReason } from './vision.ts';

/**
 * Lado mayor máximo que el servidor acepta. El cliente reduce a 1600 px (Bloque 1); 2048 deja
 * margen para fotos ya chicas que no pasan por la reducción, y sigue lejos de los 4032 px
 * que en el Bloque 0 agotaron los recursos de la Edge Function.
 */
export const MAX_SERVER_SIDE = 2048;

/** Calidad JPEG de la versión protegida (ImageScript usa 1 a 100). */
export const OUTPUT_JPEG_QUALITY = 85;

export type ProtectionFailureReason =
  | VisionFailureReason
  | 'not_jpeg'
  | 'image_too_large'
  | 'image_unreadable'
  | 'encode_failed';

export class ProtectionError extends Error {
  reason: ProtectionFailureReason;
  constructor(reason: ProtectionFailureReason, message: string) {
    super(message);
    this.name = 'ProtectionError';
    this.reason = reason;
  }
}

/** Imagen abierta: píxeles RGBA fila por fila. */
export interface DecodedImage {
  width: number;
  height: number;
  bitmap: Uint8Array | Uint8ClampedArray;
}

/** Abre y guarda imágenes. En producción es ImageScript; en los tests, un doble. */
export interface ImageCodec {
  decode(bytes: Uint8Array): Promise<DecodedImage>;
  encode(image: DecodedImage, quality: number): Promise<Uint8Array>;
}

/** Detector de zonas sensibles. En producción llama a Vision (vision.ts). */
export type ZoneDetector = (bytes: Uint8Array, width: number, height: number) => Promise<Zone[]>;

export interface ProtectedEvidence {
  /** JPEG final: pixelado, re-codificado y sin metadatos */
  bytes: Uint8Array;
  /** Zonas pixeladas, ya agrandadas y recortadas a la imagen */
  zones: Zone[];
  width: number;
  height: number;
}

/**
 * Protege una foto. Lanza ProtectionError ante cualquier falla.
 * @param raw Bytes de la foto tal como llegó a cuarentena
 */
export const protectEvidence = async (
  raw: Uint8Array,
  codec: ImageCodec,
  detect: ZoneDetector
): Promise<ProtectedEvidence> => {
  // 1. Solo JPEG: es el único formato al que se le pueden quitar los metadatos sin abrirlo
  if (!isJpeg(raw)) throw new ProtectionError('not_jpeg', 'Solo se aceptan fotos en formato JPEG.');

  // 2. Tamaño desde el encabezado, antes de gastar CPU
  const size = readJpegSize(raw);
  if (!size) throw new ProtectionError('image_unreadable', 'No se pudo leer el tamaño de la foto.');
  if (Math.max(size.width, size.height) > MAX_SERVER_SIDE) {
    throw new ProtectionError(
      'image_too_large',
      `La foto mide ${size.width}×${size.height}; el máximo es ${MAX_SERVER_SIDE} px de lado.`
    );
  }

  // 3. Sin EXIF antes de mandarla a Vision: el servicio externo nunca recibe el GPS
  let clean: Uint8Array;
  try {
    clean = stripExifMetadata(raw);
  } catch (error) {
    throw new ProtectionError('image_unreadable', (error as Error).message);
  }

  // 4. Detección y apertura en paralelo: mientras Vision responde, se decodifica la foto
  const detection = detect(clean, size.width, size.height);
  // Si la apertura falla primero, el rechazo de la detección no debe quedar sin manejar
  detection.catch(() => {});

  let image: DecodedImage;
  try {
    image = await codec.decode(clean);
  } catch (error) {
    throw new ProtectionError('image_unreadable', `No se pudo abrir la foto: ${(error as Error).message}`);
  }
  // Las coordenadas de Vision son sobre el tamaño del encabezado: tienen que coincidir
  if (image.width !== size.width || image.height !== size.height) {
    throw new ProtectionError('image_unreadable', 'El tamaño decodificado no coincide con el del encabezado.');
  }

  let zones: Zone[];
  try {
    zones = await detection;
  } catch (error) {
    if (error instanceof VisionError) throw new ProtectionError(error.reason, error.message);
    throw new ProtectionError('vision_response_error', (error as Error)?.message || 'Falló la detección.');
  }

  // 5. Pixelado sobre los píxeles (con el margen de seguridad de cada zona)
  const applied = pixelateZones(image.bitmap, image.width, image.height, zones);

  // 6. Nueva codificación, haya zonas o no: una sola forma de guardar evidencia
  let encoded: Uint8Array;
  try {
    encoded = await codec.encode(image, OUTPUT_JPEG_QUALITY);
  } catch (error) {
    throw new ProtectionError('encode_failed', `No se pudo guardar la foto protegida: ${(error as Error).message}`);
  }

  // 7. Segunda defensa: el JPEG nuevo no debería traer metadatos, pero se limpia igual
  let bytes: Uint8Array;
  try {
    bytes = stripExifMetadata(encoded);
  } catch (error) {
    throw new ProtectionError('encode_failed', (error as Error).message);
  }

  return { bytes, zones: applied, width: image.width, height: image.height };
};

/** Código HTTP para cada motivo de falla. */
export const statusForReason = (reason: ProtectionFailureReason): number => {
  switch (reason) {
    case 'not_jpeg':
      return 415;
    case 'image_too_large':
      return 413;
    case 'image_unreadable':
      return 422;
    case 'vision_not_configured':
    case 'vision_timeout':
    case 'vision_http_error':
    case 'vision_response_error':
      return 503;
    default:
      return 500;
  }
};
