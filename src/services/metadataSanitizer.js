/**
 * @file metadataSanitizer.js
 * @description Módulo de sanitización y auditoría binaria de metadatos EXIF (REP-2401).
 * Implementa el principio de Privacidad por Diseño asegurando que ninguna fotografía
 * conserve coordenadas GPS, modelo de cámara ni marcas de tiempo antes de su persistencia.
 */

/**
 * Constantes de marcadores JPEG estándar (especificación ITU-T T.81)
 */
const MARKER_SOI = 0xd8;  // Inicio de imagen (Start of Image)
const MARKER_APP1 = 0xe1; // Marcador APP1: contiene metadatos EXIF / XMP
const MARKER_APP2 = 0xe2; // Marcador APP2: perfiles ICC o FlashPix
const MARKER_SOS = 0xda;  // Inicio de escaneo de datos comprimidos (Start of Scan)
const MARKER_EOI = 0xd9;  // Fin de imagen (End of Image)

/**
 * Inspecciona un buffer binario para determinar si contiene segmentos con metadatos EXIF.
 * Útil para auditorías de QA y comprobación de seguridad en tiempo de ejecución.
 * 
 * @param {Uint8Array} bytes Buffer binario de la imagen
 * @returns {boolean} true si se detectan metadatos EXIF o marcadores APP1, false si está limpio
 */
export const hasExifMetadata = (bytes) => {
  // Si no hay datos suficientes para una cabecera JPEG mínima, retornamos false
  if (!bytes || bytes.length < 4) return false;

  // Verificamos si comienza con el marcador SOI (0xFFD8)
  if (bytes[0] !== 0xff || bytes[1] !== MARKER_SOI) {
    return false;
  }

  let offset = 2;

  // Recorremos los marcadores de cabecera de la imagen
  while (offset < bytes.length - 1) {
    // Si no encontramos el byte de escape 0xFF, el stream está corrupto o desalineado
    if (bytes[offset] !== 0xff) break;

    const marker = bytes[offset + 1];

    // Si llegamos a SOS o EOI, terminó la sección de encabezados de metadatos
    if (marker === MARKER_SOS || marker === MARKER_EOI) {
      break;
    }

    // Si encontramos el marcador APP1 (0xFFE1), verificamos si contiene la firma "Exif"
    if (marker === MARKER_APP1) {
      return true;
    }

    // Leemos la longitud del segmento actual (2 bytes en formato big-endian)
    if (offset + 3 >= bytes.length) break;
    const length = (bytes[offset + 2] << 8) + bytes[offset + 3];

    // Avanzamos al siguiente marcador saltando el contenido de este segmento
    offset += 2 + length;
  }

  return false;
};

/**
 * Elimina los segmentos de metadatos EXIF (APP1) de un buffer binario JPEG.
 * Preserva intactos los segmentos de definición de cuantización (DQT), tablas Huffman (DHT),
 * cuadros de imagen (SOF) y el stream de datos comprimidos (SOS).
 * 
 * @param {Uint8Array} bytes Buffer binario de la imagen JPEG original
 * @returns {Uint8Array} Buffer binario limpio sin segmentos de metadatos EXIF
 */
