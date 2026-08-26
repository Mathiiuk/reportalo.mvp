import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './hooks/useAuth';
import { WelcomePage } from './pages/WelcomePage';
import { LoginPage } from './pages/LoginPage';
import { CheckEmailPage } from './pages/CheckEmailPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { BlankAppPage } from './pages/BlankAppPage';
import { MunicipiosPage } from './pages/MunicipiosPage';

// Componente para proteger rutas autenticadas y verificar onboarding
const ProtectedRoute = ({ children }) => {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#1E6FCB]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
          <span className="text-white font-manrope font-semibold text-xs tracking-wider">
            Cargando Reportalo...
          </span>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/" replace />;
  }

  const onboardingCompleted =
    typeof window !== 'undefined' &&
    localStorage.getItem('reportalo_onboarding_completed') === 'true';

  // Si no completó el onboarding y no está ya en /onboarding, redirigir a /onboarding
  if (!onboardingCompleted && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  // Si ya completó el onboarding y accede a /onboarding, redirigir a /app
  if (onboardingCompleted && location.pathname === '/onboarding') {
    return <Navigate to="/app" replace />;
  }

  return children;
};

// Componente para redirigir si el usuario ya está autenticado
const PublicRoute = ({ children }) => {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#1E6FCB]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
          <span className="text-white font-manrope font-semibold text-xs tracking-wider">
            Cargando Reportalo...
          </span>
        </div>
      </div>
    );
  }

  if (session) {
    const onboardingCompleted =
      typeof window !== 'undefined' &&
      localStorage.getItem('reportalo_onboarding_completed') === 'true';
    return <Navigate to={onboardingCompleted ? '/app' : '/onboarding'} replace />;
  }

  return children;
};

export const AppRoutes = () => {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <PublicRoute>
            <WelcomePage />
          </PublicRoute>
        }
      />
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/check-email"
        element={
          <PublicRoute>
            <CheckEmailPage />
          </PublicRoute>
        }
      />
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <OnboardingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <BlankAppPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/municipios"
        element={<MunicipiosPage />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export const App = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster richColors position="top-center" closeButton />
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
