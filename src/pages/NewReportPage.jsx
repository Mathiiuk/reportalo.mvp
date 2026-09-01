import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useEvidenceCapture } from '../hooks/useEvidenceCapture';
import { EvidenceCaptureStep } from '../components/report/EvidenceCaptureStep';
import { ReportDetailsStep } from '../components/report/ReportDetailsStep';
import { useGeolocation } from '../hooks/useGeolocation';
import { getReportCategories, DEFAULT_REPORT_CATEGORIES } from '../services/categoriesService';

/**
 * Pagina principal del flujo de Nuevo Reporte Ciudadano (REP-2200).
 * Integra los Pasos 1 y 2 con diseño calcado del User Journey v2.
 */
export const NewReportPage = ({ initialEvidenceList = [] }) => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [categories, setCategories] = useState(DEFAULT_REPORT_CATEGORIES);
  const [selectedCategory, setSelectedCategory] = useState(DEFAULT_REPORT_CATEGORIES[1]); // Default: Infracción de tránsito
  const [description, setDescription] = useState('Camión de gran porte circulando por calle residencial, a las 14:30.');
  const { coordinates } = useGeolocation({ autoFetch: true });

  const {
    evidenceList,
    error,
    isProcessing,
    captureFile,
    removePhoto,
    clearEvidence,
  } = useEvidenceCapture({
    geolocation: coordinates,
  });

  const activeList = evidenceList.length > 0 ? evidenceList : initialEvidenceList;

  // Cargar categorias desde la DB con fallback
  useEffect(() => {
    let isMounted = true;
    getReportCategories().then((data) => {
      if (isMounted && data && data.length > 0) {
        setCategories(data);
        if (!selectedCategory) {
          setSelectedCategory(data[0]);
        }
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

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

        {/* PASO 2: Categoría y Descripción (Diseño exacto Journey v2) */}
        {currentStep === 2 && (
          <motion.div
            key="step-2"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="w-full h-full flex flex-col"
          >
            <ReportDetailsStep
              categories={categories}
              selectedCategory={selectedCategory}
              description={description}
              onSelectCategory={setSelectedCategory}
              onChangeDescription={setDescription}
              onBack={handleBack}
              onContinue={() => setCurrentStep(3)}
            />
          </motion.div>
        )}

        {/* PASO 3: Placeholder para el envío final */}
        {currentStep === 3 && (
          <motion.div
            key="step-3"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="w-full h-full bg-[#F4F7FB] flex flex-col justify-between p-4"
          >
            <div className="flex items-center gap-2 mb-4">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="w-8 h-8 rounded-full bg-white flex items-center justify-center border border-slate-200 cursor-pointer"
              >
                <span className="material-symbols-rounded text-[20px]">arrow_back</span>
              </button>
              <h2 className="text-[17px] font-extrabold text-[#1B365D] m-0">Paso 3: Enviar</h2>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex-1 flex flex-col items-center justify-center text-center">
              <p className="text-sm font-bold text-[#1B365D] mb-1">Paso de Revisión y Envío</p>
              <p className="text-xs text-slate-500 max-w-[260px]">
                Categoría: <strong>{selectedCategory?.name}</strong> con {activeList.length} foto(s).
              </p>
            </div>

            <button
              type="button"
              onClick={handleCancel}
              className="w-full py-3.5 px-4 rounded-[13px] bg-[#1E6FCB] text-white font-extrabold text-[14px] cursor-pointer border-0 mt-4"
            >
              Volver al mapa
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NewReportPage;
