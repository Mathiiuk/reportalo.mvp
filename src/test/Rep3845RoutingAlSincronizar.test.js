/**
 * @file Rep3845RoutingAlSincronizar.test.js
 * @description REP-3845 (E5): un reporte que quedó en la cola sin conexión y se crea al recuperar la señal también
 * queda ruteado (route_report, idempotente). Si el routing falla, el envío no se deshace.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../services/offlineStorageService', () => ({
  getAllPendingSyncReports: vi.fn(),
  deleteDraftReport: vi.fn().mockResolvedValue(true),
  recordDraftSyncError: vi.fn().mockResolvedValue(null),
}));
vi.mock('../services/quarantinePipelineService', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, processAllEvidencesThroughQuarantine: vi.fn() };
});
vi.mock('../services/categoriesService', () => ({ resolveServiceDbId: vi.fn() }));
vi.mock('../services/reportSubmissionService', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    createCitizenReport: vi.fn(),
    attachReportEvidence: vi.fn(),
    getAttachedEvidenceUrls: vi.fn().mockResolvedValue(new Set()),
  };
});
vi.mock('../services/reportRoutingService', () => ({ routeReport: vi.fn() }));

import { deleteDraftReport } from '../services/offlineStorageService';
import { processAllEvidencesThroughQuarantine } from '../services/quarantinePipelineService';
import { resolveServiceDbId } from '../services/categoriesService';
import { createCitizenReport, attachReportEvidence } from '../services/reportSubmissionService';
import { routeReport } from '../services/reportRoutingService';
import { sendPendingDraft } from '../services/pendingSyncService';

const draft = () => ({
  client_side_id: 'draft-1',
  status: 'PENDING_SYNC',
  description: 'Auto estacionado en la rampa de discapacitados',
  selectedCategory: { id: 'TRANSITO', name: 'Tránsito', dbId: 'srv-1' },
  customLocation: { localityId: 'loc-balvanera', coordinates: { lat: -34.61, lng: -58.4 } },
  evidenceList: [{ id: 'e1', blob: new Blob(['x'], { type: 'image/jpeg' }), name: 'f.jpg', mimeType: 'image/jpeg' }],
});

describe('REP-3845 · routing al sincronizar la cola (E5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveServiceDbId.mockResolvedValue('srv-1');
    processAllEvidencesThroughQuarantine.mockResolvedValue({
      success: true,
      processedEvidences: [{ sanitizedUrl: 'https://x.supabase.co/storage/v1/object/public/report-evidences/draft-1/1.jpg' }],
    });
    createCitizenReport.mockResolvedValue({ success: true, data: { id: 'rep-1', client_side_id: 'draft-1' } });
    attachReportEvidence.mockResolvedValue({ success: true });
  });

  it('UT-3845-12: después de crear el reporte y adjuntar las fotos, pide su routing', async () => {
    routeReport.mockResolvedValue({ success: true, routing: { criterio: 'sin_destino' } });
    const result = await sendPendingDraft(draft(), 'user-1');

    expect(result).toEqual({ success: true, reportId: 'rep-1' });
    expect(routeReport).toHaveBeenCalledWith('rep-1');
    expect(deleteDraftReport).toHaveBeenCalledWith('draft-1');
  });

  it('UT-3845-13: si el routing falla, el reporte igual queda enviado', async () => {
    routeReport.mockResolvedValue({ success: false, routing: null, error: 'timeout' });
    const result = await sendPendingDraft(draft(), 'user-1');
    expect(result).toEqual({ success: true, reportId: 'rep-1' });
  });

  it('UT-3845-14: si el reporte no se pudo crear, no se pide routing', async () => {
    createCitizenReport.mockResolvedValue({ success: false, error: 'boom', userMessage: 'No pudimos guardar tu reporte.' });
    await sendPendingDraft(draft(), 'user-1');
    expect(routeReport).not.toHaveBeenCalled();
  });
});
