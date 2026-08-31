import React, { useRef } from 'react';
import { Camera, ImagePlus, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Componente UI para el Paso 1 de Captura de Evidencia Ciudadana (REP-2201).
 * Totalmente desacoplado de procesamiento server-side y servicios de anonimizacion.
 */
export const EvidenceCaptureStep = ({
  evidence,
  error,
  isProcessing = false,
  onCaptureFile,
  onClearEvidence,
}) => {
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file && onCaptureFile) {
      onCaptureFile(file);
    }
    // Resetear valor para permitir seleccionar el mismo archivo si se desea reintentar
    e.target.value = '';
  };

  return (
    <div className="w-full flex-1 flex flex-col justify-between">
      {/* Inputs ocultos para captura directa de camara y seleccion desde galeria */}
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

      <div className="flex-1 flex flex-col">
        {/* Mensaje de Error si el archivo no es valido */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 p-3.5 rounded-2xl bg-[#FEF2F2] border border-[#FCA5A5] flex items-start gap-2.5 text-[#991B1B]"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="text-xs font-bold leading-relaxed">{error}</div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Estado 1: Evidencia Cargada (Preview con acciones) */}
        {evidence ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-full flex-1 min-h-[300px] max-h-[420px] bg-slate-900 rounded-[28px] overflow-hidden border border-slate-200 shadow-md flex flex-col"
          >
            {/* Imagen Previa */}
            <img
              src={evidence.previewUrl}
              alt="Evidencia capturada"
              className="w-full h-full object-cover select-none"
              data-testid="evidence-preview-img"
            />

            {/* Badge de Estado: CAPTURED_LOCAL */}
            <div className="absolute top-3.5 left-3.5 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/65 backdrop-blur-md text-white text-[11px] font-extrabold border border-white/20">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#22C55E]" />
              <span>Foto capturada</span>
            </div>

            {/* Accion de Eliminar/Reemplazar Evidencia */}
            <div className="absolute bottom-3.5 left-3.5 right-3.5 z-10 flex items-center justify-between gap-2 bg-slate-950/70 backdrop-blur-md p-2.5 rounded-2xl border border-white/10">
              <div className="min-w-0 flex-1 px-1">
                <p className="text-white text-[11px] font-bold truncate m-0">
                  {evidence.name}
                </p>
                <p className="text-slate-300 text-[10px] m-0 font-medium">
                  {(evidence.sizeBytes / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>

              <button
                type="button"
                onClick={onClearEvidence}
                aria-label="Eliminar foto capturada"
                className="px-3 py-2 rounded-xl bg-red-600/85 hover:bg-red-600 text-white font-extrabold text-xs flex items-center gap-1.5 border-0 cursor-pointer active:scale-95 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Cambiar</span>
              </button>
            </div>
          </motion.div>
        ) : (
          /* Estado 2: Opciones de Captura (Camara o Galeria) */
          <div className="flex-1 flex flex-col justify-center gap-3">
            {/* Opcion Principal: Tomar Foto con Camara */}
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => cameraInputRef.current?.click()}
              className="w-full p-6 rounded-[28px] bg-gradient-to-br from-[#1E6FCB] to-[#15539B] text-white flex flex-col items-center justify-center gap-3 shadow-[0_10px_25px_rgba(30,111,203,0.3)] hover:brightness-105 active:scale-98 transition-all cursor-pointer border-0"
            >
              <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-xs">
                <Camera className="w-7 h-7 text-white" />
              </div>
              <div className="text-center">
                <span className="text-[16px] font-extrabold block">
                  Tomar fotografía ahora
                </span>
                <span className="text-[12px] text-white/80 font-medium">
                  Abre la cámara de tu dispositivo
                </span>
              </div>
            </button>

            {/* Opcion Secundaria: Seleccionar de Galeria */}
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => galleryInputRef.current?.click()}
              className="w-full p-5 rounded-[24px] bg-white border border-slate-200 text-[#1B365D] flex items-center justify-center gap-3 shadow-xs hover:bg-slate-50 active:scale-98 transition-all cursor-pointer"
            >
              <ImagePlus className="w-5 h-5 text-[#1E6FCB]" />
              <span className="text-[14px] font-extrabold">
                Subir desde mi galería
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
