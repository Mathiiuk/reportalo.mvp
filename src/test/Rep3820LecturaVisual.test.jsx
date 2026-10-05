/**
 * @file Rep3820LecturaVisual.test.jsx
 * @description REP-3820: lectura (servicio y hook) de la verificación visual de las fotos de un reporte.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// -------------------------------------------------------------------- hook
vi.mock('../lib/supabaseClient', () => ({ supabase: {}, isSupabaseConfigured: true }));
vi.mock('../services/reportImageAnalysisService', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, fetchReportImageAnalyses: vi.fn() };
});
import { fetchReportImageAnalyses as fetchMock } from '../services/reportImageAnalysisService';
import { useReportImageAnalysis, IMAGE_ANALYSIS_POLL_INTERVAL_MS, IMAGE_ANALYSIS_MAX_POLL_MS, IMAGE_ANALYSIS_MAX_CONSECUTIVE_ERRORS } from '../hooks/useReportImageAnalysis';

const fila = (n) => ({ image_id: `i${n}`, status: 'completado', coherence: 'coincide' });

describe('REP-3820: useReportImageAnalysis', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('UT-V3820-04: lee al entrar y, si ya están todas las fotos, no vuelve a consultar', async () => {
    fetchMock.mockResolvedValue({ results: [fila(1)], error: null });
    const { result } = renderHook(() => useReportImageAnalysis({ reportId: 'rep-1', imageCount: 1 }));

    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(result.current.results).toEqual([fila(1)]);
    expect(result.current.loading).toBe(false);

    await act(async () => { await vi.advanceTimersByTimeAsync(IMAGE_ANALYSIS_POLL_INTERVAL_MS * 3); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('UT-V3820-05: mientras falten resultados sigue consultando y el bloque aparece solo cuando llegan', async () => {
    fetchMock.mockResolvedValueOnce({ results: [], error: null }).mockResolvedValueOnce({ results: [fila(1)], error: null });
    const { result } = renderHook(() => useReportImageAnalysis({ reportId: 'rep-1', imageCount: 1 }));

    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(result.current.results).toEqual([]);

    await act(async () => { await vi.advanceTimersByTimeAsync(IMAGE_ANALYSIS_POLL_INTERVAL_MS); });
    expect(result.current.results).toEqual([fila(1)]);

    await act(async () => { await vi.advanceTimersByTimeAsync(IMAGE_ANALYSIS_POLL_INTERVAL_MS * 3); });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('UT-V3820-06: con varias fotos espera un resultado por cada una', async () => {
    fetchMock.mockResolvedValue({ results: [fila(1)], error: null });
    renderHook(() => useReportImageAnalysis({ reportId: 'rep-1', imageCount: 2 }));

    await act(async () => { await vi.advanceTimersByTimeAsync(IMAGE_ANALYSIS_POLL_INTERVAL_MS * 2); });
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
  });

  it('UT-V3820-07: deja de consultar al pasar el tiempo máximo (3 minutos)', async () => {
    fetchMock.mockResolvedValue({ results: [], error: null });
    renderHook(() => useReportImageAnalysis({ reportId: 'rep-1', imageCount: 1 }));

    await act(async () => { await vi.advanceTimersByTimeAsync(IMAGE_ANALYSIS_MAX_POLL_MS + IMAGE_ANALYSIS_POLL_INTERVAL_MS * 2); });
    const llamadas = fetchMock.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(IMAGE_ANALYSIS_POLL_INTERVAL_MS * 5); });
    expect(fetchMock).toHaveBeenCalledTimes(llamadas);
  });

  it('UT-V3820-08: falla blanda: un error de lectura no rompe nada y no hay resultados', async () => {
    fetchMock.mockResolvedValue({ results: [], error: 'sin permiso' });
    const { result } = renderHook(() => useReportImageAnalysis({ reportId: 'rep-1', imageCount: 1 }));

    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(result.current.results).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('UT-V3820-08b: si la lectura falla varias veces seguidas (sin permiso, tabla inexistente) deja de insistir', async () => {
    fetchMock.mockResolvedValue({ results: [], error: 'relation does not exist' });
    renderHook(() => useReportImageAnalysis({ reportId: 'rep-1', imageCount: 1 }));

    await act(async () => { await vi.advanceTimersByTimeAsync(IMAGE_ANALYSIS_POLL_INTERVAL_MS * 10); });
    expect(fetchMock).toHaveBeenCalledTimes(IMAGE_ANALYSIS_MAX_CONSECUTIVE_ERRORS);
  });

  it('UT-V3820-09: deshabilitado (reporte ajeno), sin fotos o sin reporte: no consulta nada', async () => {
    renderHook(() => useReportImageAnalysis({ reportId: 'rep-1', imageCount: 1, enabled: false }));
    renderHook(() => useReportImageAnalysis({ reportId: 'rep-1', imageCount: 0 }));
    renderHook(() => useReportImageAnalysis({ reportId: undefined, imageCount: 1 }));

    await act(async () => { await vi.advanceTimersByTimeAsync(IMAGE_ANALYSIS_POLL_INTERVAL_MS * 2); });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('UT-V3820-10: al desmontar corta el sondeo (sin timers vivos)', async () => {
    fetchMock.mockResolvedValue({ results: [], error: null });
    const { unmount } = renderHook(() => useReportImageAnalysis({ reportId: 'rep-1', imageCount: 1 }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    unmount();
    const llamadas = fetchMock.mock.calls.length;

    await act(async () => { await vi.advanceTimersByTimeAsync(IMAGE_ANALYSIS_POLL_INTERVAL_MS * 3); });
    expect(fetchMock).toHaveBeenCalledTimes(llamadas);
    expect(vi.getTimerCount()).toBe(0);
  });
});

