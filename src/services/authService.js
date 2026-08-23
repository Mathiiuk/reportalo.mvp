// ==============================================================================
// Servicio de Autenticación de Supabase (authService.js)
// ==============================================================================

// Importación del cliente configurado de Supabase
import { supabase } from '../utils/supabase';

// Registrar un nuevo usuario con email, contraseña y metadatos
export const signUp = async (email, password, metadata = {}) => {
  // Llamada a la API de Supabase Auth para registro
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata, // Incluye full_name u otros atributos
    },
  });

  // Si hay error en la solicitud, lanzar excepción con el mensaje recibido
  if (error) {
    throw error;
  }

  return data;
};

// Iniciar sesión con email y contraseña
export const signIn = async (email, password) => {
  // Llamada a la API de Supabase Auth para login
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  // Si las credenciales fallan o hay error de red
  if (error) {
    throw error;
  }

  return data;
};

// Iniciar sesión o registrarse mediante Google OAuth
export const signInWithGoogle = async () => {
  // Redirección OAuth con proveedor Google
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + '/permisos',
    },
  });

  if (error) {
    throw error;
  }

  return data;
};

// Cerrar sesión activa del usuario
export const signOut = async () => {
  // Llamada a sign out en Supabase
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }

  return true;
};

// Obtener el usuario autenticado actualmente
export const getCurrentUser = async () => {
  // Consulta del usuario en la sesión activa
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error) {
    return null;
  }

  return user;
};

// Obtener la sesión activa
export const getSession = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error) {
    return null;
  }

  return session;
};
