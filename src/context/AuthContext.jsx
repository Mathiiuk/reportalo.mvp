// ==============================================================================
// Contexto Global de Autenticación con Supabase (AuthContext.jsx)
// ==============================================================================

import React, { createContext, useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import {
  signUp as authSignUp,
  signIn as authSignIn,
  signInWithGoogle as authSignInWithGoogle,
  signOut as authSignOut,
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
    // 1. Obtener la sesión activa actual al montar
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });

    // 2. Escuchar cambios de estado de autenticación en tiempo real
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, updatedSession) => {
        setSession(updatedSession);
        setUser(updatedSession?.user ?? null);
        setLoading(false);
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

  // Función de logout
  const signOut = async () => {
    await authSignOut();
    setUser(null);
    setSession(null);
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
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
