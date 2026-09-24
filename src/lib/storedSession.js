import { supabase } from './supabaseClient';

/**
 * Lee de forma síncrona la sesión que supabase-js dejó guardada en el teléfono.
 *
 * Sirve para arrancar la app sin esperar a la red: `supabase.auth.getSession()` es
 * asíncrono y, si el token de acceso venció (dura 1 h), primero intenta renovarlo
 * contra el servidor. Con poca señal eso deja la app en «Cargando...» durante
 * segundos, y sin señal auth-js avisa `null` aunque la sesión siga guardada.
 *
 * Solo se usa para decidir qué pantalla mostrar: el servidor sigue validando cada
 * pedido con su token (RLS), así que no da más acceso del que ya había.
 *
 * @returns {object|null} La sesión guardada, o null si no hay una utilizable
 */
export const readStoredSession = () => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    // La clave la define supabase-js (sb-<proyecto>-auth-token); no se arma a mano
    const storageKey = supabase?.auth?.storageKey;
    if (!storageKey) return null;
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const session = JSON.parse(raw);
    // Sin refresh_token no se puede renovar, y sin usuario no hay a quién mostrarle la app
    if (!session?.access_token || !session?.refresh_token || !session?.user?.id) return null;
    return session;
  } catch {
    // JSON roto o almacenamiento bloqueado (modo privado): se sigue el camino normal
    return null;
  }
};

export default readStoredSession;
