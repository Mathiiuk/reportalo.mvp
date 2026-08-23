// ==============================================================================
// Definición Central de Rutas de la Aplicación (routes/index.jsx)
// ==============================================================================

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { HomePage } from '../pages/HomePage';
import { PermisosPage } from '../pages/PermisosPage';
import { MapaPage } from '../pages/MapaPage';
import { ProtectedRoute } from './ProtectedRoute';

export const AppRoutes = () => {
  return (
    <Routes>
      {/* Ruta 1: Landing Pública con Colapso de Auth */}
      <Route path="/" element={<HomePage />} />

      {/* Ruta 2: Permisos (Protegida: Requiere Autenticación) */}
      <Route
        path="/permisos"
        element={
          <ProtectedRoute requireCompletedOnboarding={false}>
            <PermisosPage />
          </ProtectedRoute>
        }
      />

      {/* Ruta 3: Mapa Principal (Protegida: Requiere Autenticación y Onboarding Completado) */}
      <Route
        path="/map"
        element={
          <ProtectedRoute requireCompletedOnboarding={true}>
            <MapaPage />
          </ProtectedRoute>
        }
      />

      {/* Redirección por defecto a Home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
