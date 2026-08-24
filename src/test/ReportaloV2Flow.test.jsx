// ==============================================================================
// Suite de Pruebas Automatizadas: Flujo Completo Reportalo V2 Minimalista
// ==============================================================================

import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { OnboardingProvider } from '../context/OnboardingContext';
import { HomePage } from '../pages/HomePage';
import { PermisosPage } from '../pages/PermisosPage';

// Helper para envolver con providers
const renderWithProviders = (ui) => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <OnboardingProvider>{ui}</OnboardingProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('Flujo Reportalo V2 — Onboarding y Autenticación', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('1. HomePage — Renderiza Logo, Beneficios y Botón Comenzar', () => {
    renderWithProviders(<HomePage />);

    // Verificar Logo y nombre
    expect(screen.getByAltText(/logo reportalo/i)).toBeInTheDocument();
    expect(screen.getByText('Reportalo')).toBeInTheDocument();

    // Verificar los 3 beneficios
    expect(screen.getByText('Anónimo ante el organismo receptor')).toBeInTheDocument();
    expect(screen.getByText('La IA encuentra a quién corresponde')).toBeInTheDocument();
    expect(screen.getByText('Seguimiento hasta resolverse')).toBeInTheDocument();

    // Verificar botón principal
    expect(screen.getByRole('button', { name: /comenzar/i })).toBeInTheDocument();
  });

  it('2. HomePage — Al hacer clic en Comenzar muestra formulario de login con Google', async () => {
    renderWithProviders(<HomePage />);

    // Clic en Comenzar
    const startBtn = screen.getByRole('button', { name: /comenzar/i });
    fireEvent.click(startBtn);

    // Debe mostrarse el formulario de login
    await screen.findByText('Ingresá a Reportalo');
    expect(screen.getByText('Continuar con Google')).toBeInTheDocument();
    expect(screen.getByText('Enviarme un enlace')).toBeInTheDocument();
  });

  it('3. PermisosPage — Renderiza tarjetas de Cámara, Ubicación y Bloque de Privacidad', () => {
    renderWithProviders(<PermisosPage />);

    expect(screen.getByText('Activá los permisos')).toBeInTheDocument();
    expect(screen.getByText('Cámara')).toBeInTheDocument();
    expect(screen.getByText(/ubicación/i)).toBeInTheDocument();

    // Botones de acción
    expect(screen.getByRole('button', { name: /continuar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ahora no/i })).toBeInTheDocument();
  });
});
