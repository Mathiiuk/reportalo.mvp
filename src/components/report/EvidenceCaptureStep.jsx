import React, { useRef, useEffect, useState } from 'react';
import { Shield, X, LocateFixed, Camera, ImagePlus, AlertCircle, ArrowRight, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getFriendlyLocationLabel } from '../../services/locationService';

const MAX_PHOTOS = 4;

// El visor es oscuro en los dos temas: el anillo de foco se separa sobre el fondo de cámara.
const CAMERA_FOCUS = 'rep-focus focus-visible:ring-offset-rep-camera';

/**
 * Paso 1 del alta de reporte: captura de evidencia a pantalla completa (1 a 4 fotos).
 * UJ v3.3 · M09 «Capturar» (REP-3791 Bloque 1 · mobile). Mismo contrato de props que antes.
 *
 * Diferencias deliberadas con el mockup (documentadas en el README del bloque):
 * - Flash y cambio de cámara no se dibujan: con <input capture> los maneja la cámara del sistema.
 * - El control de la derecha pasa a «Continuar» cuando hay fotos (el mockup no muestra cómo avanzar).
 * - Sin difuminado en vivo: el badge es una promesa; el difuminado real ocurre en el servidor.
 */
export const EvidenceCaptureStep = ({
  evidenceList = [],
  error,
  isProcessing = false,
  geolocation = null,
  onCaptureFile,
  onClearEvidence,
  onRemovePhoto,
  onCancel,
  onContinue,
}) => {
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const hasTriggeredInitialRef = useRef(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(null);
  const [showGalleryModal, setShowGalleryModal] = useState(false);

  // Apertura automática de cámara al ingresar por primera vez si no hay fotos
  useEffect(() => {
    if (!hasTriggeredInitialRef.current && evidenceList.length === 0) {
      hasTriggeredInitialRef.current = true;
      const timer = setTimeout(() => {
        cameraInputRef.current?.click();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [evidenceList.length]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file && onCaptureFile) {
      onCaptureFile(file);
      setSelectedPhotoIndex(null); // Volver al visor de la foto más reciente
    }
    e.target.value = '';
  };

  const photoCount = evidenceList.length;
  const activePhoto =
    selectedPhotoIndex !== null && evidenceList[selectedPhotoIndex]
      ? evidenceList[selectedPhotoIndex]
      : evidenceList[photoCount - 1] || null;

  const locationLabel = getFriendlyLocationLabel(geolocation);

  return (
    <div
      data-testid="evidence-capture-step"
      className="relative flex h-full min-h-0 w-full flex-1 select-none flex-col overflow-hidden bg-rep-camera font-manrope text-white"
    >
      {/* Inputs nativos ocultos */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        data-testid="camera-file-input"
        onChange={handleFileChange}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        data-testid="gallery-file-input"
        onChange={handleFileChange}
      />

      {/* 1. Visor */}
      <div className="relative flex w-full flex-1 items-center justify-center overflow-hidden bg-black/30">
        {activePhoto ? (
          <img
            src={activePhoto.previewUrl}
            alt="Evidencia capturada"
            data-testid="evidence-preview-img"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/5 text-rep-camera-accent">
              <Camera className="h-10 w-10" aria-hidden="true" />
            </div>
            <p className="m-0 max-w-[260px] text-rep-body font-bold text-white/80">
              Preparando cámara para registrar el reporte...
            </p>
          </div>
        )}

        {/* Barra superior flotante */}
        <div className="absolute inset-x-3 top-[max(12px,env(safe-area-inset-top,12px))] z-20 flex items-center justify-between">
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cerrar cámara"
            className={`${CAMERA_FOCUS} flex min-h-touch min-w-touch items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md transition-transform duration-120 active:scale-[0.98]`}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>

          <div className="flex items-center gap-1.5 rounded-full bg-rep-accent px-3.5 py-2 text-rep-on-accent shadow-md">
            <Shield className="h-4 w-4 fill-current" aria-hidden="true" />
            <span className="text-[13px] font-extrabold">Privacidad activada</span>
          </div>

          {/* Espaciador: mantiene centrado el badge (el flash del mockup no aplica en web) */}
          <span aria-hidden="true" className="min-w-touch" />
        </div>

        {/* Coordenadas tomadas al disparar */}
        <div className="absolute inset-x-3 bottom-3 z-20 flex items-center gap-2 rounded-xl bg-black/55 px-3 py-2.5 backdrop-blur-md">
          <LocateFixed className="h-[18px] w-[18px] shrink-0 text-rep-camera-accent" aria-hidden="true" />
          <span className="truncate font-mono text-[13px] font-semibold text-white/90">{locationLabel}</span>
        </div>
      </div>

      {/* 2. Panel inferior */}
      <div className="shrink-0 bg-rep-camera px-5 pt-3.5 pb-[max(16px,env(safe-area-inset-bottom,16px))]">
        <AnimatePresence>
          {error && (
            <motion.div
              role="alert"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-3 flex items-center gap-2 rounded-xl border border-rep-danger/40 bg-rep-danger/20 p-3 text-rep-label font-bold text-white"
            >
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="m-0 mb-4 text-center text-rep-body text-rep-camera-ink-muted">
          Sacá la foto normal. Los rostros y patentes se difuminan al procesarla, antes de guardarse.
        </p>

        <div className="flex items-center justify-between gap-3">
          {/* A. Fotos tomadas (abre el visor de gestión) o acceso a galería */}
          <div className="flex w-[76px] justify-start">
            {photoCount > 0 ? (
              <div className="relative">
                <button
                  type="button"
                  data-testid="evidence-thumbnail-stack"
                  onClick={() => setShowGalleryModal(true)}
                  aria-label={`Ver y gestionar ${photoCount === 1 ? 'la foto tomada' : `las ${photoCount} fotos tomadas`}`}
                  className={`${CAMERA_FOCUS} relative flex min-h-touch items-center rounded-xl`}
                >
                  {evidenceList.slice(0, 2).map((item, idx) => (
                    <span
                      key={item.id}
                      className="block h-12 w-12 shrink-0 overflow-hidden rounded-xl border-[1.5px] border-white/60 bg-black/40 shadow-md"
                      style={{ marginLeft: idx > 0 ? '-18px' : '0px' }}
                    >
                      <img src={item.previewUrl} alt={`Foto ${idx + 1}`} className="h-full w-full object-cover" />
                    </span>
                  ))}
                  <span
                    aria-hidden="true"
                    className="absolute -right-2 -top-2 flex h-[22px] min-w-[22px] items-center justify-center rounded-full border-2 border-rep-camera bg-rep-accent px-1 text-[11px] font-extrabold text-rep-on-accent"
                  >
                    {photoCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={onClearEvidence}
                  aria-label="Eliminar fotos"
                  className={`${CAMERA_FOCUS} absolute -bottom-2 -left-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/85 text-white before:absolute before:-inset-2.5 before:content-['']`}
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                aria-label="Elegir foto de la galería"
                className={`${CAMERA_FOCUS} flex h-12 w-12 items-center justify-center rounded-xl border border-dashed border-white/25 text-white/70 transition-colors duration-120 hover:text-white`}
              >
                <ImagePlus className="h-5 w-5" aria-hidden="true" />
              </button>
            )}
          </div>

          {/* B. Disparador */}
          <button
            type="button"
            disabled={photoCount >= MAX_PHOTOS || isProcessing}
            onClick={() => cameraInputRef.current?.click()}
            aria-label="Tomar fotografía"
            className={`${CAMERA_FOCUS} flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-full border-4 border-white bg-rep-accent text-rep-on-accent shadow-[0_4px_18px_rgb(var(--rep-accent)/0.45)] transition-transform duration-120 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none`}
          >
            <Camera className="h-8 w-8" strokeWidth={2.25} aria-hidden="true" />
          </button>

          {/* C. Continuar (con fotos) o límite de fotos */}
          <div className="flex w-[76px] flex-col items-center justify-center gap-1">
            {photoCount > 0 ? (
              <>
                <button
                  type="button"
                  onClick={onContinue}
                  aria-label="Continuar al siguiente paso"
                  className={`${CAMERA_FOCUS} flex h-12 w-12 items-center justify-center rounded-full bg-white text-rep-camera shadow-md transition-transform duration-120 active:scale-[0.96]`}
                >
                  <ArrowRight className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
                </button>
                <span aria-hidden="true" className="text-rep-label font-bold text-white/85">Continuar</span>
              </>
            ) : (
              <span className="text-rep-label font-bold text-rep-camera-ink-muted">máx. {MAX_PHOTOS}</span>
            )}
          </div>
        </div>
      </div>

      {/* 3. Visor de gestión de fotos (1 a 4) */}
      <AnimatePresence>
        {showGalleryModal && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="evidence-gallery-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col justify-between bg-black/90 p-4 backdrop-blur-md"
          >
            <div className="flex items-center justify-between pt-[max(8px,env(safe-area-inset-top,8px))]">
              <h2 id="evidence-gallery-title" className="m-0 text-rep-section text-white">
                Fotos capturadas ({photoCount}/{MAX_PHOTOS})
              </h2>
              <button
                type="button"
                onClick={() => setShowGalleryModal(false)}
                className={`${CAMERA_FOCUS} flex min-h-touch min-w-touch items-center justify-center rounded-full bg-white/10 text-white`}
                aria-label="Cerrar visor de fotos"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="mx-auto grid w-full max-w-md flex-1 grid-cols-2 content-center gap-3.5 overflow-y-auto py-4">
              {evidenceList.map((item, idx) => {
                const isActive =
                  selectedPhotoIndex === idx || (selectedPhotoIndex === null && idx === photoCount - 1);
                return (
                  <div key={item.id} className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPhotoIndex(idx);
                        setShowGalleryModal(false);
                      }}
                      aria-label={`Ver foto ${idx + 1}`}
                      aria-pressed={isActive}
                      className={`${CAMERA_FOCUS} relative block aspect-square w-full overflow-hidden rounded-2xl border-2 bg-black/40 shadow-lg ${
                        isActive ? 'border-rep-accent ring-2 ring-rep-accent/50' : 'border-white/20'
                      }`}
                    >
                      <img src={item.previewUrl} alt={`Foto ${idx + 1}`} className="h-full w-full object-cover" />
                      <span className="absolute left-2 top-2 rounded-md bg-black/70 px-2 py-0.5 text-rep-label font-extrabold text-white">
                        #{idx + 1}
                      </span>
                    </button>

                    {onRemovePhoto && (
                      <button
                        type="button"
                        onClick={() => {
                          onRemovePhoto(item.id);
                          if (evidenceList.length <= 1) {
                            setShowGalleryModal(false);
                          }
                        }}
                        className={`${CAMERA_FOCUS} absolute right-1 top-1 flex min-h-touch min-w-touch items-center justify-center`}
                        aria-label={`Eliminar foto ${idx + 1}`}
                      >
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/75 text-white shadow-sm">
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mx-auto flex w-full max-w-md flex-col gap-2 pb-[max(8px,env(safe-area-inset-bottom,8px))]">
              {photoCount < MAX_PHOTOS && (
                <button
                  type="button"
                  onClick={() => {
                    setShowGalleryModal(false);
                    cameraInputRef.current?.click();
                  }}
                  className={`${CAMERA_FOCUS} flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-white/15 text-rep-body font-bold text-white transition-colors duration-120 hover:bg-white/20`}
                >
                  <Camera className="h-4 w-4" aria-hidden="true" />
                  <span>Agregar otra foto ({MAX_PHOTOS - photoCount} restantes)</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowGalleryModal(false)}
                className={`${CAMERA_FOCUS} flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-rep-accent text-rep-button text-rep-on-accent transition-colors duration-120 hover:bg-rep-accent-strong`}
              >
                Volver a la cámara
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EvidenceCaptureStep;
