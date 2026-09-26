/**
 * @file H35PendingSyncFailFast.test.js
 * @description H-35: un borrador de la cola que nunca va a poder enviarse (descripción vacía o corta,
 * sin categoría, sin ubicación) no debe procesar las fotos ni dejar copias públicas sin reporte, y el
 * motivo del fallo tiene que quedar guardado para mostrarlo en Pendientes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../services/offlineStorageService', () => ({
  getAllPendingSyncReports: vi.fn(),
  deleteDraftReport: vi.fn().mockResolvedValue(true),
  recordDraftSyncError: vi.fn().mockResolvedValue(null),
}));
vi.mock('../services/quarantinePipelineService', () => ({ processAllEvidencesThroughQuarantine: vi.fn() }));
vi.mock('../services/categoriesService', () => ({ resolveServiceDbId: vi.fn() }));
vi.mock('../services/reportSubmissionService', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, createCitizenReport: vi.fn(), attachReportEvidence: vi.fn(), getAttachedEvidenceUrls: vi.fn().mockResolvedValue(new Set()) };
});

import { deleteDraftReport, recordDraftSyncError } from '../services/offlineStorageService';
import { processAllEvidencesThroughQuarantine } from '../services/quarantinePipelineService';
import { resolveServiceDbId } from '../services/categoriesService';
import { createCitizenReport, attachReportEvidence } from '../services/reportSubmissionService';
import { sendPendingDraft, validateDraftForSync } from '../services/pendingSyncService';

const draftValido = () => ({
  client_side_id: 'draft-1',
  status: 'PENDING_SYNC',
  description: 'Contenedor desbordado en la esquina',
  selectedCategory: { id: 'AMBIENTE', name: 'Ambiente', dbId: 'srv-1' },
  customLocation: { localityId: 'loc-1', coordinates: { lat: -34.66, lng: -58.36 } },
  evidenceList: [{ id: 'e1', blob: new Blob(['x'], { type: 'image/jpeg' }), name: 'f.jpg', mimeType: 'image/jpeg' }],
});

describe('H-35: validateDraftForSync', () => {
  it('UT-H35-01: un borrador completo es válido', () => {
    expect(validateDraftForSync(draftValido())).toEqual({ valid: true });
  });

  it.each([
    ['descripción vacía', { description: '' }, 'DESCRIPTION'],
    ['descripción de solo espacios', { description: '     ' }, 'DESCRIPTION'],
    ['descripción de menos de 10 caracteres', { description: 'bache' }, 'DESCRIPTION'],
    ['descripción de más de 280 caracteres', { description: 'a'.repeat(281) }, 'DESCRIPTION'],
    ['sin categoría', { selectedCategory: null }, 'CATEGORY'],
    ['sin ubicación confirmada', { customLocation: null }, 'LOCATION'],
    ['sin fotos guardadas', { evidenceList: [] }, 'PHOTOS'],
  ])('UT-H35-02: rechaza un borrador con %s', (_caso, cambio, codigo) => {
    const result = validateDraftForSync({ ...draftValido(), ...cambio });
    expect(result.valid).toBe(false);
    expect(result.code).toBe(codigo);
    expect(result.error).toBeTruthy();
  });

  it('UT-H35-03: el mensaje de la descripción es el del ciudadano, sin jerga', () => {
    const { error } = validateDraftForSync({ ...draftValido(), description: 'bache' });
    expect(error).toMatch(/descripción/i);
    expect(error).not.toMatch(/undefined|null|NOT NULL/i);
  });
});

describe('H-35: sendPendingDraft valida ANTES de procesar las fotos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveServiceDbId.mockResolvedValue('srv-1');
    recordDraftSyncError.mockResolvedValue(null);
    deleteDraftReport.mockResolvedValue(true);
  });

  it('UT-H35-04: con la descripción inválida no procesa fotos, no crea reporte y guarda el motivo', async () => {
    const result = await sendPendingDraft({ ...draftValido(), description: 'bache' }, 'user-1');

    expect(result).toMatchObject({ success: false, code: 'DESCRIPTION', kind: 'invalid' });
    expect(processAllEvidencesThroughQuarantine).not.toHaveBeenCalled();
    expect(createCitizenReport).not.toHaveBeenCalled();
    expect(deleteDraftReport).not.toHaveBeenCalled();
    expect(recordDraftSyncError).toHaveBeenCalledWith(
      'draft-1',
      expect.objectContaining({ code: 'DESCRIPTION', kind: 'invalid', message: expect.stringMatching(/descripción/i) })
    );
  });

  it.each([
    ['CATEGORY', { selectedCategory: null }],
    ['LOCATION', { customLocation: null }],
    ['PHOTOS', { evidenceList: [] }],
  ])('UT-H35-05: con %s inválido tampoco procesa fotos', async (codigo, cambio) => {
    const result = await sendPendingDraft({ ...draftValido(), ...cambio }, 'user-1');

    expect(result).toMatchObject({ success: false, code: codigo, kind: 'invalid' });
    expect(processAllEvidencesThroughQuarantine).not.toHaveBeenCalled();
    expect(recordDraftSyncError).toHaveBeenCalledWith('draft-1', expect.objectContaining({ code: codigo }));
  });

  it('UT-H35-06: la categoría se resuelve ANTES de procesar las fotos (si no se puede, no quedan copias huérfanas)', async () => {
    resolveServiceDbId.mockResolvedValue(null);

    const result = await sendPendingDraft({ ...draftValido(), selectedCategory: { id: 'AMBIENTE', name: 'Ambiente' } }, 'user-1');

    expect(result).toMatchObject({ success: false, code: 'CATEGORY_UNRESOLVED', kind: 'retry' });
    expect(processAllEvidencesThroughQuarantine).not.toHaveBeenCalled();
    expect(recordDraftSyncError).toHaveBeenCalledWith('draft-1', expect.objectContaining({ kind: 'retry' }));
  });

  it('UT-H35-07: un borrador válido sigue el recorrido de siempre, en orden', async () => {
    processAllEvidencesThroughQuarantine.mockResolvedValue({ success: true, processedEvidences: [{ sanitizedUrl: 'https://cdn.example/protegida.jpg' }] });
    createCitizenReport.mockResolvedValue({ success: true, data: { id: 'rep-1' } });
    attachReportEvidence.mockResolvedValue({ success: true });

    const result = await sendPendingDraft(draftValido(), 'user-1');

    expect(result).toMatchObject({ success: true, reportId: 'rep-1' });
    expect(resolveServiceDbId.mock.invocationCallOrder[0]).toBeLessThan(processAllEvidencesThroughQuarantine.mock.invocationCallOrder[0]);
    expect(deleteDraftReport).toHaveBeenCalledWith('draft-1');
    expect(recordDraftSyncError).not.toHaveBeenCalled();
  });

  it('UT-H35-08: si el servidor rechaza el alta, el motivo queda guardado como reintentable', async () => {
    processAllEvidencesThroughQuarantine.mockResolvedValue({ success: true, processedEvidences: [{ sanitizedUrl: 'https://cdn.example/protegida.jpg' }] });
    createCitizenReport.mockResolvedValue({ success: false, error: 'boom técnico', userMessage: 'No pudimos guardar tu reporte. Tu borrador sigue guardado: probá de nuevo en unos segundos.' });

    const result = await sendPendingDraft(draftValido(), 'user-1');

    expect(result.success).toBe(false);
    expect(result.kind).toBe('retry');
    // El ciudadano ve el mensaje pensado para él, no el detalle técnico
    expect(recordDraftSyncError).toHaveBeenCalledWith('draft-1', expect.objectContaining({ kind: 'retry', message: expect.stringMatching(/borrador sigue guardado/i) }));
    expect(deleteDraftReport).not.toHaveBeenCalled();
  });

  it('UT-H35-09: si no se puede guardar el motivo, el envío igual informa el fallo (el diagnóstico nunca rompe la cola)', async () => {
    recordDraftSyncError.mockRejectedValue(new Error('IndexedDB lleno'));

    const result = await sendPendingDraft({ ...draftValido(), description: '' }, 'user-1');

    expect(result).toMatchObject({ success: false, code: 'DESCRIPTION' });
  });
});

// REP-3793 · Bloque 4 offline: al volver la señal, si el servidor no pudo proteger la foto,
// el reporte sigue en la cola. No se descarta ni se envía la foto sin proteger.
describe('REP-3793: un pendiente cuya foto no se pudo proteger queda en la cola', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveServiceDbId.mockResolvedValue('srv-1');
    recordDraftSyncError.mockResolvedValue(null);
    deleteDraftReport.mockResolvedValue(true);
  });

  it('UT-3793-OFF-01: Vision caído al sincronizar → sigue pendiente, sin reporte y sin adjuntar nada', async () => {
    processAllEvidencesThroughQuarantine.mockResolvedValue({
      success: false,
      failSafeTriggered: true,
      reason: 'vision_timeout',
      error: 'No pudimos proteger tu foto. No se guardó ninguna copia.',
    });

    const result = await sendPendingDraft(draftValido(), 'user-1');

    expect(result).toMatchObject({ success: false, code: 'PROTECTION', kind: 'retry' });
    expect(createCitizenReport).not.toHaveBeenCalled();
    expect(attachReportEvidence).not.toHaveBeenCalled();
    // El borrador y su foto se conservan para el próximo intento
    expect(deleteDraftReport).not.toHaveBeenCalled();
    expect(recordDraftSyncError).toHaveBeenCalledWith('draft-1', expect.objectContaining({ code: 'PROTECTION', kind: 'retry' }));
  });
});
