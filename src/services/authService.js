// ==============================================================================
// Servicio de Autenticación de Supabase (authService.js)
// ==============================================================================

// Importación del cliente configurado de Supabase y utilidades de seguridad
import { supabase, getSecureRedirectUrl, validateRedirectUrl } from '../utils/supabase';

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

// Enviar magic link (OTP) al email del usuario
// SECURITY: Usa redirect URL validado para prevenir open redirect attacks
export const signInWithEmail = async (email) => {
  // Para magic links, redirigir a /auth/callback que verifica el token
  const redirectUrl = `${getSecureRedirectUrl()}/auth/callback`;

  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // URL a la que Supabase redirige después de verificar el link
      emailRedirectTo: redirectUrl,
    },
  });

  if (error) {
    throw error;
  }

  return data;
};

// Iniciar sesión o registrarse mediante Google OAuth
// SECURITY: Usa redirect URL validado para prevenir open redirect attacks
export const signInWithGoogle = async () => {
  // SECURITY: Obtener y validar origin contra whitelist de orígenes permitidos
  const redirectUrl = getSecureRedirectUrl();

  // SECURITY: Validar que el redirect URL sea seguro antes de usarlo
  // Previene open redirect attacks si el origin fuera manipulado
  if (!validateRedirectUrl(redirectUrl)) {
    throw new Error('Redirect URL no permitido por seguridad.');
  }

  // Redirección OAuth con proveedor Google hacia el origen seguro de la app
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl,
      // SECURITY: Configurar opciones de OAuth para mayor seguridad
      queryParams: {
        // Forzar consent screen en cada login (previene session fixation)
        prompt: 'select_account',
      },
    },
  });

  if (error) {
    throw error;
  }

  return data;
};

// Cerrar sesión activa del usuario
// SECURITY: Limpieza completa de tokens y estado del cliente
export const signOut = async () => {
  // Llamada a sign out en Supabase (invalida tokens en el servidor)
  const { error } = await supabase.auth.signOut({
    // SECURITY: scope='global' invalida TODOS los refresh tokens del usuario
    // en todos los dispositivos, no solo el actual
    scope: 'global',
  });

  if (error) {
    throw error;
  }

  // SECURITY: Limpiar cualquier dato residual de sesión del almacenamiento local
  try {
    // Supabase guarda tokens con este prefijo
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Ignorar errores de localStorage (puede estar bloqueado en modo privado)
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

// SECURITY: Limpiar tokens de la URL después del callback OAuth o Magic Link
// Previene que tokens queden expuestos en el historial del navegador
export const cleanAuthCallbackUrl = () => {
  const url = new URL(window.location.href);
  let cleaned = false;

  // Limpiar hash fragments con tokens (OAuth)
  if (url.hash && (url.hash.includes('access_token') || url.hash.includes('refresh_token'))) {
    url.hash = '';
    cleaned = true;
  }

  // Limpiar query params de tokens (Magic Link)
  const tokenParams = ['token_hash', 'type', 'access_token', 'refresh_token'];
  for (const param of tokenParams) {
    if (url.searchParams.has(param)) {
      url.searchParams.delete(param);
      cleaned = true;
    }
  }

  // Limpiar query params de error de OAuth/Magic Link
  if (url.searchParams.has('error') || url.searchParams.has('error_code')) {
    url.searchParams.delete('error');
    url.searchParams.delete('error_code');
    url.searchParams.delete('error_description');
    cleaned = true;
  }

  if (cleaned) {
    // Reconstruir URL limpia (pathname + search restante)
    const cleanUrl = url.pathname + (url.search ? url.search : '');
    window.history.replaceState({}, document.title, cleanUrl);
  }
};

// Mantener compatibilidad con código existente
export const cleanOAuthCallbackUrl = cleanAuthCallbackUrl;
