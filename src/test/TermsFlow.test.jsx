import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { TermsAndPermissionsPage } from '../pages/TermsAndPermissionsPage';
import { BlankAppPage } from '../pages/BlankAppPage';
import { AuthContext } from '../context/AuthContext';
import {
  hasAcceptedCurrentTerms,
  recordTermsAcceptance,
  CURRENT_TERMS_VERSION,
  TERMS_STORAGE_KEY,
} from '../services/termsService';

describe('REP-3532: Flujo de Términos y Privacidad v1.2 y Permisos', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('Servicio: termsService', () => {
    it('UT-TM-01: hasAcceptedCurrentTerms retorna false si no hay registro', () => {
      expect(hasAcceptedCurrentTerms('user-123')).toBe(false);
    });

    it('UT-TM-02: recordTermsAcceptance guarda la versión v1.2 y timestamp ISO', () => {
      recordTermsAcceptance('user-123', { camera: true, location: true });
      expect(hasAcceptedCurrentTerms('user-123')).toBe(true);

      const saved = JSON.parse(localStorage.getItem(TERMS_STORAGE_KEY));
      expect(saved.terms_version).toBe(CURRENT_TERMS_VERSION);
      expect(saved.userId).toBe('user-123');
      expect(saved.accepted_at).toBeDefined();
      expect(saved.permissions.camera).toBe(true);
      expect(saved.permissions.location).toBe(true);
    });

    it('UT-TM-03: hasAcceptedCurrentTerms retorna false si la versión guardada es desactualizada', () => {
      localStorage.setItem(
        TERMS_STORAGE_KEY,
        JSON.stringify({
          userId: 'user-123',
          terms_version: '1.0',
          accepted_at: '2026-01-01T00:00:00.000Z',
        })
      );

      expect(hasAcceptedCurrentTerms('user-123')).toBe(false);
    });
  });

  describe('Pantalla 1: Términos y Privacidad', () => {
    it('UT-TM-04: Renderiza los 3 bloques clave y el botón Aceptar deshabilitado por defecto', () => {
      render(
        <MemoryRouter>
          <TermsAndPermissionsPage />
        </MemoryRouter>
      );

      expect(screen.getByRole('heading', { name: /Términos y privacidad/i })).toBeInTheDocument();
      expect(screen.getByText(/Versión 1.2 · vigente desde 08\/2026/i)).toBeInTheDocument();

      // 3 bloques clave
      expect(screen.getByText(/Tratamiento de imágenes/i)).toBeInTheDocument();
      expect(screen.getByText(/Qué se guarda/i)).toBeInTheDocument();
      expect(screen.getByText(/Tus derechos/i)).toBeInTheDocument();

      // Checkbox y botón
      expect(screen.getByText(/Acepto los términos y el tratamiento de mis imágenes descripto arriba./i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Aceptar y continuar/i })).toBeDisabled();
    });

    it('UT-TM-05: Al tildar el checkbox se habilita el botón y avanza a la pantalla de Permisos', async () => {
      render(
        <MemoryRouter>
          <TermsAndPermissionsPage />
        </MemoryRouter>
      );

      const checkbox = screen.getByLabelText(/Acepto los términos y el tratamiento de mis imágenes/i);
      const submitBtn = screen.getByRole('button', { name: /Aceptar y continuar/i });

      expect(submitBtn).toBeDisabled();

      fireEvent.click(checkbox);
      expect(submitBtn).not.toBeDisabled();

      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Activá los permisos/i })).toBeInTheDocument();
        expect(screen.getByText(/Cámara/i)).toBeInTheDocument();
        expect(screen.getByText(/Ubicación/i)).toBeInTheDocument();
      });
    });

    it('UT-TM-06: Permite abrir y cerrar el modal con el articulado legal completo', async () => {
      render(
        <MemoryRouter>
          <TermsAndPermissionsPage />
        </MemoryRouter>
      );

      const openModalBtn = screen.getByRole('button', { name: /Leer el texto completo/i });
      fireEvent.click(openModalBtn);

      expect(screen.getByText(/Términos y Condiciones Completos/i)).toBeInTheDocument();
      expect(screen.getByText(/Ley Nacional N° 25.326/i)).toBeInTheDocument();

      const closeModalBtn = screen.getByRole('button', { name: /Entendido/i });
      fireEvent.click(closeModalBtn);

      await waitFor(() => {
        expect(screen.queryByText(/Términos y Condiciones Completos/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Pantalla 2: Permisos y Finalización', () => {
    it('UT-TM-07: Guarda consentimiento y navega a /app al presionar Continuar', async () => {
      const AppReceiver = () => <div data-testid="app-dashboard">App Dashboard</div>;
      const mockUser = { id: 'usr-999', email: 'vecino@reportalo.ar' };

      render(
        <AuthContext.Provider
          value={{
            user: mockUser,
            session: { access_token: 'fake' },
            loading: false,
            authError: null,
            signInWithGoogle: vi.fn(),
            signInWithMagicLink: vi.fn(),
            signOut: vi.fn(),
            clearError: vi.fn(),
          }}
        >
          <MemoryRouter initialEntries={['/terminos']}>
            <Routes>
              <Route path="/terminos" element={<TermsAndPermissionsPage />} />
              <Route path="/mapa" element={<AppReceiver />} />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      );

      // Aceptamos términos paso 1
      fireEvent.click(screen.getByLabelText(/Acepto los términos/i));
      fireEvent.click(screen.getByRole('button', { name: /Aceptar y continuar/i }));

      // En paso 2
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Activá los permisos/i })).toBeInTheDocument();
      });

      const continueBtn = screen.getByRole('button', { name: /Continuar/i });
      fireEvent.click(continueBtn);

      await waitFor(() => {
        expect(hasAcceptedCurrentTerms('usr-999')).toBe(true);
        expect(screen.getByTestId('app-dashboard')).toBeInTheDocument();
      });
    });

    it('UT-TM-08: El botón "Ahora no" guarda aceptación de términos y permite explorar la app', async () => {
      const AppReceiver = () => <div data-testid="app-dashboard">App Dashboard</div>;
      const mockUser = { id: 'usr-999', email: 'vecino@reportalo.ar' };

      render(
        <AuthContext.Provider
          value={{
            user: mockUser,
            session: { access_token: 'fake' },
            loading: false,
            authError: null,
            signInWithGoogle: vi.fn(),
            signInWithMagicLink: vi.fn(),
            signOut: vi.fn(),
            clearError: vi.fn(),
          }}
        >
          <MemoryRouter initialEntries={['/terminos']}>
            <Routes>
              <Route path="/terminos" element={<TermsAndPermissionsPage />} />
              <Route path="/mapa" element={<AppReceiver />} />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      );

      // Paso 1
      fireEvent.click(screen.getByLabelText(/Acepto los términos/i));
      fireEvent.click(screen.getByRole('button', { name: /Aceptar y continuar/i }));

      // Paso 2: Ahora no
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Ahora no/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Ahora no/i }));

      await waitFor(() => {
        expect(hasAcceptedCurrentTerms('usr-999')).toBe(true);
        expect(screen.getByTestId('app-dashboard')).toBeInTheDocument();
      });
    });
  });

  describe('Integración: BlankAppPage Guard de Reporte', () => {
    it('UT-TM-09: Al hacer clic en Crear reporte sin términos aceptados, redirige a /terminos', async () => {
      const TermsReceiver = () => <div data-testid="terms-screen">Terms Screen</div>;
      const mockUser = { id: 'user-sin-terminos', email: 'nuevo@reportalo.ar' };

      render(
        <AuthContext.Provider
          value={{
            user: mockUser,
            session: { access_token: 'fake' },
            loading: false,
            authError: null,
            signInWithGoogle: vi.fn(),
            signInWithMagicLink: vi.fn(),
            signOut: vi.fn(),
            clearError: vi.fn(),
          }}
        >
          <MemoryRouter initialEntries={['/app']}>
            <Routes>
              <Route path="/app" element={<BlankAppPage />} />
              <Route path="/terminos" element={<TermsReceiver />} />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      );

      expect(screen.getByText(/Términos v1.2 pendientes/i)).toBeInTheDocument();

      const createBtn = screen.getByRole('button', { name: /Crear nuevo reporte/i });
      fireEvent.click(createBtn);

      await waitFor(() => {
        expect(screen.getByTestId('terms-screen')).toBeInTheDocument();
      });
    });
  });
});
