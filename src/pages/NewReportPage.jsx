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
import { EvidencePreviewScreen } from '../components/report/EvidencePreviewScreen';
import { ReportSuccessScreen } from '../components/report/ReportSuccessScreen';
import { TermsAndPermissionsPage } from './TermsAndPermissionsPage';
import { useGeolocation } from '../hooks/useGeolocation';
import { getReportCategories, DEFAULT_REPORT_CATEGORIES } from '../services/categoriesService';
import {
  hasAcceptedCurrentTerms,
  recordTermsAcceptance,
} from '../services/termsService';

import { getFriendlyLocationLabel } from '../services/locationService';
// Servicios de persistencia local en IndexedDB para modo offline (REP-2703)
import {
  saveDraftReport,
  getActiveDraftReport,
  markDraftPendingSync,
  deleteDraftReport,
  DRAFT_STATUS,
} from '../services/offlineStorageService';
// Hook de monitoreo reactivo de conectividad (REP-2703)
import { useNetworkStatus } from '../hooks/useNetworkStatus';

/**
 * Pagina principal del flujo de Nuevo Reporte Ciudadano (REP-2200 / REP-2703).
 * Integra los Pasos 1, 2 y 3 con soporte de disparo directo desde el mapa, multifoto (1 a 4)
 * y persistencia offline resiliente en IndexedDB con estado PENDING_SYNC.
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

  // Monitoreo de conectividad a internet en tiempo real (REP-2703)
  const { isOnline } = useNetworkStatus();

  // Identificador de cliente único (client_side_id UUID) para idempotencia en DB
  const [clientSideId, setClientSideId] = useState(() => (
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  ));

  // Estado del borrador local (DRAFT_LOCAL o PENDING_SYNC)
  const [draftStatus, setDraftStatus] = useState(
    isOnline ? DRAFT_STATUS.DRAFT_LOCAL : DRAFT_STATUS.PENDING_SYNC
  );

  // Lista de evidencias anonimizadas devueltas por el pipeline de cuarentena (REP-2402)
  const [processedEvidenceList, setProcessedEvidenceList] = useState([]);

  const {
    evidenceList,
    error,
    isProcessing,
    captureFile,
    removePhoto,
    clearEvidence,
    restoreEvidenceList,
  } = useEvidenceCapture({
    initialEvidenceList,
    geolocation: coordinates,
  });

  const processedInitialFileRef = useRef(false);

  // Referencia para rastrear si el usuario ya navegó manualmente de paso para evitar que la promesa de IndexedDB lo resetee
  const hasUserNavigatedStepRef = useRef(false);

  // Función controlada para avanzar o retroceder de paso
  const goToStep = (stepOrUpdater) => {
    hasUserNavigatedStepRef.current = true;
    setCurrentStep(stepOrUpdater);
  };

  // Si vino una foto tomada directamente en el clic del botón de cámara del mapa
  useEffect(() => {
    if (!processedInitialFileRef.current && location.state?.initialCapturedFile) {
      processedInitialFileRef.current = true;
      captureFile(location.state.initialCapturedFile);
    }
  }, [location.state, captureFile]);

  // Recuperación automática de borrador no enviado desde IndexedDB al montar (REP-2703)
  useEffect(() => {
    let isMounted = true;

    // Solo restauramos si no se inició el flujo con una foto capturada fresca desde el mapa ni con initialEvidenceList
    if (!location.state?.initialCapturedFile && initialEvidenceList.length === 0) {
      getActiveDraftReport()
        .then((draft) => {
          if (isMounted && draft && draft.client_side_id) {
            // Asignamos el identificador del borrador existente
            setClientSideId(draft.client_side_id);
            setDraftStatus(draft.status || DRAFT_STATUS.DRAFT_LOCAL);

            // Solo restauramos el paso si el usuario aún no navegó manualmente de paso
            if (!hasUserNavigatedStepRef.current && draft.currentStep && draft.currentStep >= 1 && draft.currentStep <= 3) {
              setCurrentStep(draft.currentStep);
            }

            // Restauramos los campos del formulario
            if (draft.selectedCategory) {
              setSelectedCategory(draft.selectedCategory);
            }
            if (typeof draft.description === 'string' && draft.description.trim()) {
              setDescription(draft.description);
            }
            if (draft.customLocation) {
              setCustomLocation(draft.customLocation);
            }

            // Restauramos la lista de evidencias con sus objetos Blob/File si no hay fotos en memoria
            if (
              Array.isArray(draft.evidenceList) &&
              draft.evidenceList.length > 0 &&
              evidenceList.length === 0
            ) {
              const restoredEvidences = draft.evidenceList.map((ev) => {
                const fileObj = ev.blob || ev.file;
                let previewUrl = ev.previewUrl || '';
                // Generamos una URL de objeto fresca para previsualización si contamos con el blob
                if (fileObj && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
                  try {
                    previewUrl = URL.createObjectURL(fileObj);
                  } catch (e) {
                    // Fallback a URL previa
                  }
                }
                return {
                  ...ev,
                  file: fileObj,
                  previewUrl,
                };
              });

              if (typeof restoreEvidenceList === 'function') {
                restoreEvidenceList(restoredEvidences);
              }
            }
          }
        })
        .catch((err) => {
          console.warn('No se pudo recuperar borrador activo de IndexedDB:', err);
        });
    }

    return () => {
      isMounted = false;
    };
  }, []);

  const activeList = evidenceList.length > 0 ? evidenceList : initialEvidenceList;
  const userHasAccepted = hasAcceptedCurrentTerms(user?.id);
  const activeCoords = customLocation?.coordinates || coordinates;
  const activeAddressLabel = customLocation?.fullAddress || getFriendlyLocationLabel(coordinates);

  // Auto-guardado reactivo en IndexedDB ante cambios en fotos o datos del reporte (REP-2703)
  useEffect(() => {
    // Si estamos en Paso 4 (procesando) o Paso 5 (éxito), no sobreescribimos el borrador
    if (currentStep > 3) return;

    // Solo guardamos si el usuario cargó al menos una foto o descripción
    if (activeList.length === 0 && !description) return;

    const currentStatus = !isOnline ? DRAFT_STATUS.PENDING_SYNC : draftStatus;

    saveDraftReport({
      client_side_id: clientSideId,
      currentStep,
      evidenceList: activeList,
      selectedCategory,
      description,
      customLocation,
      geolocation: activeCoords,
      address: activeAddressLabel,
      status: currentStatus,
    }).catch((err) => {
      console.warn('Auto-guardado en IndexedDB no disponible:', err);
    });
  }, [
    clientSideId,
    currentStep,
    activeList,
    selectedCategory,
    description,
    customLocation,
    activeCoords,
    activeAddressLabel,
    isOnline,
    draftStatus,
  ]);

  // Manejo reactivo de pérdida de conectividad (REP-2703)
  useEffect(() => {
    if (!isOnline && clientSideId) {
      setDraftStatus(DRAFT_STATUS.PENDING_SYNC);
      markDraftPendingSync(clientSideId).catch(() => {});
      // Notificación coloquial y tranquilizadora al usuario
      toast.warning('Te quedaste sin conexión', {
        description: 'Tus fotos y datos están guardados en tu teléfono y no se van a perder.',
      });
    }
  }, [isOnline, clientSideId]);

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

  // Cancelar flujo y regresar al mapa: purga el borrador de IndexedDB de fondo y navega de inmediato (REP-2703)
  const handleCancel = () => {
    if (clientSideId) {
      deleteDraftReport(clientSideId).catch(() => {});
    }
    clearEvidence();
    navigate('/mapa', { replace: true });
  };

  const handleBack = () => {
    if (currentStep > 1) {
      goToStep((prev) => prev - 1);
    } else {
      handleCancel();
    }
  };

  // Envío de reporte: si está offline, se persiste en PENDING_SYNC; si está online, avanza a cuarentena
  const handleSubmitReport = async () => {
    if (!isOnline) {
      // Estado explícito PENDING_SYNC cuando no hay conectividad (REP-2703)
      await markDraftPendingSync(clientSideId);
      // Mensaje coloquial informando que se guardó y enviará solo
      toast.success('Reporte guardado con éxito', {
        description: 'Se enviará automáticamente apenas recuperes señal.',
      });
      navigate('/mapa', { replace: true });
      return;
    }

    // Si hay conexión: punto de salida hacia el pipeline server-side de cuarentena (REP-2400 / REP-2404)
    goToStep(4);
  };

  // Acto de consentimiento + envío (primer reporte)
  const handleAcceptTermsAndSubmit = async () => {
    await recordTermsAcceptance(user?.id, { camera: true, location: true });
    if (!isOnline) {
      await markDraftPendingSync(clientSideId);
      // Mensaje coloquial informando que se guardó y enviará solo
      toast.success('Reporte guardado con éxito', {
        description: 'Se enviará automáticamente apenas recuperes señal.',
      });
      navigate('/mapa', { replace: true });
      return;
    }
    goToStep(4);
  };

  // Purgado de la imagen original local una vez confirmada la sincronización exitosa (REP-2703 / REP-2402)
  useEffect(() => {
    if (currentStep === 6 && clientSideId) {
      deleteDraftReport(clientSideId).catch(() => {});
    }
  }, [currentStep, clientSideId]);

  // Determinar agencia receptora según ubicación
  const determinedAgency = activeAddressLabel?.toLowerCase().includes('avellaneda')
    ? 'Municipio de Avellaneda'
    : 'Gobierno de la Ciudad de Buenos Aires';


  return (
    <div
      data-testid="new-report-page"
      className={`relative w-full h-[100dvh] ${
        currentStep === 1 || currentStep === 4 || currentStep === 5
          ? 'bg-[#0E1116]'
          : 'bg-[#F4F7FB]'
      } overflow-hidden flex flex-col font-manrope select-none`}
    >
      {/* Banner informativo de estado sin conexión (REP-2703) */}
      {!isOnline && (
        <div
          data-testid="offline-status-banner"
          className="bg-[#FFF4E5] border-b border-[#FFE2B8] px-3 py-1 flex items-center justify-between text-[#B25E00] text-[11.5px] font-semibold z-20 flex-shrink-0"
        >
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-rounded text-[15px]">wifi_off</span>
            <span>Estás sin conexión — Tu reporte quedó guardado en tu teléfono</span>
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">

        {/* PASO 1: Captura de Evidencia Fullscreen (Diseño exacto Journey v2) */}
        {currentStep === 1 && (
          <motion.div
            key="step-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="w-full flex-1 min-h-0 flex flex-col overflow-hidden"
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
              onContinue={() => goToStep(2)}
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
            className="w-full flex-1 min-h-0 flex flex-col overflow-hidden"
          >
            <ReportDetailsStep
              categories={categories}
              selectedCategory={selectedCategory}
              description={description}
              onSelectCategory={setSelectedCategory}
              onChangeDescription={setDescription}
              onBack={handleBack}
              onContinue={() => goToStep(3)}
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
            className="w-full flex-1 min-h-0 flex flex-col overflow-hidden"
          >
            <ReportReviewStep
              evidenceList={activeList}
              selectedCategory={selectedCategory}
              description={description}
              geolocation={activeCoords}
              address={activeAddressLabel}
              hasAcceptedTerms={userHasAccepted}
              isOnline={isOnline}
              draftStatus={draftStatus}
              onBack={handleBack}
              onSubmitReport={handleSubmitReport}
              onAcceptTermsAndSubmit={handleAcceptTermsAndSubmit}
              onViewAllPhotos={() => goToStep(1)}
              onOpenTerms={() => setShowTermsModal(true)}
              onOpenAdjustLocation={() => setShowAdjustLocationModal(true)}
            />

          </motion.div>
        )}

        {/* PASO 4: Procesamiento y Protección de Fotos ("Protegiendo tus fotos…") - Pipeline Server-Side Cuarentena (REP-2404) */}
        {currentStep === 4 && (
          <motion.div
            key="step-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="w-full flex-1 min-h-0 flex flex-col overflow-hidden"
          >
            {/* Pantalla de procesamiento sincronizada con el pipeline server-side de cuarentena */}
            <ReportProcessingScreen
              evidenceList={activeList}
              categoryName={selectedCategory?.name || 'Infracción de tránsito'}
              clientSideId={clientSideId}
              durationMs={import.meta.env?.MODE === 'test' ? 300 : 3200}
              onErrorBack={() => goToStep(1)}
              onProcessingComplete={(processedEvidences) => {
                // Al completar la anonimización y sanitización, almacenamos las fotos procesadas y pasamos a previsualizar (REP-2402)
                setProcessedEvidenceList(processedEvidences || activeList);
                goToStep(5);
              }}
            />
          </motion.div>
        )}

        {/* PASO 5: Previsualización de Evidencia Anonimizada ("Tu foto está lista y protegida" - REP-2402) */}
        {currentStep === 5 && (
          <motion.div
            key="step-5"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="w-full flex-1 min-h-0 flex flex-col overflow-hidden"
          >
            <EvidencePreviewScreen
              evidenceList={processedEvidenceList.length > 0 ? processedEvidenceList : activeList}
              categoryName={selectedCategory?.name || 'Infracción de tránsito'}
              onConfirm={() => goToStep(6)}
              onRetake={() => {
                clearEvidence();
                goToStep(1);
              }}
            />
          </motion.div>
        )}

        {/* PASO 6: Confirmación de Envío Exitoso ("Reporte enviado") */}
        {currentStep === 6 && (
          <motion.div
            key="step-6"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="w-full flex-1 min-h-0 flex flex-col overflow-hidden"
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