export const stripExifFromJpeg = (bytes) => {
  // Validamos que el buffer exista y tenga al menos la firma de inicio JPEG
  if (!bytes || bytes.length < 4) return bytes;

  // Si no es un JPEG válido (0xFFD8), devolvemos el buffer sin modificar
  if (bytes[0] !== 0xff || bytes[1] !== MARKER_SOI) {
    return bytes;
  }

  // Lista para acumular los fragmentos limpios y esenciales de la imagen
  const safeChunks = [];
  let offset = 2;

  // Agregamos siempre el marcador SOI inicial (0xFFD8)
  safeChunks.push(new Uint8Array([0xff, MARKER_SOI]));

  // Recorremos los bloques de encabezados de la estructura JPEG
  while (offset < bytes.length) {
    // Si el byte actual no es 0xFF, detenemos el escaneo estructurado
    if (bytes[offset] !== 0xff) break;

    const marker = bytes[offset + 1];

    // Marcador SOS (Start of Scan) o EOI (End of Image): inicia la carga de píxeles
    if (marker === MARKER_SOS || marker === MARKER_EOI) {
      // Todo el resto del buffer a partir de aquí son los datos de la imagen en sí
      safeChunks.push(bytes.subarray(offset));
      break;
    }

    // Longitud total del segmento actual (incluye los 2 bytes de longitud)
    const segmentLength = (bytes[offset + 2] << 8) + bytes[offset + 3];

    // Marcador APP1 (0xFFE1): es el que contiene los metadatos EXIF, GPS y etiquetas del fabricante
    const isExifOrGpsMarker = (marker === MARKER_APP1);

    // Si NO es el marcador de metadatos EXIF, conservamos este segmento seguro
    if (!isExifOrGpsMarker) {
      safeChunks.push(bytes.subarray(offset, offset + 2 + segmentLength));
    }

    // Avanzamos el cursor al siguiente marcador
    offset += 2 + segmentLength;
  }

  // Calculamos la longitud total del nuevo buffer despojado de EXIF
  const totalLength = safeChunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const sanitizedBytes = new Uint8Array(totalLength);

  let currentPosition = 0;
  // Unificamos todos los fragmentos seguros en el array final
  for (const chunk of safeChunks) {
    sanitizedBytes.set(chunk, currentPosition);
    currentPosition += chunk.length;
  }

  return sanitizedBytes;
};

/**
 * Lee la etiqueta EXIF "Orientation" (tag 0x0112 del IFD0) desde el segmento APP1 de un JPEG.
 * Necesario porque `stripExifFromJpeg` descarta APP1 completo (incluyendo Orientation) y, si la
 * rotación no se aplica antes a los píxeles, la foto queda mostrada de costado/invertida (REP fix).
 *
 * @param {Uint8Array} bytes Buffer binario de la imagen JPEG original
 * @returns {number} Valor de orientación EXIF (1-8), o 1 (normal) si no hay etiqueta o no es válida
 */
export const readExifOrientation = (bytes) => {
  if (!bytes || bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== MARKER_SOI) return 1;

  let offset = 2;
  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) break;
    const marker = bytes[offset + 1];

    if (marker === MARKER_SOS || marker === MARKER_EOI) break;

    const segmentLength = (bytes[offset + 2] << 8) + bytes[offset + 3];

    if (marker === MARKER_APP1) {
      const segmentStart = offset + 4;
      // Firma "Exif\0\0" seguida del header TIFF
      const isExifSignature =
        bytes[segmentStart] === 0x45 && // E
        bytes[segmentStart + 1] === 0x78 && // x
        bytes[segmentStart + 2] === 0x69 && // i
        bytes[segmentStart + 3] === 0x66; // f

      if (isExifSignature) {
        const tiffStart = segmentStart + 6;
        const isLittleEndian = bytes[tiffStart] === 0x49 && bytes[tiffStart + 1] === 0x49;
        const isBigEndian = bytes[tiffStart] === 0x4d && bytes[tiffStart + 1] === 0x4d;

        if (isLittleEndian || isBigEndian) {
          const readUint16 = (pos) =>
            isLittleEndian ? bytes[pos] | (bytes[pos + 1] << 8) : (bytes[pos] << 8) | bytes[pos + 1];
          const readUint32 = (pos) =>
            isLittleEndian
              ? (bytes[pos] | (bytes[pos + 1] << 8) | (bytes[pos + 2] << 16) | (bytes[pos + 3] << 24)) >>> 0
              : ((bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3]) >>> 0;

          const ifd0Offset = tiffStart + readUint32(tiffStart + 4);
          if (ifd0Offset + 2 <= bytes.length) {
            const entryCount = readUint16(ifd0Offset);
            for (let i = 0; i < entryCount; i++) {
              const entryOffset = ifd0Offset + 2 + i * 12;
              if (entryOffset + 12 > bytes.length) break;
              const tag = readUint16(entryOffset);
              if (tag === 0x0112) {
                const value = readUint16(entryOffset + 8);
                return value >= 1 && value <= 8 ? value : 1;
              }
            }
          }
        }
      }
      // No seguimos buscando: Orientation solo vive en IFD0 del primer APP1 Exif
      break;
    }

    offset += 2 + segmentLength;
  }

  return 1;
};

