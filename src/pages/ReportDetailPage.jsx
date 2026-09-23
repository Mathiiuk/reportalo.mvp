/**
 * @file ReportDetailPage.jsx
 * @description Detalle del reporte del ciudadano.
 *
 * Integración de dos trabajos (21/09/2026):
 *  - REP-3789 aportó la capa de datos: lectura del reporte y del historial, guarda
 *    de pertenencia y, sobre todo, `useReportAnalysisLive`, que trae el fundamento
 *    jurídico por Supabase Realtime con polling de respaldo.
 *  - REP-3791 Bloque 3 aportó el diseño del UJ v3.3 (M16 teléfono / D17 escritorio)
 *    y la taxonomía de estados del §10 (`reportStatus.js` + `StatusPill`).
 *
 * El sondeo cada 15 s que traía el bloque se descartó: `useReportAnalysisLive` ya
 * resuelve lo mismo mejor. El panel solo recibe `analysis`, `loading` y `error`,
 * así que la pantalla no depende de cómo llega el dato.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Check, Eye, MapPin, FileText, Share2, ImageOff, Ban } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getReportDetail, getReportStateHistory, isOwnedBy } from '../services/reportDetailService';
import { ReportAiAnalysisPanel } from '../components/report/ReportAiAnalysisPanel';
import { StatusPill } from '../components/report/StatusPill';
import { buildTimeline, formatReportCode, normalizeReportState } from '../components/report/reportStatus';
import { useReportAnalysisLive } from '../hooks/useReportAnalysisLive';
import { useIsDesktopLayout } from '../hooks/useMediaQuery';

const CARD = 'rounded-2xl border border-rep-border bg-rep-surface p-4 shadow-rep-card desktop:p-5';

const isServerImage = (url) => /^https?:\/\//i.test(String(url ?? ''));

// El pie de las fotos solo promete anonimización si todas vienen del servidor:
// una URL local (blob:) no pasó por el pipeline de cuarentena (H-25).
const photoCaption = (images) => {
  const n = images.length;
  const base = `${n} ${n === 1 ? 'foto' : 'fotos'}`;
  if (n === 0 || !images.every((img) => isServerImage(img.image_url))) return base;
  if (n === 1) return `${base}, anonimizada`;
  return `${base}, ${n === 2 ? 'ambas anonimizadas' : 'todas anonimizadas'}`;
};

// Un borrador viejo puede haber guardado una URL local que ya no existe (H-25).
const ReportPhoto = ({ src, alt, className }) => {
  const [failed, setFailed] = useState(false);
  if (failed || !src) {
    return (
      <div className={`flex flex-col items-center justify-center gap-1 bg-rep-surface-sunken text-rep-ink-muted ${className}`}>
        <ImageOff aria-hidden="true" className="h-5 w-5" strokeWidth={2} />
        <span className="text-rep-label">Imagen no disponible</span>
      </div>
    );
  }
  return <img src={src} alt={alt} onError={() => setFailed(true)} className={`object-cover ${className}`} />;
};

const DetailSkeleton = () => (
  <div
    data-testid="detail-loading"
    aria-busy="true"
    aria-label="Cargando el reporte"
    className="flex flex-col gap-3 motion-safe:animate-pulse"
  >
    <div className="h-8 w-40 rounded-lg bg-rep-track" />
    <div className="h-32 rounded-2xl bg-rep-track" />
    <div className="h-28 rounded-2xl bg-rep-track" />
    <div className="h-40 rounded-2xl bg-rep-track" />
  </div>
);

export const ReportDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isDesktop = useIsDesktopLayout();

  const [report, setReport] = useState(null);
  const [stateHistory, setStateHistory] = useState([]);
  const [loadingReport, setLoadingReport] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  // Fundamento jurídico en vivo: Realtime como vía principal, polling de respaldo.
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

    // El historial se pide en paralelo: si RLS no lo deja leer, la pantalla sigue
    // sirviendo (la línea de tiempo se deriva igual del estado actual del reporte).
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

  const handleBack = useCallback(() => navigate('/reportes'), [navigate]);

  const handleShare = useCallback(async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: `Reporte ${formatReportCode(id)}`, url });
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
      <div className="flex min-h-[100dvh] w-full flex-col bg-rep-bg font-manrope">
        <div className="mx-auto w-full max-w-lg flex-1 px-4 py-6 desktop:max-w-[1200px] desktop:px-10">
          <DetailSkeleton />
        </div>
      </div>
    );
  }

  // Sin reporte, o el reporte no es del usuario en sesión. La policy de
  // citizen_reports es de lectura pública (la necesita el mapa), así que la
  // pertenencia se valida acá: el detalle con el fundamento jurídico es privado.
  if (loadError || !report || !isOwnedBy(report, user?.id)) {
    return (
      <div
        data-testid="detail-not-found"
        className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-rep-bg px-6 text-center font-manrope"
      >
        <h1 className="m-0 text-rep-title text-rep-ink">No encontramos este reporte</h1>
        <p className="m-0 max-w-[320px] text-rep-body text-rep-ink-muted">
          Puede que el enlace sea incorrecto o que el reporte pertenezca a otra cuenta.
        </p>
        <button
          type="button"
          onClick={handleBack}
          className="rep-focus inline-flex min-h-touch items-center rounded-xl bg-rep-accent px-5 text-rep-button text-rep-on-accent transition-[transform,filter] duration-120 active:scale-[0.98]"
        >
          Volver a mis reportes
        </button>
      </div>
    );
  }

  const images = report.report_images || [];
  const activePhoto = images[activePhotoIndex] ?? images[0] ?? null;
  const state = normalizeReportState(report.current_state_code);
  const timeline = buildTimeline({
    currentState: report.current_state_code,
    createdAt: report.created_at,
    history: stateHistory,
  });
  const locationLabel =
    report.localities?.name ||
    (typeof report.latitud === 'number'
      ? `${report.latitud.toFixed(4)}, ${report.longitud.toFixed(4)}`
      : 'Ubicación no disponible');
  const isClosed = state === 'resuelto' || state === 'descartado';
  const reportCode = formatReportCode(report.id);
  const categoryName = report.services?.service_name || 'Sin categoría';
  // Tres o más evidencias no entran prolijas en la grilla de dos columnas
  // (quedaría una sola en la última fila), así que pasan a carrusel (REP-3789).
  const isCarousel = images.length > 2;

  const BackButton = ({ className = '' }) => (
    <button
      type="button"
      onClick={handleBack}
      aria-label="Volver"
      className={`rep-focus flex min-h-touch min-w-touch items-center justify-center rounded-full text-rep-ink-label transition-[transform,background-color] duration-120 hover:bg-rep-divider active:scale-[0.98] ${className}`}
    >
      <ArrowLeft aria-hidden="true" className="h-6 w-6" strokeWidth={2.25} />
    </button>
  );

  return (
    <div
      data-testid="report-detail-page"
      data-live-mode={mode}
      className="flex h-full min-h-[100dvh] w-full flex-col bg-rep-bg font-manrope"
    >
      <div className="mx-auto w-full max-w-lg flex-1 px-4 pb-6 pt-[max(8px,env(safe-area-inset-top,8px))] desktop:max-w-[1200px] desktop:px-10 desktop:py-8">
        {/* Cabecera de teléfono (M16): volver + número + estado */}
        {!isDesktop && (
          <header className="flex items-center gap-1 py-2">
            <BackButton className="-ml-2" />
            <h1 className="m-0 flex-1 text-rep-title text-rep-ink">{reportCode}</h1>
            <StatusPill state={report.current_state_code} />
          </header>
        )}

        <div className="mt-2 flex flex-col gap-3 desktop:mt-0 desktop:grid desktop:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] desktop:grid-rows-[auto_auto_1fr] desktop:items-start desktop:gap-x-8 desktop:gap-y-4">
          {/* Columna izquierda en escritorio: fotos, ubicación, acciones */}
          <div className="contents desktop:col-start-1 desktop:row-span-3 desktop:row-start-1 desktop:flex desktop:flex-col desktop:gap-4">
            <section aria-label="Fotos del reporte" className="flex flex-col gap-2">
              {images.length === 0 ? (
                <div data-testid="detail-no-images">
                  <ReportPhoto src={null} alt="" className="h-40 w-full rounded-2xl desktop:h-[300px]" />
                </div>
              ) : (
                <div data-testid="detail-images" data-count={images.length} data-layout={isCarousel ? 'carousel' : 'grid'}>
                  {/* Teléfono: hasta dos fotos en grilla; con tres o más, carrusel.
                      Se muestran TODAS las evidencias: el mockup dibuja dos, pero
                      recortar la galería escondería evidencia que el ciudadano
                      adjuntó (REP-3789, UT-DET-13). */}
                  {!isDesktop && (
                    <div
                      className={
                        isCarousel
                          ? 'flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1'
                          : 'grid grid-cols-2 gap-2'
                      }
                    >
                      {images.map((img, idx) => (
                        <ReportPhoto
                          key={img.id}
                          src={img.image_url}
                          alt={`Foto ${idx + 1} del reporte`}
                          className={
                            isCarousel
                              ? 'h-32 w-[45%] shrink-0 snap-start rounded-xl'
                              : `h-32 w-full rounded-xl ${images.length === 1 ? 'col-span-2' : ''}`
                          }
                        />
                      ))}
                    </div>
                  )}
                  {/* Escritorio (D17): foto grande + miniaturas */}
                  {isDesktop && (
                    <div className="flex flex-col gap-2">
                      <ReportPhoto
                        key={activePhoto?.id}
                        src={activePhoto?.image_url}
                        alt={`Foto ${activePhotoIndex + 1} del reporte`}
                        className="h-[300px] w-full rounded-2xl"
                      />
                      <div className="flex items-center gap-2">
                        {images.map((img, idx) => (
                          <button
                            key={img.id}
                            type="button"
                            onClick={() => setActivePhotoIndex(idx)}
                            aria-label={`Ver foto ${idx + 1}`}
                            aria-pressed={idx === activePhotoIndex}
                            className={`rep-focus h-14 w-16 overflow-hidden rounded-xl border-2 ${idx === activePhotoIndex ? 'border-rep-accent' : 'border-transparent'}`}
                          >
                            <ReportPhoto src={img.image_url} alt="" className="h-full w-full" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <span className="text-rep-label text-rep-ink-muted desktop:text-rep-label-d">{photoCaption(images)}</span>
            </section>

            {/* Categoría y descripción. El mockup de M16 no las dibuja, pero sin
                ellas el ciudadano no puede leer lo que él mismo reportó: se
                conservan de REP-3789 y se restilan con los tokens del UJ v3.3. */}
            <div className={`${CARD} order-2 flex flex-col gap-1.5 desktop:order-none`}>
              <span className="text-rep-label font-bold text-rep-ink-label desktop:text-rep-label-d">
                {categoryName}
              </span>
              <p className="m-0 text-rep-body text-rep-ink-body desktop:text-rep-body-d">
                {report.description || 'Sin descripción adicional'}
              </p>
            </div>

            <div className={`${CARD} order-5 flex items-center gap-2.5 desktop:order-none`}>
              <MapPin aria-hidden="true" className="h-5 w-5 shrink-0 text-rep-accent" strokeWidth={2.25} />
              <span className="min-w-0 truncate text-rep-body font-bold text-rep-ink desktop:text-rep-body-d">
                {locationLabel}
              </span>
            </div>

            {!isClosed && (
              <div className="order-6 flex items-start gap-2.5 rounded-2xl border border-dashed border-rep-border px-4 py-3 desktop:order-none">
                <FileText aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-rep-ink-faint" strokeWidth={2} />
                <span className="text-rep-label text-rep-ink-muted desktop:text-rep-label-d">
                  Constancia de cierre · se habilita cuando el caso pase a Resuelto
                </span>
              </div>
            )}

            <div className="order-7 flex gap-3 desktop:order-none">
              <button
                type="button"
                onClick={handleShare}
                className="rep-focus flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl border border-rep-border bg-rep-surface text-rep-body font-bold text-rep-ink-label transition-[transform,filter] duration-120 hover:brightness-[.96] active:scale-[0.98] dark:hover:brightness-[1.06] desktop:text-rep-body-d"
              >
                <Share2 aria-hidden="true" className="h-4 w-4" strokeWidth={2.25} />
                Compartir
              </button>
            </div>
          </div>

          {/* Columna derecha en escritorio (D17): número, fundamento, historial */}
          {isDesktop && (
            <div className="col-start-2 row-start-1 flex items-center gap-3">
              <BackButton className="-ml-3" />
              <h1 className="m-0 text-rep-title-d text-rep-ink">{reportCode}</h1>
              <StatusPill state={report.current_state_code} />
            </div>
          )}

          <div className="order-3 desktop:order-none desktop:col-start-2 desktop:row-start-2">
            <ReportAiAnalysisPanel analysis={analysis} loading={loadingAnalysis} error={analysisError} />
          </div>

          <section
            data-testid="report-timeline"
            aria-label="Historial del reporte"
            className={`${CARD} order-4 desktop:order-none desktop:col-start-2 desktop:row-start-3`}
          >
            <ol className="m-0 flex list-none flex-col p-0">
              {timeline.map((step, index) => {
                const isLast = index === timeline.length - 1;
                return (
                  <li
                    key={step.key}
                    data-testid={`timeline-step-${step.key}`}
                    data-reached={String(Boolean(step.done))}
                    aria-current={step.current ? 'step' : undefined}
                    className="relative flex gap-3 pb-4 last:pb-0"
                  >
                    {!isLast && (
                      <span
                        aria-hidden="true"
                        className={`absolute left-[11px] top-7 h-[calc(100%-24px)] w-[2px] ${step.done && timeline[index + 1]?.done ? 'bg-rep-success/50' : 'bg-rep-track'}`}
                      />
                    )}
                    {step.discarded ? (
                      <span className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rep-track text-rep-ink-label">
                        <Ban aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.5} />
                      </span>
                    ) : step.current && step.key !== 'enviado' && step.key !== 'resuelto' ? (
                      <span className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rep-accent text-rep-on-accent">
                        <Eye aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.5} />
                      </span>
                    ) : step.done ? (
                      <span className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rep-success text-rep-on-accent">
                        <Check aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={3} />
                      </span>
                    ) : (
                      <span aria-hidden="true" className="relative h-6 w-6 shrink-0 rounded-full border-2 border-rep-track bg-rep-surface" />
                    )}
                    <div className="flex min-w-0 flex-col gap-0.5 pt-0.5">
                      <span
                        className={`text-rep-body desktop:text-rep-body-d ${step.done ? 'font-bold text-rep-ink' : 'font-semibold text-rep-ink-muted'}`}
                      >
                        {step.label}
                      </span>
                      {(step.date || step.note) && (
                        <span className="text-rep-label text-rep-ink-muted desktop:text-rep-label-d">
                          {[step.date, step.note ? `«${step.note}»` : null].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
};

export default ReportDetailPage;
