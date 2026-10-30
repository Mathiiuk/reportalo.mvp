/**
 * @file Rep3001MisReportesV2.test.jsx
 * @description REP-3001 · «Mis reportes» como en el diseño v2 de Iván (D49 a D52, M42 a M45). En escritorio la lista
 * queda a la izquierda y el reporte abierto a la derecha. Cada fila trae miniatura, número y categoría, la descripción,
 * la calle con altura y el estado. El seguimiento cierra con «Respuesta del organismo» hasta que el organismo decide,
 * dice a qué bandeja llegó y no muestra los textos internos del sistema. El fundamento y la verificación de la foto
 * quedan debajo del seguimiento (Matías, 30/10).
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const { getMyReportsMock } = vi.hoisted(() => ({ getMyReportsMock: vi.fn() }));
vi.mock('../lib/supabaseClient', () => ({ supabase: {}, isSupabaseConfigured: true }));
vi.mock('../services/reportSubmissionService', async (importOriginal) => ({ ...(await importOriginal()), getMyReports: getMyReportsMock }));
vi.mock('../services/offlineStorageService', () => ({
  getAllPendingSyncReports: vi.fn().mockResolvedValue([]),
  getActiveDraftReport: vi.fn().mockResolvedValue(null),
}));
vi.mock('../services/reportDetailService', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getReportDetail: vi.fn(),
    getReportStateHistory: vi.fn(),
    getReportTakenEvent: vi.fn(),
    // Firma de prueba: la miniatura y las fotos salen firmadas
    signEvidenceImages: vi.fn(async (imgs) => imgs.map((i) => ({ ...i, image_url: `https://firmada/${i.id}` }))),
  };
});
vi.mock('../hooks/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('../hooks/useReportAnalysisLive', () => ({ useReportAnalysisLive: vi.fn(() => ({ analysis: null, loading: false, error: null, mode: 'realtime' })) }));
vi.mock('../hooks/useReportImageAnalysis', () => ({ useReportImageAnalysis: vi.fn(() => ({ results: [], loading: false })) }));

import { getReportDetail, getReportStateHistory, getReportTakenEvent } from '../services/reportDetailService';
import { useAuth } from '../hooks/useAuth';
import { useReportAnalysisLive } from '../hooks/useReportAnalysisLive';
import { AuthContext } from '../context/AuthContext';
import { ReportsPage } from '../pages/ReportsPage';
import { ReportDetailPage } from '../pages/ReportDetailPage';
import { buildTimeline } from '../components/report/reportStatus';

const OWNER = 'owner-0001';
const ID = 'abcd1234-0000-4000-8000-000000000000';
const ORG = 'Reportalo CABA (organismo de prueba)';
const fila = {
  id: ID,
  description: 'Bache profundo en la calzada',
  current_state_code: 'DERIVADO',
  created_at: '2026-10-27T10:58:00Z',
  address_street: 'Pasco',
  address_number: '1150',
  services: { service_name: 'Infraestructura' },
  localities: { name: 'Gerli' },
  report_images: [{ id: 'img-1', image_url: 'https://x/storage/v1/object/public/report-evidences/c/f1.webp', created_at: '2026-10-27T10:58:00Z' }],
};
const historia = [
  { state_code: 'EN_ANALISIS', changed_at: '2026-10-27T10:59:00Z', notes: 'Análisis automático en curso', actor_type: 'sistema', agencies: null },
  { state_code: 'DERIVADO', changed_at: '2026-10-27T11:12:00Z', notes: `Entrega interna al operador de prueba de ${ORG}. Ningún municipio real recibió el reporte.`, actor_type: 'sistema', agencies: null },
];

const escritorio = (activo) => {
  window.matchMedia = vi.fn((query) => ({
    matches: activo && query === '(min-width: 1025px)',
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  }));
};

describe('REP-3001 · Mis reportes con el diseño v2 (D49 a D52)', () => {
  const original = window.matchMedia;
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ user: { id: OWNER }, session: { user: { id: OWNER } } });
    getMyReportsMock.mockResolvedValue({ success: true, reports: [fila] });
  });
  afterEach(() => {
    window.matchMedia = original;
  });

  it('UT-3001-L1: la lista lleva subtítulo y cada fila, miniatura, número y categoría, descripción, calle con altura y estado', async () => {
    escritorio(false);
    render(
      <AuthContext.Provider value={{ user: { id: OWNER }, session: { user: { id: OWNER } }, loading: false }}>
        <MemoryRouter initialEntries={['/reportes']}>
          <ReportsPage />
        </MemoryRouter>
      </AuthContext.Provider>
    );
    expect(await screen.findByText('Tus reportes y su estado')).toBeInTheDocument();
    const row = await screen.findByTestId('report-row');
    expect(within(row).getByText('#RP-ABCD1234 · Infraestructura')).toBeInTheDocument();
    expect(within(row).getByText('Bache profundo en la calzada')).toBeInTheDocument();
    expect(within(row).getByText('Pasco 1150, Gerli')).toBeInTheDocument();
    expect(within(row).getByTestId('status-pill')).toHaveTextContent('Derivado');
    await waitFor(() => expect(row.querySelector('img')).toHaveAttribute('src', 'https://firmada/img-1'));
  });

  it('UT-3001-L2: el seguimiento cierra con «Respuesta del organismo» hasta que el organismo decide', () => {
    const derivado = buildTimeline({ currentState: 'DERIVADO', createdAt: '2026-10-27T10:58:00Z', history: historia });
    expect(derivado.at(-1)).toMatchObject({ key: 'resuelto', label: 'Respuesta del organismo', done: false });
    const resuelto = buildTimeline({
      currentState: 'RESUELTO',
      createdAt: '2026-10-27T10:58:00Z',
      history: [...historia, { state_code: 'RESUELTO', changed_at: '2026-10-28T19:40:00Z', notes: 'Listo', actor_type: 'organismo' }],
    });
    expect(resuelto.at(-1)).toMatchObject({ key: 'resuelto', label: 'Resuelto', done: true });
  });

  it('UT-3001-L3: Derivado dice a qué bandeja llegó y los textos internos del sistema no se muestran', () => {
    const steps = buildTimeline({ currentState: 'DERIVADO', createdAt: '2026-10-27T10:58:00Z', history: historia });
    const derivado = steps.find((s) => s.key === 'notificado');
    expect(derivado.detail).toBe(`Bandeja de ${ORG}`);
    expect(derivado.note).toBeNull();
    expect(steps.find((s) => s.key === 'en_revision').note).toBeNull();
  });

  it('UT-3001-L4: en escritorio el reporte abierto tiene la lista al lado, el encabezado con la categoría y la foto marcada como protegida', async () => {
    escritorio(true);
    getReportDetail.mockResolvedValue({
      success: true,
      data: { ...fila, user_id: OWNER, latitud: -34.6, longitud: -58.4 },
    });
    getReportStateHistory.mockResolvedValue({ success: true, history: historia });
    getReportTakenEvent.mockResolvedValue(null);
    useReportAnalysisLive.mockReturnValue({
      analysis: { result_status_code: 'fundamentado', citizen_feedback: 'Está prohibido.', agencies: { name: 'Tránsito' }, report_ai_evidence: [] },
      loading: false,
      error: null,
      mode: 'realtime',
    });
    render(
      <AuthContext.Provider value={{ user: { id: OWNER }, session: { user: { id: OWNER } }, loading: false }}>
        <MemoryRouter initialEntries={[`/reportes/${ID}`]}>
          <Routes>
            <Route path="/reportes/:id" element={<ReportDetailPage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    );
    const lista = await screen.findByRole('navigation', { name: 'Mis reportes' });
    const actual = await within(lista).findByTestId('report-row');
    expect(actual).toHaveAttribute('aria-current', 'page');
    expect(await screen.findByText('· Infraestructura')).toBeInTheDocument();
    expect(screen.getByText('Foto protegida')).toBeInTheDocument();
    // El seguimiento va antes que el fundamento
    const seguimiento = screen.getByTestId('report-timeline');
    const fundamento = screen.getByTestId('rag-panel');
    expect(seguimiento.compareDocumentPosition(fundamento) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
