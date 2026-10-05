/**
 * @file Rep3798EstadoEnVivoPantalla.test.jsx
 * @description REP-3798: cuando llega un cambio de estado, el detalle del reporte se actualiza solo.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }));
vi.mock('../services/reportDetailService', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, getReportDetail: vi.fn(), getReportStateHistory: vi.fn() };
});
vi.mock('../hooks/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('../hooks/useReportAnalysisLive', () => ({ useReportAnalysisLive: vi.fn() }));
// REP-3820: la verificación visual lee otra tabla; estas pruebas no la necesitan (sin resultados no hay bloque)
vi.mock('../hooks/useReportImageAnalysis', () => ({ useReportImageAnalysis: vi.fn(() => ({ results: [], loading: false })) }));
// Se captura el callback que la pantalla le pasa al hook, para simular que llega un cambio de estado
let liveParams = null;
vi.mock('../hooks/useReportStateLive', () => ({
  useReportStateLive: (params) => {
    liveParams = params;
  },
}));

import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import { useReportAnalysisLive } from '../hooks/useReportAnalysisLive';
import { getReportDetail, getReportStateHistory } from '../services/reportDetailService';
import { ReportDetailPage } from '../pages/ReportDetailPage';

const REPORT_ID = '3f2a1b4c-0000-4000-8000-000000000001';
const report = (owner) => ({
  id: REPORT_ID,
  user_id: owner,
  description: 'Bache profundo',
  current_state_code: 'RECIBIDO',
  created_at: '2026-08-14T14:32:00Z',
  services: { service_name: 'Tránsito' },
  localities: { name: 'Avellaneda' },
  report_images: [],
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={[`/reportes/${REPORT_ID}`]}>
      <Routes>
        <Route path="/reportes/:id" element={<ReportDetailPage />} />
      </Routes>
    </MemoryRouter>
  );

describe('REP-3798 · el detalle cambia de estado en vivo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    liveParams = null;
    useAuth.mockReturnValue({ user: { id: 'dueño' } });
    useReportAnalysisLive.mockReturnValue({ analysis: null, loading: false, error: null, mode: 'realtime' });
    getReportStateHistory.mockResolvedValue({ success: true, history: [] });
  });

  it('UT-LIVE-09: el dueño ve el nuevo estado sin recargar y recibe un aviso', async () => {
    getReportDetail.mockResolvedValue({ success: true, data: report('dueño') });
    renderPage();
    await screen.findByTestId('report-detail-page');
    expect(liveParams).toMatchObject({ reportId: REPORT_ID, stateCode: 'RECIBIDO', isOwner: true });

    await act(async () => {
      liveParams.onUpdate({ stateCode: 'EN_ANALISIS', history: [{ id: 'h1', state_code: 'EN_ANALISIS', changed_at: '2026-08-15T10:00:00Z' }] });
    });

    await waitFor(() => expect(liveParams.stateCode).toBe('EN_ANALISIS'));
    expect(screen.getAllByText('En revisión').length).toBeGreaterThan(0);
    expect(toast.info).toHaveBeenCalledWith('Tu reporte cambió de estado', { description: 'En revisión' });
  });

  it('UT-LIVE-10: quien mira un reporte ajeno ve el nuevo estado pero sin aviso personal', async () => {
    getReportDetail.mockResolvedValue({ success: true, data: report('otro') });
    renderPage();
    await screen.findByTestId('detail-public-notice');
    expect(liveParams.isOwner).toBe(false);

    await act(async () => {
      liveParams.onUpdate({ stateCode: 'DERIVADO', history: null });
    });

    await waitFor(() => expect(liveParams.stateCode).toBe('DERIVADO'));
    expect(toast.info).not.toHaveBeenCalled();
  });
});
