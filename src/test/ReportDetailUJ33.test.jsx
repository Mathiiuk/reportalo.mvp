import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

/*
 * Adaptado el 21/09/2026 a la capa de datos integrada: la pantalla usa el
 * servicio de REP-3789 (getReportDetail + getReportStateHistory + isOwnedBy) y
 * el hook useReportAnalysisLive (Realtime con polling de respaldo), en lugar del
 * sondeo con fetchReportAiAnalysis que traía el bloque. Las aserciones de diseño
 * y de taxonomía no cambiaron.
 */
vi.mock('../lib/supabaseClient', () => ({ supabase: {}, isSupabaseConfigured: true }));
vi.mock('../services/reportDetailService', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, getReportDetail: vi.fn(), getReportStateHistory: vi.fn() };
});
vi.mock('../hooks/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('../hooks/useReportAnalysisLive', () => ({ useReportAnalysisLive: vi.fn() }));

import { getReportDetail, getReportStateHistory } from '../services/reportDetailService';
import { useAuth } from '../hooks/useAuth';
import { useReportAnalysisLive } from '../hooks/useReportAnalysisLive';
import { ReportDetailPage } from '../pages/ReportDetailPage';
import { normalizeReportState, buildTimeline, formatReportCode } from '../components/report/reportStatus';
import { StatusPill } from '../components/report/StatusPill';

const REPORT_ID = 'abcd1234-0000-4000-8000-000000000000';
const OWNER_ID = 'owner-0001';

// El detalle es privado: la pantalla valida pertenencia contra el usuario en sesión.
const mockSession = () => useAuth.mockReturnValue({ user: { id: OWNER_ID } });
const mockAnalysis = (analysis, { loading = false, error = null } = {}) =>
  useReportAnalysisLive.mockReturnValue({ analysis, loading, error, mode: 'realtime' });

const renderDetail = () =>
  render(
    <MemoryRouter initialEntries={[`/reporte/${REPORT_ID}`]}>
      <Routes>
        <Route path="/reporte/:id" element={<ReportDetailPage />} />
      </Routes>
    </MemoryRouter>
  );

describe('REP-3791 Bloque 3 · Detalle del reporte y fundamento legal (UJ v3.3 · M16 / D17)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('UT-B3-01: traduce los códigos actuales de la base a la taxonomía del §10 (H-23)', () => {
    // Códigos REALES de producción (CiudadAR), verificados contra la base el 21/09/2026
    expect(normalizeReportState('RECIBIDO')).toBe('enviado');
    expect(normalizeReportState('EN_ANALISIS')).toBe('en_revision');
    expect(normalizeReportState('DERIVADO')).toBe('notificado');
    expect(normalizeReportState('RESUELTO')).toBe('resuelto');
    expect(normalizeReportState('DESESTIMADO')).toBe('descartado');
    // Códigos del seed del repositorio, que hoy no existen en la base
    expect(normalizeReportState('en_curso')).toBe('en_revision');
    expect(normalizeReportState('rechazado')).toBe('descartado');
    expect(formatReportCode(REPORT_ID)).toBe('#RP-ABCD1234');
  });

  it('UT-B3-02: la línea de tiempo marca los pasos alcanzados y conserva la nota del oficial', () => {
    const steps = buildTimeline({
      currentState: 'EN_ANALISIS',
      createdAt: '2026-08-14T14:32:00Z',
      history: [{ state_code: 'EN_ANALISIS', notes: 'Derivado a inspección de tránsito', changed_at: '2026-08-15T09:10:00Z' }],
    });
    expect(steps.map((s) => [s.key, s.done])).toEqual([
      ['enviado', true],
      ['en_revision', true],
      ['notificado', false],
      ['resuelto', false],
    ]);
    expect(steps[1].current).toBe(true);
    expect(steps[1].note).toBe('Derivado a inspección de tránsito');
  });

  it('UT-B3-03: un reporte descartado agrega el cierre alternativo con su motivo', () => {
    const steps = buildTimeline({
      currentState: 'DESESTIMADO',
      createdAt: '2026-08-14T14:32:00Z',
      history: [{ state_code: 'DESESTIMADO', notes: 'Fuera de jurisdicción', changed_at: '2026-08-16T10:00:00Z' }],
    });
    const last = steps[steps.length - 1];
    expect(last.key).toBe('descartado');
    expect(last.note).toBe('Fuera de jurisdicción');
  });

  it('UT-B3-04: StatusPill muestra la etiqueta del §10 aunque la base use otro código', () => {
    render(<StatusPill state="EN_ANALISIS" />);
    expect(screen.getByTestId('status-pill')).toHaveTextContent('En revisión');
    expect(screen.getByTestId('status-pill')).toHaveAttribute('data-state', 'en_revision');
  });

  it('UT-B3-05: el detalle muestra número, estado, fundamento legal con organismo e historial', async () => {
    mockSession();
    getReportDetail.mockResolvedValue({
      success: true,
      data: {
        id: REPORT_ID,
        user_id: OWNER_ID,
        description: 'Camión en calle residencial',
        current_state_code: 'EN_ANALISIS',
        created_at: '2026-08-14T14:32:00Z',
        latitud: -34.66,
        longitud: -58.36,
        localities: { name: 'Avellaneda' },
        report_images: [{ id: 'img-1', image_url: 'https://example.org/foto.jpg' }],
      },
    });
    getReportStateHistory.mockResolvedValue({
      success: true,
      history: [{ state_code: 'EN_ANALISIS', notes: 'Derivado a inspección de tránsito', changed_at: '2026-08-15T09:10:00Z' }],
    });
    mockAnalysis({
      result_status_code: 'fundamentado',
      citizen_feedback: 'La circulación de cargas está restringida en esa calle.',
      agencies: { name: 'Policía de Tránsito' },
      report_ai_evidence: [
        { fragment_id: 'f1', was_cited: true, knowledge_fragments: { hierarchy_path: 'Ley 13.927 > Art. 1', foundation_type_code: 'norma' } },
      ],
    });

    renderDetail();

    expect(await screen.findByText('#RP-ABCD1234')).toBeInTheDocument();
    expect(screen.getByTestId('status-pill')).toHaveTextContent('En revisión');
    await waitFor(() => expect(screen.getByTestId('rag-panel')).toHaveAttribute('data-status', 'fundamentado'));
    expect(screen.getByText('Ley 13.927 > Art. 1')).toBeInTheDocument();
    expect(screen.getByTestId('rag-panel-agency')).toHaveTextContent('Policía de Tránsito');
    expect(screen.getByText(/«Derivado a inspección de tránsito»/)).toBeInTheDocument();
    expect(screen.getByText('Avellaneda')).toBeInTheDocument();
    expect(screen.getByText('1 foto, anonimizada')).toBeInTheDocument();
  });

  it('UT-B3-06: mientras el análisis no llegó, el panel queda en estado «Analizando»', async () => {
    mockSession();
    getReportDetail.mockResolvedValue({
      success: true,
      data: {
        id: REPORT_ID,
        user_id: OWNER_ID,
        current_state_code: 'RECIBIDO',
        created_at: '2026-08-14T14:32:00Z',
        report_images: [],
      },
    });
    // El historial puede no ser legible por RLS: la pantalla igual tiene que servir.
    getReportStateHistory.mockResolvedValue({ success: false, history: [] });
    mockAnalysis(null);

    renderDetail();

    expect(await screen.findByTestId('rag-panel-pending')).toBeInTheDocument();
    expect(screen.getByText('Analizando')).toBeInTheDocument();
  });

  it('UT-B3-07: un reporte inexistente muestra la pantalla de reporte no encontrado', async () => {
    mockSession();
    getReportDetail.mockResolvedValue({ success: false, error: 'NOT_FOUND' });
    getReportStateHistory.mockResolvedValue({ success: true, history: [] });
    mockAnalysis(null);

    renderDetail();

    expect(await screen.findByTestId('detail-not-found')).toBeInTheDocument();
    expect(screen.queryByTestId('report-detail-page')).not.toBeInTheDocument();
  });
});
