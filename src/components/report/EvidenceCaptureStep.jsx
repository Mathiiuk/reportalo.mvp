import React, { useRef, useEffect } from 'react';
import { Shield, Zap, X, MapPin, Camera, RefreshCw, AlertCircle, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Componente UI para el Paso 1: Captura de Evidencia Fotográfica Fullscreen (REP-2201).
 * Diseño calcado del User Journey v2.
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

  // Apertura automatica de camara al ingresar por primera vez si no hay fotos
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
    }
    e.target.value = '';
  };

  const photoCount = evidenceList.length;
  const latestPhoto = evidenceList[photoCount - 1] || null;

  // Formato amigable de coordenadas o direccion
  const locationLabel = geolocation?.lat
    ? `${geolocation.lat.toFixed(3)}, ${geolocation.lng.toFixed(3)} · Ubicación GPS`
    : '−34.663, −58.365 · Avellaneda';

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

      {/* 1. VISOR PRINCIPAL / ESCENA DE CAMARA O FOTO CAPTURADA */}
      <div className="relative flex-1 w-full bg-[#1A1F26] overflow-hidden flex items-center justify-center">
        {latestPhoto ? (
          <img
            src={latestPhoto.previewUrl}
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
          {/* Boton Cerrar / Volver */}
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

          {/* Icono Flash / Ajustes */}
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
          {/* A. Miniaturas de fotos capturadas (Pila) */}
          <div className="w-14 flex items-center justify-start">
            {photoCount > 0 ? (
              <div className="relative cursor-pointer" onClick={onContinue} title="Ver fotos y continuar">
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

                {/* Boton X para limpiar fotos */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClearEvidence();
                  }}
                  aria-label="Eliminar fotos"
                  className="absolute -bottom-1.5 -left-1.5 w-4 h-4 rounded-full bg-black/80 text-white flex items-center justify-center border-0 cursor-pointer p-0"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="w-10 h-10 rounded-xl border border-dashed border-white/20 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
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
    </div>
  );
};
