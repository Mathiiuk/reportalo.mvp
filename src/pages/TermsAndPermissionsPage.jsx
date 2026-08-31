import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import {
  CURRENT_TERMS_VERSION,
  TERMS_EFFECTIVE_DATE,
  recordTermsAcceptance,
  recordTermsRejection,
  getTermsUpdateStatus,
  postponeTermsUpdate,
  getTermsRecord,
  formatAcceptedDate,
  FULL_TERMS_AND_CONDITIONS,
} from '../services/termsService';

export const TermsAndPermissionsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();

  // Modo consultivo: activado cuando la navegación proviene de /perfil
  // Permite leer los T&C sin presentar el flujo de aceptación obligatoria
  const modoConsulta = location.state?.consultaDesde === 'perfil';

  // Detección de versión desactualizada y aviso pendiente
  const updateStatus = getTermsUpdateStatus(user?.id);
  const isOutdatedUpdate = updateStatus.isOutdated;

  // Datos reales del consentimiento aceptado (para el modo consultivo)
  const termsRecord = getTermsRecord(user?.id);
  const acceptedVersionLabel = termsRecord?.terms_version || CURRENT_TERMS_VERSION;
  const acceptedDateLabel = formatAcceptedDate(termsRecord?.accepted_at);

  // Paso actual: 1 (Términos) o 2 (Permisos)
  const [currentStep, setCurrentStep] = useState(1);

  // Estado del checkbox de aceptación explícita
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Estado de error visual cuando se intenta continuar sin tildar
  const [showTermsError, setShowTermsError] = useState(false);

  // Estado de error de red / conexión
  const [networkError, setNetworkError] = useState(false);

  // Estados de switches de permisos
  const [cameraPermission, setCameraPermission] = useState(true);
  const [locationPermission, setLocationPermission] = useState(true);

  // Modal de lectura de términos completos
  const [showFullTermsModal, setShowFullTermsModal] = useState(false);

  // Modal de confirmación de rechazo
  const [showRejectModal, setShowRejectModal] = useState(false);

  // Avanzar del paso 1 (Términos) al paso 2 (Permisos)
  const handleAcceptTerms = () => {
    if (!acceptedTerms) {
      setShowTermsError(true);
      return;
    }
    setShowTermsError(false);
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setNetworkError(true);
      return;
    }
    setNetworkError(false);
    setCurrentStep(2);
  };

  // Postergación de aviso de nueva versión (Recordármelo más tarde)
  const handlePostpone = () => {
    postponeTermsUpdate(user?.id);
    toast.info('Te lo recordaremos en el próximo inicio.');
    navigate('/app');
  };

  // Reintentar registro ante error de red
  const handleRetryTerms = () => {
    if (!acceptedTerms) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setNetworkError(true);
      toast.error('Comprobá tu conexión a internet.');
      return;
    }
    setNetworkError(false);
    setCurrentStep(2);
  };

  // Abrir diálogo de confirmación de rechazo
  const handleRejectTerms = () => {
    setShowRejectModal(true);
  };

  // Confirmar rechazo, persistir y redirigir a login con aviso de rechazo
  const handleConfirmReject = async () => {
    setShowRejectModal(false);
    const rejectionRecord = recordTermsRejection(user?.id);
    toast.info('Rechazaste los términos. Podés volver y aceptar cuando quieras.');
    try {
      if (signOut) await signOut();
    } catch (e) {
      console.warn('Sign out error on reject:', e);
    }
    navigate('/login', { state: { rejected: true, rejectionRecord } });
  };

  // Cancelar rechazo y permanecer en la pantalla de términos
  const handleCancelReject = () => {
    setShowRejectModal(false);
  };

  // Guardar consentimiento y permisos completados
  const handleFinishPermissions = async () => {
    await recordTermsAcceptance(user?.id, {
      camera: cameraPermission,
      location: locationPermission,
    });
    toast.success('Términos y permisos configurados.');
    navigate('/mapa');
  };

  // Salir con "Ahora no"
  const handleSkipPermissions = async () => {
    await recordTermsAcceptance(user?.id, {
      camera: false,
      location: false,
    });
    toast.info('Podrás activar los permisos cuando vayas a reportar.');
    navigate('/mapa');
  };

  return (
    <div className="min-h-[100dvh] h-[100dvh] w-full font-manrope select-none flex flex-col bg-[#F4F7FB] overflow-hidden">
      
      {/* Barra superior institucional visible en todos los viewports */}
      <header className="w-full flex-shrink-0 bg-white border-b border-[#EEF1F5] px-4 sm:px-6 lg:px-7 py-3 sm:py-3.5 flex items-center gap-2.5 sm:gap-3 z-20">
        <Link to="/" className="flex items-center gap-2.5 text-inherit no-underline">
          <img
            src="/logo-icon.webp"
            alt="Reportalo"
            className="w-[20px] h-[26px] object-contain"
          />
          <span className="font-extrabold text-[15px] sm:text-[16px] text-[#243447]">
            Reportalo
          </span>
        </Link>

        {user?.email ? (
          <span className="ml-auto font-semibold text-[11.5px] sm:text-[12px] text-[#8593A2] truncate max-w-[200px] sm:max-w-none">
            {user.email}
          </span>
        ) : (
          <span className="ml-auto font-semibold text-[11.5px] sm:text-[12px] text-[#8593A2]">
            vecina@correo.com
          </span>
        )}
      </header>

      {/* Contenedor principal con scroll vertical detrás del pie fijo */}
      <div className="flex-1 flex flex-col overflow-y-auto overscroll-contain">
        <main className="flex-1 flex justify-center px-4 sm:px-6 lg:px-7 pt-6 sm:pt-8 lg:pt-9 pb-8 w-full">
          <div className="w-full max-w-[480px] md:max-w-[560px] lg:max-w-[680px]">
            <AnimatePresence mode="wait">
              
              {/* ========================================================================= */}
              {/* MODO CONSULTIVO: lectura informativa desde /perfil                        */}
              {/* No modifica ni resetea el estado de consentimiento (REP-3607)             */}
              {/* ========================================================================= */}
              {modoConsulta && (
                <motion.div
                  key="modo-consulta"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.28, ease: 'easeOut' }}
                  className="flex flex-col gap-4 sm:gap-4.5 lg:gap-5 w-full"
                >
                  {/* Encabezado consultivo */}
                  <div>
                    <h1 className="font-extrabold text-[22px] sm:text-[26px] lg:text-[30px] text-[#243447] tracking-[-0.6px] leading-tight m-0">
                      Términos y privacidad
                    </h1>
                    <div className="flex items-center gap-2 mt-2">
                      {isOutdatedUpdate ? (
                        <span className="font-bold text-[9px] sm:text-[10px] text-[#8A6A3E] bg-[#FFF2E0] rounded-[5px] sm:rounded-[6px] px-2 py-1 uppercase tracking-wider">
                          NUEVA VERSIÓN
                        </span>
                      ) : (
                        <span className="font-bold text-[9px] sm:text-[10px] text-[#2C7A55] bg-[#E3F5EC] rounded-[5px] sm:rounded-[6px] px-2 py-1 uppercase tracking-wider">
                          VIGENTE · ACEPTADA
                        </span>
                      )}
                      <span className="font-semibold text-[11px] sm:text-[12px] text-[#9AA7B5]">
                        Versión {CURRENT_TERMS_VERSION} · desde {TERMS_EFFECTIVE_DATE}
                      </span>
                    </div>
                    <p className="font-medium text-[12.5px] sm:text-[13px] lg:text-[13.5px] leading-[1.6] text-[#56657A] mt-3.5 mb-0">
                      Estás consultando los términos en modo lectura. No se realizará ningún cambio en tu consentimiento.
                    </p>
                  </div>

                  {/* Bloques informativos y banners */}
                  <div className="flex flex-col gap-2.5 sm:gap-3 lg:gap-3.5">

                    {/* Banner: ya aceptaste la versión vigente */}
                    {!isOutdatedUpdate && (
                      <div className="bg-[#E3F5EC] border border-[#D0EADB] rounded-[12px] p-[11px_12px] lg:p-[13px_15px] flex gap-[8px] lg:gap-[10px] items-start shadow-2xs">
                        <span className="material-symbols-rounded text-[16px] lg:text-[18px] text-[#2E9E6B] flex-shrink-0 mt-0.5">
                          verified
                        </span>
                        <div>
                          <div className="font-extrabold text-[10.5px] md:text-[11.5px] lg:text-[12px] text-[#2C7A55]">
                            Ya aceptaste la versión vigente
                          </div>
                          <div className="font-medium text-[10.5px] lg:text-[11.5px] leading-[1.45] text-[#2C7A55] mt-[3px]">
                            Versión {acceptedVersionLabel} — aceptada el {acceptedDateLabel}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Banner: nueva versión disponible (modo consultivo, sin acción obligatoria) */}
                    {isOutdatedUpdate && (
                      <div className="bg-[#E8F1FB] border border-[#D4E6F8] rounded-[12px] p-[11px_12px] lg:p-[13px_15px] flex gap-[8px] lg:gap-[10px] items-start shadow-2xs">
                        <span className="material-symbols-rounded text-[16px] lg:text-[18px] text-[#15539E] flex-shrink-0 mt-0.5">
                          info
                        </span>
                        <div>
                          <div className="font-extrabold text-[10.5px] md:text-[11.5px] lg:text-[12px] text-[#15539E]">
                            Hay una nueva versión disponible
                          </div>
                          <div className="font-medium text-[10.5px] lg:text-[11.5px] leading-[1.45] text-[#15539E] mt-[3px]">
                            Aceptaste la v{updateStatus.previousVersion || '1.2'} el {updateStatus.acceptedDate || acceptedDateLabel}. La nueva versión ({CURRENT_TERMS_VERSION}) se solicitará antes de publicar un reporte.
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Bloque 1: Tratamiento de imágenes */}
                    <div className="bg-white border border-[#E6ECF3] rounded-[14px] p-3.5 sm:p-4 lg:p-[16px_18px] flex gap-3 lg:gap-[13px] items-start shadow-xs">
                      <span className="material-symbols-rounded filled text-[20px] lg:text-[22px] text-[#1E6FCB] flex-shrink-0 mt-0.5">
                        photo_camera
                      </span>
                      <div className="flex-1">
                        <div className="font-bold text-[12.5px] sm:text-[13px] lg:text-[13.5px] text-[#263249]">
                          Tratamiento de imágenes
                        </div>
                        <div className="font-medium text-[11px] sm:text-[12px] lg:text-[12.5px] leading-[1.5] text-[#7A8696] mt-1">
                          Tus fotos se procesan en nuestros servidores y en los de un proveedor de análisis, con el único fin de difuminar rostros y patentes y clasificar el reporte.
                        </div>
                      </div>
                    </div>

                    {/* Bloque 2: Qué se guarda */}
                    <div className="bg-white border border-[#E6ECF3] rounded-[14px] p-3.5 sm:p-4 lg:p-[16px_18px] flex gap-3 lg:gap-[13px] items-start shadow-xs">
                      <span className="material-symbols-rounded filled text-[20px] lg:text-[22px] text-[#1E6FCB] flex-shrink-0 mt-0.5">
                        visibility_off
                      </span>
                      <div className="flex-1">
                        <div className="font-bold text-[12.5px] sm:text-[13px] lg:text-[13.5px] text-[#263249]">
                          Qué se guarda
                        </div>
                        <div className="font-medium text-[11px] sm:text-[12px] lg:text-[12.5px] leading-[1.5] text-[#7A8696] mt-1">
                          Solo la versión anonimizada. La imagen original se descarta al terminar el procesamiento.
                        </div>
                      </div>
                    </div>

                    {/* Bloque 3: Tus derechos */}
                    <div className="bg-white border border-[#E6ECF3] rounded-[14px] p-3.5 sm:p-4 lg:p-[16px_18px] flex gap-3 lg:gap-[13px] items-start shadow-xs">
                      <span className="material-symbols-rounded filled text-[20px] lg:text-[22px] text-[#1E6FCB] flex-shrink-0 mt-0.5">
                        gavel
                      </span>
                      <div className="flex-1">
                        <div className="font-bold text-[12.5px] sm:text-[13px] lg:text-[13.5px] text-[#263249]">
                          Tus derechos
                        </div>
                        <div className="font-medium text-[11px] sm:text-[12px] lg:text-[12.5px] leading-[1.5] text-[#7A8696] mt-1">
                          Podés acceder, rectificar y suprimir tus datos (Ley 25.326). Tu identidad no se comparte con el organismo receptor.
                        </div>
                      </div>
                    </div>

                    {/* Enlace al articulado legal completo (igual al flujo normal) */}
                    <button
                      onClick={() => setShowFullTermsModal(true)}
                      type="button"
                      className="flex items-center justify-center gap-1.5 font-bold text-[11px] sm:text-[11.5px] text-[#1E6FCB] hover:text-[#15539E] cursor-pointer bg-transparent border-0 py-1.5 transition-colors mx-auto"
                    >
                      <span>Leer el texto completo</span>
                      <span className="material-symbols-rounded text-[15px]">
                        open_in_new
                      </span>
                    </button>

                  </div>
                </motion.div>
              )}

              {/* ========================================================================= */}
              {/* PASO 1: Términos y Privacidad (flujo de aceptación obligatoria)           */}
              {/* ========================================================================= */}
              {!modoConsulta && currentStep === 1 && (
                <motion.div
                  key="step-terms"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.28, ease: 'easeOut' }}
                  className="flex flex-col gap-4 sm:gap-4.5 lg:gap-5 w-full"
                >
                  {/* Encabezado */}
                  <div>
                    <h1 className="font-extrabold text-[22px] sm:text-[26px] lg:text-[30px] text-[#243447] tracking-[-0.6px] leading-tight m-0">
                      {isOutdatedUpdate ? 'Actualizamos los términos' : 'Términos y privacidad'}
                    </h1>
                    <div className="flex items-center gap-2 mt-2">
                      {updateStatus.isBlocked ? (
                        <span className="font-bold text-[9px] sm:text-[10px] text-[#8A3B30] bg-[#FDECEA] rounded-[5px] sm:rounded-[6px] px-2 py-1 uppercase tracking-wider">
                          ACEPTACIÓN REQUERIDA
                        </span>
                      ) : isOutdatedUpdate ? (
                        <span className="font-bold text-[9px] sm:text-[10px] text-[#8A6A3E] bg-[#FFF2E0] rounded-[5px] sm:rounded-[6px] px-2 py-1 uppercase tracking-wider">
                          NUEVA VERSIÓN
                        </span>
                      ) : (
                        <span className="font-bold text-[9px] sm:text-[10px] text-[#2C7A55] bg-[#E3F5EC] rounded-[5px] sm:rounded-[6px] px-2 py-1 uppercase tracking-wider">
                          VIGENTE
                        </span>
                      )}
                      <span className="font-semibold text-[11px] sm:text-[12px] text-[#9AA7B5]">
                        {isOutdatedUpdate
                          ? `${CURRENT_TERMS_VERSION} · desde ${TERMS_EFFECTIVE_DATE}`
                          : `Versión ${CURRENT_TERMS_VERSION} · desde ${TERMS_EFFECTIVE_DATE}`}
                      </span>
                    </div>

                    {/* Subtítulo institucional (destacado en escritorio) */}
                    <p className="font-medium text-[12.5px] sm:text-[13px] lg:text-[13.5px] leading-[1.6] text-[#56657A] mt-3.5 mb-0">
                      Para enviar reportes necesitamos tu consentimiento para procesar las fotos que subís.
                    </p>
                  </div>

                  {/* Lista de bloques informativos (una sola columna en todos los viewports) */}
                  <div className="flex flex-col gap-2.5 sm:gap-3 lg:gap-3.5">
                    
                    {/* Banner de Historial, Último Aviso o Bloqueo */}
                    {isOutdatedUpdate && (
                      updateStatus.isBlocked ? (
                        <div className="bg-[#FDECEA] border border-[#F7D2CC] rounded-[12px] p-[11px_12px] lg:p-[13px_15px] flex gap-[8px] lg:gap-[10px] items-start shadow-2xs">
                          <span className="material-symbols-rounded text-[16px] lg:text-[18px] text-[#C0392B] flex-shrink-0 mt-0.5">
                            lock
                          </span>
                          <div>
                            <div className="font-extrabold text-[10.5px] md:text-[11.5px] lg:text-[12px] text-[#8A3B30]">
                              Ya postergaste tres veces
                            </div>
                            <div className="font-medium text-[10.5px] lg:text-[11.5px] leading-[1.45] text-[#8A3B30] mt-[3px]">
                              Para seguir usando Reportalo tenés que aceptar la versión {CURRENT_TERMS_VERSION}.
                            </div>
                          </div>
                        </div>
                      ) : updateStatus.isLastNotice ? (
                        <div className="bg-[#FFF2E0] border border-[#F7E2C8] rounded-[12px] p-[11px_12px] lg:p-[13px_15px] flex gap-[8px] lg:gap-[10px] items-start shadow-2xs">
                          <span className="material-symbols-rounded text-[16px] lg:text-[18px] text-[#E07C1A] flex-shrink-0 mt-0.5">
                            notification_important
                          </span>
                          <div>
                            <div className="font-extrabold text-[10.5px] md:text-[11.5px] lg:text-[12px] text-[#8A6A3E]">
                              Último aviso
                            </div>
                            <div className="font-medium text-[10.5px] lg:text-[11.5px] leading-[1.45] text-[#8A6A3E] mt-[3px]">
                              La próxima vez que abras la app vas a tener que aceptar para seguir usándola.
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-[#E8F1FB] border border-[#D4E6F8] rounded-[12px] p-[11px_12px] lg:p-[13px_15px] flex gap-[8px] lg:gap-[10px] items-start shadow-2xs">
                          <span className="material-symbols-rounded text-[16px] lg:text-[18px] text-[#15539E] flex-shrink-0 mt-0.5">
                            history
                          </span>
                          <div className="font-semibold text-[10.5px] lg:text-[11.5px] leading-[1.45] text-[#15539E]">
                            Aceptaste la versión {updateStatus.previousVersion || '1.2'} el {updateStatus.acceptedDate || '14/08/2026'}. Seguís pudiendo usar la app mientras revisás la nueva.
                          </div>
                        </div>
                      )
                    )}

                    {/* Alerta de error de red / conectividad (cloud_off) */}
                    {networkError && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-[#FDECEA] border border-[#F7D2CC] rounded-[12px] p-[11px_12px] lg:p-[13px_15px] flex items-start gap-2 lg:gap-2.5 shadow-2xs"
                      >
                        <span className="material-symbols-rounded text-[16px] lg:text-[18px] text-[#C0392B] flex-shrink-0 mt-0.5">
                          cloud_off
                        </span>
                        <div>
                          <div className="font-extrabold text-[10.5px] md:text-[11.5px] lg:text-[12px] text-[#8A3B30]">
                            No pudimos registrar tu aceptación
                          </div>
                          <div className="font-medium text-[10.5px] lg:text-[11.5px] leading-[1.45] text-[#8A3B30] mt-[3px]">
                            Revisá tu conexión y probá de nuevo. Tu casilla queda marcada.
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Bloque 1: Tratamiento de imágenes */}
                    <div className="bg-white border border-[#E6ECF3] rounded-[14px] p-3.5 sm:p-4 lg:p-[16px_18px] flex gap-3 lg:gap-[13px] items-start shadow-xs">
                      <span className="material-symbols-rounded filled text-[20px] lg:text-[22px] text-[#1E6FCB] flex-shrink-0 mt-0.5">
                        photo_camera
                      </span>
                      <div className="flex-1">
                        <div className="font-bold text-[12.5px] sm:text-[13px] lg:text-[13.5px] text-[#263249]">
                          Tratamiento de imágenes
                        </div>
                        <div className="font-medium text-[11px] sm:text-[12px] lg:text-[12.5px] leading-[1.5] text-[#7A8696] mt-1">
                          Tus fotos se procesan en nuestros servidores y en los de un proveedor de análisis, con el único fin de difuminar rostros y patentes y clasificar el reporte.
                        </div>
                      </div>
                    </div>

                    {/* Bloque 2: Qué se guarda */}
                    <div className="bg-white border border-[#E6ECF3] rounded-[14px] p-3.5 sm:p-4 lg:p-[16px_18px] flex gap-3 lg:gap-[13px] items-start shadow-xs">
                      <span className="material-symbols-rounded filled text-[20px] lg:text-[22px] text-[#1E6FCB] flex-shrink-0 mt-0.5">
                        visibility_off
                      </span>
                      <div className="flex-1">
                        <div className="font-bold text-[12.5px] sm:text-[13px] lg:text-[13.5px] text-[#263249]">
                          Qué se guarda
                        </div>
                        <div className="font-medium text-[11px] sm:text-[12px] lg:text-[12.5px] leading-[1.5] text-[#7A8696] mt-1">
                          Solo la versión anonimizada. La imagen original se descarta al terminar el procesamiento.
                        </div>
                      </div>
                    </div>

                    {/* Bloque 3: Tus derechos */}
                    <div className="bg-white border border-[#E6ECF3] rounded-[14px] p-3.5 sm:p-4 lg:p-[16px_18px] flex gap-3 lg:gap-[13px] items-start shadow-xs">
                      <span className="material-symbols-rounded filled text-[20px] lg:text-[22px] text-[#1E6FCB] flex-shrink-0 mt-0.5">
                        gavel
                      </span>
                      <div className="flex-1">
                        <div className="font-bold text-[12.5px] sm:text-[13px] lg:text-[13.5px] text-[#263249]">
                          Tus derechos
                        </div>
                        <div className="font-medium text-[11px] sm:text-[12px] lg:text-[12.5px] leading-[1.5] text-[#7A8696] mt-1">
                          Podés acceder, rectificar y suprimir tus datos (Ley 25.326). Tu identidad no se comparte con el organismo receptor.
                        </div>
                      </div>
                    </div>

                    {/* Enlace al articulado legal completo */}
                    <button
                      onClick={() => setShowFullTermsModal(true)}
                      type="button"
                      className="flex items-center justify-center gap-1.5 font-bold text-[11px] sm:text-[11.5px] text-[#1E6FCB] hover:text-[#15539E] cursor-pointer bg-transparent border-0 py-1.5 transition-colors mx-auto"
                    >
                      <span>Leer el texto completo</span>
                      <span className="material-symbols-rounded text-[15px]">
                        open_in_new
                      </span>
                    </button>

                    {/* Alerta visual si se intentó continuar sin marcar el checkbox */}
                    {showTermsError && !acceptedTerms && (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-[#FFF2E0] border border-[#F7E2C8] rounded-[12px] p-[11px_12px] flex items-center gap-2 mt-1 shadow-2xs"
                      >
                        <span className="material-symbols-rounded text-[16px] text-[#8A6A3E] flex-shrink-0">
                          error
                        </span>
                        <div className="font-semibold text-[10.5px] md:text-[11.5px] leading-[1.45] text-[#8A6A3E]">
                          La casilla es obligatoria. Marcala para poder continuar.
                        </div>
                      </motion.div>
                    )}

                  </div>
                </motion.div>
              )}

              {/* ========================================================================= */}
              {/* PASO 2: Activá los Permisos                                               */}
              {/* ========================================================================= */}
              {!modoConsulta && currentStep === 2 && (
                <motion.div
                  key="step-permissions"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.28, ease: 'easeOut' }}
                  className="flex flex-col gap-4 sm:gap-4.5 lg:gap-5 w-full"
                >
                  {/* Zona superior: Icono, Título y Switches de permisos */}
                  <div>
                    <div className="w-[48px] h-[48px] sm:w-[54px] sm:h-[54px] rounded-[16px] bg-[#E8F1FB] flex items-center justify-center mb-3.5 shadow-xs">
                      <span className="material-symbols-rounded filled text-[26px] sm:text-[30px] text-[#1E6FCB]">
                        verified_user
                      </span>
                    </div>

                    <h1 className="font-extrabold text-[22px] sm:text-[26px] lg:text-[30px] text-[#243447] tracking-[-0.6px] leading-tight m-0">
                      Activá los permisos
                    </h1>
                    <p className="font-medium text-[12.5px] sm:text-[13px] lg:text-[13.5px] leading-[1.5] text-[#8593A2] mt-1.5 mb-4 max-w-[460px]">
                      Reportalo solo los usa al momento de reportar. Podés cambiarlos cuando quieras.
                    </p>

                    {/* Permiso 1: Cámara */}
                    <div className="bg-white border border-[#E6ECF3] rounded-[14px] p-3.5 sm:p-4 flex gap-3.5 items-start mb-3 shadow-xs">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 rounded-[10px] sm:rounded-[12px] bg-[#E8F1FB] flex items-center justify-center">
                        <span className="material-symbols-rounded filled text-[20px] sm:text-[22px] text-[#1E6FCB]">
                          photo_camera
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-[13px] sm:text-[13.5px] text-[#263249]">
                          Cámara
                        </div>
                        <div className="font-medium text-[11.5px] sm:text-[12px] leading-[1.4] text-[#8593A2] mt-0.5">
                          Para capturar la foto que sirve de evidencia.
                        </div>
                      </div>
                      
                      <button
                        onClick={() => setCameraPermission((prev) => !prev)}
                        type="button"
                        aria-label="Alternar permiso de cámara"
                        className={`w-[44px] h-[26px] rounded-[13px] transition-colors relative flex-shrink-0 cursor-pointer border-0 p-0 ${
                          cameraPermission ? 'bg-[#1E6FCB]' : 'bg-[#CFD8E2]'
                        }`}
                      >
                        <span
                          className={`absolute top-[3px] w-[20px] h-[20px] rounded-full bg-white transition-all shadow-xs ${
                            cameraPermission ? 'right-[3px]' : 'left-[3px]'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Permiso 2: Ubicación */}
                    <div className="bg-white border border-[#E6ECF3] rounded-[14px] p-3.5 sm:p-4 flex gap-3.5 items-start mb-3.5 shadow-xs">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 rounded-[10px] sm:rounded-[12px] bg-[#E8F1FB] flex items-center justify-center">
                        <span className="material-symbols-rounded filled text-[20px] sm:text-[22px] text-[#1E6FCB]">
                          location_on
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-[13px] sm:text-[13.5px] text-[#263249]">
                          Ubicación
                        </div>
                        <div className="font-medium text-[11.5px] sm:text-[12px] leading-[1.4] text-[#8593A2] mt-0.5">
                          Para georreferenciar el reporte en el mapa.
                        </div>
                      </div>

                      <button
                        onClick={() => setLocationPermission((prev) => !prev)}
                        type="button"
                        aria-label="Alternar permiso de ubicación"
                        className={`w-[44px] h-[26px] rounded-[13px] transition-colors relative flex-shrink-0 cursor-pointer border-0 p-0 ${
                          locationPermission ? 'bg-[#1E6FCB]' : 'bg-[#CFD8E2]'
                        }`}
                      >
                        <span
                          className={`absolute top-[3px] w-[20px] h-[20px] rounded-full bg-white transition-all shadow-xs ${
                            locationPermission ? 'right-[3px]' : 'left-[3px]'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Card verde informativa de protección */}
                    <div className="flex items-start gap-2.5 bg-[#E3F5EC] border border-[#D0EADB] rounded-[14px] p-3.5 mb-2 text-left shadow-2xs">
                      <span className="material-symbols-rounded filled text-[18px] text-[#2E9E6B] flex-shrink-0 mt-0.5">
                        shield
                      </span>
                      <span className="font-semibold text-[11px] sm:text-[12px] leading-[1.5] text-[#2C7A55]">
                        Tu foto se procesa de forma segura: los rostros y patentes se difuminan automáticamente antes de guardarse. La imagen original nunca se almacena.
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Pie Fijo Siempre Visible (Acciones fijas sin scrollear) */}
      <footer className="flex-shrink-0 bg-white border-t border-[#EEF1F5] px-4 sm:px-6 lg:px-7 py-3 sm:py-3.5 lg:py-4 flex justify-center z-20 shadow-[0_-4px_16px_rgba(0,0,0,0.03)]">
        <div className="w-full max-w-[480px] md:max-w-[560px] lg:max-w-[680px]">
          
          {/* ========================================================================= */}
          {/* PIE MODO CONSULTIVO                                                     */}
          {/* ========================================================================= */}
          {modoConsulta && (
            <div className="flex justify-end">
              {/* Botón de regreso sin modificar ningún estado de consentimiento */}
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate(-1)}
                type="button"
                className="rounded-[12px] py-[13px] px-[26px] font-extrabold text-[13.5px] text-white bg-[#1E6FCB] shadow-[0px_8px_18px_rgba(30,111,203,0.3)] hover:bg-[#15539E] border-0 transition-all cursor-pointer flex items-center justify-center gap-2 min-h-[44px]"
              >
                <span className="material-symbols-rounded text-[17px] text-white">
                  arrow_back
                </span>
                <span>Volver a mi perfil</span>
              </motion.button>
            </div>
          )}

          {/* ========================================================================= */}
          {/* PIE PASO 1 (Términos)                                                     */}
          {/* ========================================================================= */}
          {!modoConsulta && currentStep === 1 && (
            <div>
              {/* Layout Desktop (>= 1024px): Fila horizontal (Casilla a la izquierda, botones a la derecha) */}
              <div className="hidden lg:flex lg:items-center lg:justify-between lg:gap-5">
                {/* Izquierda: Checkbox */}
                <label
                  htmlFor="terms-checkbox-desktop"
                  className="flex gap-2.5 items-start cursor-pointer select-none flex-1 min-w-0"
                >
                  <input
                    id="terms-checkbox-desktop"
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => {
                      const val = e.target.checked;
                      setAcceptedTerms(val);
                      if (val) setShowTermsError(false);
                    }}
                    className="sr-only"
                  />
                  <div
                    className={`w-[22px] h-[22px] rounded-[6px] flex items-center justify-center flex-shrink-0 transition-all ${
                      acceptedTerms
                        ? 'bg-[#1E6FCB] text-white shadow-xs'
                        : showTermsError
                        ? 'border-2 border-[#E07C1A] bg-white'
                        : 'border-2 border-[#CFD8E2] bg-white'
                    }`}
                  >
                    {acceptedTerms && (
                      <span className="material-symbols-rounded text-[16px] font-bold">
                        check
                      </span>
                    )}
                  </div>
                  <span className="font-semibold text-[12.5px] leading-[1.45] text-[#46566B]">
                    {isOutdatedUpdate
                      ? `Acepto la versión ${CURRENT_TERMS_VERSION} de los términos y el tratamiento de mis imágenes.`
                      : 'Acepto los términos y el tratamiento de mis imágenes descripto arriba.'}
                  </span>
                </label>

                {/* Derecha: Botones de acción */}
                <div className="flex items-center gap-3.5 flex-shrink-0">
                  {/* Botón Rechazar / Postergación */}
                  {updateStatus.isBlocked ? (
                    <button
                      onClick={handleConfirmReject}
                      type="button"
                      className="min-h-[44px] px-2 font-bold text-[13px] text-[#8593A2] hover:text-[#243447] cursor-pointer bg-transparent border-0 transition-colors"
                    >
                      Rechazar y cerrar sesión
                    </button>
                  ) : isOutdatedUpdate ? (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handlePostpone}
                        type="button"
                        className="min-h-[44px] font-bold text-[11.5px] text-[#1E6FCB] hover:text-[#15539E] cursor-pointer bg-transparent border-0 p-0 transition-colors"
                      >
                        Recordármelo más tarde
                      </button>
                      {updateStatus.isLastNotice ? (
                        <span className="font-bold text-[10px] text-[#C0392B]">
                          último aviso
                        </span>
                      ) : (
                        <span className="font-semibold text-[10px] text-[#9AA7B5]">
                          {updateStatus.noticesLeftText || 'quedan 2 avisos'}
                        </span>
                      )}
                      <button
                        onClick={handleRejectTerms}
                        type="button"
                        className="min-h-[44px] px-2 font-bold text-[13px] text-[#8593A2] hover:text-[#243447] cursor-pointer bg-transparent border-0 transition-colors"
                      >
                        Rechazar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleRejectTerms}
                      type="button"
                      className="min-h-[44px] px-3 font-bold text-[13px] text-[#8593A2] hover:text-[#243447] cursor-pointer bg-transparent border-0 transition-colors"
                    >
                      Rechazar
                    </button>
                  )}

                  {/* Botón Principal (Aceptar / Reintentar) */}
                  {networkError ? (
                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleRetryTerms}
                      type="button"
                      className="rounded-[12px] py-[13px] px-[26px] font-extrabold text-[13.5px] text-white bg-[#1E6FCB] shadow-[0px_8px_18px_rgba(30,111,203,0.3)] hover:bg-[#15539E] border-0 transition-all cursor-pointer flex items-center justify-center gap-2 min-h-[44px]"
                    >
                      <span className="material-symbols-rounded text-[17px] text-white">
                        refresh
                      </span>
                      <span>Reintentar</span>
                    </motion.button>
                  ) : (
                    <motion.button
                      whileHover={acceptedTerms ? { scale: 1.01 } : {}}
                      whileTap={acceptedTerms ? { scale: 0.98 } : {}}
                      onClick={handleAcceptTerms}
                      type="button"
                      className={`rounded-[12px] py-[13px] px-[26px] font-extrabold text-[13.5px] border-0 transition-all cursor-pointer min-h-[44px] ${
                        acceptedTerms
                          ? 'bg-[#1E6FCB] text-white shadow-[0px_8px_18px_rgba(30,111,203,0.3)] hover:bg-[#15539E]'
                          : 'bg-[#DDE6EF] text-[#9AA7B5] hover:bg-[#D5DFEA]'
                      }`}
                    >
                      Aceptar y continuar
                    </motion.button>
                  )}
                </div>
              </div>

              {/* Layout Móvil y Tablet (< 1024px): Apilado */}
              <div className="lg:hidden">
                {/* Checkbox */}
                <label
                  htmlFor="terms-checkbox-mobile"
                  className="flex gap-2.5 items-start mb-2.5 cursor-pointer select-none bg-white p-2.5 sm:p-3 rounded-[12px] border border-[#E6ECF3]"
                >
                  <input
                    id="terms-checkbox-mobile"
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => {
                      const val = e.target.checked;
                      setAcceptedTerms(val);
                      if (val) setShowTermsError(false);
                    }}
                    className="sr-only"
                  />
                  <div
                    className={`w-[22px] h-[22px] rounded-[6px] flex items-center justify-center flex-shrink-0 transition-all ${
                      acceptedTerms
                        ? 'bg-[#1E6FCB] text-white shadow-xs'
                        : showTermsError
                        ? 'border-2 border-[#E07C1A] bg-white'
                        : 'border-2 border-[#CFD8E2] bg-white'
                    }`}
                  >
                    {acceptedTerms && (
                      <span className="material-symbols-rounded text-[16px] font-bold">
                        check
                      </span>
                    )}
                  </div>
                  <span className="font-semibold text-[11px] sm:text-[12px] leading-[1.45] text-[#46566B]">
                    {isOutdatedUpdate
                      ? `Acepto la versión ${CURRENT_TERMS_VERSION} de los términos y el tratamiento de mis imágenes.`
                      : 'Acepto los términos y el tratamiento de mis imágenes descripto arriba.'}
                  </span>
                </label>

                {/* Botón Principal (Aceptar / Reintentar) */}
                {networkError ? (
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleRetryTerms}
                    type="button"
                    className="w-full rounded-[13px] py-[14px] px-6 text-center font-extrabold text-[14px] md:text-[15px] text-white bg-[#1E6FCB] shadow-[0px_8px_18px_rgba(30,111,203,0.3)] hover:bg-[#15539E] border-0 transition-all cursor-pointer flex items-center justify-center gap-2 min-h-[44px]"
                  >
                    <span className="material-symbols-rounded text-[17px] text-white">
                      refresh
                    </span>
                    <span>Reintentar</span>
                  </motion.button>
                ) : (
                  <motion.button
                    whileHover={acceptedTerms ? { scale: 1.01 } : {}}
                    whileTap={acceptedTerms ? { scale: 0.98 } : {}}
                    onClick={handleAcceptTerms}
                    type="button"
                    className={`w-full rounded-[13px] py-[14px] px-6 text-center font-extrabold text-[14px] md:text-[15px] border-0 transition-all cursor-pointer min-h-[44px] ${
                      acceptedTerms
                        ? 'bg-[#1E6FCB] text-white shadow-[0px_8px_18px_rgba(30,111,203,0.3)] hover:bg-[#15539E]'
                        : 'bg-[#DDE6EF] text-[#9AA7B5] hover:bg-[#D5DFEA]'
                    }`}
                  >
                    Aceptar y continuar
                  </motion.button>
                )}

                {/* Fila de postergación o rechazo */}
                {updateStatus.isBlocked ? (
                  <div className="text-center pt-2 pb-0.5">
                    <button
                      onClick={handleConfirmReject}
                      type="button"
                      className="min-h-[44px] font-bold text-[11.5px] text-[#8593A2] hover:text-[#243447] cursor-pointer bg-transparent border-0 transition-colors"
                    >
                      Rechazar y cerrar sesión
                    </button>
                  </div>
                ) : isOutdatedUpdate ? (
                  <>
                    <div className="flex items-center justify-between pt-[10px] px-1 pb-1">
                      <button
                        onClick={handlePostpone}
                        type="button"
                        className="min-h-[44px] font-bold text-[11.5px] text-[#1E6FCB] hover:text-[#15539E] cursor-pointer bg-transparent border-0 p-0 transition-colors"
                      >
                        Recordármelo más tarde
                      </button>
                      {updateStatus.isLastNotice ? (
                        <span className="font-bold text-[10px] text-[#C0392B]">
                          último aviso
                        </span>
                      ) : (
                        <span className="font-semibold text-[10px] text-[#9AA7B5]">
                          {updateStatus.noticesLeftText || 'quedan 2 avisos'}
                        </span>
                      )}
                    </div>
                    <div className="text-center">
                      <button
                        onClick={handleRejectTerms}
                        type="button"
                        className="min-h-[44px] font-bold text-[11px] text-[#8593A2] hover:text-[#243447] cursor-pointer bg-transparent border-0 transition-colors"
                      >
                        Rechazar
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-center pt-2 pb-0.5">
                    <button
                      onClick={handleRejectTerms}
                      type="button"
                      className="min-h-[44px] font-bold text-[11.5px] md:text-[12px] text-[#8593A2] hover:text-[#243447] cursor-pointer bg-transparent border-0 transition-colors"
                    >
                      Rechazar
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* PIE PASO 2 (Permisos)                                                     */}
          {/* ========================================================================= */}
          {!modoConsulta && currentStep === 2 && (
            <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 sm:gap-4">
              <button
                onClick={handleSkipPermissions}
                type="button"
                className="w-full sm:w-auto text-center font-bold text-[13px] text-[#8593A2] hover:text-[#243447] cursor-pointer bg-transparent border-0 transition-colors min-h-[44px] px-3"
              >
                Ahora no
              </button>
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleFinishPermissions}
                type="button"
                className="w-full sm:w-auto bg-[#1E6FCB] text-white rounded-[12px] py-[13px] px-[28px] text-center font-extrabold text-[14px] shadow-[0px_8px_18px_rgba(30,111,203,0.3)] hover:bg-[#15539E] cursor-pointer border-0 transition-colors min-h-[44px]"
              >
                Continuar
              </motion.button>
            </div>
          )}

        </div>
      </footer>

      {/* ========================================================================= */}
      {/* MODAL: Términos y Condiciones Completos                                    */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {showFullTermsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#182230]/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-white rounded-[20px] w-full max-w-[560px] max-h-[85vh] flex flex-col shadow-2xl overflow-hidden border border-[#E6ECF3]"
            >
              <div className="p-4 sm:p-5 border-b border-[#EEF1F5] flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-[16px] text-[#243447] m-0">
                    Términos y Condiciones
                  </h3>
                  <p className="font-semibold text-[11px] text-[#8593A2] m-0 mt-0.5">
                    Versión {CURRENT_TERMS_VERSION} · Vigencia desde {TERMS_EFFECTIVE_DATE}
                  </p>
                </div>
                <button
                  onClick={() => setShowFullTermsModal(false)}
                  className="w-8 h-8 rounded-full bg-[#F4F7FB] flex items-center justify-center text-[#56657A] hover:bg-[#E6ECF3] cursor-pointer border-0"
                >
                  <span className="material-symbols-rounded text-[18px]">close</span>
                </button>
              </div>

              <div className="p-4 sm:p-5 overflow-y-auto flex-1 text-[#46566B] font-medium text-[12px] leading-[1.6] space-y-3">
                <p>
                  Bienvenido a <strong>Reportalo</strong>. Al acceder o utilizar nuestra plataforma de reportes ciudadanos, aceptas cumplir los presentes Términos y Condiciones.
                </p>
                <div>
                  <h4 className="font-bold text-[13px] text-[#243447] mb-1">
                    1. Consentimiento de Tratamiento de Imágenes
                  </h4>
                  <p>
                    Las imágenes subidas por el usuario son procesadas exclusivamente para fines de difuminación automática de datos identificables (rostros y patentes vehiculares) y clasificación tipológica del incidente urbano.
                  </p>
                </div>
                <div>
                  <h4 className="font-bold text-[13px] text-[#243447] mb-1">
                    2. Protección de Datos Personales (Ley 25.326)
                  </h4>
                  <p>
                    El titular de los datos personales tiene la facultad de ejercer el derecho de acceso a los mismos en forma gratuita en intervalos no inferiores a seis meses. Asimismo, podrá solicitar en cualquier momento la rectificación, actualización o supresión de sus datos.
                  </p>
                </div>
                <div>
                  <h4 className="font-bold text-[13px] text-[#243447] mb-1">
                    3. Retención y Anonimización
                  </h4>
                  <p>
                    La fotografía original sin anonimizar se descarta inmediatamente tras completarse el proceso de difuminación. Únicamente se conserva la versión resultante anonimizada vinculada al reporte.
                  </p>
                </div>
              </div>

              <div className="p-4 border-t border-[#EEF1F5] flex justify-end">
                <button
                  onClick={() => setShowFullTermsModal(false)}
                  className="bg-[#1E6FCB] text-white font-extrabold text-[13px] py-2.5 px-5 rounded-[10px] hover:bg-[#15539E] cursor-pointer border-0"
                >
                  Entendido
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL: Confirmación de Rechazo                                             */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {showRejectModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-[#182230]/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="bg-white rounded-[20px] w-full max-w-[420px] p-5 sm:p-6 shadow-2xl border border-[#F7D2CC] flex flex-col"
            >
              <div className="w-10 h-10 rounded-[12px] bg-[#FDECEA] flex items-center justify-center text-[#C0392B] mb-3">
                <span className="material-symbols-rounded text-[22px]">block</span>
              </div>
              <h3 className="font-extrabold text-[16px] sm:text-[17px] text-[#243447] tracking-[-0.2px] m-0">
                ¿Rechazar los términos?
              </h3>
              <p className="font-medium text-[11.5px] sm:text-[12px] leading-[1.55] text-[#56657A] mt-2 mb-5">
                Sin tu consentimiento no vas a poder enviar reportes. Vas a poder explorar la app pero con funciones limitadas.
              </p>
              
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleConfirmReject}
                  type="button"
                  className="w-full rounded-[12px] py-3 text-center font-extrabold text-[13.5px] text-white bg-[#C0392B] hover:bg-[#A93226] border-0 cursor-pointer transition-colors shadow-xs"
                >
                  Rechazar y salir
                </button>
                <button
                  onClick={handleCancelReject}
                  type="button"
                  className="w-full rounded-[12px] py-2.5 text-center font-bold text-[13px] text-[#56657A] hover:bg-[#F4F7FB] border-0 cursor-pointer transition-colors"
                >
                  Volver a los términos
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
