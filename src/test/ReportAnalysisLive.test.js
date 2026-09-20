/**
 * @file ReportAnalysisLive.test.js
 * @description Pruebas del hook de lectura en vivo del análisis jurídico
 * (REP-3789): Realtime como vía principal y polling como respaldo.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const channelMock = {
  on: vi.fn(),
  subscribe: vi.fn(),
};

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    channel: vi.fn(() => channelMock),
    removeChannel: vi.fn(),
  },
  isSupabaseConfigured: true,
}));

vi.mock('../services/reportAiAnalysisService', () => ({
  fetchReportAiAnalysis: vi.fn(),
}));

import { useReportAnalysisLive, POLL_INTERVAL_MS, isAnalysisResolved } from '../hooks/useReportAnalysisLive';
import { fetchReportAiAnalysis } from '../services/reportAiAnalysisService';
import { supabase } from '../lib/supabaseClient';

const REPORT_ID = 'report-1';
const RESOLVED = { id: 'a-1', result_status_code: 'fundamentado', report_ai_evidence: [] };

describe('REP-3789: useReportAnalysisLive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    channelMock.on.mockReturnValue(channelMock);
    channelMock.subscribe.mockImplementation((cb) => {
      if (cb) cb('SUBSCRIBED');
      return channelMock;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('UT-LIVE-01: isAnalysisResolved distingue pendiente de resuelto', () => {
    expect(isAnalysisResolved(null)).toBe(false);
    expect(isAnalysisResolved({})).toBe(false);
    expect(isAnalysisResolved(RESOLVED)).toBe(true);
  });

  it('UT-LIVE-02: si el análisis ya existe, lo entrega y no abre canal de Realtime', async () => {
    fetchReportAiAnalysis.mockResolvedValue({ analysis: RESOLVED, error: null });

    const { result } = renderHook(() => useReportAnalysisLive(REPORT_ID));

    await waitFor(() => expect(result.current.analysis).toEqual(RESOLVED));
    expect(result.current.loading).toBe(false);
    // No hace falta escuchar nada: el resultado ya estaba persistido.
    expect(supabase.channel).not.toHaveBeenCalled();
  });

  it('UT-LIVE-03: si está pendiente, se suscribe a Realtime filtrando por report_id', async () => {
    fetchReportAiAnalysis.mockResolvedValue({ analysis: null, error: null });

    const { result } = renderHook(() => useReportAnalysisLive(REPORT_ID));

    await waitFor(() => expect(supabase.channel).toHaveBeenCalledWith(`report-analysis-${REPORT_ID}`));

    const [, subscriptionConfig] = channelMock.on.mock.calls[0];
    expect(subscriptionConfig).toMatchObject({
      schema: 'public',
      table: 'report_ai_analysis',
      filter: `report_id=eq.${REPORT_ID}`,
    });
    await waitFor(() => expect(result.current.mode).toBe('realtime'));
  });

  it('UT-LIVE-04: el polling de respaldo trae el análisis que Realtime no entregó', async () => {
    vi.useFakeTimers();
    fetchReportAiAnalysis.mockResolvedValue({ analysis: null, error: null });

    const { result } = renderHook(() => useReportAnalysisLive(REPORT_ID));

    // Deja correr la lectura inicial y el alta del canal.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.analysis).toBeNull();

    // El análisis se persiste más tarde; Realtime no emite el evento.
    fetchReportAiAnalysis.mockResolvedValue({ analysis: RESOLVED, error: null });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS + 100);
    });

    expect(result.current.analysis).toEqual(RESOLVED);
    // Al resolverse, el respaldo se apaga y el canal se libera.
    expect(supabase.removeChannel).toHaveBeenCalled();
  });

  it('UT-LIVE-05: marca modo polling si el canal falla', async () => {
    fetchReportAiAnalysis.mockResolvedValue({ analysis: null, error: null });
    channelMock.subscribe.mockImplementation((cb) => {
      if (cb) cb('CHANNEL_ERROR');
      return channelMock;
    });

    const { result } = renderHook(() => useReportAnalysisLive(REPORT_ID));

    await waitFor(() => expect(result.current.mode).toBe('polling'));
  });

  it('UT-LIVE-06: libera el canal al desmontar', async () => {
    fetchReportAiAnalysis.mockResolvedValue({ analysis: null, error: null });

    const { unmount } = renderHook(() => useReportAnalysisLive(REPORT_ID));
    await waitFor(() => expect(supabase.channel).toHaveBeenCalled());

    unmount();
    expect(supabase.removeChannel).toHaveBeenCalled();
  });
});
