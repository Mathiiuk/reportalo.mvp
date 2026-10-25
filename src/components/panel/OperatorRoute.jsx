import React, { createContext, useContext, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { AppLoadingScreen } from '../common/AppLoadingScreen';
import { useOperatorProfile } from '../../services/operatorService';
import { saveResumePath, getResumePath, clearResumePath } from '../../lib/sessionMarker';

// Perfil del operador para las pantallas del panel (organismo, nombre visible)
const OperatorContext = createContext(null);
export const useOperator = () => useContext(OperatorContext);

/**
 * REP-3747 · Ruta del panel de organismos: solo operadores de un organismo de prueba.
 *
 * Es un guard de experiencia de uso; los datos los protege la base. Sin sesión, guarda la dirección para volver
 * después del login (ProtectedRoute la retoma) y no hace pasar al operador por el onboarding del vecino. Si la
 * cuenta no es de operador, lleva a /acceso-restringido (caso 6 de las reglas v1.0).
 */
export const OperatorRoute = ({ children }) => {
  const { session, user, loading } = useAuth();
  const location = useLocation();
  const destino = `${location.pathname}${location.search}`;
  const { status, profile } = useOperatorProfile(session ? user?.id : null);

  // Al llegar (o al ser rechazado) la dirección guardada ya no hace falta
  useEffect(() => {
    if (session && status !== 'loading' && getResumePath() === destino) clearResumePath();
  }, [session, status, destino]);

  if (loading) return <AppLoadingScreen message="Cargando el panel..." />;

  if (!session) {
    saveResumePath(destino);
    return <Navigate to="/login" replace />;
  }

  if (status === 'loading') return <AppLoadingScreen message="Verificando tu acceso..." />;

  if (status === 'denied') {
    return <Navigate to="/acceso-restringido" replace state={{ from: destino, sectionLabel: 'Panel de organismos' }} />;
  }

  if (status === 'error') {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-rep-bg px-8 font-manrope">
        <p role="alert" className="m-0 max-w-[440px] text-center text-rep-body text-rep-ink-muted">
          No pudimos verificar tu acceso al panel. Revisá tu conexión y volvé a intentar.
        </p>
      </div>
    );
  }

  return <OperatorContext.Provider value={profile}>{children}</OperatorContext.Provider>;
};
