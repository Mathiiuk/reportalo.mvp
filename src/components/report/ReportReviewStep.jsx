import React, { useState } from 'react';
import { MapPin, Send, Save, X, CloudOff, Clock, Info, SlidersHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ReportFlowHeader } from './ReportFlowHeader';
import { ConsentSheet } from './ConsentSheet';
import { getCategoryTone } from './categoryTone';
import { useIsDesktopLayout } from '../../hooks/useMediaQuery';

const FIELD_LABEL =
  'text-rep-label font-semibold text-rep-ink-muted desktop:w-[120px] desktop:shrink-0 desktop:text-rep-label-d desktop:uppercase desktop:tracking-wide';

/**
 * Paso 3 del alta de reporte: revisión antes de enviar + hoja de consentimiento.
 * UJ v3.3 · M11 «Revisar y enviar» / M13 «Antes de enviar» (teléfono) y D12 / D14 (escritorio).
 * REP-3791 Bloque 2. Mismo contrato de props que antes.
 */
export const ReportReviewStep = ({
  evidenceList = [],
  selectedCategory,
  description,
  geolocation,
  address,
  hasConfirmedLocality = false,
  isLocalityAutoSuggested = false,
  hasAcceptedTerms = false,
  isOnline = true,
  draftStatus = 'DRAFT_LOCAL',
  onBack,
  onSubmitReport,
  onAcceptTermsAndSubmit,
  onOpenTerms,
  onOpenAdjustLocation,
}) => {
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [showPhotosGalleryModal, setShowPhotosGalleryModal] = useState(false);
  const isDesktop = useIsDesktopLayout();

  const deviceWord = isDesktop ? 'computadora' : 'teléfono';
  const isOfflineDraft = !isOnline || draftStatus === 'PENDING_SYNC';
  const photoCount = evidenceList.length;
  const photoLabel = `${photoCount} ${photoCount === 1 ? 'foto adjunta' : 'fotos adjuntas'}`;
  const tone = selectedCategory ? getCategoryTone(selectedCategory) : null;
  const submitLabel = !isOnline ? 'Guardar reporte sin conexión' : 'Enviar reporte';

  const displayAddress =
    address ||
    (geolocation?.lat
      ? `Lat: ${geolocation.lat.toFixed(4)}, Lng: ${geolocation.lng.toFixed(4)}`
      : 'Punto marcado en el mapa');

  const handleSendClick = () => {
    // R-1/R-2: no se puede enviar sin que el ciudadano confirme la localidad real
    if (!hasConfirmedLocality) {
      onOpenAdjustLocation?.();
      return;
    }
    if (hasAcceptedTerms) {
      // Quien ya aceptó la versión vigente pasa derecho al envío (M14)
      onSubmitReport();
    } else {
      // Sin aceptación vigente: hoja de consentimiento (M13 / D14)
      setShowConsentModal(true);
    }
  };

  const handleAcceptAndSend = () => {
    setShowConsentModal(false);
    onAcceptTermsAndSubmit();
  };

  return (
    <div data-testid="report-review-step" className="relative flex h-full w-full flex-col bg-rep-bg desktop:overflow-y-auto">
      <ReportFlowHeader step={3} onBack={onBack} backLabel="Volver al detalle" />

      <div className="min-h-0 flex-1 overflow-y-auto desktop:flex-none desktop:overflow-visible">
        <div className="mx-auto flex w-full max-w-lg flex-col gap-3 px-4 py-4 desktop:grid desktop:max-w-[1200px] desktop:grid-cols-[minmax(280px,1fr)_minmax(0,1.9fr)] desktop:items-stretch desktop:gap-6 desktop:px-10 desktop:py-8">
          {/* Fotos adjuntas: todavía no salieron del dispositivo */}
          <section
            aria-label="Fotos adjuntas"
            className="rounded-2xl border border-rep-border bg-rep-surface p-3.5 shadow-rep-card desktop:flex desktop:flex-col desktop:gap-4 desktop:p-5"
          >
            <div className="flex items-center justify-between">
              <h3 className="m-0 text-rep-body font-bold text-rep-ink desktop:text-rep-body-d">{photoLabel}</h3>
              {photoCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowPhotosGalleryModal(true)}
                  className="rep-focus min-h-touch rounded-lg px-1 text-rep-label font-bold text-rep-accent hover:underline desktop:text-rep-label-d"
                >
                  Ver todas
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 desktop:flex-col desktop:items-stretch desktop:gap-4">
              <div className="flex shrink-0 gap-2">
                {evidenceList.slice(0, 3).map((item, idx) => (
                  <button
                    key={item.id || idx}
                    type="button"
                    onClick={() => setShowPhotosGalleryModal(true)}
                    aria-label={`Ver foto ${idx + 1}`}
                    className="rep-focus h-16 w-16 overflow-hidden rounded-xl border border-rep-border bg-rep-track desktop:h-20 desktop:w-20"
                  >
                    <img src={item.previewUrl} alt={`Evidencia ${idx + 1}`} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>

              <div className="flex min-w-0 flex-col gap-0.5 desktop:rounded-xl desktop:bg-rep-surface-sunken desktop:p-3.5">
                {isOfflineDraft ? (
                  <>
                    <span className="inline-flex items-center gap-1.5 text-rep-warning-ink">
                      <CloudOff aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={2.25} />
                      <span className="text-rep-label font-bold desktop:text-rep-label-d">Guardado en tu {deviceWord}</span>
                    </span>
                    <span className="text-rep-label font-medium text-rep-ink-muted desktop:text-rep-label-d">
                      Se enviará automáticamente cuando tengas señal
                    </span>
                  </>
                ) : (
                  <>
                    <span className="inline-flex items-center gap-1.5 text-rep-ink-label">
                      <Clock aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={2.25} />
                      <span className="text-rep-label font-bold desktop:text-rep-label-d">Todavía en tu {deviceWord}</span>
                    </span>
                    <span className="text-rep-label font-medium text-rep-ink-muted desktop:text-rep-label-d">
                      Se suben y se anonimizan al enviar
                    </span>
                  </>
                )}
              </div>
            </div>
          </section>

          {/* Datos del reporte. En teléfono el título va primero (order-first); en escritorio encabeza la tarjeta derecha */}
          <div className="contents desktop:flex desktop:flex-col desktop:gap-4 desktop:rounded-2xl desktop:border desktop:border-rep-border desktop:bg-rep-surface desktop:p-6 desktop:shadow-rep-card">
            <h2 className="order-first m-0 text-rep-label font-bold text-rep-ink-label desktop:order-none desktop:text-rep-section-d desktop:text-rep-ink">
              Revisá antes de enviar
            </h2>

            <section
              aria-label="Datos del reporte"
              className="flex flex-col gap-3 rounded-2xl border border-rep-border bg-rep-surface p-3.5 shadow-rep-card desktop:gap-4 desktop:rounded-none desktop:border-0 desktop:p-0 desktop:shadow-none"
            >
              <div className="flex items-center justify-between gap-3 desktop:justify-start">
                <span className={FIELD_LABEL}>Categoría</span>
                <span
                  className="rounded-lg px-2.5 py-1 text-rep-pill"
                  style={{ color: tone?.ink, backgroundColor: tone?.soft }}
                >
                  {selectedCategory?.name || 'Tránsito'}
                </span>
              </div>

              <div aria-hidden="true" className="h-px bg-rep-divider" />

              <div className="desktop:flex">
                <div className={`mb-1 desktop:mb-0 ${FIELD_LABEL}`}>Descripción</div>
                <p className="m-0 text-rep-body text-rep-ink-body desktop:text-rep-body-d">
                  {description || 'Sin descripción adicional'}
                </p>
              </div>

              <div aria-hidden="true" className="h-px bg-rep-divider" />

              <div className="flex items-center gap-2.5">
                <MapPin aria-hidden="true" className="h-5 w-5 shrink-0 text-rep-accent desktop:hidden" strokeWidth={2.25} />
                <div className="min-w-0 flex-1 desktop:flex desktop:items-center">
                  <div className={FIELD_LABEL}>Ubicación</div>
                  <div className="truncate text-rep-body font-bold text-rep-ink desktop:text-rep-body-d">{displayAddress}</div>
                </div>
                <button
                  type="button"
                  onClick={onOpenAdjustLocation}
                  aria-label="Ajustar ubicación"
                  className="rep-focus inline-flex min-h-touch shrink-0 items-center gap-1.5 rounded-xl border border-rep-accent-border bg-rep-surface px-3 text-rep-label font-extrabold text-rep-accent transition-colors duration-120 hover:bg-rep-accent-soft desktop:text-rep-label-d"
                >
                  <SlidersHorizontal aria-hidden="true" className="h-4 w-4" strokeWidth={2.25} />
                  Ajustar
                </button>
              </div>

              {/* REP-2500-PRESEL: la localidad se preselecciono sola. Se avisa de
                  forma explicita para que el ciudadano pueda corregirla: los
                  centroides son aproximados y el locality_id define que organismo
                  recibe el reclamo. Se conserva del trabajo ya mergeado en staging,
                  restilado con los tokens del UJ v3.3. */}
              {hasConfirmedLocality && isLocalityAutoSuggested && (
                <div
                  data-testid="auto-locality-hint"
                  role="status"
                  className="flex items-start gap-2 rounded-xl border border-rep-accent-border bg-rep-accent-soft px-3 py-2.5"
                >
                  <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-rep-accent" strokeWidth={2.25} />
                  <span className="text-rep-label font-semibold text-rep-accent desktop:text-rep-label-d">
                    Detectamos esta localidad por tu ubicación. Si no es correcta, tocá "Ajustar".
                  </span>
                </div>
              )}

              {!hasConfirmedLocality && (
                <div
                  data-testid="missing-locality-hint"
                  role="status"
                  className="flex items-start gap-2 rounded-xl border border-rep-warning/40 bg-rep-warning-soft px-3 py-2.5"
                >
                  <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-rep-warning" strokeWidth={2.25} />
                  <span className="text-rep-label font-semibold text-rep-warning-ink desktop:text-rep-label-d">
                    Confirmá la localidad exacta tocando "Ajustar" antes de enviar.
                  </span>
                </div>
              )}
            </section>

            <div className="flex items-start gap-2.5 rounded-2xl border border-rep-warning/30 bg-rep-warning-soft p-3.5 desktop:mt-auto desktop:border-0 desktop:bg-transparent desktop:p-0">
              <Info aria-hidden="true" className="mt-0.5 h-[18px] w-[18px] shrink-0 text-rep-warning desktop:text-rep-ink-muted" strokeWidth={2.25} />
              <p className="m-0 text-rep-label font-medium text-rep-warning-ink desktop:text-rep-label-d desktop:text-rep-ink-muted">
                Tu identidad permanece anónima para el organismo receptor.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Acción principal */}
      <div className="shrink-0 border-t border-rep-divider bg-rep-surface px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom,12px))] desktop:border-t-0 desktop:bg-transparent desktop:px-0 desktop:pb-8 desktop:pt-0">
        <div className="mx-auto flex w-full max-w-lg flex-col desktop:max-w-[1200px] desktop:flex-row-reverse desktop:items-center desktop:justify-start desktop:gap-5 desktop:px-10">
          <button
            type="button"
            onClick={handleSendClick}
            aria-label={submitLabel}
            className="rep-focus flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-rep-accent px-4 text-rep-button text-rep-on-accent shadow-rep-accent transition-[transform,background-color] duration-120 hover:bg-rep-accent-strong active:scale-[0.98] desktop:w-auto desktop:min-w-[220px] desktop:px-8"
          >
            <span>{submitLabel}</span>
            {!isOnline ? (
              <Save aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={2.25} />
            ) : (
              <Send aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={2.25} />
            )}
          </button>

          {!hasAcceptedTerms && (
            <p className="m-0 pt-2 text-center text-rep-label font-medium text-rep-ink-muted desktop:pt-0 desktop:text-rep-label-d">
              Antes de enviar te vamos a pedir aceptar los{' '}
              <button
                type="button"
                onClick={onOpenTerms}
                className="rep-focus rounded font-bold text-rep-ink-label underline"
              >
                términos
              </button>
              .
            </p>
          )}
        </div>
      </div>

      {/* Visor de fotos del reporte (no cambia de paso) */}
      <AnimatePresence>
        {showPhotosGalleryModal && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-gallery-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col justify-between bg-black/90 p-4 backdrop-blur-md"
          >
            <div className="flex items-center justify-between pt-[max(8px,env(safe-area-inset-top,8px))]">
              <h2 id="review-gallery-title" className="m-0 text-rep-section text-white">
                Fotos adjuntas al reporte ({photoCount})
              </h2>
              <button
                type="button"
                onClick={() => setShowPhotosGalleryModal(false)}
                className="rep-focus flex min-h-touch min-w-touch items-center justify-center rounded-full bg-white/10 text-white focus-visible:ring-offset-black"
                aria-label="Cerrar visor de fotos"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>

            <div className="mx-auto grid w-full max-w-md flex-1 grid-cols-2 content-center gap-3.5 overflow-y-auto py-4 desktop:max-w-3xl desktop:grid-cols-4">
              {evidenceList.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="relative aspect-square overflow-hidden rounded-2xl border-2 border-white/20 bg-black/40 shadow-lg"
                >
                  <img src={item.previewUrl} alt={`Foto ${idx + 1}`} className="h-full w-full object-cover" />
                  <span className="absolute left-2 top-2 rounded-md bg-black/70 px-2 py-0.5 text-rep-label font-extrabold text-white">
                    #{idx + 1}
                  </span>
                </div>
              ))}
            </div>

            <div className="mx-auto flex w-full max-w-md flex-col gap-2 pb-[max(8px,env(safe-area-inset-bottom,8px))]">
              <button
                type="button"
                onClick={() => setShowPhotosGalleryModal(false)}
                className="rep-focus flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-rep-accent text-rep-button text-rep-on-accent transition-colors duration-120 hover:bg-rep-accent-strong focus-visible:ring-offset-black"
              >
                Volver a la revisión
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConsentSheet
        open={showConsentModal}
        onAccept={handleAcceptAndSend}
        onDismiss={() => setShowConsentModal(false)}
        onOpenTerms={onOpenTerms}
      />
    </div>
  );
};

export default ReportReviewStep;
