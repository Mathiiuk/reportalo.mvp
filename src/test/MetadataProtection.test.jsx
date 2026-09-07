import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  hasExifMetadata,
  stripExifFromJpeg,
  sanitizeFileMetadata,
} from '../services/metadataSanitizer';
import { processEvidenceThroughQuarantine } from '../services/quarantinePipelineService';

/**
 * Función auxiliar para generar un stream sintético JPEG en formato binario Uint8Array.
 * Permite simular imágenes reales con o sin segmentos APP1 (EXIF / GPS).
 * 
 * @param {boolean} includeExif Determina si se inyecta el bloque APP1 con tags ficticios
 * @returns {Uint8Array} Buffer binario JPEG
 */
const createSyntheticJpeg = (includeExif = true) => {
  // Marcador SOI estándar de inicio de JPEG (0xFF, 0xD8)
  const header = [0xff, 0xd8];

  let app1Segment = [];
  if (includeExif) {
    // Marcador APP1 (0xFF, 0xE1) utilizado para almacenar metadatos EXIF / GPS
    const marker = [0xff, 0xe1];
    
    // Contenido simulado de metadatos: firma "Exif\0\0" + datos GPS simulados
    const exifPayload = [
      0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // "Exif\0\0"
      0x49, 0x49, 0x2a, 0x00,             // Encabezado TIFF Little-Endian
      0x08, 0x00, 0x00, 0x00,             // Offset al primer IFD
      0x05, 0x00,                         // Cantidad de etiquetas simuladas (GPSLatitude, Model, etc.)
      0x01, 0x0f, 0x02, 0x00, 0x06, 0x00, 0x00, 0x00, // Tag Make (Fabricante de la cámara)
      0x41, 0x70, 0x70, 0x6c, 0x65, 0x00,             // "Apple\0"
    ];

    // Longitud total del segmento APP1 (incluyendo los 2 bytes de longitud)
    const segmentLength = exifPayload.length + 2;
    const lengthBytes = [(segmentLength >> 8) & 0xff, segmentLength & 0xff];

    app1Segment = [...marker, ...lengthBytes, ...exifPayload];
  }

  // Marcador SOS (Start of Scan - 0xFF, 0xDA) que marca el inicio de los datos de píxeles
  const sosSegment = [
    0xff, 0xda,
    0x00, 0x08, // Longitud del encabezado SOS
    0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, // Parámetros de escaneo
    0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, // Datos comprimidos de imagen simulados
  ];

  // Marcador EOI (End of Image - 0xFF, 0xD9)
  const eoiSegment = [0xff, 0xd9];

  // Unificamos los bloques en un único Uint8Array binario
  return new Uint8Array([...header, ...app1Segment, ...sosSegment, ...eoiSegment]);
};

