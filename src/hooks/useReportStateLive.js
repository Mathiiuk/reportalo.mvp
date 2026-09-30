/**
 * @file useReportStateLive.js
 * @description Estado del reporte en vivo (REP-3798): cuando el municipio cambia el estado de un reporte
 * (En revisión → Notificado → Resuelto / Descartado), la pantalla de detalle se entera sin recargar.
 *
 * Los estados cambian por fuera de la app (los actualiza quien atiende el reporte), así que el ciudadano
 * solo los ve si la pantalla se actualiza sola. Estrategia de dos capas, la misma de useReportAnalysisLive:
 *   1. Supabase Realtime sobre report_state_history filtrado por report_id. Esa tabla tiene RLS de
 *      «dueño o quien atiende», así que solo el dueño recibe estos eventos (ver la migración que la publica).
 *   2. Sondeo de respaldo de citizen_reports.current_state_code (una fila por id), porque Realtime puede no
 *      llegar y porque quien mira un reporte ajeno no recibe el historial. Solo corre con la pestaña visible,
 *      y se apaga cuando el reporte llega a un estado de cierre.
 *
 * Nunca lanza: un fallo de red deja la pantalla como estaba.
 */
import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getReportStateSnapshot, getReportStateHistory } from '../services/reportDetailService';
import { isClosedState } from '../components/report/reportStatus';

/** Cada cuánto consulta el respaldo mientras el reporte sigue abierto. */
export const STATE_POLL_INTERVAL_MS = 15000;

/**
 * @param {object} params
 * @param {string|undefined} params.reportId UUID de citizen_reports.id
 * @param {string|undefined} params.stateCode Estado que la pantalla muestra ahora (código de la base)
 * @param {boolean} params.isOwner Si el reporte es del usuario en sesión (solo el dueño recibe el historial)
 * @param {number} [params.intervalMs] Cada cuánto sondea (por defecto 15 s; el acuse de envío usa menos)
 * @param {(update: { stateCode: string, history: Array<object>|null }) => void} params.onUpdate
 *   Se llama cuando el estado cambió; `history` es null si no se pudo leer (reporte ajeno o error).
 */
export const useReportStateLive = ({ reportId, stateCode, isOwner, onUpdate, intervalMs = STATE_POLL_INTERVAL_MS }) => {
  // Refs para no recrear la suscripción en cada render
  const stateRef = useRef(stateCode);
  const onUpdateRef = useRef(onUpdate);
  stateRef.current = stateCode;
  onUpdateRef.current = onUpdate;

  const closed = isClosedState(stateCode);

  useEffect(() => {
    if (!reportId || !stateCode || closed) return undefined;

    let cancelled = false;

    /** Lee el estado actual y avisa solo si cambió. */
    const check = async () => {
      try {
        const { snapshot } = await getReportStateSnapshot(reportId);
        if (cancelled || !snapshot?.current_state_code) return;
        if (snapshot.current_state_code === stateRef.current) return;

        let history = null;
        if (isOwner) {
          const result = await getReportStateHistory(reportId);
          history = result.success ? result.history : null;
        }
        if (cancelled) return;
        onUpdateRef.current?.({ stateCode: snapshot.current_state_code, history });
      } catch {
        // Sin red o sin acceso: se reintenta en el próximo ciclo
      }
    };

    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      check();
    }, intervalMs);

    // Al volver a la pestaña se consulta enseguida, sin esperar al próximo ciclo
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);

    // Realtime: solo el dueño recibe el historial (RLS), y es quien más se beneficia de verlo al instante
    let channel = null;
    if (isOwner && typeof supabase?.channel === 'function') {
      try {
        channel = supabase
          .channel(`report-state-${reportId}`)
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'report_state_history', filter: `report_id=eq.${reportId}` },
            () => check()
          )
          .subscribe();
      } catch {
        channel = null;
      }
    }

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      if (channel && typeof supabase?.removeChannel === 'function') supabase.removeChannel(channel);
    };
  }, [reportId, isOwner, closed, intervalMs, Boolean(stateCode)]);
};

export default useReportStateLive;
