/**
 * @file Rep3798FotosPrivadas.test.js
 * @description REP-3798 (pedido de Leo, PM): las fotos son privadas de verdad. El bucket pasa a privado, así que
 * al dueño se le entregan URLs firmadas y temporales; la URL canónica guardada en report_images no se abre sin sesión.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const createSignedUrlsMock = vi.fn();
const fromMock = vi.fn();
vi.mock('../lib/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: (...args) => fromMock(...args),
    storage: { from: vi.fn(() => ({ createSignedUrls: createSignedUrlsMock })) },
  },
}));

import { supabase } from '../lib/supabaseClient';
import {
  getEvidencePathFromUrl,
  signEvidenceImages,
  getReportDetail,
  SIGNED_URL_TTL_SECONDS,
} from '../services/reportDetailService';

const URL1 = 'https://x.supabase.co/storage/v1/object/public/report-evidences/csid-1/111_sanitized.jpg';
const URL2 = 'https://x.supabase.co/storage/v1/object/public/report-evidences/csid-1/222_sanitized.jpg';

describe('REP-3798 · fotos privadas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabase.storage.from.mockReturnValue({ createSignedUrls: createSignedUrlsMock });
  });

  it('UT-PRV-01: saca la ruta del bucket de la URL canónica', () => {
    expect(getEvidencePathFromUrl(URL1)).toBe('csid-1/111_sanitized.jpg');
    expect(getEvidencePathFromUrl(`${URL1}?t=1`)).toBe('csid-1/111_sanitized.jpg');
  });

  it('UT-PRV-02: una URL que no es del bucket de evidencias (o local) no tiene ruta', () => {
    expect(getEvidencePathFromUrl('blob:http://localhost/abc')).toBeNull();
    expect(getEvidencePathFromUrl('https://otro.com/foto.jpg')).toBeNull();
    expect(getEvidencePathFromUrl(null)).toBeNull();
  });

  it('UT-PRV-03: reemplaza la URL de cada foto por su URL firmada', async () => {
    createSignedUrlsMock.mockResolvedValue({
      data: [
        { path: 'csid-1/111_sanitized.jpg', signedUrl: 'https://firmada/1?token=a' },
        { path: 'csid-1/222_sanitized.jpg', signedUrl: 'https://firmada/2?token=b' },
      ],
      error: null,
    });
    const result = await signEvidenceImages([
      { id: 'i1', image_url: URL1 },
      { id: 'i2', image_url: URL2 },
    ]);
    expect(createSignedUrlsMock).toHaveBeenCalledWith(['csid-1/111_sanitized.jpg', 'csid-1/222_sanitized.jpg'], SIGNED_URL_TTL_SECONDS);
    expect(result.map((row) => row.image_url)).toEqual(['https://firmada/1?token=a', 'https://firmada/2?token=b']);
  });

  it('UT-PRV-04: si no se puede firmar, deja la URL original y no rompe', async () => {
    createSignedUrlsMock.mockResolvedValue({ data: null, error: { message: 'sin permiso' } });
    const rows = [{ id: 'i1', image_url: URL1 }];
    expect(await signEvidenceImages(rows)).toEqual(rows);

    createSignedUrlsMock.mockRejectedValue(new Error('sin red'));
    expect(await signEvidenceImages(rows)).toEqual(rows);
  });

  it('UT-PRV-05: sin fotos no consulta el storage', async () => {
    expect(await signEvidenceImages([])).toEqual([]);
    expect(createSignedUrlsMock).not.toHaveBeenCalled();
  });

  it('UT-PRV-06: el detalle de un reporte propio devuelve las fotos firmadas', async () => {
    createSignedUrlsMock.mockResolvedValue({ data: [{ path: 'csid-1/111_sanitized.jpg', signedUrl: 'https://firmada/1' }], error: null });
    fromMock.mockImplementation((table) => {
      if (table === 'citizen_reports') {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'r1', user_id: 'dueño' }, error: null }) }) }) };
      }
      return { select: () => ({ eq: async () => ({ data: [{ id: 'i1', image_url: URL1 }], error: null }) }) };
    });
    const result = await getReportDetail('r1', 'dueño');
    expect(result.data.report_images[0].image_url).toBe('https://firmada/1');
  });

  it('UT-PRV-07: el detalle de un reporte ajeno no trae ni firma ninguna foto', async () => {
    fromMock.mockImplementation((table) => {
      if (table === 'citizen_reports') {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'r1', user_id: 'otro' }, error: null }) }) }) };
      }
      throw new Error(`no debería consultar ${table}`);
    });
    const result = await getReportDetail('r1', 'dueño');
    expect(result.data.report_images).toEqual([]);
    expect(createSignedUrlsMock).not.toHaveBeenCalled();
  });
});
