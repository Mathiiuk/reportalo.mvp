import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useEvidenceCapture } from '../hooks/useEvidenceCapture';
import { EvidenceCaptureStep } from '../components/report/EvidenceCaptureStep';
import { ReportDetailsStep } from '../components/report/ReportDetailsStep';
import { ReportReviewStep } from '../components/report/ReportReviewStep';
import { useGeolocation } from '../hooks/useGeolocation';
import { getReportCategories, DEFAULT_REPORT_CATEGORIES } from '../services/categoriesService';

/**
 * Pagina principal del flujo de Nuevo Reporte Ciudadano (REP-2200).
 * Integra los Pasos 1, 2 y 3 con diseño calcado del User Journey v2.
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

  // Simulación / Acción de envío del reporte
  const handleSubmitReport = () => {
    toast.success('¡Reporte generado con éxito!', {
      description: 'Tu evidencia fue registrada localmente con estado CAPTURED_LOCAL.',
    });
    handleCancel();
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

        {/* PASO 3: Revisión antes de enviar (Diseño exacto Journey v2) */}
        {currentStep === 3 && (
          <motion.div
            key="step-3"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="w-full h-full flex flex-col"
          >
            <ReportReviewStep
              evidenceList={activeList}
              selectedCategory={selectedCategory}
              description={description}
              geolocation={coordinates}
              address="Av. Mitre 1240, Avellaneda"
              onBack={handleBack}
              onSubmit={handleSubmitReport}
              onViewAllPhotos={() => setCurrentStep(1)}
              onOpenTerms={() => navigate('/terminos', { state: { consultaDesde: 'nuevo-reporte' } })}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NewReportPage;
