/**
 * @file Rep3798EstadosEnVivo.test.jsx
 * @description REP-3798: el estado del reporte cambia en tiempo real en el detalle, sin recargar.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const channelMock = { on: vi.fn(), subscribe: vi.fn() };
vi.mock('../lib/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: { channel: vi.fn(), removeChannel: vi.fn() },
}));
vi.mock('../services/reportDetailService', () => ({
  getReportStateSnapshot: vi.fn(),
  getReportStateHistory: vi.fn(),
}));

import { supabase } from '../lib/supabaseClient';
import { getReportStateSnapshot, getReportStateHistory } from '../services/reportDetailService';
import { useReportStateLive, STATE_POLL_INTERVAL_MS } from '../hooks/useReportStateLive';

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe('REP-3798 · estado del reporte en vivo', () => {
  let onUpdate;
  let realtimeCallback;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    onUpdate = vi.fn();
    realtimeCallback = null;
    channelMock.on.mockImplementation((_type, _filter, cb) => {
      realtimeCallback = cb;
      return channelMock;
    });
    channelMock.subscribe.mockReturnValue(channelMock);
    supabase.channel.mockReturnValue(channelMock);
    getReportStateSnapshot.mockResolvedValue({ snapshot: { current_state_code: 'RECIBIDO' } });
    getReportStateHistory.mockResolvedValue({ success: true, history: [{ id: 'h1', state_code: 'EN_ANALISIS' }] });
  });

  afterEach(() => vi.useRealTimers());

  const mount = (props = {}) =>
    renderHook((p) => useReportStateLive(p), {
      initialProps: { reportId: 'r1', stateCode: 'RECIBIDO', isOwner: true, onUpdate, ...props },
    });

  it('UT-LIVE-01: si el estado no cambió, no avisa', async () => {
    mount();
    await act(async () => { vi.advanceTimersByTime(STATE_POLL_INTERVAL_MS); });
    await flush();
    expect(getReportStateSnapshot).toHaveBeenCalledWith('r1');
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('UT-LIVE-02: si el estado cambió, avisa con el estado nuevo y el historial (dueño)', async () => {
    getReportStateSnapshot.mockResolvedValue({ snapshot: { current_state_code: 'EN_ANALISIS' } });
    mount();
    await act(async () => { vi.advanceTimersByTime(STATE_POLL_INTERVAL_MS); });
    await flush();
    expect(onUpdate).toHaveBeenCalledWith({ stateCode: 'EN_ANALISIS', history: [{ id: 'h1', state_code: 'EN_ANALISIS' }] });
  });

  it('UT-LIVE-03: quien mira un reporte ajeno recibe el estado pero no consulta el historial ni abre Realtime', async () => {
    getReportStateSnapshot.mockResolvedValue({ snapshot: { current_state_code: 'DERIVADO' } });
    mount({ isOwner: false });
    await act(async () => { vi.advanceTimersByTime(STATE_POLL_INTERVAL_MS); });
    await flush();
    expect(onUpdate).toHaveBeenCalledWith({ stateCode: 'DERIVADO', history: null });
    expect(getReportStateHistory).not.toHaveBeenCalled();
    expect(supabase.channel).not.toHaveBeenCalled();
  });

  it('UT-LIVE-04: el dueño se suscribe a report_state_history de su reporte y un alta dispara la consulta', async () => {
    getReportStateSnapshot.mockResolvedValue({ snapshot: { current_state_code: 'RESUELTO' } });
    mount();
    expect(supabase.channel).toHaveBeenCalledWith('report-state-r1');
    expect(channelMock.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({ table: 'report_state_history', filter: 'report_id=eq.r1' }),
      expect.any(Function)
    );
    await act(async () => { realtimeCallback(); });
    await flush();
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ stateCode: 'RESUELTO' }));
  });

  it('UT-LIVE-05: un reporte cerrado (Resuelto o Descartado) no se sondea ni se suscribe', async () => {
    mount({ stateCode: 'RESUELTO' });
    await act(async () => { vi.advanceTimersByTime(STATE_POLL_INTERVAL_MS * 3); });
    expect(getReportStateSnapshot).not.toHaveBeenCalled();
    expect(supabase.channel).not.toHaveBeenCalled();
  });

  it('UT-LIVE-06: con la pestaña oculta no sondea', async () => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    mount();
    await act(async () => { vi.advanceTimersByTime(STATE_POLL_INTERVAL_MS * 2); });
    expect(getReportStateSnapshot).not.toHaveBeenCalled();
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  });

  it('UT-LIVE-07: al desmontar corta el sondeo y cierra el canal', async () => {
    const { unmount } = mount();
    unmount();
    await act(async () => { vi.advanceTimersByTime(STATE_POLL_INTERVAL_MS * 2); });
    expect(getReportStateSnapshot).not.toHaveBeenCalled();
    expect(supabase.removeChannel).toHaveBeenCalledWith(channelMock);
  });

  it('UT-LIVE-08: si la consulta falla, no rompe ni avisa', async () => {
    getReportStateSnapshot.mockRejectedValue(new Error('sin red'));
    mount();
    await act(async () => { vi.advanceTimersByTime(STATE_POLL_INTERVAL_MS); });
    await flush();
    expect(onUpdate).not.toHaveBeenCalled();
  });
});
