import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { WelcomePage } from '../pages/WelcomePage';
import { LoginPage } from '../pages/LoginPage';
import { CheckEmailPage } from '../pages/CheckEmailPage';
import { BlankAppPage } from '../pages/BlankAppPage';
import { MunicipiosPage } from '../pages/MunicipiosPage';
import { AuthContext, AuthProvider } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';

// Mock de Supabase Client
vi.mock('../lib/supabaseClient', () => {
  return {
    isSupabaseConfigured: true,
    supabase: {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: null },
          error: null,
        }),
        onAuthStateChange: vi.fn().mockReturnValue({
          data: {
            subscription: {
              unsubscribe: vi.fn(),
            },
          },
        }),
        signInWithOAuth: vi.fn().mockResolvedValue({
          data: { url: 'https://accounts.google.com/o/oauth2/v2/auth' },
          error: null,
        }),
        signInWithOtp: vi.fn().mockResolvedValue({
          data: {},
          error: null,
        }),
        signOut: vi.fn().mockResolvedValue({
          error: null,
        }),
      },
    },
  };
});

describe('REP-2100 & REP-2101: Flujo de Autenticación, UI y Magic Link', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Pantalla 1: WelcomePage (Onboarding / Bienvenida)', () => {
    it('UT-01: Renderiza la marca Reportalo, beneficios clave y botón Comenzar', () => {
      render(
        <MemoryRouter>
          <WelcomePage />
        </MemoryRouter>
      );

      // Verificamos título principal
      expect(screen.getByRole('heading', { name: /Reportalo/i, level: 1 })).toBeInTheDocument();

      // Verificamos los tres puntos de valor
      expect(screen.getAllByText(/Anónimo ante el organismo receptor/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/La IA encuentra a quién corresponde/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Seguimiento hasta resolverse/i).length).toBeGreaterThanOrEqual(1);

      // Verificamos botón Comenzar y nota
      expect(screen.getAllByRole('button', { name: /Comenzar/i }).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Entrás con tu correo, sin crear contraseña/i)).toBeInTheDocument();
    });

    it('UT-02: Al hacer clic en Comenzar, navega a la pantalla de login', () => {
      const LocationTracker = () => {
        return <div data-testid="location-display">Login Page Mounted</div>;
      };

      render(
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/" element={<WelcomePage />} />
            <Route path="/login" element={<LocationTracker />} />
          </Routes>
        </MemoryRouter>
      );

      const startButtons = screen.getAllByRole('button', { name: /Comenzar/i });
      fireEvent.click(startButtons[0]);

      expect(screen.getByTestId('location-display')).toBeInTheDocument();
    });
  });

  describe('Pantalla 2: LoginPage (Acceso con Google y Magic Link)', () => {
    it('UT-03: Renderiza el botón "Continuar con Google", input de correo y botón "Enviarme un enlace"', () => {
      const mockContext = {
        user: null,
        session: null,
        loading: false,
        authError: null,
        signInWithGoogle: vi.fn(),
        signInWithMagicLink: vi.fn(),
        signOut: vi.fn(),
        clearError: vi.fn(),
      };

      render(
        <AuthContext.Provider value={mockContext}>
          <MemoryRouter>
            <LoginPage />
          </MemoryRouter>
        </AuthContext.Provider>
      );

      // Título y subtítulo
      expect(screen.getByRole('heading', { name: /Ingresá a Reportalo/i })).toBeInTheDocument();
      expect(screen.getByText(/Sin contraseñas. Elegí cómo querés entrar./i)).toBeInTheDocument();

      // Botón Google
      expect(screen.getByRole('button', { name: /Continuar con Google/i })).toBeInTheDocument();

      // Correo e input
      expect(screen.getByLabelText(/Tu correo/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText('lucia.f@mail.com')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Enviarme un enlace/i })).toBeInTheDocument();
    });

    it('UT-04: Al hacer clic en "Continuar con Google" se ejecuta el flujo OAuth con proveedor google', async () => {
      const mockSignInWithGoogle = vi.fn().mockResolvedValue({ data: {}, error: null });
      const mockContext = {
        user: null,
        session: null,
        loading: false,
        authError: null,
        signInWithGoogle: mockSignInWithGoogle,
        signInWithMagicLink: vi.fn(),
        signOut: vi.fn(),
        clearError: vi.fn(),
      };

      render(
        <AuthContext.Provider value={mockContext}>
          <MemoryRouter>
            <LoginPage />
          </MemoryRouter>
        </AuthContext.Provider>
      );

      const googleButton = screen.getByRole('button', { name: /Continuar con Google/i });
      fireEvent.click(googleButton);

      expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1);
    });

    it('UT-05: El botón "Enviarme un enlace" valida el correo y navega a /check-email al enviarse', async () => {
      const mockSignInWithMagicLink = vi.fn().mockResolvedValue({ data: {}, error: null });
      const mockContext = {
        user: null,
        session: null,
        loading: false,
        authError: null,
        signInWithGoogle: vi.fn(),
        signInWithMagicLink: mockSignInWithMagicLink,
        signOut: vi.fn(),
        clearError: vi.fn(),
      };

      const CheckEmailReceiver = () => {
        return <div data-testid="check-email-screen">Check Email Screen</div>;
      };

      render(
        <AuthContext.Provider value={mockContext}>
          <MemoryRouter initialEntries={['/login']}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/check-email" element={<CheckEmailReceiver />} />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      );

      const emailInput = screen.getByPlaceholderText('lucia.f@mail.com');
      const submitBtn = screen.getByRole('button', { name: /Enviarme un enlace/i });

      // Si el email está vacío o es inválido, no dispara
      fireEvent.change(emailInput, { target: { value: 'email-invalido' } });
      fireEvent.click(submitBtn);
      expect(mockSignInWithMagicLink).not.toHaveBeenCalled();

      // Con email válido
      fireEvent.change(emailInput, { target: { value: 'ciudadano@reportalo.ar' } });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockSignInWithMagicLink).toHaveBeenCalledWith('ciudadano@reportalo.ar');
        expect(screen.getByTestId('check-email-screen')).toBeInTheDocument();
      });
    });
  });

  describe('REP-2101: Pantalla de Confirmación CheckEmailPage (/check-email)', () => {
    it('UT-ML-01: Renderiza la vista "Revisá tu correo" con email dinámico y advertencia de 15 minutos', () => {
      render(
        <MemoryRouter initialEntries={[{ pathname: '/check-email', state: { email: 'vecino@reportalo.ar' } }]}>
          <CheckEmailPage />
        </MemoryRouter>
      );

      expect(screen.getByRole('heading', { name: /Revisá tu correo/i })).toBeInTheDocument();
      expect(screen.getByText('vecino@reportalo.ar')).toBeInTheDocument();
      expect(screen.getByText(/Tocá el enlace desde este teléfono y entrás directo./i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Abrir mi correo/i })).toBeInTheDocument();
      expect(screen.getByText(/El enlace vence en 15 minutos y sirve una sola vez./i)).toBeInTheDocument();
    });

    it('UT-ML-02: Permite volver a la pantalla de login con el botón de retroceso', () => {
      render(
        <MemoryRouter initialEntries={['/check-email']}>
          <Routes>
            <Route path="/login" element={<div data-testid="login-view">Login View</div>} />
            <Route path="/check-email" element={<CheckEmailPage />} />
          </Routes>
        </MemoryRouter>
      );

      const backButtons = screen.getAllByRole('button', { name: /Volver/i });
      fireEvent.click(backButtons[0]);

      expect(screen.getByTestId('login-view')).toBeInTheDocument();
    });
  });

  describe('Pantalla Destino: BlankAppPage (Post-login)', () => {
    it('UT-07: Renderiza estado conectado y permite cerrar sesión', () => {
      const mockSignOut = vi.fn();
      const mockUser = { id: 'usr-123', email: 'ciudadano@reportalo.ar' };

      render(
        <AuthContext.Provider
          value={{
            user: mockUser,
            session: { access_token: 'fake-jwt' },
            loading: false,
            authError: null,
            signInWithGoogle: vi.fn(),
            signInWithMagicLink: vi.fn(),
            signOut: mockSignOut,
            clearError: vi.fn(),
          }}
        >
          <MemoryRouter>
            <BlankAppPage />
          </MemoryRouter>
        </AuthContext.Provider>
      );

      expect(screen.getByText(/Conectado/i)).toBeInTheDocument();
      expect(screen.getByText('ciudadano@reportalo.ar')).toBeInTheDocument();

      const logoutBtn = screen.getByRole('button', { name: /Cerrar sesión/i });
      fireEvent.click(logoutBtn);

      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });
  });

  describe('AuthProvider: Supabase Integration & Magic Link', () => {
    it('UT-08: signInWithMagicLink llama a supabase.auth.signInWithOtp con email normalizado', async () => {
      render(
        <AuthProvider>
          <AuthContext.Consumer>
            {({ signInWithMagicLink }) => (
              <button onClick={() => signInWithMagicLink('  TEST@REPORTALO.AR  ')}>
                Disparar Magic Link
              </button>
            )}
          </AuthContext.Consumer>
        </AuthProvider>
      );

      const triggerBtn = screen.getByText('Disparar Magic Link');
      fireEvent.click(triggerBtn);

      await waitFor(() => {
        expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith(
          expect.objectContaining({
            email: 'test@reportalo.ar',
          })
        );
      });
    });
  });

  describe('Pantalla Municipios: MunicipiosPage (/municipios)', () => {
    it('UT-09: Renderiza la sección de municipios con propuesta para gobiernos locales y métricas', () => {
      render(
        <MemoryRouter>
          <MunicipiosPage />
        </MemoryRouter>
      );

      expect(screen.getByText(/MUNICIPIOS/i)).toBeInTheDocument();
      expect(screen.getByText(/Los reclamos de tus vecinos, con evidencia y encuadre legal/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Contratar Reportalo/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Solicitar una demo/i })).toBeInTheDocument();
      expect(screen.getByText(/FOTOS ANONIMIZADAS/i)).toBeInTheDocument();
      expect(screen.getByText(/Ley 25.326/i)).toBeInTheDocument();
      expect(screen.getByText(/Solo se habilitan cuentas con correo oficial del municipio./i)).toBeInTheDocument();
    });
  });
});
