// ==============================================================================
// Contexto Global de Autenticación con Supabase (AuthContext.jsx)
// ==============================================================================

import React, { createContext, useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import {
  signUp as authSignUp,
  signIn as authSignIn,
  signInWithEmail as authSignInWithEmail,
  signInWithGoogle as authSignInWithGoogle,
  signOut as authSignOut,
  cleanOAuthCallbackUrl,
} from '../services/authService';

// Creación del Contexto
export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  // Estado del usuario autenticado
  const [user, setUser] = useState(null);
  // Estado de sesión
  const [session, setSession] = useState(null);
  // Estado de carga inicial mientras se comprueba la sesión
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // SECURITY: Limpiar tokens de la URL después de un callback OAuth
    // Previene que tokens queden expuestos en el historial del navegador
    cleanOAuthCallbackUrl();

    // 1. Obtener la sesión activa actual al montar
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setLoading(false);
    }).catch((error) => {
      // Si falla la obtención de sesión, limpiar estado para evitar estados stale
      console.error('[Auth] Error al obtener sesión:', error);
      setSession(null);
      setUser(null);
      setLoading(false);
    });

    // 2. Escuchar cambios de estado de autenticación en tiempo real
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, updatedSession) => {
        // SECURITY: Log de eventos de autenticación para auditoría
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
          console.info(`[Auth] Evento: ${event}`);
        }

        setSession(updatedSession);
        setUser(updatedSession?.user ?? null);
        setLoading(false);

        // SECURITY: Limpiar URL después de un callback OAuth exitoso
        if (event === 'SIGNED_IN') {
          cleanOAuthCallbackUrl();
        }
      }
    );

    // Limpieza de suscripción al desmontar
    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // Función de registro
  const signUp = async (email, password, metadata) => {
    return authSignUp(email, password, metadata);
  };

  // Función de login con email
  const signIn = async (email, password) => {
    return authSignIn(email, password);
  };

  // Función de login con Google
  const signInWithGoogle = async () => {
    return authSignInWithGoogle();
  };

  // Función de login con Magic Link (email)
  const signInWithEmail = async (email) => {
    return authSignInWithEmail(email);
  };

  // Función de logout
  // SECURITY: Limpieza completa de tokens y estado
  const signOut = async () => {
    try {
      await authSignOut();
    } finally {
      // Siempre limpiar estado local, incluso si la llamada al servidor falla
      setUser(null);
      setSession(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isAuthenticated: !!user,
        signUp,
        signIn,
        signInWithEmail,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
