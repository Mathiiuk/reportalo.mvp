// ==============================================================================
// Suite de Pruebas Automatizadas: Flujo Completo Reportalo V2
// ==============================================================================

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
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

  it('1. HomePage — Renderiza Hero, Lema, 3 Beneficios y Botones de Login y Registro', () => {
    renderWithProviders(<HomePage />);

    // Verificar Título y lema
    expect(screen.getByText('Reportalo')).toBeInTheDocument();
    expect(screen.getByText('Tu ciudad. Tu voz.')).toBeInTheDocument();

    // Verificar los 3 beneficios
    expect(screen.getByText('Tu identidad protegida')).toBeInTheDocument();
    expect(screen.getByText('La IA encuentra a quién corresponde')).toBeInTheDocument();
    expect(screen.getByText('Seguimiento hasta resolverse')).toBeInTheDocument();

    // Verificar botones
    expect(screen.getByRole('button', { name: /registrarse/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /iniciar sesión/i })).toBeInTheDocument();
  });

  it('2. AuthCollapse — Al hacer clic en Registrarse despliega el formulario y valida T&C', async () => {
    renderWithProviders(<HomePage />);

    // Clic en Registrarse
    const registerBtn = screen.getByRole('button', { name: /registrarse/i });
    fireEvent.click(registerBtn);

    // Debe mostrarse el formulario de registro (esperar la transición animada)
    await screen.findByText('Crear cuenta');
    expect(screen.getByLabelText(/nombre completo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();

    // Obtener el botón submit del formulario de registro
    const submitBtn = screen.getByRole('button', { name: /^registrarse$/i });

    // El botón submit de registro debe estar deshabilitado hasta aceptar T&C
    expect(submitBtn).toBeDisabled();

    // Tildar el checkbox de T&C
    const termsCheckbox = screen.getByRole('checkbox');
    fireEvent.click(termsCheckbox);

    // Ahora debe estar habilitado
    expect(submitBtn).not.toBeDisabled();
  });

  it('3. PermisosPage — Renderiza tarjetas de Cámara, Ubicación y Bloque de Privacidad', () => {
    renderWithProviders(<PermisosPage />);

    expect(screen.getByText('Activá los permisos')).toBeInTheDocument();
    expect(screen.getByText('Tu evidencia permanece protegida')).toBeInTheDocument();
    expect(screen.getByText('Cámara')).toBeInTheDocument();
    expect(screen.getByText('Ubicación')).toBeInTheDocument();

    // Botones de acción
    expect(screen.getByRole('button', { name: /continuar al mapa/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ahora no/i })).toBeInTheDocument();
  });
});
