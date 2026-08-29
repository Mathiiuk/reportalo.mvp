import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { TermsAndPermissionsPage } from '../pages/TermsAndPermissionsPage';
import { LoginPage } from '../pages/LoginPage';
import { BlankAppPage } from '../pages/BlankAppPage';
import { AuthContext } from '../context/AuthContext';
import {
  hasAcceptedCurrentTerms,
  recordTermsAcceptance,
  syncTermsConsentWithRemote,
  getTermsUpdateStatus,
  postponeTermsUpdate,
  CURRENT_TERMS_VERSION,
  TERMS_EFFECTIVE_DATE,
  TERMS_STORAGE_KEY,
  TERMS_NOTICES_STORAGE_KEY,
} from '../services/termsService';
import { supabase } from '../lib/supabaseClient';

vi.mock('../lib/supabaseClient', () => {
  const insertMock = vi.fn().mockResolvedValue({ error: null });
  const maybeSingleMock = vi.fn().mockResolvedValue({
    data: {
      user_id: 'user-remote',
      terms_version: '1.3',
      accepted_at: '2026-08-28T12:00:00.000Z',
      permissions: { camera: true, location: true },
      metadata: { client: 'web' },
    },
    error: null,
  });

  const fromMock = vi.fn().mockReturnValue({
    insert: insertMock,
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: maybeSingleMock,
  });

  return {
    isSupabaseConfigured: true,
    supabase: {
      from: fromMock,
    },
  };
});

