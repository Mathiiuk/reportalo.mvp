/**
 * @file ReportDetailFlow.test.jsx
 * @description Pruebas de la pantalla de detalle del reporte (REP-3789), donde
 * el fundamento jurídico del RAG se vuelve visible para el ciudadano.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// Se mockea solo el I/O (getReportDetail / getReportStateHistory). isOwnedBy,
// buildShortCode y buildTimeline se dejan reales: son lógica pura y justamente
// parte de lo que queremos verificar.
vi.mock('../services/reportDetailService', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, getReportDetail: vi.fn(), getReportStateHistory: vi.fn() };
});

vi.mock('../hooks/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('../hooks/useReportAnalysisLive', () => ({ useReportAnalysisLive: vi.fn() }));

import { ReportDetailPage } from '../pages/ReportDetailPage';
import { getReportDetail, getReportStateHistory } from '../services/reportDetailService';
import { useAuth } from '../hooks/useAuth';
import { useReportAnalysisLive } from '../hooks/useReportAnalysisLive';

const REPORT_ID = '3f2a1b4c-0000-4000-8000-000000000001';
const OWNER_ID = 'user-owner-1';

const baseReport = {
  id: REPORT_ID,
  user_id: OWNER_ID,
  description: 'Camión de gran porte estacionado sobre la rampa.',
  // Codigo real de public.report_states. Antes decia 'EN_ANALISIS', que no existe
  // en el catalogo y por eso la prueba no reflejaba produccion (H-23).
  current_state_code: 'en_curso',
  created_at: '2026-08-14T14:32:00Z',
  services: { service_name: 'Tránsito' },
  localities: { name: 'Avellaneda' },
  report_images: [],
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={[`/reportes/${REPORT_ID}`]}>
      <Routes>
        <Route path="/reportes/:id" element={<ReportDetailPage />} />
      </Routes>
    </MemoryRouter>
  );

describe('REP-3789: detalle del reporte y fundamento jurídico', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ user: { id: OWNER_ID } });
    useReportAnalysisLive.mockReturnValue({ analysis: null, loading: false, error: null, mode: 'realtime' });
    getReportStateHistory.mockResolvedValue({ success: true, history: [] });
  });

  it('UT-DET-01: muestra el estado de carga mientras resuelve el reporte', () => {
    getReportDetail.mockReturnValue(new Promise(() => {})); // nunca resuelve
    renderPage();
    expect(screen.getByTestId('detail-loading')).toBeInTheDocument();
  });

  it('UT-DET-02: muestra "no encontrado" si el backend devuelve error', async () => {
    getReportDetail.mockResolvedValue({ success: false, error: 'NOT_FOUND' });
    renderPage();
    expect(await screen.findByTestId('detail-not-found')).toBeInTheDocument();
  });

  it('UT-DET-03: no muestra el detalle de un reporte ajeno, aunque RLS permita leerlo', async () => {
    // citizen_reports tiene lectura pública (la necesita el mapa): la pertenencia
    // se valida en el cliente para no exponer el fundamento jurídico de otro.
    getReportDetail.mockResolvedValue({ success: true, data: { ...baseReport, user_id: 'otro-usuario' } });
    renderPage();
    expect(await screen.findByTestId('detail-not-found')).toBeInTheDocument();
  });

  it('UT-DET-04: con análisis fundamentado muestra fundamento, norma y organismo', async () => {
    getReportDetail.mockResolvedValue({ success: true, data: baseReport });
    useReportAnalysisLive.mockReturnValue({
      loading: false,
      error: null,
      mode: 'realtime',
      analysis: {
        id: 'analysis-1',
        result_status_code: 'fundamentado',
        citizen_feedback: 'No está permitido estacionar sobre la rampa.',
        generation_model_code: 'gemini-3.8-flash',
        prompt_version: 'v2',
        agencies: { name: 'ANSV / Policía de Tránsito' },
        report_ai_evidence: [
          {
            fragment_id: 'FRAG-A',
            was_cited: true,
            quoted_text: 'texto citado',
            knowledge_fragments: { hierarchy_path: 'Ley 13.927 > Artículo 4', foundation_type_code: 'obligacion' },
          },
        ],
      },
    });

    renderPage();

    expect(await screen.findByText('No está permitido estacionar sobre la rampa.')).toBeInTheDocument();
    expect(screen.getByText('Ley 13.927 > Artículo 4')).toBeInTheDocument();
    expect(screen.getByText('ANSV / Policía de Tránsito')).toBeInTheDocument();
    expect(screen.getByText('Camión de gran porte estacionado sobre la rampa.')).toBeInTheDocument();
  });

  it('UT-DET-05: con el análisis todavía pendiente muestra procesamiento, no un vacío', async () => {
    getReportDetail.mockResolvedValue({ success: true, data: baseReport });
    useReportAnalysisLive.mockReturnValue({ analysis: null, loading: false, error: null, mode: 'polling' });

    renderPage();

    expect(await screen.findByTestId('rag-panel-pending')).toBeInTheDocument();
  });

  it('UT-DET-06: nunca muestra un fragmento de tipo sanción al ciudadano', async () => {
    getReportDetail.mockResolvedValue({ success: true, data: baseReport });
    useReportAnalysisLive.mockReturnValue({
      loading: false,
      error: null,
      mode: 'realtime',
      analysis: {
        id: 'analysis-2',
        result_status_code: 'fundamentado',
        citizen_feedback: 'Fundamento visible.',
        report_ai_evidence: [
          {
            fragment_id: 'FRAG-S',
            was_cited: true,
            quoted_text: 'multa de 100 unidades fijas',
            knowledge_fragments: { hierarchy_path: 'Ley 13.927 > Artículo 99', foundation_type_code: 'sancion' },
          },
        ],
      },
    });

    renderPage();

    await screen.findByText('Fundamento visible.');
    expect(screen.queryByText(/multa de 100/)).not.toBeInTheDocument();
    expect(screen.queryByText('Ley 13.927 > Artículo 99')).not.toBeInTheDocument();
  });

  it('UT-DET-07: expone el estado real del reporte según report_states de producción', async () => {
    // El catálogo real de public.report_states es borrador / enviado / en_curso /
    // resuelto / rechazado, y current_state_code tiene FK contra él. La píldora
    // traduce esos códigos a las etiquetas del §10 del UJ v3.3 (H-23).
    getReportDetail.mockResolvedValue({ success: true, data: { ...baseReport, current_state_code: 'en_curso' } });
    renderPage();
    expect(await screen.findByTestId('status-pill')).toHaveTextContent('En revisión');
  });

  it('UT-DET-07b: un reporte rechazado se muestra como Descartado, no como en curso', async () => {
    // Regresión de H-23: con la taxonomía anterior este caso caía al valor por
    // defecto y el ciudadano veía "EN CURSO" en un reporte ya cerrado.
    getReportDetail.mockResolvedValue({ success: true, data: { ...baseReport, current_state_code: 'rechazado' } });
    renderPage();
    expect(await screen.findByTestId('status-pill')).toHaveTextContent('Descartado');
  });

  it('UT-DET-08: informa cuando el reporte no tiene evidencia adjunta', async () => {
    getReportDetail.mockResolvedValue({ success: true, data: baseReport });
    renderPage();
    expect(await screen.findByTestId('detail-no-images')).toBeInTheDocument();
  });

  it('UT-DET-09: deja trazable el análisis mostrado para QA (data-analysis-id)', async () => {
    getReportDetail.mockResolvedValue({ success: true, data: baseReport });
    useReportAnalysisLive.mockReturnValue({
      loading: false,
      error: null,
      mode: 'realtime',
      analysis: {
        id: 'analysis-trace-9',
        result_status_code: 'sin_normativa',
        generation_model_code: 'gemini-3.8-flash',
        prompt_version: 'v2',
        report_ai_evidence: [],
      },
    });

    renderPage();

    const panel = await screen.findByTestId('rag-panel');
    expect(panel).toHaveAttribute('data-analysis-id', 'analysis-trace-9');
    expect(panel).toHaveAttribute('data-generation-model', 'gemini-3.8-flash');
    expect(panel).toHaveAttribute('data-prompt-version', 'v2');
  });

  it('UT-DET-10: dibuja la línea de tiempo con el historial real del reporte', async () => {
    getReportDetail.mockResolvedValue({ success: true, data: { ...baseReport, current_state_code: 'en_curso' } });
    getReportStateHistory.mockResolvedValue({
      success: true,
      history: [
        { id: 'h1', state_code: 'enviado', changed_at: '2026-08-14T14:32:00Z', notes: null },
        { id: 'h2', state_code: 'en_curso', changed_at: '2026-08-15T09:10:00Z', notes: 'Derivado a inspección' },
      ],
    });

    renderPage();

    expect(await screen.findByTestId('report-timeline')).toBeInTheDocument();
    expect(screen.getByTestId('timeline-step-en_revision')).toHaveAttribute('data-reached', 'true');
    // "Resuelto" todavía no ocurrió: se dibuja apagado, sin fecha inventada.
    expect(screen.getByTestId('timeline-step-resuelto')).toHaveAttribute('data-reached', 'false');
    expect(screen.getByText(/Derivado a inspección/)).toBeInTheDocument();
  });

  it('UT-DET-12: si falla la lectura del análisis lo informa, en vez de dejar al usuario esperando', async () => {
    // Sin este manejo, un error de lectura se veía igual que "procesando": el
    // ciudadano quedaba esperando indefinidamente algo que ya habia fallado.
    getReportDetail.mockResolvedValue({ success: true, data: baseReport });
    useReportAnalysisLive.mockReturnValue({
      analysis: null,
      loading: false,
      error: 'network error',
      mode: 'polling',
    });

    renderPage();

    expect(await screen.findByTestId('rag-panel-error')).toBeInTheDocument();
    expect(screen.queryByTestId('rag-panel-pending')).not.toBeInTheDocument();
  });

  it('UT-DET-13: muestra todas las evidencias, no solo las dos del mockup', async () => {
    getReportDetail.mockResolvedValue({
      success: true,
      data: {
        ...baseReport,
        report_images: [
          { id: 'i1', image_url: 'https://example.test/1.jpg' },
          { id: 'i2', image_url: 'https://example.test/2.jpg' },
          { id: 'i3', image_url: 'https://example.test/3.jpg' },
        ],
      },
    });

    renderPage();

    const gallery = await screen.findByTestId('detail-images');
    expect(gallery).toHaveAttribute('data-count', '3');
    expect(screen.getAllByRole('img')).toHaveLength(3);
    // Tres o más pasan a carrusel horizontal
    expect(gallery).toHaveAttribute('data-layout', 'carousel');
  });

  it('UT-DET-14: con una o dos evidencias mantiene la grilla del mockup', async () => {
    getReportDetail.mockResolvedValue({
      success: true,
      data: {
        ...baseReport,
        report_images: [
          { id: 'i1', image_url: 'https://example.test/1.jpg' },
          { id: 'i2', image_url: 'https://example.test/2.jpg' },
        ],
      },
    });

    renderPage();

    const gallery = await screen.findByTestId('detail-images');
    expect(gallery).toHaveAttribute('data-layout', 'grid');
    expect(screen.getAllByRole('img')).toHaveLength(2);
  });

  it('UT-DET-11: sin historial registrado, deriva el primer paso del reporte', async () => {
    // Caso mayoritario hoy en produccion: el reporte no tiene filas en
    // report_state_history, pero la linea de tiempo no puede quedar vacia.
    getReportDetail.mockResolvedValue({ success: true, data: { ...baseReport, current_state_code: 'enviado' } });
    getReportStateHistory.mockResolvedValue({ success: true, history: [] });

    renderPage();

    expect(await screen.findByTestId('timeline-step-enviado')).toHaveAttribute('data-reached', 'true');
    expect(screen.getByTestId('timeline-step-en_revision')).toHaveAttribute('data-reached', 'false');
  });
});
