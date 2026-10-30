/**
 * @file Rep3747IngresoDirecto.test.jsx
 * @description REP-3747 (Matías, 29/10): una cuenta de organismo va directo a /panel aunque entre por el login del
 * vecino (Google y el enlace vuelven a /onboarding). Un vecino sigue su recorrido de siempre.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

// Dirección en la que terminó la app (las pantallas se cargan en diferido: el texto puede llegar tarde)
const Ruta = () => <span data-testid="ruta">{useLocation().pathname}</span>;

const fromMock = vi.fn();
vi.mock('../lib/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: { from: (...args) => fromMock(...args), rpc: async () => ({ data: [], error: null }) },
}));

import { AppRoutes } from '../App';
import { clearResumePath, getResumePath, saveResumePath } from '../lib/sessionMarker';

const perfil = (fila) =>
  fromMock.mockImplementation(() => {
    const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: fila, error: null }) };
    return q;
  });

const OPERADOR = { role: 'organismo', agency: { id: 'a1', name: 'Reportalo CABA (organismo de prueba)', code: 'reportalo_caba', is_test: true } };
const sesion = { session: { user: { id: 'u1' } }, user: { id: 'u1', email: 'op@prueba.ar' }, loading: false, signOut: vi.fn() };

const montar = (entrada) =>
  render(
    <AuthContext.Provider value={sesion}>
      <MemoryRouter initialEntries={[entrada]}>
        <AppRoutes />
        <Ruta />
      </MemoryRouter>
    </AuthContext.Provider>
  );

describe('REP-3747 · el operador entra directo al panel', () => {
  beforeEach(() => {
    fromMock.mockReset();
    clearResumePath();
    localStorage.removeItem('reportalo_onboarding_completed');
    localStorage.removeItem('reportalo_permissions_configured');
  });

  it('UT-3747-D1: después del login del vecino (/onboarding), una cuenta de organismo va a /panel sin onboarding', async () => {
    perfil(OPERADOR);
    montar('/onboarding');
    expect((await screen.findAllByText('Reportalo CABA (organismo de prueba)')).length).toBeGreaterThan(0);
  });

  it('UT-3747-D2: con sesión de organismo, /login y la bienvenida llevan al panel', async () => {
    perfil(OPERADOR);
    montar('/login');
    expect((await screen.findAllByText('Reportalo CABA (organismo de prueba)')).length).toBeGreaterThan(0);
  });

  it('UT-3747-D3: un vecino sigue su recorrido (onboarding), sin pasar por el panel', async () => {
    perfil({ role: 'ciudadano', agency: null });
    montar('/onboarding');
    await waitFor(() => expect(fromMock).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText(/cargando reportalo/i)).not.toBeInTheDocument());
    expect(screen.queryByText('Reportalo CABA (organismo de prueba)')).not.toBeInTheDocument();
  });

  // Matías, 30/10: abrió /panel sin sesión en ese navegador, después entró como vecino con Google y la app lo llevó
  // al panel, que le mostró «Error 403 - Acceso Denegado». La dirección guardada del panel es solo para operadores.
  it('UT-3747-D4: un vecino con una dirección del panel guardada sigue su recorrido y la dirección se borra', async () => {
    saveResumePath('/panel');
    perfil({ role: 'ciudadano', agency: null });
    montar('/onboarding');
    await waitFor(() => expect(fromMock).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText(/cargando reportalo|verificando tu acceso/i)).not.toBeInTheDocument());
    // Nunca pasa por el panel ni por el 403
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByTestId('ruta').textContent).toBe('/onboarding');
    expect(screen.queryByText(/acceso denegado/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Reportalo CABA (organismo de prueba)')).not.toBeInTheDocument();
    expect(getResumePath()).toBeNull();
  });

  it('UT-3747-D5: un operador con una dirección del panel guardada vuelve ahí, no al inicio del panel', async () => {
    saveResumePath('/panel?f=cerrados');
    perfil(OPERADOR);
    montar('/onboarding');
    await waitFor(async () => {
      const botones = await screen.findAllByRole('button', { name: /cerrados/i });
      expect(botones.some((b) => b.getAttribute('aria-pressed') === 'true')).toBe(true);
    });
  });
});
