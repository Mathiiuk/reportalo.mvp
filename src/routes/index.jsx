// ==============================================================================
// Definición Central de Rutas con Code Splitting (routes/index.jsx)
// ==============================================================================

// Importación de React y utilidades de carga diferida (lazy / Suspense)
import React, { Suspense, lazy } from 'react';
// Importación de componentes de enrutamiento
import { Routes, Route, Navigate } from 'react-router-dom';
// Importación estática de la Landing inicial para carga inmediata
import { HomePage } from '../pages/HomePage';
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

        {/* Redirección automática de rutas no encontradas a Home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};
