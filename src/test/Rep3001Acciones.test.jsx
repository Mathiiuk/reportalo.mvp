/**
 * @file Rep3001Acciones.test.jsx
 * @description REP-3001: acciones del operador con el diseño de Iván (LEEME §5.3). Conserva los requisitos de la
 * pantalla anterior: lo que se puede hacer sale del catálogo (`actions`), el motivo es obligatorio, el escalado pide a
 * quién (y ahora un contacto opcional) y los rechazos de la base se muestran claros.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { email: 'operador@prueba.ar' }, signOut: vi.fn() }) }));

import { PanelPage } from '../pages/panel/PanelPage';

const ID = '9b182245-aaaa-bbbb-cccc-000000000000';
const AGENCIA = 'Reportalo CABA (organismo de prueba)';
const CITA_NORMA = { reference: 'Ley 451 (CABA) — Art. 6.1.54', quoted_text: 'estacione sobre las aceras', source_url: 'https://bo/x', foundation_type: 'conducta_prohibida' };
const CITA_SANCION = { reference: 'Ley 451 — Art. 6.1.55', quoted_text: 'Multa de 100 a 500 unidades fijas', foundation_type: 'sancion' };
const img = (n) => ({ id: `img-${n}`, image_url: `https://x/storage/v1/object/public/report-evidences/csid/f${n}.webp` });

const BASE = {
  report_id: ID,
  report_code: '#RP-9B182245',
  case_number: 42,
  created_at: '2026-10-25T13:00:00Z',
  category: 'Tránsito',
  state_code: 'DERIVADO',
  state_label: 'Derivado',
  description: 'Auto sobre la vereda, llamar al [teléfono oculto]',
  locality: 'Caballito',
  subdivision: 'Comuna 6',
  latitud: -34.6043,
  longitud: -58.4395,
  address_street: 'Avenida Rivadavia',
  address_number: '5000',
  address_road_type: 'avenida',
  images: [img(1)],
  foundation: { status: 'fundamento_preliminar', citations: [CITA_NORMA, CITA_SANCION], disclaimer: 'Fundamento preliminar...' },
  actions: ['DESESTIMADO', 'EN_DISCREPANCIA', 'ESCALADO', 'RESUELTO'],
  taken: null,
  history: [
    { state_code: 'EN_ANALISIS', changed_at: '2026-10-25T13:01:00Z', notes: 'Análisis automático en curso', actor_type: 'sistema', agency: null },
    { state_code: 'DERIVADO', changed_at: '2026-10-25T14:00:00Z', notes: 'Entrega interna al operador de prueba', actor_type: 'sistema', agency: null },
  ],
};

// La RPC del detalle devuelve `detalle` hasta que una acción sale bien; después, `despues`
const responder = ({ detalle = BASE, despues = detalle, accion = { ok: true }, bandeja = [] } = {}) => {
  let hecho = false;
  rpcMock.mockImplementation(async (nombre) => {
    if (nombre === 'get_panel_inbox') return { data: bandeja, error: null };
    if (nombre === 'get_panel_report_detail') return { data: hecho ? despues : detalle, error: null };
    if (accion?.ok) hecho = true;
    return { data: accion, error: null };
  });
};

const montar = () =>
  render(
    <MemoryRouter initialEntries={[`/panel/reportes/${ID}`]}>
      <Routes>
        <Route path="/panel" element={<PanelPage />} />
        <Route path="/panel/reportes/:id" element={<PanelPage />} />
      </Routes>
    </MemoryRouter>
  );

const dialogo = () => screen.getByRole('dialog');

// Una semana después de los hechos: las fechas salen como «el dd/mm», no «hoy» ni «ayer»
const congelar = () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-05T15:00:00Z'));
};

describe('REP-3001 · acciones', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    congelar();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('UT-3001-A1: «Tomar el caso» llama a take_report, sigue Derivado y avisa lo que ve el vecino', async () => {
    responder({ despues: { ...BASE, taken: { taken_at: '2026-10-26T12:00:00Z', agency: AGENCIA } }, accion: { ok: true } });
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Tomar el caso' }));
    await waitFor(() => expect(rpcMock).toHaveBeenCalledWith('take_report', { p_report_id: ID }));
    expect(await screen.findByRole('button', { name: 'Caso tomado' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Tomaste el caso. Sigue Derivado y el vecino ve «El organismo tomó tu reporte».');
  });

  it('UT-3001-A2: Rechazar → Escalado exige destino y motivo; el contacto es opcional y viaja a la base', async () => {
    responder();
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Rechazar' }));
    const d = dialogo();
    fireEvent.click(within(d).getByLabelText(/corresponde a otro organismo o área/i));
    const enviar = within(d).getByRole('button', { name: 'Escalar el reporte' });
    expect(enviar).toBeDisabled();
    fireEvent.change(within(d).getByLabelText(/motivo/i), { target: { value: 'Es una autopista' } });
    expect(enviar).toBeDisabled();
    fireEvent.change(within(d).getByLabelText(/a quién corresponde/i), { target: { value: 'Concesionaria AUSA' } });
    fireEvent.change(within(d).getByLabelText(/contacto del destino/i), { target: { value: 'contacto@ausa.ar' } });
    fireEvent.click(enviar);
    await waitFor(() =>
      expect(rpcMock).toHaveBeenCalledWith('change_report_state', {
        p_report_id: ID,
        p_to_state: 'ESCALADO',
        p_reason: 'Es una autopista',
        p_escalated_to: 'Concesionaria AUSA',
        p_escalated_contact: 'contacto@ausa.ar',
      })
    );
    expect(await screen.findByRole('status')).toHaveTextContent('Reporte escalado a Concesionaria AUSA. El vecino ve el destino y el motivo.');
  });

  it('UT-3001-A3: Desestimado y En discrepancia piden motivo (hasta 500) y avisan lo que corresponde', async () => {
    responder();
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Rechazar' }));
    const d = dialogo();
    fireEvent.click(within(d).getByLabelText(/no hay reclamo o está mal formulado/i));
    expect(within(d).getByText('Un reporte desestimado no se puede revertir desde el panel.')).toBeInTheDocument();
    expect(within(d).queryByLabelText(/a quién corresponde/i)).not.toBeInTheDocument();
    const motivo = within(d).getByLabelText(/motivo/i);
    expect(motivo).toHaveAttribute('maxLength', '500');
    fireEvent.change(motivo, { target: { value: '   ' } });
    expect(within(d).getByRole('button', { name: 'Desestimar' })).toBeDisabled();
    fireEvent.click(within(d).getByLabelText(/lo reportado no coincide/i));
    fireEvent.change(within(d).getByLabelText(/motivo/i), { target: { value: 'No hay bache en esa altura' } });
    expect(within(d).getByText('26/500')).toBeInTheDocument();
    fireEvent.click(within(d).getByRole('button', { name: 'Registrar discrepancia' }));
    await waitFor(() =>
      expect(rpcMock).toHaveBeenCalledWith('change_report_state', expect.objectContaining({ p_to_state: 'EN_DISCREPANCIA', p_reason: 'No hay bache en esa altura', p_escalated_to: null }))
    );
  });

  it('UT-3001-A4: «Marcar resuelto» muestra la transición, pide motivo y se bloquea mientras guarda (sin doble envío)', async () => {
    let liberar;
    rpcMock.mockImplementation((n) => {
      if (n === 'get_panel_inbox') return Promise.resolve({ data: [], error: null });
      if (n === 'get_panel_report_detail') return Promise.resolve({ data: BASE, error: null });
      return new Promise((ok) => {
        liberar = () => ok({ data: { ok: true }, error: null });
      });
    });
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Marcar resuelto' }));
    const d = dialogo();
    expect(within(d).getByText('Un reporte resuelto no se puede revertir desde el panel.')).toBeInTheDocument();
    fireEvent.change(within(d).getByLabelText(/motivo/i), { target: { value: 'Se reparó el 28/10' } });
    fireEvent.click(within(d).getByRole('button', { name: 'Marcar resuelto' }));
    const guardando = await within(d).findByRole('button', { name: /guardando/i });
    expect(guardando).toBeDisabled();
    fireEvent.click(guardando);
    expect(rpcMock.mock.calls.filter(([n]) => n === 'change_report_state')).toHaveLength(1);
    liberar();
    expect(await screen.findByRole('status')).toHaveTextContent('Caso N° 000042 marcado como resuelto. El vecino ya ve el motivo.');
  });

  it('UT-3001-A5: si la base rechaza, el error se ve dentro del diálogo y el diálogo no se cierra', async () => {
    responder({ accion: { ok: false, code: 'transicion_no_definida' } });
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Marcar resuelto' }));
    fireEvent.change(within(dialogo()).getByLabelText(/motivo/i), { target: { value: 'Listo' } });
    fireEvent.click(within(dialogo()).getByRole('button', { name: 'Marcar resuelto' }));
    expect(await within(dialogo()).findByRole('alert')).toHaveTextContent(/el reporte ya cambió de estado/i);
  });

  it('UT-3001-A6: desde Escalado solo se ofrece lo del catálogo (Desestimado y Resuelto), sin Tomar', async () => {
    responder({ detalle: { ...BASE, state_code: 'ESCALADO', state_label: 'Escalado', actions: ['DESESTIMADO', 'RESUELTO'] } });
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Rechazar' }));
    expect(screen.queryByRole('button', { name: 'Tomar el caso' })).not.toBeInTheDocument();
    const d = dialogo();
    expect(within(d).getByLabelText(/no hay reclamo o está mal formulado/i)).toBeChecked();
    expect(within(d).queryByLabelText(/lo reportado no coincide/i)).not.toBeInTheDocument();
    expect(within(d).queryByLabelText(/corresponde a otro organismo o área/i)).not.toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('UT-3001-A7: Resuelto o Desestimado → «Estado final», sin acciones, con la nota de que no se revierte', async () => {
    responder({
      detalle: {
        ...BASE,
        state_code: 'RESUELTO',
        state_label: 'Resuelto',
        actions: [],
        history: [...BASE.history, { state_code: 'RESUELTO', changed_at: '2026-10-28T15:00:00Z', notes: 'Se reparó', actor_type: 'organismo', agency: AGENCIA }],
      },
    });
    montar();
    expect(await screen.findByText('Estado final')).toBeInTheDocument();
    expect(screen.getByText(/Resuelto el 28\/10 · 12:00/)).toBeInTheDocument();
    expect(screen.getByText(/no se revierten desde el panel/i)).toBeInTheDocument();
    for (const n of ['Tomar el caso', 'Rechazar', 'Marcar resuelto']) expect(screen.queryByRole('button', { name: n })).not.toBeInTheDocument();
  });

  it('UT-3001-A8: el historial muestra destino, contacto y motivo del escalado', async () => {
    responder({
      detalle: {
        ...BASE,
        state_code: 'ESCALADO',
        state_label: 'Escalado',
        actions: ['DESESTIMADO', 'RESUELTO'],
        taken: { taken_at: '2026-10-26T12:00:00Z', agency: AGENCIA },
        history: [
          ...BASE.history,
          { state_code: 'ESCALADO', changed_at: '2026-10-27T12:00:00Z', notes: 'Es una autopista', actor_type: 'organismo', agency: AGENCIA, escalated_to: 'AUSA', escalated_contact: 'contacto@ausa.ar' },
        ],
      },
    });
    montar();
    const historial = await screen.findByRole('list', { name: /historial/i });
    const items = within(historial).getAllByRole('listitem');
    expect(items.map((li) => li.querySelector('strong').textContent)).toEqual([
      'Reporte creado',
      'Análisis automático',
      `Entró a la bandeja de ${AGENCIA}`,
      `Tomado por ${AGENCIA}`,
      'Escalado',
    ]);
    const escalado = items[4];
    expect(within(escalado).getByText(AGENCIA)).toBeInTheDocument();
    expect(within(escalado).getByText('AUSA')).toBeInTheDocument();
    expect(within(escalado).getByText('contacto@ausa.ar')).toBeInTheDocument();
    expect(within(escalado).getByText(/«Es una autopista»/)).toBeInTheDocument();
    // Las entradas del sistema no llevan organismo
    expect(within(items[1]).queryByText(AGENCIA)).not.toBeInTheDocument();
  });
});
