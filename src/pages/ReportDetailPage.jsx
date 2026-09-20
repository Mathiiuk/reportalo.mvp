import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { ArrowLeft, MapPin, ChevronRight, Share2, Ban, ImageOff } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import {
  getReportDetail,
  getReportStateHistory,
  buildTimeline,
  getStateMeta,
  isOwnedBy,
  buildShortCode,
} from '../services/reportDetailService';
import { useReportAnalysisLive } from '../hooks/useReportAnalysisLive';
import { ReportAiAnalysisPanel } from '../components/report/ReportAiAnalysisPanel';
import { ReportTimeline } from '../components/report/ReportTimeline';

/**
 * Detalle de un reporte ciudadano (REP-3789).
 *
 * Es la pantalla donde el fundamento jurídico del RAG se vuelve visible para el
 * ciudadano: hasta ahora el análisis se producía y se persistía en backend
 * (REP-2908 / REP-2909) pero no tenía ningún punto de entrada en la interfaz.
 *
 * El análisis llega de forma asíncrona, así que el panel se alimenta de
 * useReportAnalysisLive (Realtime + polling de respaldo) y no de una lectura
 * única: la pantalla pasa de "procesando" a "fundamentado" sin recargar.
 *
 * Las etiquetas de estado salen de REPORT_STATE_META (fuente única de verdad en
 * reportDetailService); acá solo vive el color de cada insignia.
 *
 * NOTA: supabase/seed.sql sigue desactualizado — declara códigos en minúscula
 * que no existen en producción. Se reportó por separado.
 */

const BADGE_COLORS = {
  RECIBIDO: 'text-[#1E6FCB] bg-[#EEF5FC]',
  EN_ANALISIS: 'text-[#1E6FCB] bg-[#EEF5FC]',
  DERIVADO: 'text-[#E08A00] bg-[#FFF6E9]',
  RESUELTO: 'text-[#2E9E6B] bg-[#E3F5EC]',
  DESESTIMADO: 'text-[#7A8696] bg-[#F1F4F8]',
};
const FALLBACK_COLOR = 'text-[#7A8696] bg-[#F1F4F8]';

