// ==============================================================================
// Guardián de Rutas Protegidas (ProtectedRoute.jsx)
// ==============================================================================

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useOnboarding } from '../hooks/useOnboarding';
import { Spinner } from '../components/common/Spinner';

export const ProtectedRoute = ({ children, requireCompletedOnboarding = false }) => {
  const { isAuthenticated, loading } = useAuth();
  const { isCompleted } = useOnboarding();
  const location = useLocation();

  // 1. Mientras Supabase comprueba la sesión, mostrar spinner
  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-surface-muted">
        <Spinner size="lg" />
      </div>
    );
  }

  // 2. Si el usuario no está autenticado, redirigir a la landing (Home)
  if (!isAuthenticated) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // 3. Si la ruta requiere onboarding completado y el usuario no lo completó, enviar a /permisos
  if (requireCompletedOnboarding && !isCompleted) {
    return <Navigate to="/permisos" replace />;
  }

  // 4. Usuario autenticado y con permisos válidos
  return children;
};
