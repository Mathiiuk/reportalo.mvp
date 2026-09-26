/**
 * @file exif.ts
 * @description Lógica pura (sin Deno ni red) de la función quarantine-anonymize (REP-2501).
 * Vive aparte de index.ts para poder probarla con Vitest.
 */

const MARKER_SOI = 0xd8;
const MARKER_EOI = 0xd9;
const MARKER_SOS = 0xda;
const MARKER_APP0 = 0xe0;
const MARKER_APP1 = 0xe1;
const MARKER_APP14 = 0xee; // Adobe: solo dice cómo decodificar el color, no lleva datos personales
const MARKER_APP15 = 0xef;
const MARKER_COM = 0xfe;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** ¿Empieza con la firma de un JPEG (0xFFD8 y otro marcador)? */
export const isJpeg = (buffer: Uint8Array): boolean =>
  buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === MARKER_SOI;

/** ¿Es un UUID? Se usa para no armar rutas de Storage con texto que puso el cliente. */
export const isUuid = (value: unknown): boolean =>
  typeof value === 'string' && UUID_PATTERN.test(value);

/**
 * La ruta de cuarentena debe ser `<id-del-usuario>/<archivo>`: una sola carpeta, la del
 * usuario autenticado, y un nombre de archivo sin más niveles ni `..`.
 * Evita que un usuario pida procesar (y borrar) la foto original de otro.
 */
export const isOwnQuarantinePath = (path: unknown, userId: string): boolean => {
  if (typeof path !== 'string' || !userId) return false;
  const parts = path.split('/');
  if (parts.length !== 2) return false;
  const [folder, file] = parts;
  return folder === userId && file.length > 0 && file !== '.' && file !== '..';
};

/**
 * Segmentos que llevan metadatos: APP1 a APP15 (EXIF, XMP, MPF, IPTC en APP13...) salvo
 * APP14, y los comentarios. APP0 se conserva salvo la extensión JFXX, que trae una
 * miniatura: una copia de la foto sin anonimizar.
 */
const isMetadataSegment = (marker: number, payload: Uint8Array): boolean => {
  if (marker === MARKER_COM) return true;
  if (marker >= MARKER_APP1 && marker <= MARKER_APP15 && marker !== MARKER_APP14) return true;
  if (marker === MARKER_APP0) {
    return payload.length >= 5 && String.fromCharCode(...payload.subarray(0, 4)) === 'JFXX';
  }
  return false;
};

/**
 * Busca el fin de imagen (0xFFD9) dentro de los datos comprimidos. En esa zona un 0xFF
 * seguido de 0x00 es relleno y 0xFF + 0xD0..0xD7 es un marcador de reinicio: ninguno
 * termina la imagen.
 */
const findEndOfImage = (buffer: Uint8Array, from: number): number => {
  for (let i = from; i < buffer.length - 1; i += 1) {
    if (buffer[i] === 0xff && buffer[i + 1] === MARKER_EOI) return i + 2;
  }
  return -1;
};

/**
 * Devuelve el JPEG sin metadatos y sin nada después del fin de imagen (algunos teléfonos
 * agregan ahí una segunda imagen o un mapa de ganancia con su propio EXIF).
 *
 * Lanza error si el archivo no es un JPEG o está corrupto: es preferible rechazar la
 * foto a guardar algo que no se pudo verificar.
 */
export const stripExifMetadata = (buffer: Uint8Array): Uint8Array => {
  if (!isJpeg(buffer)) {
    throw new Error('Solo se aceptan imágenes JPEG: no se puede limpiar otro formato.');
  }

  const kept: Uint8Array[] = [buffer.subarray(0, 2)];
  let offset = 2;

  while (offset + 1 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      throw new Error('JPEG corrupto: se esperaba un marcador.');
    }
    const marker = buffer[offset + 1];

    // Relleno entre marcadores
    if (marker === 0xff) {
      offset += 1;
      continue;
    }

    if (marker === MARKER_EOI) {
      kept.push(buffer.subarray(offset, offset + 2));
      break;
    }

    if (offset + 3 >= buffer.length) throw new Error('JPEG corrupto: segmento cortado.');
    const length = (buffer[offset + 2] << 8) | buffer[offset + 3];
    const end = offset + 2 + length;
    if (length < 2 || end > buffer.length) {
      throw new Error('JPEG corrupto: longitud de segmento inválida.');
    }

    if (marker === MARKER_SOS) {
      // A partir de acá vienen los datos de la imagen: se copia hasta el primer fin de imagen
      const eoi = findEndOfImage(buffer, end);
      if (eoi === -1) throw new Error('JPEG corrupto: falta el fin de imagen.');
      kept.push(buffer.subarray(offset, eoi));
      break;
    }

    const payload = buffer.subarray(offset + 4, end);
    if (!isMetadataSegment(marker, payload)) {
      kept.push(buffer.subarray(offset, end));
    }
    offset = end;
  }

  const total = kept.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(total);
  let position = 0;
  for (const part of kept) {
    result.set(part, position);
    position += part.length;
  }
  return result;
};

/** Marcadores SOF (inicio de cuadro) que llevan el alto y el ancho: todos salvo DHT, JPG y DAC. */
const isStartOfFrame = (marker: number): boolean =>
  marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;

/**
 * REP-3793 · Lee el ancho y el alto de un JPEG desde su encabezado, sin decodificarlo.
 * Sirve para rechazar una foto demasiado grande ANTES de gastar CPU abriéndola: una foto
 * de celular sin reducir supera el límite de la Edge Function y la corta a la mitad.
 * @returns { width, height } o null si no encuentra el encabezado
 */
export const readJpegSize = (buffer: Uint8Array): { width: number; height: number } | null => {
  if (!isJpeg(buffer)) return null;
  let offset = 2;
  while (offset + 8 < buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    const marker = buffer[offset + 1];
    // Relleno entre marcadores
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    // Llegar a los datos de la imagen sin ver un SOF es un JPEG inválido
    if (marker === MARKER_SOS || marker === MARKER_EOI) return null;
    const length = (buffer[offset + 2] << 8) | buffer[offset + 3];
    if (isStartOfFrame(marker)) {
      // SOF: longitud (2), precisión (1), alto (2), ancho (2)
      const height = (buffer[offset + 5] << 8) | buffer[offset + 6];
      const width = (buffer[offset + 7] << 8) | buffer[offset + 8];
      return width > 0 && height > 0 ? { width, height } : null;
    }
    if (length < 2) return null;
    offset += 2 + length;
  }
  return null;
};
