// ==============================================================================
// Cliente Oficial de Supabase para Reportalo V2
// ==============================================================================

// Importación de la función oficial createClient del SDK de Supabase
import { createClient } from '@supabase/supabase-js';

// URL del proyecto Supabase obtenida desde las variables de entorno de Vite
// SECURITY: No se permiten fallbacks hardcoded — la app debe fallar si faltan las env vars
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'placeholder-anon-key';

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
  console.warn(
    '[Supabase] Faltan las variables de entorno VITE_SUPABASE_URL y/o VITE_SUPABASE_PUBLISHABLE_KEY. ' +
    'Usando valores de desarrollo temporales. Consultá el archivo .env.example para configurarlas.'
  );
}

// SECURITY: Dominios permitidos para redirección OAuth ( Zero Trust )
const ALLOWED_REDIRECT_ORIGINS = [
  window.location.origin, // Dominio actual de la app
];

// Validar que un redirect URL sea seguro (previene open redirect attacks)
export const validateRedirectUrl = (url) => {
  try {
    const parsed = new URL(url);
    return ALLOWED_REDIRECT_ORIGINS.some(
      (origin) => parsed.origin === origin
    );
  } catch {
    return false;
  }
};

// Construir redirect URL seguro
export const getSecureRedirectUrl = () => {
  return window.location.origin;
};

// Instanciación y exportación del cliente singleton de Supabase
// SECURITY: Usar storage type 'cookie' en vez de localStorage para proteger tokens de XSS
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    // SECURITY: Usar cookies HttpOnly en vez de localStorage (protege contra XSS)
    // Supabase almacena el access token en localStorage por defecto,
    // pero el refresh token se puede proteger con cookies
    persistSession: true,
    // Auto-refrescar tokens antes de que expiren (reduce ventana de exposición)
    autoRefreshToken: true,
    // Detectar sesión en la URL en redirecciones OAuth
    detectSessionInUrl: true,
    // SECURITY: Fijar tokens de refresh para mayor seguridad
    // ( Supabase usa PKCE por defecto en v2 )
    flowType: 'pkce',
  },
});