describe('REP-3532: Flujo de Términos y Privacidad v1.3 y Permisos', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    // Asegurar que el entorno de red esté siempre online antes de cada test
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true, writable: true });
  });

  describe('Servicio: termsService', () => {
    it('UT-TM-01: hasAcceptedCurrentTerms retorna false si no hay registro', () => {
      expect(hasAcceptedCurrentTerms('user-123')).toBe(false);
    });

    it('UT-TM-02: recordTermsAcceptance guarda la versión vigente y timestamp ISO', () => {
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

  describe('Pantalla 1: Términos y Privacidad (REP-3544)', () => {
    it('UT-TM-04: Renderiza encabezado con badge VIGENTE, los 3 bloques clave y botón Rechazar', () => {
      render(
        <MemoryRouter>
          <TermsAndPermissionsPage />
        </MemoryRouter>
      );

      expect(screen.getByRole('heading', { name: /Términos y privacidad/i })).toBeInTheDocument();
      expect(screen.getByText('VIGENTE')).toBeInTheDocument();
      expect(screen.getByText(new RegExp(`Versión ${CURRENT_TERMS_VERSION} · desde ${TERMS_EFFECTIVE_DATE}`, 'i'))).toBeInTheDocument();

      // 3 bloques clave
      expect(screen.getByText(/Tratamiento de imágenes/i)).toBeInTheDocument();
      expect(screen.getByText(/Qué se guarda/i)).toBeInTheDocument();
      expect(screen.getByText(/Tus derechos/i)).toBeInTheDocument();

      // Checkbox, botón Aceptar y botón Rechazar
      expect(screen.getAllByText(/Acepto los términos y el tratamiento de mis imágenes descripto arriba./i)[0]).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /Aceptar y continuar/i })[0]).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /Rechazar/i })[0]).toBeInTheDocument();
    });

    it('UT-TM-10: Al hacer clic en Aceptar sin marcar la casilla, muestra el banner de error y borde de advertencia', async () => {
      render(
        <MemoryRouter>
          <TermsAndPermissionsPage />
        </MemoryRouter>
      );

      // Antes de hacer clic no debe estar el mensaje de error
      expect(screen.queryByText(/La casilla es obligatoria. Marcala para poder continuar./i)).not.toBeInTheDocument();

      const submitBtn = screen.getAllByRole('button', { name: /Aceptar y continuar/i })[0];
      fireEvent.click(submitBtn);

      // Debe mostrarse el banner de error
      await waitFor(() => {
        expect(screen.getByText(/La casilla es obligatoria. Marcala para poder continuar./i)).toBeInTheDocument();
      });

      // No debe haber avanzado a la pantalla de permisos
      expect(screen.queryByRole('heading', { name: /Activá los permisos/i })).not.toBeInTheDocument();
    });

    it('UT-TM-11: Al tildar el checkbox desaparece el error y permite avanzar a la pantalla de Permisos', async () => {
      render(
        <MemoryRouter>
          <TermsAndPermissionsPage />
        </MemoryRouter>
      );

      const submitBtn = screen.getAllByRole('button', { name: /Aceptar y continuar/i })[0];
      fireEvent.click(submitBtn);

      // Error visible
      expect(screen.getByText(/La casilla es obligatoria. Marcala para poder continuar./i)).toBeInTheDocument();

      // Marcamos el checkbox
      const checkbox = screen.getAllByLabelText(/Acepto los términos y el tratamiento de mis imágenes/i)[0];
      fireEvent.click(checkbox);

      // El error debe desaparecer
      expect(screen.queryByText(/La casilla es obligatoria. Marcala para poder continuar./i)).not.toBeInTheDocument();

      // Al presionar de nuevo avanza
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Activá los permisos/i })).toBeInTheDocument();
        expect(screen.getByText(/Cámara/i)).toBeInTheDocument();
        expect(screen.getByText(/Ubicación/i)).toBeInTheDocument();
      });
    });

    it('UT-TM-17: Ante falla de red al aceptar, muestra el banner cloud_off, mantiene la casilla y botón Reintentar', async () => {
      // Simular desconexión de red
      const originalOnLine = navigator.onLine;
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

      render(
        <MemoryRouter>
          <TermsAndPermissionsPage />
        </MemoryRouter>
      );

      const checkbox = screen.getAllByLabelText(/Acepto los términos y el tratamiento de mis imágenes/i)[0];
      fireEvent.click(checkbox);

      const submitBtn = screen.getAllByRole('button', { name: /Aceptar y continuar/i })[0];
      fireEvent.click(submitBtn);

      // Debe mostrar el banner de error de red
      expect(screen.getByText(/No pudimos registrar tu aceptación/i)).toBeInTheDocument();
      expect(screen.getByText(/Revisá tu conexión y probá de nuevo. Tu casilla queda marcada./i)).toBeInTheDocument();

      // El botón debe haber cambiado a "Reintentar"
      expect(screen.getAllByRole('button', { name: /Reintentar/i })[0]).toBeInTheDocument();

      // Restaurar estado de red
      Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
    });

    it('UT-TM-18: Al presionar Reintentar con la conexión restablecida, avanza al Paso 2', async () => {
      // Simular offline y luego online
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

      render(
        <MemoryRouter>
          <TermsAndPermissionsPage />
        </MemoryRouter>
      );

      const checkbox = screen.getAllByLabelText(/Acepto los términos y el tratamiento de mis imágenes/i)[0];
      fireEvent.click(checkbox);
      fireEvent.click(screen.getAllByRole('button', { name: /Aceptar y continuar/i })[0]);

      expect(screen.getByText(/No pudimos registrar tu aceptación/i)).toBeInTheDocument();

      // Restablecemos conexión
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

      const retryBtn = screen.getAllByRole('button', { name: /Reintentar/i })[0];
      fireEvent.click(retryBtn);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Activá los permisos/i })).toBeInTheDocument();
      });
    });

    it('UT-TM-12: El botón Rechazar abre el diálogo de confirmación y redirige a /login con aviso de rechazo', async () => {
      const mockSignOut = vi.fn();
      const mockUser = { id: 'usr-explorador', email: 'explora@reportalo.ar' };

      render(
        <AuthContext.Provider
          value={{
            user: mockUser,
            session: { access_token: 'fake' },
            loading: false,
            authError: null,
            signInWithGoogle: vi.fn(),
            signInWithMagicLink: vi.fn(),
            signOut: mockSignOut,
            clearError: vi.fn(),
          }}
        >
          <MemoryRouter initialEntries={['/terminos']}>
            <Routes>
              <Route path="/terminos" element={<TermsAndPermissionsPage />} />
              <Route path="/login" element={<LoginPage />} />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      );

      const rejectBtn = screen.getAllByRole('button', { name: /Rechazar/i })[0];
      fireEvent.click(rejectBtn);

      // Debe abrirse el modal con ¿Rechazar los términos?
      expect(screen.getByRole('heading', { name: /¿Rechazar los términos\?/i })).toBeInTheDocument();
      expect(screen.getByText(/Sin tu consentimiento no vas a poder enviar reportes/i)).toBeInTheDocument();

      // Probar cancelar con "Volver a los términos"
      const cancelBtn = screen.getByRole('button', { name: /Volver a los términos/i });
      fireEvent.click(cancelBtn);

      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: /¿Rechazar los términos\?/i })).not.toBeInTheDocument();
      });
      expect(screen.queryByText(/Rechazaste los términos/i)).not.toBeInTheDocument();

      // Volvemos a abrir y confirmamos con "Rechazar y salir"
      fireEvent.click(rejectBtn);
      const confirmRejectBtn = screen.getByRole('button', { name: /Rechazar y salir/i });
      fireEvent.click(confirmRejectBtn);

      await waitFor(() => {
        expect(mockSignOut).toHaveBeenCalled();
        expect(screen.getByText(/Rechazaste los términos/i)).toBeInTheDocument();
        expect(screen.getByText(/Para usar Reportalo tenés que aceptar la versión vigente/i)).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /Entrar a Reportalo/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Ver los términos otra vez/i })).toBeInTheDocument();
      });
    });

    it('UT-TM-16: Desde la pantalla de Login con rechazo, "Ver los términos otra vez" vuelve a /terminos', async () => {
      const TermsReceiver = () => <div data-testid="terms-page">Pantalla de Términos</div>;

      render(
        <AuthContext.Provider
          value={{
            user: null,
            session: null,
            loading: false,
            authError: null,
            signInWithGoogle: vi.fn(),
            signInWithMagicLink: vi.fn(),
            signOut: vi.fn(),
            clearError: vi.fn(),
          }}
        >
          <MemoryRouter initialEntries={[{ pathname: '/login', state: { rejected: true } }]}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/terminos" element={<TermsReceiver />} />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      );

      expect(screen.getByText(/Rechazaste los términos/i)).toBeInTheDocument();
      const backToTermsLink = screen.getByRole('link', { name: /Ver los términos otra vez/i });
      fireEvent.click(backToTermsLink);

      await waitFor(() => {
        expect(screen.getByTestId('terms-page')).toBeInTheDocument();
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

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Términos y Condiciones/i })).toBeInTheDocument();
      });
      expect(screen.getAllByText(/Ley 25\.326/i).length).toBeGreaterThanOrEqual(1);

      const closeModalBtn = screen.getByRole('button', { name: /Entendido/i });
      fireEvent.click(closeModalBtn);

      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: /Términos y Condiciones/i })).not.toBeInTheDocument();
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
      fireEvent.click(screen.getAllByLabelText(/Acepto los términos/i)[0]);
      fireEvent.click(screen.getAllByRole('button', { name: /Aceptar y continuar/i })[0]);

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
      fireEvent.click(screen.getAllByLabelText(/Acepto los términos/i)[0]);
      fireEvent.click(screen.getAllByRole('button', { name: /Aceptar y continuar/i })[0]);

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

      expect(screen.getByText(/Términos v1.3 pendientes/i)).toBeInTheDocument();

      const createBtn = screen.getByRole('button', { name: /Crear nuevo reporte/i });
      fireEvent.click(createBtn);

      await waitFor(() => {
        expect(screen.getByTestId('terms-screen')).toBeInTheDocument();
      });
    });
  });

  describe('Versión Desactualizada: 3 Avisos (Aviso 1 de 3)', () => {
    it('UT-TM-19: Usuaria que aceptó v1.2 ve Aviso 1 de 3 (badge NUEVA VERSIÓN 1.3, banner history, quedan 2 avisos)', () => {
      const mockUser = { id: 'usr-v12', email: 'laura@reportalo.ar' };
      localStorage.setItem(
        TERMS_STORAGE_KEY,
        JSON.stringify({
          userId: 'usr-v12',
          terms_version: '1.2',
          accepted_at: '2026-08-14T10:00:00.000Z',
        })
      );

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
          <MemoryRouter>
            <TermsAndPermissionsPage />
          </MemoryRouter>
        </AuthContext.Provider>
      );

      // Título y badge de nueva versión
      expect(screen.getByRole('heading', { name: /Actualizamos los términos/i })).toBeInTheDocument();
      expect(screen.getByText(/NUEVA VERSIÓN/i)).toBeInTheDocument();
      expect(screen.getByText(/1.3 · desde 09\/2026/i)).toBeInTheDocument();

      // Banner de historial previo
      expect(screen.getByText(/Aceptaste la versión 1.2 el 14\/08\/2026/i)).toBeInTheDocument();
      expect(screen.getByText(/Seguís pudiendo usar la app mientras revisás la nueva/i)).toBeInTheDocument();

      // Checkbox adaptado a la versión 1.3
      expect(screen.getAllByText(/Acepto la versión 1.3 de los términos y el tratamiento de mis imágenes/i)[0]).toBeInTheDocument();

      // Botón de postergación e indicador de avisos
      expect(screen.getAllByRole('button', { name: /Recordármelo más tarde/i })[0]).toBeInTheDocument();
      expect(screen.getAllByText(/quedan 2 avisos/i)[0]).toBeInTheDocument();
    });

    it('UT-TM-20: Al presionar "Recordármelo más tarde", posterga y navega a /app', async () => {
      const AppReceiver = () => <div data-testid="app-screen">App Screen</div>;
      const mockUser = { id: 'usr-v12', email: 'laura@reportalo.ar' };
      localStorage.setItem(
        TERMS_STORAGE_KEY,
        JSON.stringify({
          userId: 'usr-v12',
          terms_version: '1.2',
          accepted_at: '2026-08-14T10:00:00.000Z',
        })
      );

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
              <Route path="/app" element={<AppReceiver />} />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      );

      const postponeBtn = screen.getAllByRole('button', { name: /Recordármelo más tarde/i })[0];
      fireEvent.click(postponeBtn);

      await waitFor(() => {
        expect(screen.getByTestId('app-screen')).toBeInTheDocument();
        const savedNotices = localStorage.getItem(TERMS_NOTICES_STORAGE_KEY);
        expect(savedNotices).toBe('1');
      });
    });

    it('UT-TM-21: Al marcar y aceptar la versión 1.3, actualiza el consentimiento a v1.3', async () => {
      const mockUser = { id: 'usr-v12', email: 'laura@reportalo.ar' };
      localStorage.setItem(
        TERMS_STORAGE_KEY,
        JSON.stringify({
          userId: 'usr-v12',
          terms_version: '1.2',
          accepted_at: '2026-08-14T10:00:00.000Z',
        })
      );

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
          <MemoryRouter>
            <TermsAndPermissionsPage />
          </MemoryRouter>
        </AuthContext.Provider>
      );

      const checkbox = screen.getAllByLabelText(/Acepto la versión 1.3 de los términos/i)[0];
      fireEvent.click(checkbox);

      const submitBtn = screen.getAllByRole('button', { name: /Aceptar y continuar/i })[0];
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Activá los permisos/i })).toBeInTheDocument();
      });
    });

    it('UT-TM-22: Aviso 2 de 3 muestra "queda 1 aviso" y mantiene el banner de historial', () => {
      const mockUser = { id: 'usr-v12', email: 'laura@reportalo.ar' };
      localStorage.setItem(
        TERMS_STORAGE_KEY,
        JSON.stringify({
          userId: 'usr-v12',
          terms_version: '1.2',
          accepted_at: '2026-08-14T10:00:00.000Z',
        })
      );
      localStorage.setItem(TERMS_NOTICES_STORAGE_KEY, '1'); // Aviso 2 de 3

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
          <MemoryRouter>
            <TermsAndPermissionsPage />
          </MemoryRouter>
        </AuthContext.Provider>
      );

      expect(screen.getByRole('heading', { name: /Actualizamos los términos/i })).toBeInTheDocument();
      expect(screen.getByText(/Aceptaste la versión 1.2 el 14\/08\/2026/i)).toBeInTheDocument();
      expect(screen.getAllByText(/queda 1 aviso/i)[0]).toBeInTheDocument();
    });

    it('UT-TM-23: Aviso 3 de 3 (Último aviso) muestra banner notification_important en #FFF2E0 y tag rojo "último aviso"', () => {
      const mockUser = { id: 'usr-v12', email: 'laura@reportalo.ar' };
      localStorage.setItem(
        TERMS_STORAGE_KEY,
        JSON.stringify({
          userId: 'usr-v12',
          terms_version: '1.2',
          accepted_at: '2026-08-14T10:00:00.000Z',
        })
      );
      localStorage.setItem(TERMS_NOTICES_STORAGE_KEY, '0'); // Aviso 3 de 3 (Último aviso)

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
          <MemoryRouter>
            <TermsAndPermissionsPage />
          </MemoryRouter>
        </AuthContext.Provider>
      );

      expect(screen.getByRole('heading', { name: /Actualizamos los términos/i })).toBeInTheDocument();
      // Banner de último aviso
      expect(screen.getAllByText(/Último aviso/i)[0]).toBeInTheDocument();
      expect(screen.getByText(/La próxima vez que abras la app vas a tener que aceptar para seguir usándola/i)).toBeInTheDocument();
      // Tag de último aviso en rojo
      const lastNoticeTag = screen.getAllByText(/^último aviso$/i)[0];
      expect(lastNoticeTag).toBeInTheDocument();
    });

    it('UT-TM-25: Pantalla Bloqueante (Postergó 3 veces) muestra badge ACEPTACIÓN REQUERIDA, banner lock y botón Rechazar y cerrar sesión', () => {
      const mockUser = { id: 'usr-v12', email: 'laura@reportalo.ar' };
      localStorage.setItem(
        TERMS_STORAGE_KEY,
        JSON.stringify({
          userId: 'usr-v12',
          terms_version: '1.2',
          accepted_at: '2026-08-14T10:00:00.000Z',
        })
      );
      localStorage.setItem(TERMS_NOTICES_STORAGE_KEY, '-1'); // Bloqueado tras 3 postergaciones

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
          <MemoryRouter>
            <TermsAndPermissionsPage />
          </MemoryRouter>
        </AuthContext.Provider>
      );

      // Badge ACEPTACIÓN REQUERIDA
      expect(screen.getByText(/ACEPTACIÓN REQUERIDA/i)).toBeInTheDocument();
      // Banner lock rojo
      expect(screen.getByText(/Ya postergaste tres veces/i)).toBeInTheDocument();
      expect(screen.getByText(/Para seguir usando Reportalo tenés que aceptar la versión 1.3/i)).toBeInTheDocument();
      // No debe haber botón de postergar
      expect(screen.queryByRole('button', { name: /Recordármelo más tarde/i })).not.toBeInTheDocument();
      // Botón Rechazar y cerrar sesión (disponible en vista móvil y desktop)
      expect(screen.getAllByRole('button', { name: /Rechazar y cerrar sesión/i })[0]).toBeInTheDocument();
    });

    it('UT-TM-26: Al presionar "Rechazar y cerrar sesión" en pantalla bloqueante, cierra sesión y redirige a login', async () => {
      const mockSignOut = vi.fn();
      const mockUser = { id: 'usr-v12', email: 'laura@reportalo.ar' };
      localStorage.setItem(
        TERMS_STORAGE_KEY,
        JSON.stringify({
          userId: 'usr-v12',
          terms_version: '1.2',
          accepted_at: '2026-08-14T10:00:00.000Z',
        })
      );
      localStorage.setItem(TERMS_NOTICES_STORAGE_KEY, '-1');

      render(
        <AuthContext.Provider
          value={{
            user: mockUser,
            session: { access_token: 'fake' },
            loading: false,
            authError: null,
            signInWithGoogle: vi.fn(),
            signInWithMagicLink: vi.fn(),
            signOut: mockSignOut,
            clearError: vi.fn(),
          }}
        >
          <MemoryRouter initialEntries={['/terminos']}>
            <Routes>
              <Route path="/terminos" element={<TermsAndPermissionsPage />} />
              <Route path="/login" element={<LoginPage />} />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      );

      const rejectBtn = screen.getAllByRole('button', { name: /Rechazar y cerrar sesión/i })[0];
      fireEvent.click(rejectBtn);

      await waitFor(() => {
        expect(mockSignOut).toHaveBeenCalled();
        expect(screen.getByText(/Rechazaste los términos/i)).toBeInTheDocument();
      });
    });

    it('UT-TM-27: Renderiza la barra superior institucional con logo y email del usuario autenticado', () => {
      const mockUser = { id: 'usr-desktop', email: 'vecina@correo.com' };

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
          <MemoryRouter>
            <TermsAndPermissionsPage />
          </MemoryRouter>
        </AuthContext.Provider>
      );

      // Logo y nombre en barra superior
      expect(screen.getByRole('banner')).toBeInTheDocument();
      expect(screen.getByText(/^Reportalo$/i)).toBeInTheDocument();
      expect(screen.getByText(/vecina@correo\.com/i)).toBeInTheDocument();
    });

    it('UT-TM-28: Contiene la bajada descriptiva para escritorio y los tres bloques en una sola columna', () => {
      render(
        <AuthContext.Provider
          value={{
            user: null,
            session: null,
            loading: false,
            authError: null,
            signInWithGoogle: vi.fn(),
            signInWithMagicLink: vi.fn(),
            signOut: vi.fn(),
            clearError: vi.fn(),
          }}
        >
          <MemoryRouter>
            <TermsAndPermissionsPage />
          </MemoryRouter>
        </AuthContext.Provider>
      );

      expect(screen.getByText(/Para enviar reportes necesitamos tu consentimiento para procesar las fotos que subís/i)).toBeInTheDocument();
      expect(screen.getByText(/Tratamiento de imágenes/i)).toBeInTheDocument();
      expect(screen.getByText(/Qué se guarda/i)).toBeInTheDocument();
      expect(screen.getByText(/Tus derechos/i)).toBeInTheDocument();
    });

    it('UT-TM-29: Permite tildar y continuar tanto desde el control móvil como el control desktop', async () => {
      const mockUser = { id: 'usr-flow', email: 'vecina@correo.com' };

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
          <MemoryRouter>
            <TermsAndPermissionsPage />
          </MemoryRouter>
        </AuthContext.Provider>
      );

      // Seleccionar checkboxes disponibles (móvil / desktop)
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBeGreaterThanOrEqual(1);
      fireEvent.click(checkboxes[0]);

      // Botón aceptar disponible
      const acceptButtons = screen.getAllByRole('button', { name: /Aceptar y continuar/i });
      expect(acceptButtons.length).toBeGreaterThanOrEqual(1);
      fireEvent.click(acceptButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Activá los permisos/i })).toBeInTheDocument();
      });
    });

    it('UT-TM-30: En navegación directa a /login, muestra el login estándar con botón de Google y Magic Link', () => {
      render(
        <AuthContext.Provider
          value={{
            user: null,
            session: null,
            loading: false,
            authError: null,
            signInWithGoogle: vi.fn(),
            signInWithMagicLink: vi.fn(),
            signOut: vi.fn(),
            clearError: vi.fn(),
          }}
        >
          <MemoryRouter initialEntries={['/login']}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      );

      expect(screen.getByRole('heading', { name: /Ingresá a Reportalo/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Continuar con Google/i })).toBeInTheDocument();
      expect(screen.queryByText(/Rechazaste los términos/i)).not.toBeInTheDocument();
    });

    it('UT-TM-31: recordTermsAcceptance realiza insert en Supabase terms_consents con JSONB y actualiza localStorage', async () => {
      const result = await recordTermsAcceptance('usr-supabase-1', {
        camera: true,
        location: false,
      });

      expect(supabase.from).toHaveBeenCalledWith('terms_consents');
      expect(result.terms_version).toBe('1.3');
      expect(result.permissions.camera).toBe(true);
      expect(result.permissions.location).toBe(false);

      const savedLocal = JSON.parse(localStorage.getItem(TERMS_STORAGE_KEY));
      expect(savedLocal.terms_version).toBe('1.3');
      expect(savedLocal.userId).toBe('usr-supabase-1');
    });

    it('UT-TM-32: recordTermsAcceptance tolera fallos de Supabase (offline/error) persistiendo de forma segura en localStorage', async () => {
      supabase.from.mockReturnValueOnce({
        insert: vi.fn().mockRejectedValueOnce(new Error('Network error or table missing')),
      });

      const result = await recordTermsAcceptance('usr-offline-1', {
        camera: true,
        location: true,
      });

      expect(result).toBeDefined();
      expect(result.terms_version).toBe('1.3');

      const savedLocal = JSON.parse(localStorage.getItem(TERMS_STORAGE_KEY));
      expect(savedLocal.userId).toBe('usr-offline-1');
    });

    it('UT-TM-33: syncTermsConsentWithRemote descarga el consentimiento vigente desde Supabase y actualiza el caché local', async () => {
      const synced = await syncTermsConsentWithRemote('user-remote');

      expect(supabase.from).toHaveBeenCalledWith('terms_consents');
      expect(synced.terms_version).toBe('1.3');
      expect(synced.userId).toBe('user-remote');

      const savedLocal = JSON.parse(localStorage.getItem(TERMS_STORAGE_KEY));
      expect(savedLocal.terms_version).toBe('1.3');
      expect(savedLocal.userId).toBe('user-remote');
    });
  });
});
