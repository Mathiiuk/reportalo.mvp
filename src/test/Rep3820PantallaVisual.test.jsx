/**
 * @file Rep3820VerificacionVisual.test.jsx
 * @description REP-3820: pantalla (componente e integración en el detalle del reporte) de la verificación
 * visual de las fotos.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// -------------------------------------------------------------- componente
import { ReportVisualVerification, isUsefulImageResult } from '../components/report/ReportVisualVerification';

const IMGS = [{ id: 'i1' }, { id: 'i2' }];
const resultado = (extra = {}) => ({
  image_id: 'i1',
  status: 'completado',
  coherence: 'coincide',
  scene_summary: 'Se observa un bache en la calzada con piedras sueltas.',
  quality_flags: [],
  services: { service_name: 'Infraestructura' },
  ...extra,
});

describe('REP-3820: ReportVisualVerification', () => {
  it('UT-V3820-11: coincide: muestra el resultado, lo que se ve y la aclaración de que no es un fundamento legal', () => {
    render(<ReportVisualVerification results={[resultado()]} images={[IMGS[0]]} categoryName="Infraestructura" />);

    const bloque = screen.getByTestId('visual-verification');
    expect(within(bloque).getByRole('heading', { name: /verificación de la foto/i })).toBeInTheDocument();
    expect(within(bloque).getByText('La foto coincide con tu descripción.')).toBeInTheDocument();
    expect(within(bloque).getByText(/se observa un bache/i)).toBeInTheDocument();
    expect(within(bloque).getByText(/no es un fundamento legal ni cambia el estado de tu reporte/i)).toBeInTheDocument();
    expect(within(bloque).getByTestId('visual-result')).toHaveAttribute('data-coherence', 'coincide');
  });

  it('UT-V3820-12: no coincide: lo dice sin acusar y aclara que el reporte sigue su curso', () => {
    render(<ReportVisualVerification results={[resultado({ coherence: 'no_coincide' })]} images={[IMGS[0]]} categoryName="Infraestructura" />);
    expect(screen.getByText(/no pudimos ver en la foto lo que describiste/i)).toBeInTheDocument();
    expect(screen.getByText(/tu reporte sigue su curso/i)).toBeInTheDocument();
  });

  it('UT-V3820-13: no se muestra el bloque sin resultados, ni con resultados no concluyentes, omitidos o fallidos', () => {
    const { container, rerender } = render(<ReportVisualVerification results={[]} images={IMGS} />);
    expect(container).toBeEmptyDOMElement();

    rerender(<ReportVisualVerification results={[resultado({ coherence: 'no_concluyente' })]} images={IMGS} />);
    expect(container).toBeEmptyDOMElement();

    rerender(<ReportVisualVerification results={[resultado({ status: 'omitido', coherence: null }), resultado({ image_id: 'i2', status: 'fallido', coherence: null })]} images={IMGS} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('UT-V3820-14: con varias fotos cada una tiene su propia tarjeta, en el orden de las fotos, sin fusionarse', () => {
    const results = [
      resultado({ image_id: 'i2', coherence: 'no_coincide', scene_summary: 'Una plaza con césped.' }),
      resultado({ image_id: 'i1', scene_summary: 'Un bache en la calle.' }),
    ];
    render(<ReportVisualVerification results={results} images={IMGS} categoryName="Infraestructura" />);

    const tarjetas = screen.getAllByTestId('visual-result');
    expect(tarjetas).toHaveLength(2);
    expect(within(tarjetas[0]).getByText('Foto 1')).toBeInTheDocument();
    expect(within(tarjetas[0]).getByText(/un bache en la calle/i)).toBeInTheDocument();
    expect(within(tarjetas[1]).getByText('Foto 2')).toBeInTheDocument();
    expect(within(tarjetas[1]).getByText(/una plaza con césped/i)).toBeInTheDocument();
    expect(tarjetas[0]).toHaveAttribute('data-coherence', 'coincide');
    expect(tarjetas[1]).toHaveAttribute('data-coherence', 'no_coincide');
  });

  it('UT-V3820-15: con una sola foto no se rotula «Foto 1»; si solo una de dos fotos tiene resultado útil se muestra solo esa', () => {
    const { rerender } = render(<ReportVisualVerification results={[resultado()]} images={[IMGS[0]]} />);
    expect(screen.queryByText('Foto 1')).not.toBeInTheDocument();

    rerender(<ReportVisualVerification results={[resultado({ image_id: 'i2', coherence: 'no_concluyente' }), resultado()]} images={IMGS} />);
    expect(screen.getAllByTestId('visual-result')).toHaveLength(1);
    expect(screen.getByText('Foto 1')).toBeInTheDocument();
  });

  it('UT-V3820-16: ignora resultados de fotos que el reporte no tiene', () => {
    const { container } = render(<ReportVisualVerification results={[resultado({ image_id: 'otra' })]} images={IMGS} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('UT-V3820-17: sugiere otra categoría solo si es distinta de la elegida', () => {
    const { rerender } = render(<ReportVisualVerification results={[resultado({ services: { service_name: 'Ambiente' } })]} images={[IMGS[0]]} categoryName="Tránsito" />);
    expect(screen.getByText(/podría corresponder a la categoría «Ambiente»/i)).toBeInTheDocument();

    rerender(<ReportVisualVerification results={[resultado({ services: { service_name: 'Tránsito' } })]} images={[IMGS[0]]} categoryName="Tránsito" />);
    expect(screen.queryByText(/podría corresponder/i)).not.toBeInTheDocument();

    rerender(<ReportVisualVerification results={[resultado({ services: null })]} images={[IMGS[0]]} categoryName="Tránsito" />);
    expect(screen.queryByText(/podría corresponder/i)).not.toBeInTheDocument();
  });

  it('UT-V3820-18: las marcas de calidad se explican en castellano llano', () => {
    render(<ReportVisualVerification results={[resultado({ quality_flags: ['oscura', 'borrosa'] })]} images={[IMGS[0]]} />);
    expect(screen.getByText(/la foto está oscura\. la foto está borrosa\./i)).toBeInTheDocument();
  });

  it('UT-V3820-19: nunca muestra la confianza del modelo ni datos de trazabilidad', () => {
    render(<ReportVisualVerification results={[resultado({ confidence_score: 0.98, model_code: 'gemini-3.8-flash', status_reason: 'x' })]} images={[IMGS[0]]} />);
    const texto = screen.getByTestId('visual-verification').textContent;
    expect(texto).not.toMatch(/0[.,]98|98 ?%|gemini|confianza/i);
  });

  it('UT-V3820-20: isUsefulImageResult exige completado y coherencia concluyente', () => {
    expect(isUsefulImageResult(resultado())).toBe(true);
    expect(isUsefulImageResult(resultado({ coherence: 'no_coincide' }))).toBe(true);
    expect(isUsefulImageResult(resultado({ coherence: 'no_concluyente' }))).toBe(false);
    expect(isUsefulImageResult(resultado({ status: 'fallido' }))).toBe(false);
    expect(isUsefulImageResult(null)).toBe(false);
  });
});

// ------------------------------------------------------- detalle del reporte
vi.mock('../services/reportDetailService', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, getReportDetail: vi.fn(), getReportStateHistory: vi.fn() };
});
vi.mock('../hooks/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('../hooks/useReportAnalysisLive', () => ({ useReportAnalysisLive: vi.fn() }));
vi.mock('../hooks/useReportStateLive', () => ({ useReportStateLive: vi.fn() }));
vi.mock('../hooks/useReportImageAnalysis', () => ({ useReportImageAnalysis: vi.fn(), IMAGE_ANALYSIS_POLL_INTERVAL_MS: 8000, IMAGE_ANALYSIS_MAX_POLL_MS: 180000 }));

import { ReportDetailPage } from '../pages/ReportDetailPage';
import { getReportDetail, getReportStateHistory } from '../services/reportDetailService';
import { useAuth } from '../hooks/useAuth';
import { useReportAnalysisLive } from '../hooks/useReportAnalysisLive';
import { useReportImageAnalysis as hookMock } from '../hooks/useReportImageAnalysis';

const REPORT_ID = '3f2a1b4c-0000-4000-8000-000000000001';
const OWNER_ID = 'user-owner-1';
const reporte = (extra = {}) => ({
  id: REPORT_ID,
  user_id: OWNER_ID,
  description: 'Bache grande en la calle.',
  current_state_code: 'EN_ANALISIS',
  created_at: '2026-08-14T14:32:00Z',
  services: { service_name: 'Infraestructura' },
  localities: { name: 'Avellaneda' },
  report_images: [{ id: 'i1', image_url: 'https://example.test/1.jpg' }],
  ...extra,
});
const montarDetalle = () =>
  render(
    <MemoryRouter initialEntries={[`/reportes/${REPORT_ID}`]}>
      <Routes>
        <Route path="/reportes/:id" element={<ReportDetailPage />} />
      </Routes>
    </MemoryRouter>
  );

describe('REP-3820: la verificación visual en el detalle del reporte', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ user: { id: OWNER_ID } });
    useReportAnalysisLive.mockReturnValue({
      analysis: { id: 'a1', result_status_code: 'sin_normativa' },
      loading: false,
      error: null,
      mode: 'realtime',
    });
    getReportStateHistory.mockResolvedValue({ success: true, history: [] });
    hookMock.mockReturnValue({ results: [], loading: false });
  });

  it('UT-V3820-21: el dueño ve el bloque junto al fundamento legal, claramente separado y sin pisarlo', async () => {
    getReportDetail.mockResolvedValue({ success: true, data: reporte() });
    hookMock.mockReturnValue({ results: [resultado()], loading: false });
    montarDetalle();

    const bloque = await screen.findByTestId('visual-verification');
    expect(bloque).toBeInTheDocument();
    // El panel jurídico sigue ahí, con su propio contenido
    expect(screen.getByTestId('rag-panel')).toHaveAttribute('data-status', 'sin_normativa');
    expect(within(screen.getByTestId('rag-panel')).queryByText(/verificación de la foto/i)).not.toBeInTheDocument();
    expect(within(bloque).queryByText(/fundamento legal$/i)).not.toBeInTheDocument();
  });

  it('UT-V3820-22: el bloque no cambia el estado del reporte', async () => {
    getReportDetail.mockResolvedValue({ success: true, data: reporte() });
    hookMock.mockReturnValue({ results: [resultado({ coherence: 'no_coincide' })], loading: false });
    montarDetalle();

    await screen.findByTestId('visual-verification');
    // El estado sigue siendo el del reporte (En análisis → «En revisión» al ciudadano): no se movió a ningún paso posterior
    expect(screen.getAllByText(/en revisión/i).length).toBeGreaterThan(0);
    expect(screen.getByTestId('timeline-step-resuelto')).toHaveAttribute('data-reached', 'false');
  });

  it('UT-V3820-23: sin resultado útil no hay bloque y el panel jurídico se ve igual', async () => {
    getReportDetail.mockResolvedValue({ success: true, data: reporte() });
    hookMock.mockReturnValue({ results: [resultado({ coherence: 'no_concluyente' })], loading: false });
    montarDetalle();

    expect(await screen.findByTestId('rag-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('visual-verification')).not.toBeInTheDocument();
  });

  it('UT-V3820-24: la lectura solo se habilita para el dueño, con la cantidad de fotos del reporte', async () => {
    getReportDetail.mockResolvedValue({ success: true, data: reporte({ report_images: [{ id: 'i1', image_url: 'https://e/1.jpg' }, { id: 'i2', image_url: 'https://e/2.jpg' }] }) });
    montarDetalle();
    await screen.findByTestId('rag-panel');

    expect(hookMock).toHaveBeenLastCalledWith({ reportId: REPORT_ID, imageCount: 2, enabled: true });
  });

  it('UT-V3820-25: en un reporte ajeno no se pide ni se muestra (RLS: solo dueño o quien atiende)', async () => {
    getReportDetail.mockResolvedValue({ success: true, data: reporte({ user_id: 'otro-usuario' }) });
    hookMock.mockImplementation(({ enabled }) => ({ results: enabled ? [resultado()] : [], loading: false }));
    montarDetalle();

    expect(await screen.findByTestId('detail-public-notice')).toBeInTheDocument();
    expect(hookMock).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false }));
    expect(screen.queryByTestId('visual-verification')).not.toBeInTheDocument();
  });
});