export const ReportDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [report, setReport] = useState(null);
  const [stateHistory, setStateHistory] = useState([]);
  const [loadingReport, setLoadingReport] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Análisis jurídico en vivo: Realtime como vía principal, polling de respaldo.
  const {
    analysis,
    loading: loadingAnalysis,
    error: analysisError,
    mode,
  } = useReportAnalysisLive(id);

  useEffect(() => {
    let isMounted = true;
    setLoadingReport(true);
    setLoadError(null);

    // El historial se pide en paralelo: si falla, la pantalla sigue sirviendo
    // (la línea de tiempo se deriva igual del estado actual del reporte).
    Promise.all([getReportDetail(id), getReportStateHistory(id)]).then(([detail, historyResult]) => {
      if (!isMounted) return;
      if (detail.success) {
        setReport(detail.data);
        setStateHistory(historyResult.success ? historyResult.history : []);
      } else {
        setLoadError(detail.error);
      }
      setLoadingReport(false);
    });

    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleShare = useCallback(async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: `Reporte ${buildShortCode(id)}`, url });
        return;
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        toast.success('Enlace copiado');
        return;
      }
      toast.error('No se pudo compartir en este dispositivo.');
    } catch (err) {
      // El usuario puede cancelar el diálogo nativo: eso no es un error a reportar.
      if (err?.name !== 'AbortError') {
        toast.error('No se pudo compartir el reporte.');
      }
    }
  }, [id]);

  if (loadingReport) {
    return (
      <div data-testid="detail-loading" className="min-h-screen bg-[#F4F7FB] flex items-center justify-center">
        <span className="text-[13px] font-semibold text-[#7A8696]">Cargando el reporte…</span>
      </div>
    );
  }

  // Sin reporte, o el reporte no es del usuario en sesión. La policy de
  // citizen_reports es de lectura pública (la necesita el mapa), así que la
  // pertenencia se valida acá: el detalle con el fundamento jurídico es privado.
  if (loadError || !report || !isOwnedBy(report, user?.id)) {
    return (
      <div data-testid="detail-not-found" className="min-h-screen bg-[#F4F7FB] flex flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="font-extrabold text-[18px] text-[#1B365D] m-0">No encontramos este reporte</h1>
        <p className="text-[13px] text-[#7A8696] m-0 max-w-[320px]">
          Puede que el enlace sea incorrecto o que el reporte pertenezca a otra cuenta.
        </p>
        <button
          type="button"
          onClick={() => navigate('/reportes')}
          className="bg-[#1E6FCB] text-white rounded-[11px] py-2.5 px-5 font-extrabold text-[12.5px] border-0 cursor-pointer hover:bg-[#15539E] transition-colors"
        >
          Volver a mis reportes
        </button>
      </div>
    );
  }

  const stateMeta = getStateMeta(report.current_state_code);
  const badgeColor = BADGE_COLORS[report.current_state_code] || FALLBACK_COLOR;
  const images = report.report_images || [];
  // Tres o más evidencias no entran prolijas en la grilla de dos columnas
  // (quedaría una sola en la última fila), así que pasan a carrusel.
  const isCarousel = images.length > 2;
  const localityName = report.localities?.name || 'Localidad sin especificar';
  const categoryName = report.services?.service_name || 'Sin categoría';

  return (
    <div className="min-h-screen bg-[#F4F7FB] flex flex-col" data-live-mode={mode}>
      {/* Encabezado: volver, código corto y estado actual */}
      <header className="shrink-0 bg-white px-4 py-3 border-b border-[#EEF1F5] flex items-center gap-2.5">
        <button
          type="button"
          aria-label="Volver"
          onClick={() => navigate('/reportes')}
          className="bg-transparent border-0 p-0 cursor-pointer text-[#5B6A7A] flex items-center"
        >
          <ArrowLeft size={22} strokeWidth={2.25} />
        </button>
        <span className="font-extrabold text-[15px] text-[#263249]">{buildShortCode(report.id)}</span>
        <span className={`ml-auto font-bold text-[9px] px-2.5 py-1.5 rounded-lg tracking-wide ${badgeColor}`}>
          {stateMeta.badge}
        </span>
      </header>

      <main className="flex-1 px-4 py-4 flex flex-col gap-3 max-w-[640px] w-full mx-auto">
        {/* Evidencia sanitizada. Nunca la original: lo que se guarda ya pasó por
            el pipeline de cuarentena y anonimización (REP-2401 / REP-2404). */}
        {images.length > 0 ? (
          /* Hasta dos evidencias entran en la grilla del mockup. A partir de
             tres, se pasa a un carrusel horizontal con scroll-snap: cada foto
             conserva su tamaño y la siguiente asoma, dejando ver que hay más. */
          <div
            data-testid="detail-images"
            data-count={images.length}
            data-layout={isCarousel ? 'carousel' : 'grid'}
            role={isCarousel ? 'group' : undefined}
            aria-label={isCarousel ? `Evidencia del reporte, ${images.length} fotos` : undefined}
            className={
              isCarousel
                ? 'flex gap-2 overflow-x-auto snap-x snap-mandatory no-scrollbar'
                : 'grid grid-cols-2 gap-2'
            }
          >
            {images.map((img, index) => (
              <div
                key={img.id}
                className={`h-[110px] rounded-xl overflow-hidden bg-[#CFD8E2] ${
                  isCarousel ? 'snap-start shrink-0 w-[44%]' : ''
                }`}
              >
                <img
                  src={img.image_url}
                  alt={`Evidencia ${index + 1} de ${images.length} del reporte`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        ) : (
          <div
            data-testid="detail-no-images"
            className="flex items-center gap-2 rounded-xl border border-[#E6ECF3] bg-white px-3 py-3 text-[12px] text-[#7A8696]"
          >
            <ImageOff size={16} />
            Este reporte no tiene evidencia adjunta.
          </div>
        )}

        {/* Descripción del ciudadano: es la entrada textual que alimenta al RAG. */}
        <div className="rounded-xl border border-[#E6ECF3] bg-white px-3.5 py-3 flex flex-col gap-1">
          <span className="font-bold text-[10.5px] text-[#1E6FCB]">{categoryName}</span>
          <p className="text-[13px] leading-[1.5] text-[#34435A] m-0">{report.description}</p>
        </div>

        {/* Fundamento jurídico del RAG: el corazón de REP-3789. */}
        <ReportAiAnalysisPanel analysis={analysis} loading={loadingAnalysis} error={analysisError} />

        {/* Línea de tiempo: historial real cuando existe, derivado del estado
            actual cuando el reporte todavía no tiene filas registradas. */}
        <ReportTimeline
          steps={buildTimeline({
            history: stateHistory,
            currentStateCode: report.current_state_code,
            createdAt: report.created_at,
          })}
        />

        {/* Ubicación */}
        <div className="flex items-center gap-2.5 rounded-xl border border-[#E6ECF3] bg-white px-3 py-2.5">
          <MapPin size={17} className="text-[#1E6FCB] shrink-0" />
          <span className="flex-1 font-semibold text-[10.5px] text-[#46566B] truncate">{localityName}</span>
          <ChevronRight size={17} className="text-[#9AA7B5] shrink-0" />
        </div>
      </main>

      {/* Acciones */}
      <footer className="shrink-0 bg-white border-t border-[#EEF1F5] px-4 py-2.5 flex gap-2 max-w-[640px] w-full mx-auto">
        <motion.button
          whileTap={{ scale: 0.98 }}
          type="button"
          onClick={handleShare}
          className="flex-1 border-[1.5px] border-[#DDE4EC] rounded-xl py-2.5 flex items-center justify-center gap-1.5 font-bold text-[12px] text-[#56657A] bg-transparent cursor-pointer hover:bg-slate-50 transition-colors"
        >
          <Share2 size={15} />
          Compartir
        </motion.button>

        {/* "Dar de baja" queda deshabilitado a propósito: citizen_reports no
            tiene policy de UPDATE para el ciudadano, así que hoy no existe forma
            de darlo de baja sin un cambio de backend. Se muestra para no romper
            el recorrido del UJ v3.2, pero no se simula una acción inexistente. */}
        <button
          type="button"
          disabled
          title="Disponible próximamente"
          className="flex-1 border-[1.5px] border-[#F7D2CC] rounded-xl py-2.5 flex items-center justify-center gap-1.5 font-bold text-[12px] text-[#C0392B] bg-transparent opacity-50 cursor-not-allowed"
        >
          <Ban size={15} />
          Dar de baja
        </button>
      </footer>
    </div>
  );
};