describe('REP-2401: HU | Proteger metadatos de la evidencia (Stripping EXIF y Fail-Safe)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('UT-EXIF-01: hasExifMetadata detecta con precisión la presencia o ausencia de bloques APP1 en JPEG', () => {
    // 1. Generamos un JPEG con bloque EXIF simulado
    const jpegWithExif = createSyntheticJpeg(true);
    // Verificamos que la función de auditoría detecte los metadatos
    expect(hasExifMetadata(jpegWithExif)).toBe(true);

    // 2. Generamos un JPEG limpio sin bloque EXIF
    const cleanJpeg = createSyntheticJpeg(false);
    // Verificamos que no informe presencia de metadatos
    expect(hasExifMetadata(cleanJpeg)).toBe(false);

    // 3. Casos borde: buffers nulos o vacíos
    expect(hasExifMetadata(null)).toBe(false);
    expect(hasExifMetadata(new Uint8Array([0x00, 0x01]))).toBe(false);
  });

  it('UT-EXIF-02: stripExifFromJpeg elimina completamente el segmento APP1 sin corromper la imagen', () => {
    // Generamos la imagen con metadatos EXIF
    const originalBytes = createSyntheticJpeg(true);
    expect(hasExifMetadata(originalBytes)).toBe(true);

    // Ejecutamos la sanitización binaria
    const sanitizedBytes = stripExifFromJpeg(originalBytes);

    // Verificamos que los metadatos fueron eliminados por completo
    expect(hasExifMetadata(sanitizedBytes)).toBe(false);
    // El tamaño del archivo limpio debe ser menor que el original
    expect(sanitizedBytes.length).toBeLessThan(originalBytes.length);

    // Comprobamos la integridad del archivo JPEG:
    // Debe comenzar con SOI (0xFF, 0xD8)
    expect(sanitizedBytes[0]).toBe(0xff);
    expect(sanitizedBytes[1]).toBe(0xd8);
    // El marcador SOS debe permanecer intacto
    expect(sanitizedBytes[2]).toBe(0xff);
    expect(sanitizedBytes[3]).toBe(0xda);
  });

  it('UT-EXIF-03: sanitizeFileMetadata sanitiza un objeto File/Blob y certifica la remoción', async () => {
    // Creamos los bytes con EXIF
    const rawBytes = createSyntheticJpeg(true);
    // Creamos un objeto File nativo como el generado por el input de la cámara
    const file = new File([rawBytes], 'foto_infraccion.jpg', { type: 'image/jpeg' });

    // Ejecutamos la sanitización asíncrona
    const result = await sanitizeFileMetadata(file);

    // Verificamos que el resultado informe que los metadatos fueron removidos
    expect(result.stripped).toBe(true);
    expect(result.cleanFile).toBeDefined();
    expect(result.cleanFile instanceof Blob).toBe(true);

    // Auditamos el Blob resultante para confirmar la ausencia total de EXIF
    const cleanBuffer = new Uint8Array(await result.cleanFile.arrayBuffer());
    expect(hasExifMetadata(cleanBuffer)).toBe(false);
  });

  it('UT-EXIF-04: La geolocalización funcional del reporte es independiente del EXIF de la foto', async () => {
    // Creamos una foto con metadatos EXIF simulados (que contendrían GPS de hardware)
    const rawBytes = createSyntheticJpeg(true);
    const mockFile = new File([rawBytes], 'evidencia_con_gps_exif.jpg', { type: 'image/jpeg' });

    // Definimos la geolocalización funcional declarada explícitamente en el flujo ciudadano
    const explicitFunctionalLocation = {
      lat: -34.6037389,
      lng: -58.3815704,
      address: 'Av. Corrientes 1200, CABA',
      accuracy: 10,
    };

    // Procesamos la foto a través del pipeline de cuarentena
    const pipelineResult = await processEvidenceThroughQuarantine({
      file: mockFile,
      clientSideId: 'rep-location-test-01',
    });

    // Verificamos que el procesamiento fue exitoso y la evidencia está disponible
    expect(pipelineResult.success).toBe(true);
    expect(pipelineResult.sanitizedUrl).toBeDefined();

    // Verificamos que la ubicación funcional declarada por el usuario no dependió ni fue alterada por el archivo
    expect(explicitFunctionalLocation.lat).toBe(-34.6037389);
    expect(explicitFunctionalLocation.lng).toBe(-58.3815704);
    expect(explicitFunctionalLocation.address).toBe('Av. Corrientes 1200, CABA');
  });

  it('UT-EXIF-05: Comportamiento Fail-Safe si ocurre un error durante el procesamiento de la imagen', async () => {
    // Creamos un archivo simulado
    const rawBytes = createSyntheticJpeg(true);
    const mockFile = new File([rawBytes], 'evidencia.jpg', { type: 'image/jpeg' });

    // Solicitamos la ejecución con simulación de fallo (fail-safe)
    const failSafeResult = await processEvidenceThroughQuarantine({
      file: mockFile,
      clientSideId: 'rep-failsafe-test-02',
      simulateError: true,
    });

    // Constatamos que el pipeline aborta, activa failSafeTriggered y no retorna URL sanitizada
    expect(failSafeResult.success).toBe(false);
    expect(failSafeResult.failSafeTriggered).toBe(true);
    expect(failSafeResult.sanitizedUrl).toBeUndefined();
    expect(failSafeResult.error).toContain('Fallo simulado en el procesamiento de privacidad');
  });
});
