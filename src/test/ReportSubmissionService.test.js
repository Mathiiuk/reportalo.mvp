/**
 * @file ReportSubmissionService.test.js
 * @description Pruebas de la persistencia real del envío del reporte (REP-2500).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSingle = vi.fn();
const mockSelect = vi.fn(() => ({ single: mockSingle }));
const mockUpsert = vi.fn(() => ({ select: mockSelect }));
const mockInsertReportImages = vi.fn(() => ({ select: mockSelect }));
const mockEq = vi.fn();
const mockOrder = vi.fn();

const mockUpload = vi.fn();
const mockGetPublicUrl = vi.fn();

vi.mock('../lib/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: vi.fn((table) => {
      if (table === 'citizen_reports') {
        return { upsert: mockUpsert, select: mockSelect, eq: mockEq, order: mockOrder };
      }
      if (table === 'report_images') {
        return { insert: mockInsertReportImages };
      }
      return { select: mockSelect, eq: mockEq, order: mockOrder };
    }),
    storage: {
      from: vi.fn(() => ({ upload: mockUpload, getPublicUrl: mockGetPublicUrl })),
    },
  },
}));

import { createCitizenReport, attachReportEvidence, getMyReports } from '../services/reportSubmissionService';

describe('REP-2500: createCitizenReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpsert.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ single: mockSingle });
  });

  it('crea el reporte y devuelve id + client_side_id', async () => {
    mockSingle.mockResolvedValue({
      data: { id: 'report-1', client_side_id: 'csid-1' },
      error: null,
    });

    const result = await createCitizenReport({
      clientSideId: 'csid-1',
      userId: 'user-1',
      serviceId: 'service-1',
      localityId: 'locality-1',
      description: 'Bache en la esquina',
      latitud: -34.6,
      longitud: -58.4,
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ id: 'report-1', client_side_id: 'csid-1' });
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        client_side_id: 'csid-1',
        user_id: 'user-1',
        locality_id: 'locality-1',
        current_state_code: 'RECIBIDO',
      }),
      expect.objectContaining({ onConflict: 'client_side_id' })
    );
  });

  it('rechaza si faltan datos obligatorios, sin llamar a Supabase', async () => {
    const result = await createCitizenReport({ clientSideId: 'csid-1' });
    expect(result.success).toBe(false);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('devuelve success:false si Supabase responde error', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'falló' } });

    const result = await createCitizenReport({
      clientSideId: 'csid-1',
      userId: 'user-1',
      localityId: 'locality-1',
      description: 'x',
      latitud: 0,
      longitud: 0,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('falló');
  });
});

describe('REP-2500: attachReportEvidence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    vi.stubGlobal('crypto', { randomUUID: () => 'uuid-fijo' });
    mockUpload.mockResolvedValue({ error: null });
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn/report-evidences/report-1/uuid-fijo.jpg' } });
    mockInsertReportImages.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ single: mockSingle });
    mockSingle.mockResolvedValue({
      data: { id: 'image-1', image_url: 'https://cdn/report-evidences/report-1/uuid-fijo.jpg' },
      error: null,
    });
  });

  it('sube la evidencia y la registra en report_images', async () => {
    global.fetch.mockResolvedValue({ ok: true, blob: () => Promise.resolve(new Blob(['x'])) });

    const result = await attachReportEvidence({ reportId: 'report-1', sanitizedUrl: 'blob:local-preview' });

    expect(result.success).toBe(true);
    expect(mockUpload).toHaveBeenCalledWith('report-1/uuid-fijo.jpg', expect.any(Blob), expect.any(Object));
    expect(mockInsertReportImages).toHaveBeenCalledWith({
      report_id: 'report-1',
      image_url: 'https://cdn/report-evidences/report-1/uuid-fijo.jpg',
    });
  });

  it('falla si no puede leer la url sanitizada', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 404 });

    const result = await attachReportEvidence({ reportId: 'report-1', sanitizedUrl: 'blob:roto' });

    expect(result.success).toBe(false);
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('falla si Supabase Storage rechaza el upload', async () => {
    global.fetch.mockResolvedValue({ ok: true, blob: () => Promise.resolve(new Blob(['x'])) });
    mockUpload.mockResolvedValue({ error: { message: 'sin permiso' } });

    const result = await attachReportEvidence({ reportId: 'report-1', sanitizedUrl: 'blob:local-preview' });

    expect(result.success).toBe(false);
    expect(mockInsertReportImages).not.toHaveBeenCalled();
  });
});

describe('REP-2500: getMyReports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEq.mockReturnValue({ order: mockOrder });
    mockSelect.mockReturnValue({ eq: mockEq });
  });

  it('devuelve los reportes del usuario', async () => {
    mockOrder.mockResolvedValue({ data: [{ id: 'r1' }], error: null });

    const result = await getMyReports('user-1');

    expect(result.success).toBe(true);
    expect(result.reports).toEqual([{ id: 'r1' }]);
    expect(mockEq).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('devuelve reports vacío sin userId', async () => {
    const result = await getMyReports(null);
    expect(result.success).toBe(false);
    expect(result.reports).toEqual([]);
  });
});
