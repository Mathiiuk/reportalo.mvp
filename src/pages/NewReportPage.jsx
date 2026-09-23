import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { resolveServiceDbId, getReportCategories, DEFAULT_REPORT_CATEGORIES } from '../services/categoriesService';
import { hasAcceptedCurrentTerms, recordTermsAcceptance, CURRENT_TERMS_VERSION } from '../services/termsService';

import { getFriendlyLocationLabel } from '../services/locationService';
// REP-2500-PRESEL: sugerencia de localidad a partir de la ubicacion real
import { findNearestLocality } from '../services/localityCentroids';
import { getSelectableLocalities } from '../services/localitiesService';
// Servicios de persistencia local en IndexedDB para modo offline (REP-2703)
import {
  saveDraftReport,
  getActiveDraftReport,
  markDraftPendingSync,
  deleteDraftReport,
  DRAFT_STATUS,
} from '../services/offlineStorageService';
// Persistencia real del reporte (REP-2500)
import { createCitizenReport, attachReportEvidence, isServerProtectedUrl } from '../services/reportSubmissionService';
import { formatReportCode } from '../components/report/reportStatus';
// Hook de monitoreo reactivo de conectividad (REP-2703)
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { WifiOff } from 'lucide-react';

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
  // Marca que la localidad la definio el ciudadano (ajuste manual o borrador
  // restaurado). Mientras sea false, la preseleccion automatica puede refinarse
  // sola al llegar mejores coordenadas. Es un ref y no estado porque solo
  // condiciona un efecto: no necesita provocar renders.
  const hasManualLocationRef = useRef(false);
  const [categories, setCategories] = useState(DEFAULT_REPORT_CATEGORIES);
  const [selectedCategory, setSelectedCategory] = useState(DEFAULT_REPORT_CATEGORIES[1]); // Default: Infracción de tránsito
  const [description, setDescription] = useState('');
  // isGranted distingue una lectura real de GPS del valor por defecto
  // (DEFAULT_CITY_COORDINATES): sugerir una localidad a partir del respaldo
  // seria inferir jurisdiccion desde una ubicacion inventada (REP-2500-PRESEL).
  const {
    coordinates,
    isGranted: isLocationGranted,
    status: gpsStatus,
    isDenied: isGpsDenied,
    refreshLocation,
  } = useGeolocation({ autoFetch: true });
  // UJ v3.3 · M22: el GPS no respondió o el permiso está bloqueado (PENDING no cuenta como error)
  const isGpsUnavailable = ['DENIED', 'UNAVAILABLE', 'TIMEOUT', 'NOT_SUPPORTED'].includes(gpsStatus);

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

  // Reporte ya persistido en Supabase (REP-2500) — id real y código para mostrar en éxito (E-4)
  const [persistedReport, setPersistedReport] = useState(null);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  // REP-2204: candado contra el doble envío. Es un ref y no un estado a propósito: dos toques
  // en el mismo cuadro leen el mismo render, y solo un ref se ve actualizado entre los dos.
  const submitLockRef = useRef(false);
  // Segunda barrera: la persistencia misma tampoco corre dos veces a la vez
  const persistInFlightRef = useRef(false);
  const [isSendLocked, setIsSendLocked] = useState(false);
  const lockSubmit = () => {
    if (submitLockRef.current) return false;
    submitLockRef.current = true;
    setIsSendLocked(true);
    return true;
  };
  const unlockSubmit = () => {
    submitLockRef.current = false;
    setIsSendLocked(false);
  };
  // REP-3543: constancia de consentimiento del envío que originó la aceptación (se muestra en M15)
  const [consentRecord, setConsentRecord] = useState(null);

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
            if (
              typeof draft.description === 'string' &&
              draft.description.trim() &&
              !draft.description.includes('Camión de gran porte circulando por calle residencial')
            ) {
              setDescription(draft.description);
            }
            if (draft.customLocation) {
              // Un borrador guardado ya refleja una decision del ciudadano:
              // la preseleccion automatica no debe reemplazarla.
              hasManualLocationRef.current = true;
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
  // REP-2500-PRESEL: preselecciona la localidad mas cercana a la ubicacion real
  // del dispositivo, para que el ciudadano solo tenga que confirmarla. Es una
  // sugerencia, no una imposicion: "Ajustar" sigue disponible y el aviso de
  // "detectada automaticamente" invita a corregirla.
  //
  // No se pisa una eleccion del ciudadano: hasManualLocationRef marca que
  // eligio a mano o que se restauro un borrador, y en ese caso la sugerencia
  // no vuelve a correr.
  //
  // Si en cambio la localidad todavia es una sugerencia, el efecto se re-evalua
  // cuando llegan coordenadas mejores: useGeolocation entrega primero una
  // fijacion rapida y aproximada y despues refina con alta precision, asi que
  // la sugerencia (y las coordenadas que se envian con el reporte) se
  // actualizan solas al llegar el dato fino.
  useEffect(() => {
    if (!isLocationGranted || hasManualLocationRef.current) return undefined;

    let cancelled = false;
    getSelectableLocalities()
      .then(({ success, localities }) => {
        if (cancelled || !success) return;
        const nearest = findNearestLocality(coordinates, localities);
        if (!nearest) return; // fuera de CABA/Avellaneda: que elija a mano
        setCustomLocation({
          coordinates,
          localityId: nearest.locality.id,
          localityLabel: nearest.locality.label,
          isAutoSuggested: true,
        });
      })
      .catch(() => {
        // Sin localidades disponibles (offline sin cache) el flujo sigue igual:
        // el ciudadano confirma a mano, como antes de esta mejora.
      });

    return () => {
      cancelled = true;
    };
    // customLocation NO va en las dependencias a proposito: el efecto la
    // escribe, asi que incluirla generaria un ciclo. La guarda de eleccion
    // manual es el ref, que no dispara renders.
  }, [isLocationGranted, coordinates]);

  const activeCoords = customLocation?.coordinates || coordinates;
  const activeAddressLabel = customLocation?.localityLabel || getFriendlyLocationLabel(coordinates);

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
    // REP-2204: un segundo toque mientras el primero está en curso no hace nada
    if (!lockSubmit()) return;
    if (!isOnline) {
      // Estado explícito PENDING_SYNC cuando no hay conectividad (REP-2703)
      try {
        await markDraftPendingSync(clientSideId);
      } catch (err) {
        unlockSubmit();
        throw err;
      }
      // Mensaje coloquial informando que se guardó y enviará solo
      toast.success('Reporte guardado con éxito', {
        description: 'Se enviará automáticamente apenas recuperes señal.',
        // UJ v3.3 · M20: acceso a la cola de pendientes de envío
        action: { label: 'Ver pendientes', onClick: () => navigate('/pendientes') },
      });
      navigate('/mapa', { replace: true });
      return;
    }

    // Si hay conexión: punto de salida hacia el pipeline server-side de cuarentena (REP-2400 / REP-2404)
    goToStep(4);
  };

  // Acto de consentimiento + envío (primer reporte)
  const handleAcceptTermsAndSubmit = async () => {
    if (!lockSubmit()) return;
    try {
      await recordTermsAcceptance(user?.id, { camera: true, location: true });
    } catch (err) {
      unlockSubmit();
      throw err;
    }
    setConsentRecord({ version: CURRENT_TERMS_VERSION, acceptedAt: new Date().toISOString() });
    if (!isOnline) {
      try {
        await markDraftPendingSync(clientSideId);
      } catch (err) {
        unlockSubmit();
        throw err;
      }
      // Mensaje coloquial informando que se guardó y enviará solo
      toast.success('Reporte guardado con éxito', {
        description: 'Se enviará automáticamente apenas recuperes señal.',
        // UJ v3.3 · M20: acceso a la cola de pendientes de envío
        action: { label: 'Ver pendientes', onClick: () => navigate('/pendientes') },
      });
      navigate('/mapa', { replace: true });
      return;
    }
    goToStep(4);
  };

  // REP-2204: si el envío falla y el flujo vuelve a la revisión, se puede reintentar
  useEffect(() => {
    if (currentStep <= 3) {
      submitLockRef.current = false;
      setIsSendLocked(false);
    }
  }, [currentStep]);

  // E-2: el borrador local solo se purga una vez que el servidor confirmó el guardado real (paso 6)
  useEffect(() => {
    if (currentStep === 6 && clientSideId) {
      deleteDraftReport(clientSideId).catch(() => {});
    }
  }, [currentStep, clientSideId]);

  // Extrae {lat, lng} de las dos formas en que puede venir la coordenada activa (array o {lat,lng})
  const extractLatLng = (coords) => {
    if (Array.isArray(coords)) {
      return { lng: coords[0], lat: coords[1] };
    }
    if (coords && typeof coords === 'object') {
      return { lat: coords.lat ?? coords.latitude, lng: coords.lng ?? coords.longitude };
    }
    return { lat: null, lng: null };
  };

  // Persistencia real del reporte (REP-2500): crea la fila real, adjunta cada evidencia ya sanitizada
  // y solo avanza al acuse si todo se guardó (AC-05). UJ v3.3: corre sola al terminar la protección
  // (ya no hay paso de «Confirmar y enviar»); si falla, vuelve a la revisión con el borrador intacto.
  const handleConfirmEvidenceAndPersist = async (evidencesOverride) => {
    // REP-2204: si ya hay una persistencia en curso (doble disparo del callback) no se crea otro reporte
    if (persistInFlightRef.current) return;
    persistInFlightRef.current = true;
    setIsSubmittingReport(true);
    try {
      // H-30 · La validación de privacidad va ANTES de crear el reporte, para que las dos
      // vías de envío se comporten igual. La cola offline se niega a enviar y conserva el
      // borrador cuando alguna foto no salió protegida del servidor (pendingSyncService);
      // acá se hacía lo contrario: se creaba el reporte igual, sin la foto, y el efecto
      // del paso 6 borraba el borrador, así que las fotos del ciudadano se perdían sin
      // posibilidad de reintento.
      const evidencesToAttach =
        evidencesOverride?.length > 0
          ? evidencesOverride
          : processedEvidenceList.length > 0
            ? processedEvidenceList
            : activeList;
      const protectedUrls = evidencesToAttach
        .map((evidence) => evidence.sanitizedUrl)
        .filter(isServerProtectedUrl);

      if (protectedUrls.length !== evidencesToAttach.length) {
        console.error(
          '[handleConfirmEvidenceAndPersist] Evidencia sin proteccion del servidor:',
          `${evidencesToAttach.length - protectedUrls.length} de ${evidencesToAttach.length}`
        );
        toast.error('No pudimos proteger tu foto', {
          description: 'Para cuidar tu privacidad no enviamos el reporte. Tu borrador quedó guardado.',
        });
        goToStep(3);
        return;
      }

      const { lat, lng } = extractLatLng(activeCoords);

      // REP-2204: con las categorías de respaldo no hay dbId; se resuelve por código y, si no se
      // puede, no se envía: antes el reporte se guardaba sin categoría sin avisar.
      const serviceId = await resolveServiceDbId(selectedCategory);
      if (!serviceId) {
        toast.error('No pudimos identificar la categoría', {
          description: 'Tu borrador sigue guardado. Revisá tu conexión y probá de nuevo.',
        });
        goToStep(3);
        return;
      }

      const creationResult = await createCitizenReport({
        clientSideId,
        userId: user?.id,
        serviceId,
        localityId: customLocation?.localityId ?? null,
        description,
        latitud: lat,
        longitud: lng,
      });

      if (!creationResult.success) {
        toast.error('No pudimos enviar tu reporte', {
          // REP-2204: mensaje pensado para el ciudadano; el detalle técnico queda en el log
          description: creationResult.userMessage || 'Tu borrador sigue guardado: probá de nuevo en unos segundos.',
        });
        goToStep(3);
        return;
      }

      // attachReportEvidence devuelve { success, error } y no lanza. Antes el
      // resultado se descartaba, asi que un fallo al adjuntar quedaba mudo: el
      // reporte se enviaba "bien" y la foto simplemente no existia. Fue asi
      // como paso inadvertido que report_images no tenia policy de INSERT.
      // Todas las URLs de protectedUrls ya pasaron la validacion de privacidad de arriba.
      const failedAttachments = [];
      for (const sanitizedUrl of protectedUrls) {
        // eslint-disable-next-line no-await-in-loop
        const attachResult = await attachReportEvidence({
          reportId: creationResult.data.id,
          sanitizedUrl,
        });
        if (!attachResult?.success) {
          failedAttachments.push(attachResult?.error ?? 'Error desconocido');
        }
      }

      if (failedAttachments.length > 0) {
        // El reporte ya se creo: no se revierte por la evidencia. Pero el
        // ciudadano tiene que enterarse de que su foto no quedo adjunta.
        console.error('[handleConfirmEvidenceAndPersist] Evidencia no adjuntada:', failedAttachments);
        toast.warning('Tu reporte se envió, pero no pudimos adjuntar la foto', {
          description: 'Vas a poder verlo igual. Avisanos si el problema se repite.',
        });
      }

      setPersistedReport({
        id: creationResult.data.id,
        // Mismo codigo corto que muestra el detalle (REP-3789): antes la
        // pantalla de exito usaba 8 caracteres y el detalle 4, de modo que el
        // mismo reporte se identificaba de dos formas distintas.
        reportCode: formatReportCode(creationResult.data.id),
      });
      goToStep(6);
    } catch (err) {
      console.error('[handleConfirmEvidenceAndPersist] Error inesperado:', err);
      toast.error('Error al enviar el reporte', {
        description: 'Ocurrió un problema inesperado. Probá de nuevo.',
      });
      goToStep(3);
    } finally {
      setIsSubmittingReport(false);
      persistInFlightRef.current = false;
    }
  };

  // Callback estable para ReportProcessingScreen: su pipeline se reinicia si cambia la referencia
  // de onProcessingComplete, y la persistencia provoca re-renders mientras la pantalla sigue montada.
  const persistReportRef = useRef(handleConfirmEvidenceAndPersist);
  persistReportRef.current = handleConfirmEvidenceAndPersist;
  const handleProcessingComplete = useCallback((processedEvidences) => {
    setProcessedEvidenceList(processedEvidences || []);
    persistReportRef.current(processedEvidences);
  }, []);

  // Determinar agencia receptora según ubicación
  const determinedAgency = activeAddressLabel?.toLowerCase().includes('avellaneda')
    ? 'Municipio de Avellaneda'
    : 'Gobierno de la Ciudad de Buenos Aires';


  return (
    <div
      data-testid="new-report-page"
      className={`relative w-full h-[100dvh] ${
        currentStep === 1 || currentStep === 4 || currentStep === 5
          ? 'bg-rep-camera'
          : 'bg-rep-bg'
      } overflow-hidden flex flex-col font-manrope select-none`}
    >
      {/* Banner informativo de estado sin conexión (REP-2703) */}
      {!isOnline && (
        <div
          data-testid="offline-status-banner"
          className="bg-[#FFF4E5] border-b border-[#FFE2B8] px-3 py-1 flex items-center justify-between text-[#B25E00] text-[11.5px] font-semibold z-20 flex-shrink-0"
        >
          <div className="flex items-center gap-1.5">
            <WifiOff className="w-[15px] h-[15px]" strokeWidth={2.25} />
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
              hasConfirmedLocality={Boolean(customLocation?.localityId)}
              isLocalityAutoSuggested={Boolean(customLocation?.isAutoSuggested)}
              hasAcceptedTerms={userHasAccepted}
              isOnline={isOnline}
              draftStatus={draftStatus}
              isSubmitting={isSendLocked}
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
              onDiscard={handleCancel}
              onProcessingComplete={handleProcessingComplete}
            />
          </motion.div>
        )}

        {/* UJ v3.3: ya no hay paso 5 de vista previa — M14 encadena con M15 («Cae Confirmar y enviar»).
            La foto anonimizada y el conteo de zonas se verán en el detalle del reporte (M16, Bloque 3). */}

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
              reportCode={persistedReport?.reportCode || '#RP-2048'}
              category={selectedCategory}
              agencyName={determinedAgency}
              onViewReport={() => {
                clearEvidence();
                // REP-3789: "Ver el reporte" abre el detalle del reporte recien
                // creado, no el listado. Si por algun motivo no quedo el id
                // persistido, se cae al listado en vez de romper la navegacion.
                navigate(persistedReport?.id ? `/reportes/${persistedReport.id}` : '/reportes');
              }}
              onReturnToMap={() => {
                clearEvidence();
                navigate('/mapa');
              }}
              onViewTerms={() => setShowTermsModal(true)}
              consentVersion={consentRecord?.version}
              consentAcceptedAt={consentRecord?.acceptedAt}
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
            className="fixed inset-0 z-50 bg-rep-surface"
          >
            <AdjustLocationModal
              initialCoordinates={activeCoords}
              initialLocalityId={customLocation?.localityId}
              isGpsUnavailable={isGpsUnavailable}
              isGpsDenied={isGpsDenied}
              onRetryGps={refreshLocation}
              onClose={() => setShowAdjustLocationModal(false)}
              onConfirm={(adjustedData) => {
                // Una eleccion manual deja de ser una sugerencia automatica:
                // se limpia la marca para que no siga mostrandose el aviso y
                // se bloquea la preseleccion para que no la pise despues.
                hasManualLocationRef.current = true;
                setCustomLocation({ ...adjustedData, isAutoSuggested: false });
                setShowAdjustLocationModal(false);
                toast.success('Ubicación actualizada');
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
