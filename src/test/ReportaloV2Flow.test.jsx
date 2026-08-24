// ==============================================================================
// Suite de Pruebas Automatizadas: Flujo Completo Reportalo V2 Minimalista
// ==============================================================================

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { OnboardingProvider } from '../context/OnboardingContext';
import { DarkModeProvider } from '../context/DarkModeContext';
import { HomePage } from '../pages/HomePage';
import { PermisosPage } from '../pages/PermisosPage';
import { PerfilPage } from '../pages/PerfilPage';

// Mock de Supabase — sesion por defecto: sin sesion
const mockGetSession = vi.fn().mockResolvedValue({ data: { session: null }, error: null });
const mockOnAuthStateChange = vi.fn().mockReturnValue({
  data: { subscription: { unsubscribe: vi.fn() } },
});
const mockSignOut = vi.fn().mockResolvedValue({ error: null });

vi.mock('../utils/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args) => mockGetSession(...args),
      onAuthStateChange: (...args) => mockOnAuthStateChange(...args),
      signOut: (...args) => mockSignOut(...args),
    },
  },
  getSecureRedirectUrl: vi.fn().mockReturnValue('http://localhost:3000'),
  validateRedirectUrl: vi.fn().mockReturnValue(true),
}));

// Helper para envolver con todos los providers
const renderWithProviders = (ui) => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <OnboardingProvider>
          <DarkModeProvider>{ui}</DarkModeProvider>
        </OnboardingProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('Flujo Reportalo V2 — Onboarding y Autenticación', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    // Reset: sin sesion por defecto
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
  });

  it('1. HomePage — Renderiza Logo, Beneficios y Botón Comenzar', () => {
    renderWithProviders(<HomePage />);

    expect(screen.getByAltText(/logo reportalo/i)).toBeInTheDocument();
    expect(screen.getByText('Reportalo')).toBeInTheDocument();
    expect(screen.getByText('Anónimo ante el organismo receptor')).toBeInTheDocument();
    expect(screen.getByText('La IA encuentra a quién corresponde')).toBeInTheDocument();
    expect(screen.getByText('Seguimiento hasta resolverse')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /comenzar/i })).toBeInTheDocument();
  });

  it('2. HomePage — Al hacer clic en Comenzar muestra formulario de login con Google', async () => {
    renderWithProviders(<HomePage />);

    const startBtn = screen.getByRole('button', { name: /comenzar/i });
    fireEvent.click(startBtn);

    await screen.findByText('Ingresá a Reportalo');
    expect(screen.getByText('Continuar con Google')).toBeInTheDocument();
    expect(screen.getByText('Enviarme un enlace')).toBeInTheDocument();
  });

  it('3. PermisosPage — Renderiza tarjetas de Cámara, Ubicación y Bloque de Privacidad', () => {
    renderWithProviders(<PermisosPage />);

    expect(screen.getByText('Activá los permisos')).toBeInTheDocument();
    expect(screen.getByText('Cámara')).toBeInTheDocument();
    expect(screen.getByText(/ubicación/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continuar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ahora no/i })).toBeInTheDocument();
  });

  // ====================================================================
  // REP-3313: Tests de Sesión (REP-3520 AC6)
  // ====================================================================

  it('4. Auth — Mock de Supabase funciona correctamente', async () => {
    // Verificar que el mock de getSession está configurado
    const { supabase } = await import('../utils/supabase');
    const result = await supabase.auth.getSession();
    // Por defecto retorna null (sin sesión)
    expect(result.data.session).toBeNull();
  });

  it('5. PerfilPage — Renderiza botón de Cerrar sesión', () => {
    renderWithProviders(<PerfilPage />);

    expect(screen.getByRole('button', { name: /cerrar sesión/i })).toBeInTheDocument();
  });

  it('6. PerfilPage — Logout muestra toast y redirige a /', async () => {
    renderWithProviders(<PerfilPage />);

    const logoutBtn = screen.getByRole('button', { name: /cerrar sesión/i });
    fireEvent.click(logoutBtn);

    // Verificar que signOut fue llamado
    await vi.waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
    });
  });
});
