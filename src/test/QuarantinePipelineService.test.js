/**
 * @file QuarantinePipelineService.test.js
 * @description Pruebas unitarias para el servicio de cuarentena y anonimización de imágenes (REP-2404).
 * Valida el aislamiento transitorio, sanitización de metadatos EXIF, principio fail-safe y emulador local.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  sanitizeImageMetadataLocally,
  uploadToQuarantine,
  processEvidenceThroughQuarantine,
  processAllEvidencesThroughQuarantine,
  BUCKET_QUARANTINE,
  BUCKET_PUBLIC_EVIDENCES,
  PIPELINE_STEPS,
} from '../services/quarantinePipelineService';

describe('REP-2404: Pipeline Server-Side de Cuarentena de Imágenes - Servicio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Constantes de almacenamiento y pasos de privacidad', () => {
    it('UT-QPS-01: Exporta los nombres correctos de los buckets de almacenamiento', () => {
      // Verificamos el bucket privado de cuarentena
      expect(BUCKET_QUARANTINE).toBe('evidence-quarantine');
      // Verificamos el bucket público para evidencias finales
      expect(BUCKET_PUBLIC_EVIDENCES).toBe('report-evidences');
    });

    it('UT-QPS-02: Exporta los pasos estándar del pipeline visual', () => {
      expect(PIPELINE_STEPS).toContain('Analizando la foto');
      expect(PIPELINE_STEPS).toContain('Difuminando rostros');
      expect(PIPELINE_STEPS).toContain('Difuminando patentes de terceros');
      expect(PIPELINE_STEPS).toContain('Difuminando datos sensibles');
    });
  });

  describe('2. Sanitización local de metadatos EXIF', () => {
    it('UT-QPS-03: Retorna null si no se proporciona ningún archivo', async () => {
      const result = await sanitizeImageMetadataLocally(null);
      expect(result).toBeNull();
    });

    it('UT-QPS-04: Retorna el archivo original si no es un archivo JPEG', async () => {
      // Creamos un Blob de tipo PNG simulado
      const pngBlob = new Blob(['png-mock-data'], { type: 'image/png' });
      const result = await sanitizeImageMetadataLocally(pngBlob);
      expect(result).toBe(pngBlob);
    });

    it('UT-QPS-05: Filtra segmentos EXIF APP1 (0xFFE1) en un flujo JPEG válido', async () => {
      // Construimos un JPEG sintético con marcador SOI (FF D8), segmento APP1 (FF E1 00 06 12 34), y stream SOS (FF DA)
      const jpegBytes = new Uint8Array([
        0xff, 0xd8, // SOI
        0xff, 0xe1, 0x00, 0x06, 0xaa, 0xbb, // APP1 EXIF (longitud 6 bytes)
        0xff, 0xda, 0x01, 0x02, // SOS (Start of Scan)
      ]);
      const jpegBlob = new Blob([jpegBytes], { type: 'image/jpeg' });

      const sanitizedBlob = await sanitizeImageMetadataLocally(jpegBlob);
      expect(sanitizedBlob).toBeInstanceOf(Blob);

      const buffer = await sanitizedBlob.arrayBuffer();
      const outputBytes = new Uint8Array(buffer);

      // Verificamos que el inicio siga siendo SOI
      expect(outputBytes[0]).toBe(0xff);
      expect(outputBytes[1]).toBe(0xd8);

      // Buscamos si existe el marcador APP1 (FF E1) en los bytes resultantes
      let hasApp1 = false;
      for (let i = 0; i < outputBytes.length - 1; i++) {
        if (outputBytes[i] === 0xff && outputBytes[i + 1] === 0xe1) {
          hasApp1 = true;
          break;
        }
      }
      // Debe haber sido eliminado por la sanitización
      expect(hasApp1).toBe(false);
    });
  });

  describe('3. Subida transitoria a cuarentena (uploadToQuarantine)', () => {
    it('UT-QPS-06: Falla con mensaje explicativo si no se provee archivo', async () => {
      const result = await uploadToQuarantine(null, 'client-123');
      expect(result.success).toBe(false);
      expect(result.error).toContain('No se suministró ningún archivo');
    });

    it('UT-QPS-07: Genera una ruta única de cuarentena en entorno local simulado', async () => {
      const mockFile = new File(['mock-img'], 'foto.jpg', { type: 'image/jpeg' });
      const result = await uploadToQuarantine(mockFile, 'client-test-456');

      expect(result.success).toBe(true);
      expect(result.quarantinePath).toMatch(/^temp_client-test-456_\d+\.jpg$/);
    });
  });

  describe('4. Pipeline individual con principio Fail-Safe (processEvidenceThroughQuarantine)', () => {
    it('UT-QPS-08: Falla con failSafeTriggered si faltan parámetros obligatorios', async () => {
      const result = await processEvidenceThroughQuarantine({ file: null, clientSideId: null });
      expect(result.success).toBe(false);
      expect(result.failSafeTriggered).toBe(true);
      expect(result.error).toContain('Parámetros obligatorios faltantes');
    });

    it('UT-QPS-09: Simula error forzado y activa fail-safe inmediatamente', async () => {
      const mockFile = new File(['mock-img'], 'foto.jpg', { type: 'image/jpeg' });
      const result = await processEvidenceThroughQuarantine({
        file: mockFile,
        clientSideId: 'rep-fail-safe-1',
        simulateError: true,
      });

      expect(result.success).toBe(false);
      expect(result.failSafeTriggered).toBe(true);
      expect(result.error).toContain('Fallo simulado en el procesamiento de privacidad');
    });

    it('UT-QPS-10: Ejecuta emulador determinístico exitosamente en modo desarrollo', async () => {
      const mockFile = new File(['mock-img'], 'test.jpg', { type: 'image/jpeg' });
      const result = await processEvidenceThroughQuarantine({
        file: mockFile,
        clientSideId: 'rep-success-1',
      });

      expect(result.success).toBe(true);
      expect(result.sanitizedUrl).toBeDefined();
      expect(result.clientSideId).toBe('rep-success-1');
      expect(result.entitiesDetectedCount).toBe(2);
      expect(result.detectedZones.length).toBe(2);
      expect(result.isSimulated).toBe(true);
    });
  });

  describe('5. Procesamiento por lotes (processAllEvidencesThroughQuarantine)', () => {
    it('UT-QPS-11: Retorna éxito inmediato con lista vacía si no hay evidencias', async () => {
      const result = await processAllEvidencesThroughQuarantine({ evidenceList: [] });
      expect(result.success).toBe(true);
      expect(result.processedEvidences).toEqual([]);
      expect(result.entitiesDetectedCount).toBe(0);
    });

    it('UT-QPS-12: Procesa múltiples fotos y acumula entidades detectadas con progreso', async () => {
      const progressSteps = [];
      const onProgress = (step) => {
        progressSteps.push(step);
      };

      const mockEvidences = [
        { id: 'ev-1', file: new File(['img-1'], 'foto1.jpg', { type: 'image/jpeg' }) },
        { id: 'ev-2', file: new File(['img-2'], 'foto2.jpg', { type: 'image/jpeg' }) },
      ];

      const result = await processAllEvidencesThroughQuarantine({
        evidenceList: mockEvidences,
        clientSideId: 'batch-rep-01',
        onProgress,
      });

      expect(result.success).toBe(true);
      expect(result.processedEvidences.length).toBe(2);
      // Cada foto en emulador detecta 2 entidades -> total 4
      expect(result.entitiesDetectedCount).toBe(4);
      expect(result.processedEvidences[0].status).toBe('READY');
      expect(result.processedEvidences[0].isSanitized).toBe(true);
      expect(progressSteps.length).toBeGreaterThan(0);
      expect(progressSteps[progressSteps.length - 1].progress).toBe(100);
    });

    it('UT-QPS-13: Aborta en principio fail-safe si alguna foto del lote falla', async () => {
      const mockEvidences = [
        { id: 'ev-1', file: new File(['img-1'], 'foto1.jpg', { type: 'image/jpeg' }) },
      ];

      const result = await processAllEvidencesThroughQuarantine({
        evidenceList: mockEvidences,
        clientSideId: 'batch-rep-fail',
        simulateError: true,
      });

      expect(result.success).toBe(false);
      expect(result.failSafeTriggered).toBe(true);
      expect(result.error).toContain('Fallo simulado');
    });
  });

  describe('6. Integración con Supabase Storage y Edge Function mockeados', () => {
    it('UT-QPS-14: Sube a Storage e invoca la Edge Function exitosamente cuando Supabase está activo', async () => {
      const { supabase } = await import('../lib/supabaseClient');
      const originalFunctions = supabase.functions;

      const mockUpload = vi.fn().mockResolvedValue({ data: { path: 'temp_mock.jpg' }, error: null });
      const mockRemove = vi.fn().mockResolvedValue({ data: {}, error: null });
      const mockInvoke = vi.fn().mockResolvedValue({
        data: {
          success: true,
          sanitizedUrl: 'https://test.supabase.co/storage/v1/object/public/report-evidences/anon_123.webp',
          clientSideId: 'mock-client-id',
          entitiesDetectedCount: 3,
        },
        error: null,
      });

      const spyStorage = vi.spyOn(supabase.storage, 'from').mockReturnValue({
        upload: mockUpload,
        remove: mockRemove,
      });

      Object.defineProperty(supabase, 'functions', {
        value: { invoke: mockInvoke },
        configurable: true,
      });

      const mockFile = new File(['mock-img'], 'foto.jpg', { type: 'image/jpeg' });
      const result = await processEvidenceThroughQuarantine({
        file: mockFile,
        clientSideId: 'mock-client-id',
      });

      expect(spyStorage).toHaveBeenCalledWith(BUCKET_QUARANTINE);
      expect(mockUpload).toHaveBeenCalled();
      expect(mockInvoke).toHaveBeenCalledWith('quarantine-anonymize', {
        body: expect.objectContaining({ clientSideId: 'mock-client-id' }),
      });
      expect(result.success).toBe(true);
      expect(result.sanitizedUrl).toContain('anon_123.webp');
      expect(result.entitiesDetectedCount).toBe(3);

      spyStorage.mockRestore();
      Object.defineProperty(supabase, 'functions', {
        value: originalFunctions,
        configurable: true,
      });
    });

    it('UT-QPS-15: Si la Edge Function falla por red, purga de inmediato la foto original de cuarentena', async () => {
      const { supabase } = await import('../lib/supabaseClient');
      const originalFunctions = supabase.functions;

      const mockUpload = vi.fn().mockResolvedValue({ data: { path: 'temp_to_purge.jpg' }, error: null });
      const mockRemove = vi.fn().mockResolvedValue({ data: {}, error: null });
      const mockInvoke = vi.fn().mockRejectedValue(new Error('Network connection timeout'));

      const spyStorage = vi.spyOn(supabase.storage, 'from').mockReturnValue({
        upload: mockUpload,
        remove: mockRemove,
      });

      Object.defineProperty(supabase, 'functions', {
        value: { invoke: mockInvoke },
        configurable: true,
      });

      const mockFile = new File(['mock-img'], 'foto.jpg', { type: 'image/jpeg' });
      const result = await processEvidenceThroughQuarantine({
        file: mockFile,
        clientSideId: 'purge-client-id',
      });

      expect(mockUpload).toHaveBeenCalled();
      // Verificamos que se haya invocado la purga forzosa fail-safe
      expect(mockRemove).toHaveBeenCalledWith(['temp_to_purge.jpg']);
      expect(result.success).toBe(false);
      expect(result.failSafeTriggered).toBe(true);
      expect(result.error).toContain('Network connection timeout');

      spyStorage.mockRestore();
      Object.defineProperty(supabase, 'functions', {
        value: originalFunctions,
        configurable: true,
      });
    });
  });
});
