/**
 * @file useReportImageAnalysis.js
 * @description Lectura de la verificación visual de las fotos de un reporte, con espera mientras llega (REP-3820).
 *
 * El resultado lo produce un pipeline asíncrono (cola → analizar-imagen-reporte, REP-3817/3818) que tarda del orden de
 * segundos después de enviar el reporte. Se consulta al entrar y, mientras falten resultados, cada 8 s hasta un tope de
 * 3 minutos (mismos tiempos que useReportAnalysisLive).
 *
 * DECISIÓN: solo sondeo, sin Realtime. report_image_analysis no está publicada en supabase_realtime (REP-3817 dejó la
 * decisión para este ticket); publicarla pide otra migración. El sondeo cubre la necesidad (el bloque aparece solo, sin
 * recargar) y se puede cambiar por Realtime más adelante sin tocar la pantalla.
 *
 * Falla blanda: si la lectura falla, no hay bloque (el reporte y el fundamento legal se ven igual). Un error de red no
 * debe romper ni ensuciar el detalle.
 */

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { fetchReportImageAnalyses } from '../services/reportImageAnalysisService';

export const IMAGE_ANALYSIS_POLL_INTERVAL_MS = 8000;
export const IMAGE_ANALYSIS_MAX_POLL_MS = 3 * 60 * 1000;
/** Errores de lectura seguidos tras los cuales se deja de insistir (p. ej. sin permiso o tabla inexistente). */
export const IMAGE_ANALYSIS_MAX_CONSECUTIVE_ERRORS = 3;

/**
 * @param {object} params
 * @param {string|undefined} params.reportId UUID del reporte
 * @param {number} params.imageCount Cantidad de fotos del reporte: se espera un resultado por cada una
 * @param {boolean} [params.enabled] false = no se consulta nada (p. ej. reporte ajeno: RLS no deja leerlo)
 * @returns {{ results: Array<object>, loading: boolean }}
 */
export const useReportImageAnalysis = ({ reportId, imageCount, enabled = true }) => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(Boolean(enabled && reportId));
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (!enabled || !reportId || !imageCount) {
      setResults([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    let timer = null;
    let consecutiveErrors = 0;
    const startedAt = Date.now();

    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    const read = async () => {
      const { results: rows, error } = await fetchReportImageAnalyses(supabase, reportId);
      if (!mountedRef.current) return;
      setLoading(false);
      // Falla blanda: sin bloque. El sondeo sigue por si la próxima lectura sí funciona, pero no se insiste a ciegas
      if (error) {
        consecutiveErrors += 1;
        if (consecutiveErrors >= IMAGE_ANALYSIS_MAX_CONSECUTIVE_ERRORS) stop();
        return;
      }
      consecutiveErrors = 0;
      setResults(rows);
      // Cada foto ya tiene su resultado: no hay nada más que esperar
      if (rows.length >= imageCount) stop();
    };

    read();
    timer = setInterval(() => {
      if (!mountedRef.current || Date.now() - startedAt > IMAGE_ANALYSIS_MAX_POLL_MS) {
        stop();
        return;
      }
      read();
    }, IMAGE_ANALYSIS_POLL_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      stop();
    };
  }, [reportId, imageCount, enabled]);

  return { results, loading };
};