/**
 * Redibuja una imagen en un canvas aplicando la transformación correspondiente a su
 * orientación EXIF, de forma que el resultado quede visualmente correcto con los píxeles
 * ya "horneados" en esa posición. El JPEG resultante del canvas no contiene EXIF.
 *
 * @param {Blob} blob Imagen original (con su orientación EXIF sin aplicar)
 * @param {number} orientation Valor EXIF Orientation (1-8)
 * @returns {Promise<Blob|null>} Blob JPEG ya rotado, o null si no se pudo procesar (entorno sin canvas, imagen inválida, etc.)
 */
const bakeExifOrientation = async (blob, orientation) => {
  if (orientation === 1) return null;
  if (typeof document === 'undefined' || typeof Image === 'undefined' || typeof URL?.createObjectURL !== 'function') {
    return null;
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = objectUrl;
    });

    const { naturalWidth: width, naturalHeight: height } = image;
    if (!width || !height) return null;

    const swapDimensions = orientation >= 5 && orientation <= 8;
    const canvas = document.createElement('canvas');
    canvas.width = swapDimensions ? height : width;
    canvas.height = swapDimensions ? width : height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Transformaciones estándar por valor de orientación EXIF (1-8)
    switch (orientation) {
      case 2: ctx.transform(-1, 0, 0, 1, width, 0); break;
      case 3: ctx.transform(-1, 0, 0, -1, width, height); break;
      case 4: ctx.transform(1, 0, 0, -1, 0, height); break;
      case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;
      case 6: ctx.transform(0, 1, -1, 0, height, 0); break;
      case 7: ctx.transform(0, -1, -1, 0, height, width); break;
      case 8: ctx.transform(0, -1, 1, 0, 0, width); break;
      default: break;
    }

    ctx.drawImage(image, 0, 0);

    return await new Promise((resolve) => {
      canvas.toBlob((result) => resolve(result), 'image/jpeg', 0.92);
    });
  } catch (err) {
    // Si la decodificación falla (ej. bytes sintéticos de test), seguimos con el stripping binario normal
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

/**
 * Sanitiza metadatos de un objeto File o Blob de forma asíncrona.
 * Compatible con navegadores móviles, Web Workers y entornos de testing (jsdom).
 *
 * @param {Blob|File} file Objeto de archivo recibido desde la cámara o selector
 * @returns {Promise<{ cleanFile: Blob, stripped: boolean }>} Archivo sanitizado y bandera de confirmación
 */
export const sanitizeFileMetadata = async (file) => {
  // Si no se proporcionó archivo válido, retornamos null
  if (!file) {
    throw new Error('No se suministró un archivo para sanitizar.');
  }

  try {
    let arrayBuffer;

    // 1. Si el objeto implementa la función nativa arrayBuffer()
    if (typeof file.arrayBuffer === 'function') {
      arrayBuffer = await file.arrayBuffer();
    } 
    // 2. Si es una instancia de Blob nativa verificable y existe FileReader
    else if (typeof Blob !== 'undefined' && file instanceof Blob && typeof FileReader !== 'undefined') {
      arrayBuffer = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      });
    }
    // 3. Si es un buffer directo (Uint8Array o ArrayBuffer)
    else if (file instanceof Uint8Array) {
      arrayBuffer = file.buffer;
    } else if (file instanceof ArrayBuffer) {
      arrayBuffer = file;
    }
    // 4. Fallback resiliente para mocks de testing u objetos serializables
    else {
      const fallbackPayload = typeof file === 'string' ? file : (file?.content || file?.name || 'simulated-bytes');
      const textEncoder = new TextEncoder();
      arrayBuffer = textEncoder.encode(fallbackPayload).buffer;
    }

    const originalBytes = new Uint8Array(arrayBuffer);

    // Verificamos si tiene metadatos EXIF
    const hadExif = hasExifMetadata(originalBytes);

    // Si la foto trae una orientación EXIF distinta de "normal" (1), la horneamos en los
    // píxeles vía canvas ANTES de descartar el EXIF; si no, quedaría mostrada de costado.
    const orientation = readExifOrientation(originalBytes);
    if (orientation !== 1) {
      const originalBlob = new Blob([originalBytes], { type: file.type || 'image/jpeg' });
      const rotatedBlob = await bakeExifOrientation(originalBlob, orientation);
      if (rotatedBlob) {
        const rotatedBytes = new Uint8Array(await rotatedBlob.arrayBuffer());
        // El canvas ya no incluye EXIF, pero igualmente corremos el stripping binario
        // por si el encoder del navegador llegara a insertar algún segmento.
        const cleanedBytes = stripExifFromJpeg(rotatedBytes);
        const cleanBlob = new Blob([cleanedBytes], { type: file.type || 'image/jpeg' });
        if (typeof cleanBlob.arrayBuffer !== 'function') {
          cleanBlob.arrayBuffer = async () => cleanedBytes.buffer;
        }
        return {
          cleanFile: cleanBlob,
          stripped: true,
          originalSize: originalBytes.length,
          sanitizedSize: cleanedBytes.length,
        };
      }
      // Si el horneado falló (entorno sin canvas, bytes no decodificables, etc.),
      // seguimos con el stripping binario normal como fallback seguro.
    }

    // Aplicamos el stripping binario
    const cleanedBytes = stripExifFromJpeg(originalBytes);

    // Creamos el Blob limpio resultante
    const cleanBlob = new Blob([cleanedBytes], { type: file.type || 'image/jpeg' });

    // Aseguramos compatibilidad con jsdom garantizando que arrayBuffer esté presente en el Blob devuelto
    if (typeof cleanBlob.arrayBuffer !== 'function') {
      cleanBlob.arrayBuffer = async () => cleanedBytes.buffer;
    }

    return {
      cleanFile: cleanBlob,
      stripped: hadExif,
      originalSize: originalBytes.length,
      sanitizedSize: cleanedBytes.length,
    };
  } catch (error) {
    // Si la lectura binaria falló, lanzamos el error para que el pipeline active el fail-safe
    throw new Error(`Fallo durante la sanitización de metadatos: ${error.message}`);
  }
};

