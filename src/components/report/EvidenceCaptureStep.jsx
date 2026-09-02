import React, { useRef, useEffect, useState } from 'react';
import { Shield, Zap, X, MapPin, Camera, RefreshCw, AlertCircle, ArrowRight, Trash2, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getFriendlyLocationLabel } from '../../services/locationService';

/**
 * Componente UI para el Paso 1: Captura de Evidencia Fotográfica Fullscreen (REP-2201).
 * Diseño calcado del User Journey v2 con galería modal interactiva de 1 a 4 fotos.
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
      setSelectedPhotoIndex(null); // Resetear al visor de la foto más reciente
    }
    e.target.value = '';
  };

  const photoCount = evidenceList.length;
  // Foto activa a mostrar en el visor principal
  const activePhoto =
    selectedPhotoIndex !== null && evidenceList[selectedPhotoIndex]
      ? evidenceList[selectedPhotoIndex]
      : evidenceList[photoCount - 1] || null;

  // Formato amigable de ubicación GPS dinámica
  const locationLabel = getFriendlyLocationLabel(geolocation);

  return (
    <div
      data-testid="evidence-capture-step"
      className="relative w-full h-[100dvh] bg-[#0E1116] overflow-hidden flex flex-col font-manrope select-none text-white"
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

      {/* 1. VISOR PRINCIPAL / ESCENA DE CÁMARA O FOTO CAPTURADA */}
      <div className="relative flex-1 w-full bg-[#1A1F26] overflow-hidden flex items-center justify-center">
        {activePhoto ? (
          <img
            src={activePhoto.previewUrl}
            alt="Evidencia capturada"
            data-testid="evidence-preview-img"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#1C232D] to-[#0E1116] p-6 text-center">
            <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4 text-[#1E6FCB]">
              <Camera className="w-10 h-10" />
            </div>
            <p className="text-[14px] font-bold text-slate-300 max-w-[240px] m-0">
              Preparando cámara para registrar el reporte...
            </p>
          </div>
        )}

        {/* Topbar flotante sobre el visor */}
        <div className="absolute top-[max(12px,env(safe-area-inset-top,12px))] left-3 right-3 z-20 flex items-center justify-between pointer-events-auto">
          {/* Botón Cerrar / Volver */}
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cerrar cámara"
            className="w-9 h-9 rounded-full bg-black/45 backdrop-blur-md flex items-center justify-center text-white border border-white/10 active:scale-95 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Badge Central: Privacidad Activada */}
          <div className="flex items-center gap-1.5 bg-[#1E6FCB]/95 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 shadow-md">
            <Shield className="w-3.5 h-3.5 fill-white text-white" />
            <span className="font-extrabold text-[11px] tracking-wide text-white">
              Privacidad activada
            </span>
          </div>

          {/* Icono Galería / Flash */}
          <button
            type="button"
            aria-label="Opciones de cámara"
            onClick={() => galleryInputRef.current?.click()}
            title="Seleccionar desde galería"
            className="w-9 h-9 rounded-full bg-black/45 backdrop-blur-md flex items-center justify-center text-white border border-white/10 active:scale-95 transition-all cursor-pointer"
          >
            <Zap className="w-4 h-4 fill-white text-white" />
          </button>
        </div>

        {/* Badge Inferior Flotante: Ubicación GPS */}
        <div className="absolute bottom-3 left-3 right-3 z-20 flex items-center gap-2 bg-black/55 backdrop-blur-md py-2 px-3 rounded-xl border border-white/10 text-slate-200">
          <MapPin className="w-4 h-4 text-[#2E9FE5] flex-shrink-0" />
          <span className="font-mono font-semibold text-[11px] truncate tracking-tight">
            {locationLabel}
          </span>
        </div>
      </div>

      {/* 2. PANEL INFERIOR DE ACCIONES Y CONTROL DE DISPARO */}
      <div className="flex-0 bg-[#0E1116] px-5 pt-3 pb-[max(16px,env(safe-area-inset-bottom,16px))] flex flex-col">
        {/* Banner de Error si ocurre */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-2 p-2.5 rounded-xl bg-red-950/80 border border-red-500/40 text-red-200 flex items-center gap-2 text-[11.5px] font-bold"
            >
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Copy de Privacidad */}
        <p className="font-medium text-[11px] leading-relaxed text-[#8A95A3] text-center m-0 mb-3.5">
          Sacá la foto normal. Los rostros y patentes se difuminan al procesarla, antes de guardarse.
        </p>

        {/* Fila de Controles */}
        <div className="flex items-center justify-between gap-3">
          {/* A. Miniaturas de fotos capturadas (Al hacer clic abre el visor modal) */}
          <div className="w-14 flex items-center justify-start">
            {photoCount > 0 ? (
              <div
                data-testid="evidence-thumbnail-stack"
                className="relative cursor-pointer"
                onClick={() => setShowGalleryModal(true)}
                title="Ver y gestionar fotos capturadas"
              >
                <div className="flex items-center">
                  {evidenceList.slice(0, 2).map((item, idx) => (
                    <div
                      key={item.id}
                      className="w-10 h-10 rounded-xl overflow-hidden border-[1.5px] border-white/60 shadow-md bg-slate-800 flex-shrink-0"
                      style={{ marginLeft: idx > 0 ? '-14px' : '0px' }}
                    >
                      <img src={item.previewUrl} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>

                {/* Badge con cantidad de fotos */}
                <span className="absolute -top-1.5 -right-2 w-4.5 h-4.5 rounded-full bg-[#1E6FCB] border-2 border-[#0E1116] flex items-center justify-center font-extrabold text-[9px] text-white shadow-xs">
                  {photoCount}
                </span>

                {/* Botón X para limpiar fotos */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClearEvidence();
                  }}
                  aria-label="Eliminar fotos"
                  className="absolute -bottom-1.5 -left-1.5 w-4 h-4 rounded-full bg-black/80 text-white flex items-center justify-center border-0 cursor-pointer p-0 hover:bg-red-600 transition-colors"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="w-10 h-10 rounded-xl border border-dashed border-white/20 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Subir de galería"
              >
                <Camera className="w-4 h-4 opacity-50" />
              </button>
            )}
          </div>

          {/* B. Botón Central de Disparo (Trigger Cámara) */}
          <div className="flex justify-center">
            <button
              type="button"
              disabled={photoCount >= 4 || isProcessing}
              onClick={() => cameraInputRef.current?.click()}
              aria-label="Tomar fotografía"
              className={`w-[68px] h-[68px] rounded-full border-4 border-white flex items-center justify-center transition-all cursor-pointer ${
                photoCount >= 4
                  ? 'bg-slate-700 opacity-60 cursor-not-allowed'
                  : 'bg-[#1E6FCB] hover:scale-105 active:scale-95 shadow-[0_4px_18px_rgba(30,111,203,0.5)]'
              }`}
            >
              <Camera className="w-7 h-7 text-white fill-white" />
            </button>
          </div>

          {/* C. Lado Derecho: Galería / Cambiar Cámara / Continuar */}
          <div className="w-14 flex flex-col items-center justify-center gap-1">
            {photoCount > 0 ? (
              <button
                type="button"
                onClick={onContinue}
                aria-label="Continuar al siguiente paso"
                className="w-10 h-10 rounded-full bg-[#22C55E] text-white flex items-center justify-center shadow-md active:scale-95 transition-all cursor-pointer border-0"
                title="Continuar"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                aria-label="Cambiar a galería"
                className="w-10 h-10 rounded-full bg-white/12 flex items-center justify-center text-white active:scale-95 transition-all cursor-pointer border-0"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
            <span className="font-bold text-[9px] text-[#8A95A3]">
              {photoCount > 0 ? 'Continuar' : 'máx. 4'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. MODAL DE GESTIÓN Y VISUALIZACIÓN DE FOTOS (1 A 4 FOTOS) */}
      <AnimatePresence>
        {showGalleryModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col justify-between p-4"
          >
            {/* Header del modal */}
            <div className="flex items-center justify-between pt-[max(8px,env(safe-area-inset-top,8px))]">
              <span className="font-extrabold text-[15px] text-white">
                Fotos capturadas ({photoCount}/4)
              </span>
              <button
                type="button"
                onClick={() => setShowGalleryModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white cursor-pointer border-0"
                aria-label="Cerrar visor de fotos"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Grid de fotos en tamaño grande */}
            <div className="flex-1 overflow-y-auto py-4 grid grid-cols-2 gap-3.5 items-center justify-center max-w-md mx-auto w-full">
              {evidenceList.map((item, idx) => (
                <div
                  key={item.id}
                  onClick={() => {
                    setSelectedPhotoIndex(idx);
                    setShowGalleryModal(false);
                  }}
                  className={`relative rounded-2xl overflow-hidden aspect-square border-2 bg-slate-900 cursor-pointer shadow-lg transition-transform hover:scale-[1.02] ${
                    selectedPhotoIndex === idx || (selectedPhotoIndex === null && idx === photoCount - 1)
                      ? 'border-[#1E6FCB] ring-2 ring-[#1E6FCB]/50'
                      : 'border-white/20'
                  }`}
                >
                  <img src={item.previewUrl} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                  
                  {/* Número de foto */}
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 font-extrabold text-[10px] text-white">
                    #{idx + 1}
                  </span>

                  {/* Botón eliminar individual */}
                  {onRemovePhoto && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemovePhoto(item.id);
                        if (evidenceList.length <= 1) {
                          setShowGalleryModal(false);
                        }
                      }}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-600/90 text-white flex items-center justify-center cursor-pointer border-0 hover:bg-red-700 transition-colors shadow-sm"
                      title="Eliminar esta foto"
                      aria-label={`Eliminar foto ${idx + 1}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Footer del modal */}
            <div className="flex flex-col gap-2 max-w-md mx-auto w-full pb-[max(8px,env(safe-area-inset-bottom,8px))]">
              {photoCount < 4 && (
                <button
                  type="button"
                  onClick={() => {
                    setShowGalleryModal(false);
                    cameraInputRef.current?.click();
                  }}
                  className="w-full py-3 rounded-xl bg-white/15 text-white font-bold text-[13px] flex items-center justify-center gap-2 cursor-pointer border-0 hover:bg-white/20 transition-colors"
                >
                  <Camera className="w-4 h-4" />
                  <span>Agregar otra foto ({4 - photoCount} restantes)</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowGalleryModal(false)}
                className="w-full py-3 rounded-xl bg-[#1E6FCB] text-white font-extrabold text-[13px] cursor-pointer border-0 hover:bg-[#15539E] transition-colors"
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
