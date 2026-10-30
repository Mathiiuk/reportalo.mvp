/**
 * @file Rep3001VistaVecinoV2.test.jsx
 * @description REP-3001 (reglas del panel §6): lo que ve el vecino en «Mis reportes» después de cada decisión del
 * organismo, como en el diseño v2 de Iván (D49 a D52, M42 a M45). Arriba del seguimiento va la respuesta del organismo:
 * el estado, a quién corresponde si se escaló, el motivo textual y qué organismo de prueba lo marcó y cuándo. Nunca
 * dice «Resuelto por el Estado» ni «enviado a»: con un organismo de prueba se aclara que no hubo trámite oficial.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../lib/supabaseClient', () => ({ supabase: {}, isSupabaseConfigured: true }));
vi.mock('../services/reportDetailService', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, getReportDetail: vi.fn(), getReportStateHistory: vi.fn(), getReportTakenEvent: vi.fn() };
});
vi.mock('../hooks/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('../hooks/useReportAnalysisLive', () => ({ useReportAnalysisLive: vi.fn(() => ({ analysis: null, loading: false, error: null, mode: 'realtime' })) }));
vi.mock('../hooks/useReportImageAnalysis', () => ({ useReportImageAnalysis: vi.fn(() => ({ results: [], loading: false })) }));

import { getReportDetail, getReportStateHistory, getReportTakenEvent } from '../services/reportDetailService';
import { useAuth } from '../hooks/useAuth';
import { ReportDetailPage } from '../pages/ReportDetailPage';
import { buildOrganismResponse } from '../components/report/reportStatus';

const ID = 'abcd1234-0000-4000-8000-000000000000';
const OWNER = 'owner-0001';
const ORG = { name: 'Reportalo Avellaneda (organismo de prueba)', is_test: true };

const base = (state, extra = {}) => ({
  id: ID,
  user_id: OWNER,
  description: 'Bache profundo',
  current_state_code: state,
  created_at: '2026-10-27T10:58:00Z',
  latitud: -34.68,
  longitud: -58.36,
  address_street: 'Pasco',
  address_number: '1150',
  localities: { name: 'Gerli' },
  report_images: [],
  ...extra,
});
const historia = (...decisiones) => [
  { state_code: 'EN_ANALISIS', changed_at: '2026-10-27T10:59:00Z', notes: 'Análisis automático en curso', actor_type: 'sistema', agencies: null },
  { state_code: 'DERIVADO', changed_at: '2026-10-27T11:12:00Z', notes: 'Entrega interna al operador de prueba', actor_type: 'sistema', agencies: null },
  ...decisiones,
];
const decision = (state_code, notes, extra = {}) => ({
  state_code,
  changed_at: '2026-10-28T19:40:00Z',
  notes,
  actor_type: 'organismo',
  agencies: ORG,
  ...extra,
});

const montar = ({ report, history, taken = null, user = OWNER }) => {
  useAuth.mockReturnValue({ user: { id: user } });
  getReportDetail.mockResolvedValue({ success: true, data: report });
  getReportStateHistory.mockResolvedValue({ success: true, history });
  getReportTakenEvent.mockResolvedValue(taken);
  return render(
    <MemoryRouter initialEntries={[`/reporte/${ID}`]}>
      <Routes>
        <Route path="/reporte/:id" element={<ReportDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
};

describe('REP-3001 · vista del vecino con el diseño v2 (D49 a D52)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('UT-3001-V1: la respuesta sale de la última decisión del organismo; sin decisión ni derivación, no hay', () => {
    const r = buildOrganismResponse({ currentState: 'RESUELTO', history: historia(decision('RESUELTO', 'Se reparó el 28/10.')) });
    expect(r).toMatchObject({ state: 'resuelto', label: 'Resuelto', reason: 'Se reparó el 28/10.', agency: ORG.name, isTest: true });
    expect(r.date).toMatch(/^\d{2}\/\d{2} · \d{2}:\d{2}$/);
    expect(buildOrganismResponse({ currentState: 'EN_ANALISIS', history: historia().slice(0, 1) })).toBeNull();
  });

  it('UT-3001-V2: Escalado trae a quién corresponde y el contacto; Derivado tomado, la bandeja del organismo', () => {
    const esc = buildOrganismResponse({
      currentState: 'ESCALADO',
      history: historia(decision('ESCALADO', 'Corresponde a la concesionaria.', { escalated_to: 'AUSA', escalated_contact: 'contacto@ausa.ar' })),
    });
    expect(esc).toMatchObject({ state: 'escalado', escalatedTo: 'AUSA', contact: 'contacto@ausa.ar' });
    const der = buildOrganismResponse({ currentState: 'DERIVADO', history: historia(), taken: { taken_at: '2026-10-28T13:14:00Z', agency: ORG.name } });
    expect(der).toMatchObject({ state: 'notificado', label: 'Derivado', summary: `Llegó a la bandeja de ${ORG.name}.`, reason: null });
  });

  it('UT-3001-V3: Resuelto muestra el motivo textual, quién y cuándo, y la aclaración de prueba (D50)', async () => {
    montar({ report: base('RESUELTO'), history: historia(decision('RESUELTO', 'Se reparó el 28/10.')) });
    const card = await screen.findByRole('region', { name: 'Respuesta del organismo' });
    expect(within(card).getByText('Resuelto')).toBeInTheDocument();
    expect(within(card).getByText('«Se reparó el 28/10.»')).toBeInTheDocument();
    expect(within(card).getByText(new RegExp(`^${ORG.name.replace(/[()]/g, '\\$&')} · \\d{2}/\\d{2} · \\d{2}:\\d{2}$`))).toBeInTheDocument();
    expect(within(card).getByText(`Staging: lo marcó la cuenta de prueba de ${ORG.name}.`)).toBeInTheDocument();
    expect(card.textContent).not.toMatch(/por el Estado/i);
    // El motivo no se repite en el seguimiento
    expect(within(screen.getByTestId('report-timeline')).queryByText(/Se reparó el 28\/10/)).not.toBeInTheDocument();
  });

  it('UT-3001-V4: Escalado dice a quién corresponde, sin «enviado a» (D51)', async () => {
    montar({
      report: base('ESCALADO'),
      history: historia(decision('ESCALADO', 'Corresponde a la concesionaria de la autopista.', { escalated_to: 'Concesionaria de la autopista' })),
    });
    const card = await screen.findByRole('region', { name: 'Respuesta del organismo' });
    expect(within(card).getByText('Corresponde a: Concesionaria de la autopista')).toBeInTheDocument();
    expect(within(card).getByText('«Corresponde a la concesionaria de la autopista.»')).toBeInTheDocument();
    expect(within(card).getByText(`Staging: ${ORG.name} registró a quién corresponde, pero el reporte no se envió.`)).toBeInTheDocument();
    expect(card.textContent).not.toMatch(/enviado a/i);
  });

  it('UT-3001-V5: Desestimado ofrece hacer un reporte nuevo (D52)', async () => {
    montar({ report: base('DESESTIMADO'), history: historia(decision('DESESTIMADO', 'La foto no muestra un problema en la vía pública.')) });
    const card = await screen.findByRole('region', { name: 'Respuesta del organismo' });
    expect(within(card).getByText('Desestimado')).toBeInTheDocument();
    expect(within(card).getByText('Si el problema sigue, podés hacer un reporte nuevo con otra foto.')).toBeInTheDocument();
  });

  it('UT-3001-V6: Derivado y tomado: llegó a la bandeja del organismo (D49)', async () => {
    montar({ report: base('DERIVADO'), history: historia(), taken: { taken_at: '2026-10-28T13:14:00Z', agency: ORG.name } });
    const card = await screen.findByRole('region', { name: 'Respuesta del organismo' });
    expect(within(card).getByText('Derivado')).toBeInTheDocument();
    expect(within(card).getByText(`Llegó a la bandeja de ${ORG.name}.`)).toBeInTheDocument();
  });

  it('UT-3001-V7: el autor ve que la altura no se publica; un tercero no ve la respuesta ni esa aclaración', async () => {
    const { unmount } = montar({ report: base('RESUELTO'), history: historia(decision('RESUELTO', 'Listo.')) });
    expect(await screen.findByText('Vos ves calle y altura. En el mapa público se ve sin altura.')).toBeInTheDocument();
    unmount();
    montar({ report: base('RESUELTO', { user_id: 'otra-persona' }), history: historia(decision('RESUELTO', 'Listo.')), user: 'tercero' });
    await screen.findByTestId('report-timeline');
    expect(screen.queryByRole('region', { name: 'Respuesta del organismo' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Vos ves calle y altura/)).not.toBeInTheDocument();
  });
});
