/**
 * @file Rep3001Acciones.test.jsx
 * @description REP-3001: acciones del operador en el detalle del panel. La pantalla ofrece solo lo que la base dice que
 * se puede (`actions`), pide siempre el motivo, y en el escalado también a quién. Los errores se muestran tal cual.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const rpcMock = vi.fn();
vi.mock('../lib/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: {
    rpc: (...args) => rpcMock(...args),
    storage: { from: () => ({ createSignedUrls: async () => ({ data: [], error: null }) }) },
  },
}));

vi.mock('../components/panel/OperatorRoute', () => ({
  useOperator: () => ({ role: 'organismo', agency: { id: 'a1', name: 'Reportalo CABA (organismo de prueba)', is_test: true } }),
}));

import { PanelReportDetailPage } from '../pages/panel/PanelReportDetailPage';

const ID = '9b182245-aaaa-bbbb-cccc-000000000000';
const BASE = {
  report_id: ID,
  report_code: '#RP-9B182245',
  case_number: 42,
  created_at: '2026-10-25T13:00:00Z',
  category: 'Tránsito',
  state_code: 'DERIVADO',
  state_label: 'Derivado',
  description: 'Bache',
  images: [],
  foundation: { status: 'pendiente' },
  actions: ['DESESTIMADO', 'EN_DISCREPANCIA', 'ESCALADO', 'RESUELTO'],
  taken: null,
  history: [{ state_code: 'DERIVADO', state_label: 'Derivado', changed_at: '2026-10-25T14:00:00Z', notes: 'Entrega interna' }],
};

// Responde según la RPC: el detalle cambia después de una acción exitosa
const responder = ({ detalle = BASE, despues = BASE, accion = { ok: true } } = {}) => {
  let hecho = false;
  rpcMock.mockImplementation(async (nombre) => {
    if (nombre === 'get_panel_report_detail') return { data: hecho ? despues : detalle, error: null };
    hecho = true;
    return { data: accion, error: null };
  });
};

const montar = () =>
  render(
    <MemoryRouter initialEntries={[`/panel/reportes/${ID}`]}>
      <Routes>
        <Route path="/panel/reportes/:id" element={<PanelReportDetailPage />} />
      </Routes>
    </MemoryRouter>
  );

describe('REP-3001 · acciones del operador', () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it('UT-3001-F1: «Tomar el caso» llama a take_report y deja el reporte Derivado, con quién y cuándo', async () => {
    responder({
      despues: { ...BASE, taken: { taken_at: '2026-10-26T10:00:00Z', agency: 'Reportalo CABA (organismo de prueba)' } },
      accion: { ok: true, taken_at: '2026-10-26T10:00:00Z' },
    });
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Tomar el caso' }));
    await waitFor(() => expect(rpcMock).toHaveBeenCalledWith('take_report', { p_report_id: ID }));
    expect(await screen.findByText(/tomado por reportalo caba \(organismo de prueba\)/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tomar el caso' })).not.toBeInTheDocument();
    expect(screen.getAllByText('Derivado').length).toBeGreaterThan(0);
  });

  it('UT-3001-F2: Rechazar → Escalar pide a quién y por qué, y manda los dos a la base', async () => {
    responder();
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Rechazar' }));
    fireEvent.click(screen.getByLabelText(/corresponde a otro organismo o área/i));
    const confirmar = screen.getByRole('button', { name: 'Confirmar' });
    expect(confirmar).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/motivo/i), { target: { value: 'Es una autopista' } });
    expect(confirmar).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/a qué organismo o área/i), { target: { value: 'Concesionaria AUSA' } });
    fireEvent.click(confirmar);
    await waitFor(() =>
      expect(rpcMock).toHaveBeenCalledWith('change_report_state', {
        p_report_id: ID,
        p_to_state: 'ESCALADO',
        p_reason: 'Es una autopista',
        p_escalated_to: 'Concesionaria AUSA',
      })
    );
  });

  it('UT-3001-F3: Rechazar → Desestimado y → En discrepancia exigen motivo', async () => {
    responder();
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Rechazar' }));
    expect(screen.getByLabelText(/lo reportado no coincide/i)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/no hay reclamo o está mal formulado/i));
    expect(screen.queryByLabelText(/a qué organismo o área/i)).not.toBeInTheDocument();
    const confirmar = screen.getByRole('button', { name: 'Confirmar' });
    fireEvent.change(screen.getByLabelText(/motivo/i), { target: { value: '   ' } });
    expect(confirmar).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/motivo/i), { target: { value: 'La foto muestra un gato' } });
    fireEvent.click(confirmar);
    await waitFor(() =>
      expect(rpcMock).toHaveBeenCalledWith('change_report_state', {
        p_report_id: ID,
        p_to_state: 'DESESTIMADO',
        p_reason: 'La foto muestra un gato',
        p_escalated_to: null,
      })
    );
  });

  it('UT-3001-F4: «Marcar resuelto» pide motivo y el botón queda deshabilitado mientras se guarda', async () => {
    let liberar;
    rpcMock.mockImplementation((nombre) =>
      nombre === 'get_panel_report_detail'
        ? Promise.resolve({ data: BASE, error: null })
        : new Promise((ok) => {
            liberar = () => ok({ data: { ok: true }, error: null });
          })
    );
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Marcar resuelto' }));
    fireEvent.change(screen.getByLabelText(/motivo/i), { target: { value: 'Se reparó el 28/10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByRole('button', { name: 'Guardando...' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Guardando...' }));
    expect(rpcMock.mock.calls.filter(([n]) => n === 'change_report_state')).toHaveLength(1);
    liberar();
    expect(await screen.findByRole('status')).toHaveTextContent(/el cambio quedó registrado/i);
  });

  it('UT-3001-F5: un error de la base se muestra claro y el estado no cambia en pantalla', async () => {
    responder({ accion: { ok: false, code: 'transicion_no_definida', current_state: 'RESUELTO' } });
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Marcar resuelto' }));
    fireEvent.change(screen.getByLabelText(/motivo/i), { target: { value: 'Listo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/el reporte ya cambió de estado/i);
  });

  it('UT-3001-F6: caso cerrado (Resuelto o Desestimado): sin acciones y con el aviso de que no se revierte', async () => {
    responder({ detalle: { ...BASE, state_code: 'RESUELTO', state_label: 'Resuelto', actions: [] } });
    montar();
    expect(await screen.findByText(/no se revierte desde el panel/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tomar el caso' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rechazar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Marcar resuelto' })).not.toBeInTheDocument();
  });

  it('UT-3001-F7: desde Escalado solo se ofrece lo que permite el catálogo (sin En discrepancia ni Tomar)', async () => {
    responder({ detalle: { ...BASE, state_code: 'ESCALADO', state_label: 'Escalado', actions: ['DESESTIMADO', 'RESUELTO'] } });
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Rechazar' }));
    expect(screen.queryByRole('button', { name: 'Tomar el caso' })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/no hay reclamo o está mal formulado/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/lo reportado no coincide/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/corresponde a otro organismo o área/i)).not.toBeInTheDocument();
  });

  it('UT-3001-F8: el historial muestra estado, fecha, motivo y destino del escalado', async () => {
    responder({
      detalle: {
        ...BASE,
        state_code: 'ESCALADO',
        state_label: 'Escalado',
        actions: ['DESESTIMADO', 'RESUELTO'],
        history: [
          ...BASE.history,
          { state_code: 'ESCALADO', state_label: 'Escalado', changed_at: '2026-10-27T10:00:00Z', notes: 'Es una autopista', escalated_to: 'AUSA' },
        ],
      },
    });
    montar();
    expect(await screen.findByText(/«Es una autopista»/)).toBeInTheDocument();
    expect(screen.getByText(/corresponde a: AUSA/i)).toBeInTheDocument();
  });
});
