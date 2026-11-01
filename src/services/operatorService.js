import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

/**
 * REP-3747 · Perfil del operador de un organismo de prueba.
 *
 * Lee la fila propia de `profiles` (su policy solo devuelve la del usuario con sesión) con el organismo vinculado.
 * Sirve para la experiencia de uso del panel: qué mostrar y a quién mandar a /acceso-restringido. La autorización
 * real de los datos la hace la base (profile_attends_report en las policies).
 *
 * @param {string} userId id del usuario con sesión
 * @returns {Promise<{ role: string, agency: { id: string, name: string, code: string|null, is_test: boolean } } | null>}
 *   el perfil si es operador con organismo vinculado; null si no lo es
 */
export const fetchOperatorProfile = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('role, agency:agencies(id, name, code, is_test)')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  // Solo cuenta como operador un perfil «organismo» con su organismo vinculado
  if (!data || data.role !== 'organismo' || !data.agency) return null;
  return { role: data.role, agency: data.agency };
};

/**
 * Estado del perfil de operador para el usuario dado.
 * status: 'loading' | 'operator' | 'denied' | 'error'
 */
export const useOperatorProfile = (userId) => {
  const [state, setState] = useState({ status: 'loading', profile: null });

  useEffect(() => {
    let cancelado = false;
    if (!userId) return undefined;

    setState({ status: 'loading', profile: null });
    fetchOperatorProfile(userId)
      .then((profile) => {
        if (!cancelado) setState({ status: profile ? 'operator' : 'denied', profile });
      })
      .catch(() => {
        if (!cancelado) setState({ status: 'error', profile: null });
      });

    return () => {
      cancelado = true;
    };
  }, [userId]);

  return state;
};
