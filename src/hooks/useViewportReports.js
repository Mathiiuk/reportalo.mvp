/**
 * @file useViewportReports.js
 * @description Carga de los reportes del mapa según la zona visible (REP-3805).
 *
 * Antes el mapa pedía una sola vez «los últimos 200 reportes de todo el mapa»: al superar ese volumen, los más viejos
 * dejaban de dibujarse sin avisar. Ahora el mapa avisa su zona visible cuando termina de moverse (`moveend`) y este hook
 * consulta solo esa zona, con tres cuidados:
 *   - Debounce: una ráfaga de movimientos es UNA consulta, con la última zona.
 *   - Se pide la zona visible con un margen y no se reconsulta mientras lo visible siga dentro de lo cargado (salvo que lo
 *     cargado se haya truncado y se acerque el mapa: ver shouldRefetchViewport).
 *   - Las respuestas viejas no pisan a las nuevas, y una consulta que falla conserva los marcadores que ya estaban.
 *
 * Si el mapa nunca avisa su zona (entornos sin WebGL), pasada una espera se carga la zona completa para que la pantalla no
 * quede sin reportes. `enabled: false` es la reversión: una sola consulta global, como antes de REP-3805.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { getPublicMapReports, padBounds, shouldRefetchViewport } from '../services/mapReportsService';
import { CABA_AVELLANEDA_BOUNDS } from '../services/locationService';

/** Espera tras el último movimiento del mapa antes de consultar. */
export const VIEWPORT_DEBOUNCE_MS = 350;
/** Si el mapa no avisó su zona en este tiempo, se carga la zona completa de CABA y Avellaneda. */
export const INITIAL_FALLBACK_MS = 2500;

const FULL_AREA = {
  west: CABA_AVELLANEDA_BOUNDS[0][0],
  south: CABA_AVELLANEDA_BOUNDS[0][1],
  east: CABA_AVELLANEDA_BOUNDS[1][0],
  north: CABA_AVELLANEDA_BOUNDS[1][1],
};

/**
 * @param {object} [options]
 * @param {Function} [options.fetchReports] Consulta de reportes ({ bounds }) → { success, reports, truncated, error }
 * @param {boolean} [options.enabled] false = carga global única (reversión)
 * @param {number} [options.debounceMs]
 * @returns {{ reports: Array, truncated: boolean, isLoading: boolean, error: string|null, onViewportChange: Function }}
 */
export const useViewportReports = ({ fetchReports = getPublicMapReports, enabled = true, debounceMs = VIEWPORT_DEBOUNCE_MS } = {}) => {
  const [reports, setReports] = useState([]);
  const [truncated, setTruncated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const mountedRef = useRef(true);
  const debounceRef = useRef(null);
  const fallbackRef = useRef(null);
  const lastFetchRef = useRef(null); // { bounds, truncated } de la última consulta exitosa
  const pendingRef = useRef(null); // { bounds, truncated } de la consulta en curso (aún sin respuesta)
  const sequenceRef = useRef(0);

  const accept = useCallback((result, bounds, viewport) => {
    setIsLoading(false);
    if (result.success) {
      lastFetchRef.current = { bounds, viewport, truncated: Boolean(result.truncated) };
      setReports(result.reports);
      setTruncated(Boolean(result.truncated));
      setError(null);
    } else {
      // Se conservan los marcadores que ya estaban: una falla de red al mover el mapa no los borra
      setError(result.error ?? 'No se pudieron cargar los reportes.');
    }
  }, []);

  const run = useCallback(
    async (viewport) => {
      // Una consulta en curso cuenta como lo ya pedido: sin esto, dos avisos de la misma zona (p. ej. el inicial y el de
      // cambio de tamaño del mapa) mandaban dos pedidos idénticos.
      if (!shouldRefetchViewport(pendingRef.current ?? lastFetchRef.current, viewport)) return;
      const bounds = padBounds(viewport);
      sequenceRef.current += 1;
      const sequence = sequenceRef.current;
      pendingRef.current = { bounds, viewport, truncated: false };
      const result = await fetchReports({ bounds });
      // Una respuesta que llega después de otra consulta más nueva (o del desmontaje) se descarta
      if (!mountedRef.current || sequence !== sequenceRef.current) return;
      pendingRef.current = null;
      accept(result, bounds, viewport);
    },
    [fetchReports, accept]
  );

  const onViewportChange = useCallback(
    (viewport) => {
      if (!enabled || !viewport) return;
      if (fallbackRef.current) {
        clearTimeout(fallbackRef.current);
        fallbackRef.current = null;
      }
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        run(viewport);
      }, debounceMs);
    },
    [enabled, run, debounceMs]
  );

  useEffect(() => {
    mountedRef.current = true;

    if (!enabled) {
      // Reversión: una sola consulta global, sin zona
      fetchReports({}).then((result) => {
        if (mountedRef.current) accept(result, null, null);
      });
    } else {
      fallbackRef.current = setTimeout(() => {
        fallbackRef.current = null;
        run(FULL_AREA);
      }, INITIAL_FALLBACK_MS);
    }

    return () => {
      mountedRef.current = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (fallbackRef.current) clearTimeout(fallbackRef.current);
      debounceRef.current = null;
      fallbackRef.current = null;
    };
  }, [enabled, fetchReports, run, accept]);

  return { reports, truncated, isLoading, error, onViewportChange };
};
