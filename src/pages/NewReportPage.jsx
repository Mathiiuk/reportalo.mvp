import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import { useEvidenceCapture } from '../hooks/useEvidenceCapture';
import { EvidenceCaptureStep } from '../components/report/EvidenceCaptureStep';
import { ReportDetailsStep } from '../components/report/ReportDetailsStep';
import { ReportReviewStep } from '../components/report/ReportReviewStep';
import { AdjustLocationModal } from '../components/report/AdjustLocationModal';
import { ReportProcessingScreen } from '../components/report/ReportProcessingScreen';
import { ReportSuccessScreen } from '../components/report/ReportSuccessScreen';
import { TermsAndPermissionsPage } from './TermsAndPermissionsPage';
import { useGeolocation } from '../hooks/useGeolocation';
import { getReportCategories, DEFAULT_REPORT_CATEGORIES } from '../services/categoriesService';
import {
  hasAcceptedCurrentTerms,
  recordTermsAcceptance,
} from '../services/termsService';

import { getFriendlyLocationLabel } from '../services/locationService';

/**
 * Pagina principal del flujo de Nuevo Reporte Ciudadano (REP-2200).
 * Integra los Pasos 1, 2 y 3 con soporte de disparo directo desde el mapa y multifoto (1 a 4).
 */
export const NewReportPage = ({ initialEvidenceList = [] }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showAdjustLocationModal, setShowAdjustLocationModal] = useState(false);
  const [customLocation, setCustomLocation] = useState(null);
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

  const processedInitialFileRef = useRef(false);

  // Si vino una foto tomada directamente en el clic del botón de cámara del mapa
  useEffect(() => {
    if (!processedInitialFileRef.current && location.state?.initialCapturedFile) {
      processedInitialFileRef.current = true;
      captureFile(location.state.initialCapturedFile);
    }
  }, [location.state, captureFile]);

  const activeList = evidenceList.length > 0 ? evidenceList : initialEvidenceList;
  const userHasAccepted = hasAcceptedCurrentTerms(user?.id);
  const activeCoords = customLocation?.coordinates || coordinates;
  const activeAddressLabel = customLocation?.fullAddress || getFriendlyLocationLabel(coordinates);

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

  // Envío directo de reporte (para usuarios con consentimiento previo) -> Transición a procesamiento
  const handleSubmitReport = () => {
    setCurrentStep(4);
  };

  // Acto de consentimiento + envío (primer reporte) -> Registra consentimiento y transiciona a procesamiento
  const handleAcceptTermsAndSubmit = async () => {
    await recordTermsAcceptance(user?.id, { camera: true, location: true });
    setCurrentStep(4);
  };

  // Determinar agencia receptora según ubicación
  const determinedAgency = activeAddressLabel?.toLowerCase().includes('avellaneda')
    ? 'Municipio de Avellaneda'
    : 'Gobierno de la Ciudad de Buenos Aires';

  return (
    <div
      data-testid="new-report-page"
      className={`relative w-full h-[100dvh] ${
        currentStep === 1 || currentStep === 4 ? 'bg-[#0E1116]' : 'bg-[#F4F7FB]'
      } overflow-hidden flex flex-col font-manrope select-none`}
    >
      <AnimatePresence mode="wait">
        {/* PASO 1: Captura de Evidencia Fullscreen (Diseño exacto Journey v2) */}
        {currentStep === 1 && (
          <motion.div
            key="step-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
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
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
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

        {/* PASO 3: Revisión antes de enviar (Diseño exacto Journey v3.1) */}
        {currentStep === 3 && (
          <motion.div
            key="step-3"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="w-full h-full flex flex-col"
          >
            <ReportReviewStep
              evidenceList={activeList}
              selectedCategory={selectedCategory}
              description={description}
              geolocation={activeCoords}
              address={activeAddressLabel}
              hasAcceptedTerms={userHasAccepted}
              onBack={handleBack}
              onSubmitReport={handleSubmitReport}
              onAcceptTermsAndSubmit={handleAcceptTermsAndSubmit}
              onViewAllPhotos={() => setCurrentStep(1)}
              onOpenTerms={() => setShowTermsModal(true)}
              onOpenAdjustLocation={() => setShowAdjustLocationModal(true)}
            />
          </motion.div>
        )}

        {/* PASO 4: Procesamiento y Protección de Fotos ("Protegiendo tus fotos…") */}
        {currentStep === 4 && (
          <motion.div
            key="step-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="w-full h-full flex flex-col"
          >
            <ReportProcessingScreen
              evidenceList={activeList}
              categoryName={selectedCategory?.name || 'Infracción de tránsito'}
              onProcessingComplete={() => setCurrentStep(5)}
            />
          </motion.div>
        )}

        {/* PASO 5: Confirmación de Envío Exitoso ("Reporte enviado") */}
        {currentStep === 5 && (
          <motion.div
            key="step-5"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="w-full h-full flex flex-col"
          >
            <ReportSuccessScreen
              reportCode="#RP-2048"
              category={selectedCategory}
              agencyName={determinedAgency}
              onViewReport={() => {
                clearEvidence();
                navigate('/reportes');
              }}
              onReturnToMap={() => {
                clearEvidence();
                navigate('/mapa');
              }}
              onViewTerms={() => setShowTermsModal(true)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL / PANTALLA SUPERPUESTA PARA AJUSTAR UBICACIÓN (¿Dónde ocurrió?) */}
      <AnimatePresence>
        {showAdjustLocationModal && (
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed inset-0 z-50 bg-white"
          >
            <AdjustLocationModal
              initialCoordinates={activeCoords}
              onClose={() => setShowAdjustLocationModal(false)}
              onConfirm={(adjustedData) => {
                setCustomLocation(adjustedData);
                setShowAdjustLocationModal(false);
                toast.success('Ubicación actualizada', {
                  description: adjustedData.fullAddress,
                });
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL / PANTALLA SUPERPUESTA DE TÉRMINOS Y PRIVACIDAD */}
      <AnimatePresence>
        {showTermsModal && (
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed inset-0 z-50 bg-white"
          >
            <TermsAndPermissionsPage onBackOverride={() => setShowTermsModal(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NewReportPage;
