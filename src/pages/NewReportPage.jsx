import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, X, CheckCircle2, Clock, MapPin, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEvidenceCapture } from '../hooks/useEvidenceCapture';
import { EvidenceCaptureStep } from '../components/report/EvidenceCaptureStep';
import { useGeolocation } from '../hooks/useGeolocation';

/**
 * Pagina principal del flujo de Nuevo Reporte Ciudadano (REP-2200).
 * Integra el Paso 1 de Captura de Evidencia Desacoplada (REP-2201)
 * y una vista informativa controlada para los pasos de los siguientes sprints (S11/S12).
 */
export const NewReportPage = ({ initialEvidence = null }) => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const { coordinates } = useGeolocation({ autoFetch: true });

  const {
    evidence,
    error,
    isProcessing,
    captureFile,
    clearEvidence,
  } = useEvidenceCapture({
    geolocation: coordinates,
  });

  const activeEvidence = evidence || initialEvidence;

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
      className="relative w-full h-[100dvh] bg-[#F4F7FB] overflow-hidden flex flex-col font-manrope select-none"
    >
      {/* Topbar del Wizard */}
      <header className="z-30 bg-white border-b border-slate-100 shadow-xs pt-[max(16px,env(safe-area-inset-top,16px))]">
        <div className="px-4 pt-2 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleBack}
              aria-label={currentStep > 1 ? 'Volver al paso anterior' : 'Volver al mapa'}
              className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 active:scale-95 flex items-center justify-center text-[#475569] transition-all cursor-pointer border-0"
            >
              <ArrowLeft className="w-5 h-5 text-[#334155]" />
            </button>
            <div>
              <h1 className="text-[17px] font-extrabold text-[#1B365D] tracking-tight m-0 leading-tight">
                Nuevo reporte
              </h1>
              <span className="text-[11px] font-bold text-[#8593A2]">
                Paso {currentStep} de 3
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

      {/* Contenedor dinamico del paso activo */}
      <main className="relative w-full h-full min-h-0 flex-1 overflow-y-auto px-4 py-5 max-w-lg mx-auto flex flex-col">
        <AnimatePresence mode="wait">
          {/* PASO 1: Captura de Evidencia */}
          {currentStep === 1 && (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="flex-1 flex flex-col justify-between"
            >
              <div className="flex-1 flex flex-col">
                <div className="mb-4">
                  <span className="inline-block font-extrabold text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-[#EEF5FC] text-[#1E6FCB] mb-2">
                    Paso 1: Evidencia
                  </span>
                  <h2 className="text-[20px] font-extrabold text-[#1B365D] tracking-tight m-0 leading-snug">
                    Adjuntá una foto del problema
                  </h2>
                  <p className="text-[13px] font-medium text-[#64748B] mt-1 leading-relaxed">
                    Tomá una foto en el momento o subila desde tu galería para documentar el reclamo.
                  </p>
                </div>

                {/* Componente interactivo de captura de evidencia desacoplada */}
                <div data-testid="evidence-step-container" className="flex-1 flex flex-col min-h-[280px]">
                  <EvidenceCaptureStep
                    evidence={activeEvidence}
                    error={error}
                    isProcessing={isProcessing}
                    onCaptureFile={captureFile}
                    onClearEvidence={clearEvidence}
                  />
                </div>
              </div>

              {/* Acciones del pie */}
              <div className="pt-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="flex-1 py-3.5 px-4 rounded-2xl bg-white border border-slate-200 text-[#475569] font-extrabold text-[13px] hover:bg-slate-50 active:scale-98 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!activeEvidence || isProcessing}
                  onClick={() => setCurrentStep(2)}
                  className={`flex-1 py-3.5 px-4 rounded-2xl font-extrabold text-[13px] transition-all border-0 ${
                    activeEvidence && !isProcessing
                      ? 'bg-[#1E6FCB] text-white shadow-md hover:bg-[#185ca8] active:scale-98 cursor-pointer'
                      : 'bg-[#E2E8F0] text-[#94A3B8] cursor-not-allowed'
                  }`}
                >
                  Continuar
                </button>
              </div>
            </motion.div>
          )}

          {/* PASO 2: Resumen de Evidencia y Categorización (Próximo Sprint) */}
          {currentStep === 2 && (
            <motion.div
              key="step-2"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="flex-1 flex flex-col justify-between"
            >
              <div className="flex-1 flex flex-col">
                <div className="mb-4">
                  <span className="inline-block font-extrabold text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-[#EEF5FC] text-[#1E6FCB] mb-2">
                    Paso 2: Detalles
                  </span>
                  <h2 className="text-[20px] font-extrabold text-[#1B365D] tracking-tight m-0 leading-snug">
                    Evidencia registrada
                  </h2>
                  <p className="text-[13px] font-medium text-[#64748B] mt-1 leading-relaxed">
                    Tu foto fue capturada en el dispositivo. La categorización y descripción final se habilitan en los próximos sprints.
                  </p>
                </div>

                {/* Resumen de la evidencia capturada */}
                <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-xs mb-4">
                  <div className="flex items-center gap-3.5">
                    {activeEvidence?.previewUrl ? (
                      <img
                        src={activeEvidence.previewUrl}
                        alt="Preview capturada"
                        className="w-16 h-16 rounded-2xl object-cover border border-slate-100 shadow-2xs"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                        <CheckCircle2 className="w-6 h-6 text-[#22C55E]" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="px-2 py-0.5 rounded-md bg-[#DCFCE7] text-[#15803D] text-[10px] font-extrabold uppercase tracking-wide">
                          {activeEvidence?.status || 'CAPTURED_LOCAL'}
                        </span>
                      </div>
                      <p className="text-[13px] font-extrabold text-[#1B365D] truncate m-0">
                        {activeEvidence?.name || 'Foto adjunta'}
                      </p>
                      <p className="text-[11px] text-[#64748B] m-0 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-[#1E6FCB]" />
                        <span>
                          {activeEvidence?.geolocation?.lat
                            ? `${activeEvidence.geolocation.lat.toFixed(4)}, ${activeEvidence.geolocation.lng.toFixed(4)}`
                            : 'Ubicación GPS registrada'}
                        </span>
                      </p>
                    </div>
                  </div>
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
                  Cambiar foto
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="flex-1 py-3.5 px-4 rounded-2xl bg-[#1E6FCB] text-white font-extrabold text-[13px] shadow-md hover:bg-[#185ca8] active:scale-98 transition-all cursor-pointer border-0"
                >
                  Finalizar demo
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default NewReportPage;
