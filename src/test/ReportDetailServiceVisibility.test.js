/**
 * @file ReportDetailServiceVisibility.test.js
 * @description Visibilidad del detalle (Matías, 30/09/2026): cualquier ciudadano lee el resumen de un
 * reporte ajeno, pero sus fotos no se piden. Solo el dueño las descarga.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const fromMock = vi.fn();
vi.mock('../lib/supabaseClient', () => ({ supabase: { from: (...args) => fromMock(...args) }, isSupabaseConfigured: true }));

import { getReportDetail } from '../services/reportDetailService';

const REPORT = { id: 'r1', user_id: 'dueño', description: 'Bache', current_state_code: 'RECIBIDO' };

// Simula la cadena de supabase-js para cada tabla y registra qué tablas se consultaron
const armarSupabase = () => {
  fromMock.mockImplementation((table) => {
    if (table === 'citizen_reports') {
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: REPORT, error: null }) }) }) };
    }
    if (table === 'report_images') {
      return { select: () => ({ eq: async () => ({ data: [{ id: 'i1', image_url: 'https://x/1.jpg' }], error: null }) }) };
    }
    throw new Error(`tabla inesperada: ${table}`);
  });
};

describe('getReportDetail · visibilidad de fotos', () => {
  beforeEach(() => {
    fromMock.mockReset();
    armarSupabase();
  });

  it('UT-DETV-01: para el dueño trae las fotos', async () => {
    const result = await getReportDetail('r1', 'dueño');
    expect(result.success).toBe(true);
    expect(result.data.report_images).toHaveLength(1);
    expect(fromMock).toHaveBeenCalledWith('report_images');
  });

  it('UT-DETV-02: para otra persona devuelve el reporte sin fotos y ni siquiera consulta report_images', async () => {
    const result = await getReportDetail('r1', 'otra-persona');
    expect(result.success).toBe(true);
    expect(result.data.description).toBe('Bache');
    expect(result.data.report_images).toEqual([]);
    expect(fromMock).not.toHaveBeenCalledWith('report_images');
  });

  it('UT-DETV-03: sin usuario en sesión tampoco trae fotos', async () => {
    const result = await getReportDetail('r1', undefined);
    expect(result.data.report_images).toEqual([]);
    expect(fromMock).not.toHaveBeenCalledWith('report_images');
  });
});