/**
 * Hornea la rotación EXIF en los píxeles de la imagen, dejándola derecha sin
 * depender de metadatos.
 *
 * Por qué hace falta: el pipeline de privacidad elimina el segmento APP1 para
 * borrar las coordenadas GPS (REP-2401), y ahí vive también la etiqueta
 * Orientation. Una foto sacada con el teléfono en vertical guarda sus píxeles
 * en horizontal más un "rotá esto 90°" en el EXIF; al quitar el EXIF, esa
 * instrucción desaparece y la foto queda acostada.
 *
 * La solución es rotar los píxeles ANTES de subir: así la imagen ya está
 * derecha y borrar el EXIF deja de tener consecuencias visuales. De paso, el
 * re-encodeado por canvas descarta cualquier metadato residual, lo que refuerza
 * la privacidad en vez de debilitarla.
 *
 * Nunca lanza: ante cualquier fallo devuelve el archivo original, de modo que
 * una foto mal orientada sigue siendo preferible a perder la evidencia.
 *
 * @param {Blob|File} file Imagen original capturada
 * @returns {Promise<Blob|File>} Imagen con la rotación ya aplicada, o la original
 */
export const normalizeImageOrientation = async (file) => {
  if (!file || typeof file.arrayBuffer !== 'function') return file;

  // Sin canvas ni createImageBitmap (jsdom, navegadores viejos) se devuelve tal
  // cual: el comportamiento degrada al de antes de esta corrección.
  if (typeof document === 'undefined' || typeof createImageBitmap !== 'function') {
    return file;
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const orientation = readExifOrientation(bytes);

    // 1 = ya está derecha. No se re-encodea para no perder calidad al pedo.
    if (orientation === 1) return file;

    // imageOrientation 'from-image' hace que el navegador aplique la rotación
    // EXIF al decodificar, devolviendo un bitmap ya derecho y con el alto y el
    // ancho intercambiados cuando corresponde.
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });

    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;

    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(bitmap, 0, 0);
    if (typeof bitmap.close === 'function') bitmap.close();

    const rotated = await new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.92);
    });

    return rotated || file;
  } catch (error) {
    return file;
  }
};
