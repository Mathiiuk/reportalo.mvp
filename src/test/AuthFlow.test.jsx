import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { WelcomePage } from '../pages/WelcomePage';
import { LoginPage } from '../pages/LoginPage';
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
        signOut: vi.fn().mockResolvedValue({
          error: null,
        }),
      },
    },
  };
});

describe('REP-2100: Flujo de Autenticación y UI', () => {
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

  describe('Pantalla 2: LoginPage (Acceso con Google)', () => {
    it('UT-03: Renderiza el botón "Continuar con Google", maquetado de correo y resguardo de identidad', () => {
      const mockContext = {
        user: null,
        session: null,
        loading: false,
        authError: null,
        signInWithGoogle: vi.fn(),
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
      expect(screen.getByText(/Tu correo/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText('lucia.f@mail.com')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Enviarme un enlace/i })).toBeInTheDocument();

      // Resguardo de identidad
      expect(
        screen.getAllByText(/Tu cuenta sirve para seguir tus reportes; tu identidad nunca se comparte con el organismo./i).length
      ).toBeGreaterThanOrEqual(1);
    });

    it('UT-04: Al hacer clic en "Continuar con Google" se ejecuta el flujo OAuth con proveedor google', async () => {
      const mockSignInWithGoogle = vi.fn().mockResolvedValue({ data: {}, error: null });
      const mockContext = {
        user: null,
        session: null,
        loading: false,
        authError: null,
        signInWithGoogle: mockSignInWithGoogle,
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

    it('UT-05: Muestra mensaje de error si la autenticación con Google falla', () => {
      const mockContext = {
        user: null,
        session: null,
        loading: false,
        authError: 'El usuario canceló el inicio de sesión con Google.',
        signInWithGoogle: vi.fn(),
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

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/El usuario canceló el inicio de sesión con Google./i)).toBeInTheDocument();
    });

    it('UT-06: El botón arrow_back permite retornar a la pantalla inicial', () => {
      render(
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/" element={<div data-testid="welcome-screen">Welcome Screen</div>} />
            <Route
              path="/login"
              element={
                <AuthContext.Provider
                  value={{
                    user: null,
                    session: null,
                    loading: false,
                    authError: null,
                    signInWithGoogle: vi.fn(),
                    signOut: vi.fn(),
                    clearError: vi.fn(),
                  }}
                >
                  <LoginPage />
                </AuthContext.Provider>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      const backButtons = screen.getAllByRole('button', { name: /Volver/i });
      fireEvent.click(backButtons[0]);

      expect(screen.getByTestId('welcome-screen')).toBeInTheDocument();
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

  describe('AuthProvider: Supabase Integration & URL Sanitization', () => {
    it('UT-08: signInWithGoogle llama a supabase.auth.signInWithOAuth con proveedor google', async () => {
      render(
        <AuthProvider>
          <AuthContext.Consumer>
            {({ signInWithGoogle }) => (
              <button onClick={() => signInWithGoogle()}>Disparar Google Auth</button>
            )}
          </AuthContext.Consumer>
        </AuthProvider>
      );

      const triggerBtn = screen.getByText('Disparar Google Auth');
      fireEvent.click(triggerBtn);

      await waitFor(() => {
        expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith(
          expect.objectContaining({
            provider: 'google',
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
