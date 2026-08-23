// ==============================================================================
// Cliente Oficial de Supabase para Reportalo V2
// ==============================================================================

// Importación de la función oficial createClient del SDK de Supabase
import { createClient } from '@supabase/supabase-js';

// URL del proyecto Supabase obtenida desde las variables de entorno de Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://yryuhyiujyignkdhiyua.supabase.co';

// Clave pública (anon/publishable key) de Supabase
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_65y1Sy--E7CUy6hbITMBvA_FujoiNrU';

// Instanciación y exportación del cliente singleton de Supabase
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    // Persistir la sesión en localStorage del navegador
    persistSession: true,
    // Auto-refrescar tokens antes de que expiren
    autoRefreshToken: true,
    // Detectar sesión en la URL en redirecciones OAuth
    detectSessionInUrl: true,
  },
});
