import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import { useEvidenceCapture } from '../hooks/useEvidenceCapture';
import { EvidenceCaptureStep } from '../components/report/EvidenceCaptureStep';
import { ReportDetailsStep } from '../components/report/ReportDetailsStep';
import { ReportReviewStep } from '../components/report/ReportReviewStep';
import { useGeolocation } from '../hooks/useGeolocation';
import { getReportCategories, DEFAULT_REPORT_CATEGORIES } from '../services/categoriesService';
import {
  hasAcceptedCurrentTerms,
  recordTermsAcceptance,
} from '../services/termsService';

/**
 * Pagina principal del flujo de Nuevo Reporte Ciudadano (REP-2200).
 * Integra los Pasos 1, 2 y 3 con modal bottom sheet de consentimiento único (User Journey v2).
 */
export const NewReportPage = ({ initialEvidenceList = [] }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
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
  const userHasAccepted = hasAcceptedCurrentTerms(user?.id);

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

  // Envío directo de reporte (para usuarios con consentimiento previo)
  const handleSubmitReport = () => {
    toast.success('¡Reporte enviado con éxito!', {
      description: 'Tu evidencia fue enviada y será anonimizada en el servidor.',
    });
    handleCancel();
  };

  // Acto de consentimiento + envío (primer reporte)
  const handleAcceptTermsAndSubmit = async () => {
    await recordTermsAcceptance(user?.id, { camera: true, location: true });
    toast.success('¡Consentimiento registrado y reporte enviado!', {
      description: 'Tu reporte ha sido generado bajo la versión v1.2 de Términos y Privacidad.',
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
              hasAcceptedTerms={userHasAccepted}
              onBack={handleBack}
              onSubmitReport={handleSubmitReport}
              onAcceptTermsAndSubmit={handleAcceptTermsAndSubmit}
              onViewAllPhotos={() => setCurrentStep(1)}
              onOpenTerms={() => navigate('/terminos')}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NewReportPage;
