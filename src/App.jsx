import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './hooks/useAuth';
import { AppLoadingScreen } from './components/common/AppLoadingScreen';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { PwaUpdater } from './components/common/PwaUpdater';
import { getSelectableLocalities } from './services/localitiesService';
import { PendingSyncManager } from './components/common/PendingSyncManager';
import { getSessionMarker, getResumePath, clearResumePath } from './lib/sessionMarker';

// Lazy loading de páginas (Code Splitting - FASE 1)
const WelcomePage = React.lazy(() => import('./pages/WelcomePage').then(m => ({ default: m.WelcomePage })));
const LoginPage = React.lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const CheckEmailPage = React.lazy(() => import('./pages/CheckEmailPage').then(m => ({ default: m.CheckEmailPage })));
const OnboardingPage = React.lazy(() => import('./pages/OnboardingPage').then(m => ({ default: m.OnboardingPage })));
const PermissionsPage = React.lazy(() => import('./pages/PermissionsPage').then(m => ({ default: m.PermissionsPage })));
const TermsAndPermissionsPage = React.lazy(() => import('./pages/TermsAndPermissionsPage').then(m => ({ default: m.TermsAndPermissionsPage })));
const MapPage = React.lazy(() => import('./pages/MapPage').then(m => ({ default: m.MapPage })));
const ReportsPage = React.lazy(() => import('./pages/ReportsPage').then(m => ({ default: m.ReportsPage })));
const ReportDetailPage = React.lazy(() => import('./pages/ReportDetailPage').then(m => ({ default: m.ReportDetailPage })));
const NewsPage = React.lazy(() => import('./pages/NewsPage').then(m => ({ default: m.NewsPage })));
const ProfilePage = React.lazy(() => import('./pages/ProfilePage').then(m => ({ default: m.ProfilePage })));
const BlankAppPage = React.lazy(() => import('./pages/BlankAppPage').then(m => ({ default: m.BlankAppPage })));
const MunicipiosPage = React.lazy(() => import('./pages/MunicipiosPage').then(m => ({ default: m.MunicipiosPage })));
const NewReportPage = React.lazy(() => import('./pages/NewReportPage').then(m => ({ default: m.NewReportPage })));
// ReportDetailPage ya se importa arriba (REP-3789): el bloque lo traia porque su
// base no lo tenia.
const NotificationsPage = React.lazy(() => import('./pages/NotificationsPage').then(m => ({ default: m.NotificationsPage })));
const PendingReportsPage = React.lazy(() => import('./pages/PendingReportsPage').then(m => ({ default: m.PendingReportsPage })));
const SessionExpiredPage = React.lazy(() => import('./pages/SessionExpiredPage').then(m => ({ default: m.SessionExpiredPage })));
const NewsDetailPage = React.lazy(() => import('./pages/NewsDetailPage').then(m => ({ default: m.NewsDetailPage })));
const ForbiddenPage = React.lazy(() => import('./pages/ForbiddenPage').then(m => ({ default: m.ForbiddenPage })));
const NotFoundReportPage = React.lazy(() => import('./pages/NotFoundReportPage').then(m => ({ default: m.NotFoundReportPage })));
const NotFoundPage = React.lazy(() => import('./pages/NotFoundPage').then(m => ({ default: m.NotFoundPage })));

// Componente para proteger rutas autenticadas y forzar el flujo secuencial obligatorio
const ProtectedRoute = ({ children }) => {
  const { session, user, loading } = useAuth();
  const location = useLocation();

  // UJ v3.3 · M23: al llegar a la pantalla que se estaba usando antes de que venciera la
  // sesión, se olvida. Se compara con pathname + search porque así la guarda
  // SessionExpiredPage: comparando solo el pathname, una ruta con query string nunca
  // coincidía y la marca quedaba en el dispositivo para siempre, redirigiendo a esa
  // pantalla vieja en cada paso posterior por /onboarding.
  React.useEffect(() => {
    if (session && getResumePath() === `${location.pathname}${location.search}`) clearResumePath();
  }, [session, location.pathname, location.search]);

  if (loading) {
    return <AppLoadingScreen message="Cargando Reportalo..." />;
  }

  if (!session) {
    // Había sesión y ya no está (no se cerró a mano): «Tu sesión venció» (M23). Si no, bienvenida.
    if (getSessionMarker()) {
      return <Navigate to="/sesion-vencida" replace state={{ from: `${location.pathname}${location.search}` }} />;
    }
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
    // M23: después de reingresar, se retoma la pantalla donde estaba
    return <Navigate to={permissionsConfigured ? (getResumePath() || '/mapa') : '/permisos'} replace />;
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
    <ErrorBoundary>
      <React.Suspense fallback={<AppLoadingScreen message="Cargando..." />}>
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
      {/* REP-3789: detalle del reporte con el fundamento juridico del RAG */}
      <Route
        path="/reportes/:id"
        element={
          <ProtectedRoute>
            <ReportDetailPage />
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
      {/* El detalle del reporte ya tiene su ruta /reportes/:id (REP-3789). El
          bloque proponia /reporte/:id, en singular, tomada del mockup de D17: se
          descarta para no dejar dos rutas hacia la misma pantalla. */}
      {/* UJ v3.3 · M18 / D19 — notificaciones del ciudadano (REP-3791 Bloque 6) */}
      <Route
        path="/notificaciones"
        element={
          <ProtectedRoute>
            <NotificationsPage />
          </ProtectedRoute>
        }
      />
      {/* UJ v3.3 · M25 / D32 — nota completa de una novedad (REP-3791 Bloque 8) */}
      <Route
        path="/novedades/:id"
        element={
          <ProtectedRoute>
            <NewsDetailPage />
          </ProtectedRoute>
        }
      />
      {/* UJ v3.3 · M20 — pendientes de envío (REP-3791 Bloque 4) */}
      <Route
        path="/pendientes"
        element={
          <ProtectedRoute>
            <PendingReportsPage />
          </ProtectedRoute>
        }
      />
      {/* UJ v3.3 · M23 — sesión vencida (pública: se llega justamente sin sesión) */}
      <Route path="/sesion-vencida" element={<SessionExpiredPage />} />
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
      {/* UJ v3.3 · M32 — acceso restringido (REP-3791 Bloque 9) */}
      <Route path="/acceso-restringido" element={<ForbiddenPage />} />
      <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </React.Suspense>
    </ErrorBoundary>
  );
};

export const App = () => {
  React.useEffect(() => {
    // Precargar localidades en localStorage para offline
    getSelectableLocalities().catch(() => {});
  }, []);
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster richColors position="top-center" closeButton />
        <PwaUpdater />
        <PendingSyncManager />
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;

