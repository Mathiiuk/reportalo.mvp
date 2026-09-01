import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, X, CheckCircle2, Clock, MapPin, Trash2, Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEvidenceCapture } from '../hooks/useEvidenceCapture';
import { EvidenceCaptureStep } from '../components/report/EvidenceCaptureStep';
import { useGeolocation } from '../hooks/useGeolocation';

/**
 * Pagina principal del flujo de Nuevo Reporte Ciudadano (REP-2200).
 * Integra el Paso 1 Fullscreen calcado del User Journey v2 (REP-2201).
 */
export const NewReportPage = ({ initialEvidenceList = [] }) => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const { coordinates } = useGeolocation({ autoFetch: true });

  const {
    evidenceList,
    evidence,
    error,
    isProcessing,
    photoCount,
    captureFile,
    removePhoto,
    clearEvidence,
  } = useEvidenceCapture({
    geolocation: coordinates,
  });

  const activeList = evidenceList.length > 0 ? evidenceList : initialEvidenceList;

  // Cancelar flujo y regresar al mapa sin generar datos residuales
  const handleCancel = () => {
    clearEvidence();
    navigate('/mapa', { replace: true });
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    } else {
      handleCancel();
    }
  };

  return (
    <div
      data-testid="new-report-page"
      className="relative w-full h-[100dvh] bg-[#0E1116] overflow-hidden flex flex-col font-manrope select-none"
    >
      <AnimatePresence mode="wait">
        {/* PASO 1: Captura de Evidencia Fullscreen (Diseño exacto Journey v2) */}
        {currentStep === 1 && (
          <motion.div
            key="step-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full h-full flex flex-col"
          >
            <EvidenceCaptureStep
              evidenceList={activeList}
              error={error}
              isProcessing={isProcessing}
              geolocation={coordinates}
              onCaptureFile={captureFile}
              onClearEvidence={clearEvidence}
              onRemovePhoto={removePhoto}
              onCancel={handleCancel}
              onContinue={() => setCurrentStep(2)}
            />
          </motion.div>
        )}

        {/* PASO 2: Resumen de Evidencias Capturadas y Continuación */}
        {currentStep === 2 && (
          <motion.div
            key="step-2"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="w-full h-full bg-[#F4F7FB] flex flex-col justify-between"
          >
            {/* Header del Paso 2 */}
            <header className="z-30 bg-white border-b border-slate-100 shadow-xs pt-[max(16px,env(safe-area-inset-top,16px))]">
              <div className="px-4 pt-2 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleBack}
                    aria-label="Volver al paso anterior"
                    className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 active:scale-95 flex items-center justify-center text-[#475569] transition-all cursor-pointer border-0"
                  >
                    <ArrowLeft className="w-5 h-5 text-[#334155]" />
                  </button>
                  <div>
                    <h1 className="text-[17px] font-extrabold text-[#1B365D] tracking-tight m-0 leading-tight">
                      Nuevo reporte
                    </h1>
                    <span className="text-[11px] font-bold text-[#8593A2]">
                      Paso 2 de 3 · {activeList.length} {activeList.length === 1 ? 'foto' : 'fotos'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCancel}
                  aria-label="Cancelar reporte"
                  className="w-9 h-9 rounded-full hover:bg-slate-100 active:scale-95 flex items-center justify-center text-[#94A3B8] hover:text-[#475569] transition-all cursor-pointer border-0 bg-transparent"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </header>

            {/* Contenido del Paso 2 */}
            <main className="relative w-full h-full min-h-0 flex-1 overflow-y-auto px-4 py-5 max-w-lg mx-auto flex flex-col justify-between">
              <div className="flex flex-col">
                <div className="mb-4">
                  <span className="inline-block font-extrabold text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-[#EEF5FC] text-[#1E6FCB] mb-2">
                    Paso 2: Detalles
                  </span>
                  <h2 className="text-[20px] font-extrabold text-[#1B365D] tracking-tight m-0 leading-snug">
                    Evidencia registrada ({activeList.length})
                  </h2>
                  <p className="text-[13px] font-medium text-[#64748B] mt-1 leading-relaxed">
                    Tus fotografías permanecen seguras en este dispositivo hasta el envío final.
                  </p>
                </div>

                {/* Grid / Lista de fotos capturadas */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {activeList.map((item, index) => (
                    <div
                      key={item.id || index}
                      className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 aspect-4/3 shadow-xs group"
                    >
                      <img src={item.previewUrl} alt={`Evidencia ${index + 1}`} className="w-full h-full object-cover" />
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-[10px] font-bold text-white">
                        #{index + 1}
                      </div>
                      <button
                        type="button"
                        onClick={() => removePhoto(item.id)}
                        aria-label={`Eliminar foto ${index + 1}`}
                        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-600/90 text-white flex items-center justify-center border-0 cursor-pointer shadow-xs active:scale-95"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                  {/* Slot para agregar más fotos si son menos de 4 */}
                  {activeList.length < 4 && (
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="rounded-2xl border-2 border-dashed border-slate-300 bg-white/60 hover:bg-white flex flex-col items-center justify-center p-3 text-[#1E6FCB] gap-1.5 aspect-4/3 cursor-pointer transition-all active:scale-98"
                    >
                      <Camera className="w-6 h-6 opacity-80" />
                      <span className="text-[11px] font-extrabold">+ Agregar foto</span>
                    </button>
                  )}
                </div>

                {/* Banner de Siguiente Fase (Roadmap Sprint 11 & 12) */}
                <div className="p-4 rounded-3xl bg-gradient-to-br from-[#F8FAFC] to-[#EEF5FC] border border-[#CBD5E1] flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#1E6FCB]/10 flex items-center justify-center text-[#1E6FCB] flex-shrink-0 mt-0.5">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-[13px] font-extrabold text-[#1B365D] m-0">
                      Sincronización Offline & IA
                    </h3>
                    <p className="text-[11.5px] text-[#64748B] font-medium mt-1 leading-relaxed m-0">
                      La persistencia en <strong>IndexedDB (Sprint 11)</strong> y la clasificación automática con <strong>RAG/IA y envío (Sprint 12)</strong> completarán este formulario.
                    </p>
                  </div>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="pt-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="flex-1 py-3.5 px-4 rounded-2xl bg-white border border-slate-200 text-[#475569] font-extrabold text-[13px] hover:bg-slate-50 active:scale-98 transition-all cursor-pointer"
                >
                  Modificar fotos
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="flex-1 py-3.5 px-4 rounded-2xl bg-[#1E6FCB] text-white font-extrabold text-[13px] shadow-md hover:bg-[#185ca8] active:scale-98 transition-all cursor-pointer border-0"
                >
                  Finalizar demo
                </button>
              </div>
            </main>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NewReportPage;
