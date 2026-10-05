/**
 * @file Rep3820ServicioVisual.test.js
 * @description REP-3820: lectura de report_image_analysis (respeta RLS; no pide confianza ni trazabilidad interna).
 */
import { describe, it, expect, vi } from 'vitest';

import { fetchReportImageAnalyses } from '../services/reportImageAnalysisService';

describe('REP-3820: reportImageAnalysisService', () => {
  const clienteCon = (respuesta) => {
    const chain = { select: vi.fn(), eq: vi.fn(), order: vi.fn() };
    chain.select.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    chain.order.mockResolvedValue(respuesta);
    return { from: vi.fn(() => chain), chain };
  };

  it('UT-V3820-01: lee de report_image_analysis por reporte, en orden de llegada, y devuelve las filas', async () => {
    const filas = [{ image_id: 'i1', status: 'completado' }];
    const client = clienteCon({ data: filas, error: null });

    const r = await fetchReportImageAnalyses(client, 'rep-1');

    expect(client.from).toHaveBeenCalledWith('report_image_analysis');
    expect(client.chain.eq).toHaveBeenCalledWith('report_id', 'rep-1');
    expect(client.chain.order).toHaveBeenCalledWith('created_at', { ascending: true });
    expect(r).toEqual({ results: filas, error: null });
  });

  it('UT-V3820-02: no pide la confianza ni la trazabilidad interna (modelo, tokens, motivo)', async () => {
    const client = clienteCon({ data: [], error: null });
    await fetchReportImageAnalyses(client, 'rep-1');
    const columnas = client.chain.select.mock.calls[0][0];
    expect(columnas).not.toMatch(/confidence_score|model_code|prompt_version|input_tokens|output_tokens|latency_ms|status_reason/);
    expect(columnas).toMatch(/scene_summary/);
    expect(columnas).toMatch(/service_name/);
  });

  it('UT-V3820-03: ante un error de la base devuelve el mensaje y ningún resultado; sin reportId no consulta', async () => {
    expect(await fetchReportImageAnalyses(clienteCon({ data: null, error: { message: 'permiso denegado' } }), 'rep-1')).toEqual({ results: [], error: 'permiso denegado' });
    const client = clienteCon({ data: [], error: null });
    expect((await fetchReportImageAnalyses(client, '')).error).toBeTruthy();
    expect(client.from).not.toHaveBeenCalled();
  });
});

