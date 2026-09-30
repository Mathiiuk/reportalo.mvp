/**
 * REP-3791 Bloque 11-C · Acceso, onboarding y permisos en escritorio (UJ v3.3 · D01 a D07).
 * En jsdom no hay media queries: se simula el ancho de escritorio con matchMedia.
 */
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { WelcomePage } from '../pages/WelcomePage';
import { LoginPage } from '../pages/LoginPage';
import { CheckEmailPage } from '../pages/CheckEmailPage';
import { OnboardingPage } from '../pages/OnboardingPage';
import { PermissionsPage } from '../pages/PermissionsPage';

const mockMatchMedia = (matches) => {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
};

const renderAt = (element, path = '/') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={path} element={element} />
        <Route path="/login" element={<div data-testid="login-destino" />} />
        <Route path="/mapa" element={<div data-testid="mapa-destino" />} />
      </Routes>
    </MemoryRouter>
  );

describe('REP-3791 Bloque 11-C · Acceso en escritorio', () => {
  beforeEach(() => {
    localStorage.clear();
    mockMatchMedia(true);
  });
  afterEach(() => {
    delete window.matchMedia;
  });

  it('UT-B11C-01: D01 muestra el héroe de la v3.3 y «Ingresar» lleva al acceso', () => {
    renderAt(<WelcomePage />);
    expect(screen.getByTestId('brand-bar')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Reportá lo que ves en tu ciudad' })).toBeInTheDocument();
    expect(screen.getByText('La IA encuentra a quién corresponde')).toBeInTheDocument();
    // Sin la columna lateral ni las cifras de REP-4000
    expect(screen.queryByText(/cómo funciona/i)).not.toBeInTheDocument();
    expect(screen.queryByText('100%')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(screen.getByTestId('login-destino')).toBeInTheDocument();
  });

  it('UT-B11C-02: D02 es una tarjeta centrada, sin columna lateral, con la nota de identidad adentro', () => {
    renderAt(<LoginPage />, '/login-escritorio');
    expect(screen.getByRole('heading', { name: /ingresá a reportalo/i })).toBeInTheDocument();
    expect(screen.queryByText(/seguridad y privacidad/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/tu identidad nunca se comparte con el organismo/i)).toHaveLength(1);
    // En escritorio el «volver» del teléfono no aparece: la marca de la barra lleva al inicio
    expect(screen.queryByRole('button', { name: /volver a la pantalla de bienvenida/i })).not.toBeInTheDocument();
  });

  it('UT-B11C-03: D03 cambia la línea a «Abrilo en esta misma computadora»', () => {
    renderAt(<CheckEmailPage />, '/check-email');
    expect(screen.getByText('Abrilo en esta misma computadora y entrás directo.')).toBeInTheDocument();
    expect(screen.queryByText(/tocá el enlace desde este teléfono/i)).not.toBeInTheDocument();
    expect(screen.getByText(/el enlace vence en 15 minutos/i)).toBeInTheDocument();
  });

  it('UT-B11C-04: D04 es una tarjeta horizontal con el paso y el texto de escritorio', async () => {
    renderAt(<OnboardingPage />, '/onboarding');
    expect(screen.getByText('Paso 1 de 3')).toBeInTheDocument();
    expect(screen.getByText(/^Subís la foto de lo que está mal/)).toBeInTheDocument();
    expect(screen.getByTestId('onboarding-pictogram-1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Saltar' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    // AnimatePresence espera la salida del paso anterior antes de montar el siguiente
    expect(await screen.findByText('Paso 2 de 3')).toBeInTheDocument();
  });

  it('UT-B11C-05: D07 pide dos permisos, no tres, y no registra la cámara como concedida', () => {
    renderAt(<PermissionsPage />, '/permisos');
    expect(screen.queryByRole('switch', { name: /permiso de cámara/i })).not.toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /permiso de ubicación/i })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /permiso de notificaciones/i })).toBeInTheDocument();
    expect(screen.getByText(/en escritorio no se usa la cámara/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(localStorage.getItem('reportalo_perm_camera')).toBe('false');
    expect(localStorage.getItem('reportalo_permissions_configured')).toBe('true');
    expect(screen.getByTestId('mapa-destino')).toBeInTheDocument();
  });
});
