import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './hooks/useAuth';
import { WelcomePage } from './pages/WelcomePage';
import { LoginPage } from './pages/LoginPage';
import { CheckEmailPage } from './pages/CheckEmailPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { PermissionsPage } from './pages/PermissionsPage';
import { TermsAndPermissionsPage } from './pages/TermsAndPermissionsPage';
import { MapPage } from './pages/MapPage';
import { ReportsPage } from './pages/ReportsPage';
import { NewsPage } from './pages/NewsPage';
import { ProfilePage } from './pages/ProfilePage';
import { BlankAppPage } from './pages/BlankAppPage';
import { MunicipiosPage } from './pages/MunicipiosPage';
import { NewReportPage } from './pages/NewReportPage';
import { AppLoadingScreen } from './components/common/AppLoadingScreen';
import { NotFoundReportPage } from './pages/NotFoundReportPage';
import { NotFoundPage } from './pages/NotFoundPage';

// Componente para proteger rutas autenticadas y forzar el flujo secuencial obligatorio
const ProtectedRoute = ({ children }) => {
  const { session, user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <AppLoadingScreen message="Cargando Reportalo..." />;
  }

  if (!session) {
    return <Navigate to="/" replace />;
  }

  const onboardingCompleted =
    typeof window !== 'undefined' &&
    localStorage.getItem('reportalo_onboarding_completed') === 'true';

  const permissionsConfigured =
    typeof window !== 'undefined' &&
    localStorage.getItem('reportalo_permissions_configured') === 'true';

  // 1. Paso 1 obligatorio: Onboarding de 3 pasos
  if (!onboardingCompleted && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  // 2. Paso 2 obligatorio por única vez: Activación de permisos
  if (onboardingCompleted && !permissionsConfigured && location.pathname !== '/permisos') {
    return <Navigate to="/permisos" replace />;
  }

  // 3. Si ya completó onboarding e intenta ingresar a /onboarding, redirigir
  if (onboardingCompleted && location.pathname === '/onboarding') {
    return <Navigate to={permissionsConfigured ? '/mapa' : '/permisos'} replace />;
  }

  // 4. Si ya configuró permisos e intenta reingresar a /permisos, redirigir a /mapa
  if (permissionsConfigured && location.pathname === '/permisos') {
    return <Navigate to="/mapa" replace />;
  }

  return children;
};

// Componente para redirigir si el usuario ya está autenticado hacia el panel o onboarding
const PublicRoute = ({ children }) => {
  const { session, user, loading } = useAuth();

  if (loading) {
    return <AppLoadingScreen message="Iniciando Reportalo..." />;
  }

  if (session) {
    const onboardingCompleted =
      typeof window !== 'undefined' &&
      localStorage.getItem('reportalo_onboarding_completed') === 'true';

    const permissionsConfigured =
      typeof window !== 'undefined' &&
      localStorage.getItem('reportalo_permissions_configured') === 'true';

    if (!onboardingCompleted) {
      return <Navigate to="/onboarding" replace />;
    }

    if (!permissionsConfigured) {
      return <Navigate to="/permisos" replace />;
    }

    // Si ya completó onboarding y permisos, accede al mapa
    return <Navigate to="/mapa" replace />;
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
        path="/permisos"
        element={
          <ProtectedRoute>
            <PermissionsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/terminos"
        element={
          <ProtectedRoute>
            <TermsAndPermissionsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/mapa"
        element={
          <ProtectedRoute>
            <MapPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/nuevo-reporte"
        element={
          <ProtectedRoute>
            <NewReportPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reportes"
        element={
          <ProtectedRoute>
            <ReportsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/alertas"
        element={
          <ProtectedRoute>
            <NewsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/novedades"
        element={
          <ProtectedRoute>
            <Navigate to="/alertas" replace />
          </ProtectedRoute>
        }
      />
      <Route
        path="/perfil"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <Navigate to="/mapa" replace />
          </ProtectedRoute>
        }
      />
      <Route
        path="/r/:id"
        element={<NotFoundReportPage />}
      />
      <Route
        path="/municipios"
        element={<MunicipiosPage />}
      />
      <Route
        path="/municipalidad/plan"
        element={<Navigate to="/municipios#planes" replace />}
      />
      <Route path="*" element={<NotFoundPage />} />
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
