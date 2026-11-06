/**
 * @file Rep3844OnboardingPorDispositivo.test.jsx
 * @description REP-3844: el onboarding se recuerda por dispositivo/navegador (contrato de REP-3519, postura de
 * Matías del 06/11). Si se hace en el celular y después se entra por la PC, la PC lo muestra de nuevo con su propio
 * texto. En el mismo navegador no se repite aunque se cierre sesión, y avanzar solo con «Siguiente» no cuenta como
 * completarlo. UT-OB-03 y UT-OB-04 (OnboardingFlow.test.jsx) ya cubren que «Saltar» y «Empezar» lo guardan.
 */
import React, { useEffect } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

const ONBOARDING_KEY = 'reportalo_onboarding_completed';
const PERMISSIONS_KEY = 'reportalo_permissions_configured';

// Supabase simulado: perfil de vecino (no operador), consentimiento vacío y un auth mínimo para cerrar sesión
const signOutMock = vi.fn(async () => ({ error: null }));
vi.mock('../lib/supabaseClient', () => {
  const query = () => {
    const q = {
      select: () => q,
      eq: () => q,
      order: () => q,
      limit: () => q,
      maybeSingle: async () => ({ data: { role: 'ciudadano', agency: null }, error: null }),
    };
    return q;
  };
  return {
    isSupabaseConfigured: true,
    supabase: {
      from: query,
      rpc: async () => ({ data: [], error: null }),
      auth: {
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        getSession: async () => ({ data: { session: { user: { id: 'u1', email: 'vecino@prueba.ar' } } }, error: null }),
        signOut: (...args) => signOutMock(...args),
      },
    },
  };
});

import { AppRoutes } from '../App';
import { AuthContext, AuthProvider } from '../context/AuthContext';
import { useAuth } from '../hooks/useAuth';
import { OnboardingPage } from '../pages/OnboardingPage';
import { clearResumePath } from '../lib/sessionMarker';

// Dirección en la que terminó la app (las pantallas se cargan en diferido)
const Ruta = () => <span data-testid="ruta">{useLocation().pathname}</span>;

const sesion = { session: { user: { id: 'u1' } }, user: { id: 'u1', email: 'vecino@prueba.ar' }, loading: false, signOut: vi.fn() };

// Entra con sesión de vecino por /login, como vuelve el enlace mágico o Google
const entrar = () =>
  render(
    <AuthContext.Provider value={sesion}>
      <MemoryRouter initialEntries={['/login']}>
        <AppRoutes />
        <Ruta />
      </MemoryRouter>
    </AuthContext.Provider>
  );

describe('REP-3844 · el onboarding se recuerda por dispositivo', () => {
  beforeEach(() => {
    localStorage.clear();
    clearResumePath();
    signOutMock.mockClear();
  });

  it('UT-3844-01 (A): cerrar sesión no borra el onboarding completado en ese navegador', async () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    // Cierra la sesión apenas monta, con el signOut real del AuthProvider
    const Cerrar = () => {
      const { signOut } = useAuth();
      useEffect(() => {
        signOut();
      }, [signOut]);
      return null;
    };
    render(
      <AuthProvider>
        <Cerrar />
      </AuthProvider>
    );
    await waitFor(() => expect(signOutMock).toHaveBeenCalled());
    expect(localStorage.getItem(ONBOARDING_KEY)).toBe('true');
  });

  it('UT-3844-02 (A): al volver a entrar en el mismo navegador no se repite el onboarding', async () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    entrar();
    // Sigue a los permisos (pendientes en este navegador), no al tutorial
    await waitFor(() => expect(screen.getByTestId('ruta')).toHaveTextContent('/permisos'));
  });

  it('UT-3844-03 (C): en un dispositivo o navegador nuevo, la misma cuenta ve el onboarding', async () => {
    // Sin nada guardado en este navegador: lo que la cuenta hizo en otro equipo no cuenta acá
    entrar();
    await waitFor(() => expect(screen.getByTestId('ruta')).toHaveTextContent('/onboarding'));
  });

  it('UT-3844-04 (D): avanzar solo con «Siguiente» y salir antes del final no lo marca como completado', async () => {
    const { unmount } = render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/i }));
    await screen.findByRole('heading', { name: /Tu foto se protege sola/i });
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/i }));
    await screen.findByRole('button', { name: /Empezar/i });
    // Cierra la app en el paso 3 sin tocar «Empezar» ni «Saltar»
    unmount();
    expect(localStorage.getItem(ONBOARDING_KEY)).toBeNull();
    expect(localStorage.getItem(PERMISSIONS_KEY)).toBeNull();
  });
});
