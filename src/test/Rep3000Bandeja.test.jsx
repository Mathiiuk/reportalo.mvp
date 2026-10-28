/**
 * @file Rep3000Bandeja.test.jsx
 * @description REP-3000: la bandeja de /panel lista los reportes que la base deja ver al operador (get_panel_inbox),
 * con vacío y error veraces. Cada fila lleva al detalle (REP-3749).
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const rpcMock = vi.fn();
vi.mock('../lib/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: { rpc: (...args) => rpcMock(...args) },
}));

// El panel recibe el operador desde OperatorRoute (REP-3747)
vi.mock('../components/panel/OperatorRoute', () => ({
  useOperator: () => ({ role: 'organismo', agency: { id: 'a1', name: 'Reportalo CABA (organismo de prueba)', is_test: true } }),
}));

import { PanelPage } from '../pages/panel/PanelPage';

const FILA = {
  report_id: '9b182245-0000-0000-0000-000000000000',
  report_code: '#RP-9B182245',
  category: 'Tránsito',
  created_at: '2026-10-25T13:00:00Z',
  zone: 'Balvanera',
  state_code: 'DERIVADO',
  state_label: 'Derivado', // REP-3001: etiqueta unificada
};

const montar = () =>
  render(
    <MemoryRouter>
      <PanelPage />
    </MemoryRouter>
  );

describe('REP-3000 · bandeja en /panel', () => {
  beforeEach(() => rpcMock.mockReset());

  it('UT-3000-F1: lista los reportes con código, categoría, zona y estado, y enlaza al detalle', async () => {
    rpcMock.mockResolvedValue({ data: [FILA], error: null });
    montar();
    const fila = await screen.findByRole('link', { name: /#RP-9B182245/ });
    expect(fila).toHaveAttribute('href', `/panel/reportes/${FILA.report_id}`);
    expect(within(fila).getByText('Tránsito')).toBeInTheDocument();
    expect(within(fila).getByText('Balvanera')).toBeInTheDocument();
    expect(within(fila).getByText('Derivado')).toBeInTheDocument();
    expect(rpcMock).toHaveBeenCalledWith('get_panel_inbox');
  });

  it('UT-3000-F2: bandeja vacía con mensaje veraz', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });
    montar();
    expect(await screen.findByText(/todavía no hay reportes en tu bandeja/i)).toBeInTheDocument();
    expect(screen.getByText(/ningún municipio real recibe estos reportes/i)).toBeInTheDocument();
  });

  it('UT-3000-F3: error de carga con reintento, sin inventar datos', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'network' } });
    rpcMock.mockResolvedValueOnce({ data: [FILA], error: null });
    montar();
    expect(await screen.findByRole('alert')).toHaveTextContent(/no pudimos cargar la bandeja/i);
    expect(screen.queryByRole('link', { name: /#RP-/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(await screen.findByRole('link', { name: /#RP-9B182245/ })).toBeInTheDocument();
  });
});
