import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

// Creación del contexto de autenticación
export const AuthContext = createContext({
  user: null,
  session: null,
  loading: true,
  authError: null,
  signInWithGoogle: async () => {},
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

  // Función para sanitizar fragmentos o códigos/errores OAuth de la barra de direcciones (AC-05)
  const sanitizeUrl = useCallback(() => {
    if (typeof window !== 'undefined') {
      const hasHash = Boolean(window.location.hash);
      const hasSearchAuth =
        window.location.search.includes('code=') ||
        window.location.search.includes('error=') ||
        window.location.search.includes('error_description=');

      if (hasHash || hasSearchAuth) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  // Función para capturar y traducir errores de redirección OAuth de Supabase
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
      let friendlyMessage = 'Ocurrió un error al autenticar con Google.';

      if (errorDescription?.includes('Database error saving new user')) {
        friendlyMessage =
          'Error en la base de datos de Supabase al guardar el usuario. Revisa los triggers o la tabla de perfiles en tu proyecto.';
      } else if (error === 'access_denied' || errorDescription?.includes('denied')) {
        friendlyMessage = 'El acceso con Google fue cancelado por el usuario.';
      } else if (errorDescription) {
        friendlyMessage = decodeURIComponent(errorDescription.replace(/\+/g, ' '));
      }

      return friendlyMessage;
    }

    return null;
  }, []);

  // Inicialización y escucha de eventos de autenticación de Supabase
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      // 1. Verificamos si la URL contiene errores de retorno de OAuth
      const urlError = checkUrlForErrors();
      if (urlError) {
        if (mounted) {
          setAuthError(urlError);
          toast.error(urlError);
        }
        sanitizeUrl();
      }

      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('[Auth Error getSession]:', error.message);
        }
        if (mounted) {
          setSession(initialSession);
          setUser(initialSession?.user ?? null);
          setLoading(false);
          // Sanitizamos la URL si vino con tokens de redirección exitosa
          if (initialSession) {
            sanitizeUrl();
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

    // Suscripción reactiva a cambios de sesión
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        if (!mounted) return;
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setLoading(false);

        if (event === 'SIGNED_IN') {
          sanitizeUrl();
          setAuthError(null);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setSession(null);
        }
      }
    );

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

      const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
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
    signOut,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
