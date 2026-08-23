// ==============================================================================
// Definición Central de Rutas con Code Splitting (routes/index.jsx)
// ==============================================================================

// Importación de React y utilidades de carga diferida (lazy / Suspense)
import React, { Suspense, lazy } from 'react';
// Importación de componentes de enrutamiento
import { Routes, Route } from 'react-router-dom';
// Importación estática de la Landing inicial para carga inmediata
import { HomePage } from '../pages/HomePage';
// Página 404 personalizada
import { NotFoundPage } from '../pages/NotFoundPage';
// Guardián de rutas protegidas
import { ProtectedRoute } from './ProtectedRoute';
// Spinner visual de carga mientras se descargan los chunks bajo demanda
import { Spinner } from '../components/common/Spinner';

// Carga diferida (Code Splitting) de la pantalla de permisos
const PermisosPage = lazy(() =>
  import('../pages/PermisosPage').then((module) => ({ default: module.PermisosPage }))
);

// Carga diferida (Code Splitting) del módulo pesado del mapa (MapLibre GL JS)
const MapaPage = lazy(() =>
  import('../pages/MapaPage').then((module) => ({ default: module.MapaPage }))
);

// Carga diferida de la sección Reportes
const ReportesPage = lazy(() =>
  import('../pages/ReportesPage').then((module) => ({ default: module.ReportesPage }))
);

// Carga diferida de la sección Alertas
const AlertasPage = lazy(() =>
  import('../pages/AlertasPage').then((module) => ({ default: module.AlertasPage }))
);

// Carga diferida de la sección Perfil
const PerfilPage = lazy(() =>
  import('../pages/PerfilPage').then((module) => ({ default: module.PerfilPage }))
);

export const AppRoutes = () => {
  return (
    // Suspense captura la descarga asíncrona de los módulos y muestra el spinner
    <Suspense
      fallback={
        <div className="min-h-screen w-full flex items-center justify-center bg-surface-muted">
          <Spinner size="lg" />
        </div>
      }
    >
      <Routes>
        {/* Ruta 1: Landing Pública con Carga Inmediata (<120 KB) */}
        <Route path="/" element={<HomePage />} />

        {/* Ruta 2: Permisos (Carga bajo demanda, protegida por sesión) */}
        <Route
          path="/permisos"
          element={
            <ProtectedRoute requireCompletedOnboarding={false}>
              <PermisosPage />
            </ProtectedRoute>
          }
        />

        {/* Ruta 3: Mapa Principal (Carga diferida de MapLibre GL, protegida por sesión y onboarding) */}
        <Route
          path="/map"
          element={
            <ProtectedRoute requireCompletedOnboarding={true}>
              <MapaPage />
            </ProtectedRoute>
          }
        />

        {/* Ruta 4: Reportes (protegida por sesión y onboarding) */}
        <Route
          path="/reports"
          element={
            <ProtectedRoute requireCompletedOnboarding={true}>
              <ReportesPage />
            </ProtectedRoute>
          }
        />

        {/* Ruta 5: Alertas (protegida por sesión y onboarding) */}
        <Route
          path="/alerts"
          element={
            <ProtectedRoute requireCompletedOnboarding={true}>
              <AlertasPage />
            </ProtectedRoute>
          }
        />

        {/* Ruta 6: Perfil (protegida por sesión y onboarding) */}
        <Route
          path="/profile"
          element={
            <ProtectedRoute requireCompletedOnboarding={true}>
              <PerfilPage />
            </ProtectedRoute>
          }
        />

        {/* Ruta 404: Página no encontrada personalizada */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
};
