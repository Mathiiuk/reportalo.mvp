/**
 * @file Rep3747ModoOscuroPanel.test.jsx
 * @description REP-3747 · Modo oscuro del panel, como en el diseño v2 de Iván (botón en la cabecera, LEEME §4.9).
 * Vale solo para el panel: la app del vecino sigue con su conmutador apagado (THEME_TOGGLE_ENABLED) y no se toca
 * su preferencia. Se recuerda en el dispositivo y se aplica en todas las pestañas abiertas del panel.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../lib/supabaseClient', () => ({ isSupabaseConfigured: true, supabase: { auth: { signInWithOtp: vi.fn() } } }));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ session: null, user: null, loading: false }) }));

import { PanelLoginPage } from '../pages/panel/PanelLoginPage';
import { PANEL_THEME_KEY } from '../components/panel/PanelShell';

const montar = () =>
  render(
    <MemoryRouter>
      <PanelLoginPage />
    </MemoryRouter>
  );
const raiz = () => document.querySelector('.op-panel');

describe('REP-3747 · modo oscuro del panel', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('UT-3747-O1: arranca en claro y el botón de la cabecera lo pasa a oscuro y vuelve', () => {
    montar();
    expect(raiz()).toHaveAttribute('data-theme', 'light');
    fireEvent.click(screen.getByRole('button', { name: 'Activar modo oscuro' }));
    expect(raiz()).toHaveAttribute('data-theme', 'dark');
    fireEvent.click(screen.getByRole('button', { name: 'Activar modo claro' }));
    expect(raiz()).toHaveAttribute('data-theme', 'light');
  });

  it('UT-3747-O2: se recuerda en el dispositivo y no toca el tema de la app del vecino', () => {
    const { unmount } = montar();
    fireEvent.click(screen.getByRole('button', { name: 'Activar modo oscuro' }));
    expect(localStorage.getItem(PANEL_THEME_KEY)).toBe('dark');
    expect(localStorage.getItem('reportalo_theme')).toBeNull();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    unmount();
    montar();
    expect(raiz()).toHaveAttribute('data-theme', 'dark');
  });

  it('UT-3747-O3: el cambio hecho en otra pestaña se aplica en esta', () => {
    montar();
    act(() => {
      localStorage.setItem(PANEL_THEME_KEY, 'dark');
      window.dispatchEvent(new StorageEvent('storage', { key: PANEL_THEME_KEY, newValue: 'dark' }));
    });
    expect(raiz()).toHaveAttribute('data-theme', 'dark');
  });
});
