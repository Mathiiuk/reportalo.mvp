import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { syncTermsConsentWithRemote } from '../services/termsService';

// Creación del contexto de autenticación
export const AuthContext = createContext({
  user: null,
  session: null,
  loading: true,
  authError: null,
  signInWithGoogle: async () => {},
  signInWithMagicLink: async () => {},
  signOut: async () => {},
  clearError: () => {},
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Limpiar mensaje de error
  const clearError = useCallback(() => {
    setAuthError(null);
  }, []);

  // Función para sanitizar fragmentos o códigos/errores OAuth y Magic Link de la barra de direcciones
  const sanitizeUrl = useCallback(() => {
    if (typeof window !== 'undefined') {
      const hasHash = Boolean(window.location.hash);
      const hasSearchAuth =
        window.location.search.includes('code=') ||
        window.location.search.includes('error=') ||
        window.location.search.includes('error_description=') ||
        window.location.search.includes('access_token=') ||
        window.location.search.includes('type=magiclink') ||
        window.location.search.includes('type=recovery');

      if (hasHash || hasSearchAuth) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  // Función para capturar y traducir errores de redirección OAuth y Magic Link de Supabase
  const checkUrlForErrors = useCallback(() => {
    if (typeof window === 'undefined') return null;

    const searchParams = new URLSearchParams(window.location.search);
    const hashString = window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash;
    const hashParams = new URLSearchParams(hashString);

    const error = searchParams.get('error') || hashParams.get('error');
    const errorCode = searchParams.get('error_code') || hashParams.get('error_code');
    const errorDescription =
      searchParams.get('error_description') || hashParams.get('error_description');

    if (error || errorDescription || errorCode) {
      let friendlyMessage = 'Ocurrió un error al autenticar con el enlace.';

      if (
        errorCode === 'otp_expired' ||
        errorDescription?.toLowerCase().includes('otp') ||
        errorDescription?.toLowerCase().includes('expired') ||
        errorDescription?.toLowerCase().includes('invalid')
      ) {
        friendlyMessage = 'El enlace de acceso ha expirado o ya fue utilizado. Por favor, solicita uno nuevo.';
      } else if (errorDescription?.includes('Database error saving new user')) {
        friendlyMessage =
          'Error en la base de datos de Supabase al guardar el usuario. Revisa los triggers o la tabla de perfiles en tu proyecto.';
      } else if (error === 'access_denied' || errorDescription?.includes('denied')) {
        friendlyMessage = 'El acceso fue cancelado o no autorizado.';
      } else if (errorDescription) {
        friendlyMessage = decodeURIComponent(errorDescription.replace(/\+/g, ' '));
      }

      return friendlyMessage;
    }

    return null;
  }, []);

  // Inicialización y escucha reactiva de eventos de autenticación
  useEffect(() => {
    let mounted = true;

    // Detectamos si la URL contiene fragmentos de retorno de OAuth o Magic Link
    const isHandlingAuthRedirect =
      typeof window !== 'undefined' &&
      (window.location.hash.includes('access_token') ||
        window.location.search.includes('code='));

    // Suscripción reactiva a cambios de sesión
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        if (!mounted) return;
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setLoading(false);

        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
          if (currentSession) {
            sanitizeUrl();
            setAuthError(null);
            if (currentSession.user?.id) {
              syncTermsConsentWithRemote(currentSession.user.id).catch(() => {});
            }
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setSession(null);
        }
      }
    );

    // Verificación inicial de sesión
    const initAuth = async () => {
      const urlError = checkUrlForErrors();
      if (urlError) {
        if (mounted) {
          setAuthError(urlError);
          toast.error(urlError);
          setLoading(false);
        }
        sanitizeUrl();
        return;
      }

      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('[Auth Error getSession]:', error.message);
        }
        if (mounted) {
          if (initialSession) {
            setSession(initialSession);
            setUser(initialSession.user ?? null);
            setLoading(false);
            sanitizeUrl();
            if (initialSession.user?.id) {
              syncTermsConsentWithRemote(initialSession.user.id).catch(() => {});
            }
          } else if (!isHandlingAuthRedirect) {
            // Solo desactivamos loading si no estamos esperando la resolución del hash OAuth
            setLoading(false);
          }
        }
      } catch (err) {
        console.error('[Auth Init Unexpected Error]:', err);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initAuth();

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [checkUrlForErrors, sanitizeUrl]);

  // Iniciar sesión con Google OAuth
  const signInWithGoogle = async () => {
    setAuthError(null);
    try {
      if (!isSupabaseConfigured) {
        const errorMsg = 'Supabase no está configurado con credenciales válidas en .env';
        setAuthError(errorMsg);
        toast.error(errorMsg);
        return { data: null, error: new Error(errorMsg) };
      }

      // Redirigir directamente al onboarding post autenticación
      const redirectTo =
        typeof window !== 'undefined' ? `${window.location.origin}/onboarding` : undefined;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        setAuthError(error.message || 'Error al iniciar sesión con Google.');
        toast.error(error.message || 'Error al iniciar sesión con Google.');
        return { data: null, error };
      }

      return { data, error: null };
    } catch (err) {
      const message = err?.message || 'Ocurrió un error inesperado al conectar con Google.';
      setAuthError(message);
      toast.error(message);
      return { data: null, error: err };
    }
  };

  // Iniciar sesión con Magic Link (REP-2101)
  const signInWithMagicLink = async (email) => {
    setAuthError(null);
    try {
      if (!isSupabaseConfigured) {
        const errorMsg = 'Supabase no está configurado con credenciales válidas en .env';
        setAuthError(errorMsg);
        toast.error(errorMsg);
        return { data: null, error: new Error(errorMsg) };
      }

      const normalizedEmail = email?.trim().toLowerCase();
      if (!normalizedEmail) {
        const errorMsg = 'Por favor ingresa un correo electrónico.';
        setAuthError(errorMsg);
        toast.error(errorMsg);
        return { data: null, error: new Error(errorMsg) };
      }

      const redirectTo =
        typeof window !== 'undefined' ? `${window.location.origin}/onboarding` : undefined;

      const { data, error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          emailRedirectTo: redirectTo,
          shouldCreateUser: true,
        },
      });

      if (error) {
        setAuthError(error.message || 'Error al solicitar el enlace de acceso.');
        toast.error(error.message || 'Error al solicitar el enlace de acceso.');
        return { data: null, error };
      }

      return { data, error: null };
    } catch (err) {
      const message = err?.message || 'Ocurrió un error inesperado al enviar el enlace.';
      setAuthError(message);
      toast.error(message);
      return { data: null, error: err };
    }
  };

  // Cerrar sesión
  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('[Auth signOut Error]:', error.message);
      }
      setUser(null);
      setSession(null);
      toast.info('Sesión cerrada correctamente.');
    } catch (err) {
      console.error('[Auth signOut Unexpected Error]:', err);
    }
  };

  const value = {
    user,
    session,
    loading,
    authError,
    signInWithGoogle,
    signInWithMagicLink,
    signOut,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
