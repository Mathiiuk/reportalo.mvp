/**
 * @file Rep3747PanelRoute.test.jsx
 * @description REP-3747: la ruta /panel deja entrar solo a operadores de un organismo de prueba. El guard es de
 * experiencia de uso: la autorización real la hace la base (RLS). El perfil se lee de `profiles`, que solo devuelve
 * la fila propia.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const fromMock = vi.fn();
vi.mock('../lib/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: { from: (...args) => fromMock(...args) },
}));

import { OperatorRoute } from '../components/panel/OperatorRoute';
import { PanelPage } from '../pages/panel/PanelPage';
import { getResumePath, clearResumePath } from '../lib/sessionMarker';

const sesion = (id) => ({ session: { user: { id } }, user: { id }, loading: false });

// Simula la fila propia de profiles (con su organismo embebido) y registra qué se pidió
let pedido = {};
const perfil = (fila, error = null) => {
  fromMock.mockImplementation((tabla) => {
    pedido = { tabla };
    const q = {
      select: (cols) => ((pedido.cols = cols), q),
      eq: (col, val) => ((pedido.eq = [col, val]), q),
      maybeSingle: async () => ({ data: fila, error }),
    };
    return q;
  });
};

const RutaActual = () => <span data-testid="ruta">{useLocation().pathname}</span>;

const montar = (auth, entrada = '/panel') =>
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[entrada]}>
        <Routes>
          <Route
            path="/panel"
            element={
              <OperatorRoute>
                <PanelPage />
              </OperatorRoute>
            }
          />
          <Route path="*" element={<RutaActual />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );

describe('REP-3747 · ruta /panel', () => {
  beforeEach(() => {
    fromMock.mockReset();
    clearResumePath();
    pedido = {};
  });

  it('UT-3747-F1: un operador de prueba ve el panel de su organismo', async () => {
    perfil({ role: 'organismo', agency: { id: 'a1', name: 'Reportalo CABA (organismo de prueba)', code: 'reportalo_caba', is_test: true } });
    montar(sesion('op-1'));
    expect(await screen.findByRole('heading', { name: /panel de organismos/i })).toBeInTheDocument();
    expect(screen.getByText('Reportalo CABA (organismo de prueba)')).toBeInTheDocument();
    // Lee solo la fila propia
    expect(pedido.tabla).toBe('profiles');
    expect(pedido.eq).toEqual(['id', 'op-1']);
  });

  it('UT-3747-F2: un ciudadano va a /acceso-restringido (caso 6 PO)', async () => {
    perfil({ role: 'ciudadano', agency: null });
    montar(sesion('vecino-1'));
    await waitFor(() => expect(screen.getByTestId('ruta')).toHaveTextContent('/acceso-restringido'));
  });

  it('UT-3747-F3: un perfil organismo sin organismo vinculado tampoco entra', async () => {
    perfil({ role: 'organismo', agency: null });
    montar(sesion('op-2'));
    await waitFor(() => expect(screen.getByTestId('ruta')).toHaveTextContent('/acceso-restringido'));
  });

  it('UT-3747-F4: sin sesión pide login y guarda /panel para volver después', async () => {
    montar({ session: null, user: null, loading: false });
    await waitFor(() => expect(screen.getByTestId('ruta')).toHaveTextContent('/login'));
    expect(getResumePath()).toBe('/panel');
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('UT-3747-F6: después del login vuelve a /panel sin pasar por el onboarding del vecino', async () => {
    const { AppRoutes } = await import('../App');
    const { saveResumePath } = await import('../lib/sessionMarker');
    perfil({ role: 'organismo', agency: { id: 'a2', name: 'Reportalo Avellaneda (organismo de prueba)', code: 'reportalo_avellaneda', is_test: true } });
    localStorage.removeItem('reportalo_onboarding_completed');
    saveResumePath('/panel');
    render(
      <AuthContext.Provider value={sesion('op-4')}>
        <MemoryRouter initialEntries={['/onboarding']}>
          <AppRoutes />
        </MemoryRouter>
      </AuthContext.Provider>
    );
    expect(await screen.findByText('Reportalo Avellaneda (organismo de prueba)')).toBeInTheDocument();
    await waitFor(() => expect(getResumePath()).toBeNull());
  });

  it('UT-3747-F5: si falla la lectura del perfil, muestra el error y no deja pasar', async () => {
    perfil(null, { message: 'network' });
    montar(sesion('op-3'));
    expect(await screen.findByRole('alert')).toHaveTextContent(/no pudimos verificar tu acceso/i);
    expect(screen.queryByRole('heading', { name: /panel de organismos/i })).not.toBeInTheDocument();
  });
});
