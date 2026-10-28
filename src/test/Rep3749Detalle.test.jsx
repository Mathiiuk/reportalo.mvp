/**
 * @file Rep3749Detalle.test.jsx
 * @description REP-3749: pantalla del detalle del reporte para el operador. Muestra solo lo que devuelve la base
 * (get_panel_report_detail), con la leyenda de sanciones del PO y mensajes veraces cuando falta algo.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const rpcMock = vi.fn();
vi.mock('../lib/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: {
    rpc: (...args) => rpcMock(...args),
    storage: {
      from: () => ({
        createSignedUrls: async (paths) => ({ data: paths.map((path) => ({ path, signedUrl: `https://firmada/${path}` })), error: null }),
      }),
    },
  },
}));

vi.mock('../components/panel/OperatorRoute', () => ({
  useOperator: () => ({ role: 'organismo', agency: { id: 'a1', name: 'Reportalo CABA (organismo de prueba)', is_test: true } }),
}));

import { PanelReportDetailPage } from '../pages/panel/PanelReportDetailPage';

const CITA_NORMA = {
  reference: 'Ley 451 (CABA) — Art. 6.1.37',
  document_type: 'ley',
  document_number: '451',
  source_title: 'Régimen de Faltas',
  quoted_text: 'El/la conductor/a de un vehículo que cause la obstrucción...',
  source_url: 'https://boletinoficial.buenosaires.gob.ar/x',
  foundation_type: 'conducta_prohibida',
};
const CITA_SANCION = { ...CITA_NORMA, reference: 'Ley 451 — Art. 6.1.38', quoted_text: 'Multa de 100 a 500 unidades fijas', foundation_type: 'sancion' };

const DETALLE = {
  report_id: '9b182245-aaaa-bbbb-cccc-000000000000',
  report_code: '#RP-9B182245',
  case_number: 42,
  created_at: '2026-10-25T13:00:00Z',
  category: 'Tránsito',
  state_code: 'DERIVADO',
  state_label: 'Derivado al organismo',
  description: 'Camión sobre la vereda, llamar al [teléfono oculto]',
  locality: 'Caballito',
  subdivision: 'Comuna 6',
  latitud: -34.6043,
  longitud: -58.4395,
  address_street: 'Avenida Rivadavia',
  address_number: '5000',
  images: [{ id: 'img-1', image_url: 'https://x/storage/v1/object/public/report-evidences/csid/foto.webp' }],
  foundation: { status: 'fundamento_preliminar', citations: [CITA_NORMA, CITA_SANCION], disclaimer: 'Fundamento preliminar...' },
};

const montar = () =>
  render(
    <MemoryRouter initialEntries={[`/panel/reportes/${DETALLE.report_id}`]}>
      <Routes>
        <Route path="/panel/reportes/:id" element={<PanelReportDetailPage />} />
      </Routes>
    </MemoryRouter>
  );

describe('REP-3749 · detalle del reporte en el panel', () => {
  beforeEach(() => rpcMock.mockReset());

  it('UT-3749-F1: muestra caso, categoría, estado, dirección completa, descripción filtrada, fotos firmadas y fundamento', async () => {
    rpcMock.mockResolvedValue({ data: DETALLE, error: null });
    montar();
    expect(await screen.findByRole('heading', { name: /caso n° 00042/i })).toBeInTheDocument();
    expect(rpcMock).toHaveBeenCalledWith('get_panel_report_detail', { p_report_id: DETALLE.report_id });
    expect(screen.getByText('#RP-9B182245')).toBeInTheDocument();
    expect(screen.getByText('Tránsito')).toBeInTheDocument();
    expect(screen.getByText('Derivado al organismo')).toBeInTheDocument();
    expect(screen.getByText('Avenida Rivadavia 5000')).toBeInTheDocument();
    expect(screen.getByText(/\[teléfono oculto\]/)).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: /foto anonimizada 1/i })).toHaveAttribute('src', 'https://firmada/csid/foto.webp');
    expect(screen.getByText('Ley 451 (CABA) — Art. 6.1.37')).toBeInTheDocument();
  });

  it('UT-3749-F2: la sanción lleva la leyenda del PO', async () => {
    rpcMock.mockResolvedValue({ data: DETALLE, error: null });
    montar();
    expect(await screen.findByText(/multa de 100 a 500 unidades fijas/i)).toBeInTheDocument();
    expect(screen.getByText('Sanción prevista por la norma; Reportalo no aplica sanciones.')).toBeInTheDocument();
    expect(screen.queryByText(/la norma no registra sanción/i)).not.toBeInTheDocument();
  });

  it('UT-3749-F3: sin sanción citada → «La norma no registra sanción»; sin dirección → «Dirección no disponible»', async () => {
    rpcMock.mockResolvedValue({
      data: { ...DETALLE, address_street: null, address_number: null, foundation: { ...DETALLE.foundation, citations: [CITA_NORMA] } },
      error: null,
    });
    montar();
    expect(await screen.findByText('La norma no registra sanción.')).toBeInTheDocument();
    expect(screen.getByText('Dirección no disponible')).toBeInTheDocument();
  });

  it('UT-3749-F4: fundamento pendiente o sin verificar se dice tal cual, sin citas inventadas', async () => {
    rpcMock.mockResolvedValue({ data: { ...DETALLE, foundation: { status: 'pendiente', citations: [] } }, error: null });
    montar();
    expect(await screen.findByText(/el análisis todavía no terminó/i)).toBeInTheDocument();
    expect(screen.queryByText(/la norma no registra sanción/i)).not.toBeInTheDocument();
  });

  it('UT-3749-F5: reporte ajeno o inexistente → «no está disponible para tu organismo» (caso 5 PO)', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });
    montar();
    expect(await screen.findByText('Este reporte no está disponible para tu organismo.')).toBeInTheDocument();
    expect(screen.queryByText('#RP-9B182245')).not.toBeInTheDocument();
  });

  it('UT-3749-F6: error de carga con reintento', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'network' } });
    rpcMock.mockResolvedValueOnce({ data: DETALLE, error: null });
    montar();
    expect(await screen.findByRole('alert')).toHaveTextContent(/no pudimos cargar el reporte/i);
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(await screen.findByRole('heading', { name: /caso n° 00042/i })).toBeInTheDocument();
  });
});
