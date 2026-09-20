/**
 * @file useReportAnalysisLive.js
 * @description Lectura en vivo del análisis jurídico de un reporte (REP-3789).
 *
 * El análisis del RAG no existe en el momento en que el ciudadano envía el
 * reporte: lo produce un pipeline asíncrono (pg_cron + pgmq + pg_net → Edge
 * Function `analizar-reporte`) que tarda del orden de segundos a minutos. Por
 * eso la pantalla de detalle tiene que poder pasar de "procesando" a "resuelto"
 * sin que el usuario recargue.
 *
 * Estrategia de dos capas:
 *   1. Supabase Realtime sobre report_ai_analysis, filtrado por report_id.
 *   2. Polling de respaldo, porque Realtime puede no llegar nunca: la PWA puede
 *      estar recuperándose de un corte de red, el canal puede fallar, o el
 *      evento puede perderse. El polling consulta una sola fila por índice y se
 *      apaga apenas llega el análisis o al agotar el tiempo máximo.
 *
 * Ambas capas se desmontan siempre (canal + timer) en el cleanup del efecto.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { fetchReportAiAnalysis } from '../services/reportAiAnalysisService';

/** Cada cuánto consulta el respaldo mientras el análisis sigue pendiente. */
export const POLL_INTERVAL_MS = 8000;

/**
 * Tope de espera activa. Pasado este tiempo se deja de consultar y la pantalla
 * queda en estado pendiente: el análisis puede llegar más tarde y se verá al
 * volver a entrar. Evita dejar un timer vivo indefinidamente en una PWA.
 */
export const MAX_POLL_MS = 3 * 60 * 1000;

/**
 * Un análisis cuenta como "ya resuelto" cuando existe y trae su estado. Mientras
 * no lo esté, seguimos escuchando.
 *
 * @param {object|null} analysis
 * @returns {boolean}
 */
export const isAnalysisResolved = (analysis) => Boolean(analysis && analysis.result_status_code);

/**
 * @param {string|undefined} reportId UUID de citizen_reports.id
 * @returns {{ analysis: object|null, loading: boolean, error: string|null, mode: string }}
 *   mode: 'idle' | 'realtime' | 'polling' | 'timeout' — expuesto para dejar
 *   evidencia en QA de por qué vía llegó la actualización.
 */
export const useReportAnalysisLive = (reportId) => {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState('idle');

  // Refs para poder limpiar desde el cleanup sin recrear el efecto en cada render.
  const channelRef = useRef(null);
  const timerRef = useRef(null);
  const mountedRef = useRef(true);
  const resolvedRef = useRef(false);

  /** Corta las dos capas de escucha. Idempotente. */
  const stopListening = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    resolvedRef.current = false;

    if (!reportId) {
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    setError(null);
    setAnalysis(null);
    setMode('idle');

    /**
     * Consulta el análisis y, si ya está resuelto, apaga la escucha.
     * @param {boolean} isFirstRead Marca la lectura inicial, la única que apaga `loading`.
     */
    const readAnalysis = async (isFirstRead = false) => {
      const { analysis: row, error: readError } = await fetchReportAiAnalysis(supabase, reportId);
      if (!mountedRef.current) return;

      if (readError) {
        // Un fallo del respaldo no debe romper la pantalla: el reporte se sigue
        // viendo y el panel queda en estado pendiente.
        if (isFirstRead) {
          setError(readError);
          setLoading(false);
        }
        return;
      }

      if (isFirstRead) setLoading(false);

      if (isAnalysisResolved(row)) {
        resolvedRef.current = true;
        setAnalysis(row);
        stopListening();
      }
    };

    const startedAt = Date.now();

    const startFallbackPolling = () => {
      if (timerRef.current) return;
      timerRef.current = setInterval(() => {
        if (!mountedRef.current || resolvedRef.current) {
          stopListening();
          return;
        }
        if (Date.now() - startedAt > MAX_POLL_MS) {
          stopListening();
          if (mountedRef.current) setMode('timeout');
          return;
        }
        readAnalysis(false);
      }, POLL_INTERVAL_MS);
    };

    // 1) Lectura inicial. Si el análisis ya estaba hecho, no se escucha nada más.
    readAnalysis(true).then(() => {
      if (!mountedRef.current || resolvedRef.current) return;

      // 2) Realtime como vía principal.
      const channel = supabase
        .channel(`report-analysis-${reportId}`)
        .on(
          'postgres_changes',
          {
            event: '*', // INSERT al persistirse; UPDATE si el pipeline reintenta.
            schema: 'public',
            table: 'report_ai_analysis',
            filter: `report_id=eq.${reportId}`,
          },
          () => {
            // El payload de Realtime no trae la evidencia ni el hierarchy_path
            // (son joins), así que se relee por el servicio en vez de confiar
            // en payload.new: garantiza que lo mostrado sea lo mismo que
            // devuelve el backend por la vía normal.
            readAnalysis(false);
          }
        )
        .subscribe((status) => {
          if (!mountedRef.current) return;
          if (status === 'SUBSCRIBED') {
            setMode('realtime');
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            setMode('polling');
          }
        });

      channelRef.current = channel;

      // 3) Respaldo siempre activo mientras esté pendiente: cubre tanto el canal
      //    caído como el evento perdido.
      startFallbackPolling();
    });

    return () => {
      mountedRef.current = false;
      stopListening();
    };
  }, [reportId, stopListening]);

  return { analysis, loading, error, mode };
};
