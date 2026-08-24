import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../utils/supabase';
import { cleanAuthCallbackUrl } from '../../services/authService';
import { useOnboarding } from '../../hooks/useOnboarding';
import { Spinner } from '../common/Spinner';
import { AlertTriangle } from 'lucide-react';

export const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { onboardingStatus } = useOnboarding();
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Supabase PKCE: el code está en query params
        const code = searchParams.get('code');
        const tokenHash = searchParams.get('token_hash');
        const type = searchParams.get('type');

        // Si hay code (PKCE flow), Supabase lo maneja automáticamente
        // al llamar getSession() o al detectar el cambio de auth state
        if (code || tokenHash) {
          // Esperar a que Supabase procese el token
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();

          if (sessionError) {
            console.error('[AuthCallback] Error obteniendo sesión:', sessionError);
            setError('No se pudo verificar tu identidad. Intentá de nuevo.');
            return;
          }

          if (session) {
            // Sesión establecida exitosamente
            cleanAuthCallbackUrl();

            // Redirigir según estado de onboarding
            const user = session.user;
            const hasCompletedInMetadata = user?.user_metadata?.onboarding_completed === true;

            if (hasCompletedInMetadata) {
              navigate('/map', { replace: true });
            } else {
              navigate('/onboarding', { replace: true });
            }
          } else {
            // No se pudo establecer sesión
            setError('El link expiró o ya fue utilizado. Pedí uno nuevo.');
          }
        } else {
          // No hay token en la URL — link inválido o expirado
          setError('Link inválido. Pedí un nuevo enlace mágico.');
        }
      } catch (err) {
        console.error('[AuthCallback] Error inesperado:', err);
        setError('Ocurrió un error inesperado. Intentá de nuevo.');
      }
    };

    handleCallback();
  }, [searchParams, navigate, onboardingStatus]);

  if (error) {
    return (
      <div className="min-h-[100dvh] w-full flex items-center justify-center px-6" style={{ background: 'var(--color-bg)' }}>
        <div className="max-w-sm w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-lg font-extrabold mb-2" style={{ color: 'var(--color-text-primary)' }}>
            Error de autenticación
          </h1>
          <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
            {error}
          </p>
          <button
            type="button"
            onClick={() => navigate('/', { replace: true })}
            className="w-full py-3 rounded-xl bg-primary text-white text-sm font-bold active:bg-primary-dark transition-colors cursor-pointer"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
      <div className="text-center">
        <Spinner size="lg" />
        <p className="text-sm mt-4 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
          Verificando tu identidad...
        </p>
      </div>
    </div>
  );
};
