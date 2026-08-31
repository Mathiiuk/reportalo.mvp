import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './hooks/useAuth';
import { hasAcceptedCurrentTerms, isTermsConsentBlocked, getTermsRejectionRecord } from './services/termsService';
import { WelcomePage } from './pages/WelcomePage';
import { LoginPage } from './pages/LoginPage';
import { CheckEmailPage } from './pages/CheckEmailPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { TermsAndPermissionsPage } from './pages/TermsAndPermissionsPage';
import { MapPage } from './pages/MapPage';
import { ReportsPage } from './pages/ReportsPage';
import { NewsPage } from './pages/NewsPage';
import { ProfilePage } from './pages/ProfilePage';
import { BlankAppPage } from './pages/BlankAppPage';
import { MunicipiosPage } from './pages/MunicipiosPage';

// Componente para proteger rutas autenticadas y forzar el flujo secuencial obligatorio
const ProtectedRoute = ({ children }) => {
  const { session, user, loading } = useAuth();
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

  // 1. Paso 1 obligatorio: Onboarding de 3 pasos
  if (!onboardingCompleted && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  // 2. Si ya completó el onboarding e ingresa a /onboarding, redirigir a /app
  if (onboardingCompleted && location.pathname === '/onboarding') {
    return <Navigate to="/app" replace />;
  }

  const termsAccepted = hasAcceptedCurrentTerms(user?.id);
  const termsRejected = Boolean(getTermsRejectionRecord(user?.id));
  const termsBlocked = isTermsConsentBlocked(user?.id);

  // 3. Blindaje de seguridad: Si los términos están bloqueados o fueron rechazados
  if ((termsRejected || termsBlocked) && location.pathname !== '/terminos') {
    return <Navigate to="/terminos" replace />;
  }

  // 4. Si ya completó ambos pasos obligatorios y entra a /onboarding → llevar a /mapa
  if (onboardingCompleted && termsAccepted && location.pathname === '/onboarding') {
    return <Navigate to="/mapa" replace />;
  }

  // 4b. Si accede a /terminos con T&C vigentes, permitir la consulta voluntaria (desde Perfil)
  //     pero redirigir a /mapa si no hay intención consultiva (acceso directo a la URL).
  const esConsultaVoluntaria = Boolean(location.state?.consultaDesde);
  if (
    onboardingCompleted &&
    termsAccepted &&
    location.pathname === '/terminos' &&
    !esConsultaVoluntaria
  ) {
    return <Navigate to="/mapa" replace />;
  }

  return children;
};

// Componente para redirigir si el usuario ya está autenticado hacia el panel o onboarding
const PublicRoute = ({ children }) => {
  const { session, user, loading } = useAuth();

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

    if (!onboardingCompleted) {
      return <Navigate to="/onboarding" replace />;
    }

    const termsRejected = Boolean(getTermsRejectionRecord(user?.id));
    const termsBlocked = isTermsConsentBlocked(user?.id);

    if (termsRejected || termsBlocked) {
      return <Navigate to="/terminos" replace />;
    }

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
