import React, { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { HomePage } from '../pages/HomePage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { ProtectedRoute } from './ProtectedRoute';
import { AppLayout } from './AppLayout';
import { AuthCallback } from '../components/auth/AuthCallback';
import { Spinner } from '../components/common/Spinner';

const PermisosPage = lazy(() =>
  import('../pages/PermisosPage').then((module) => ({ default: module.PermisosPage }))
);

const OnboardingPage = lazy(() =>
  import('../pages/OnboardingPage').then((module) => ({ default: module.OnboardingPage }))
);

const TermsPage = lazy(() =>
  import('../pages/TermsPage').then((module) => ({ default: module.TermsPage }))
);

const MapaPage = lazy(() =>
  import('../pages/MapaPage').then((module) => ({ default: module.MapaPage }))
);

const ReportesPage = lazy(() =>
  import('../pages/ReportesPage').then((module) => ({ default: module.ReportesPage }))
);

const AlertasPage = lazy(() =>
  import('../pages/AlertasPage').then((module) => ({ default: module.AlertasPage }))
);

const PerfilPage = lazy(() =>
  import('../pages/PerfilPage').then((module) => ({ default: module.PerfilPage }))
);

export const AppRoutes = () => {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full flex items-center justify-center bg-surface-muted">
          <Spinner size="lg" />
        </div>
      }
    >
      <Routes>
        {/* Rutas públicas */}
        <Route path="/" element={<HomePage />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/terminos" element={<TermsPage />} />
        <Route path="/permisos" element={<PermisosPage />} />

        {/* Rutas protegidas con BottomNav */}
        <Route
          element={
            <ProtectedRoute requireCompletedOnboarding={true}>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/map" element={<MapaPage />} />
          <Route path="/reports" element={<ReportesPage />} />
          <Route path="/alerts" element={<AlertasPage />} />
          <Route path="/profile" element={<PerfilPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
};
