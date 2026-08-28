import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import {
  CURRENT_TERMS_VERSION,
  TERMS_EFFECTIVE_DATE,
  recordTermsAcceptance,
  FULL_TERMS_AND_CONDITIONS,
} from '../services/termsService';

export const TermsAndPermissionsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Paso actual: 1 (Términos) o 2 (Permisos)
  const [currentStep, setCurrentStep] = useState(1);

  // Estado del checkbox de aceptación explícita
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Estado de error visual cuando se intenta continuar sin tildar
  const [showTermsError, setShowTermsError] = useState(false);

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
    setCurrentStep(2);
  };

  // Abrir diálogo de confirmación de rechazo
  const handleRejectTerms = () => {
    setShowRejectModal(true);
  };

  // Confirmar rechazo y continuar a la app en modo exploración
  const handleConfirmReject = () => {
    setShowRejectModal(false);
    toast.info('Podés explorar la aplicación. Para reportar incidentes deberás aceptar los términos.');
    navigate('/app');
  };

  // Cancelar rechazo y permanecer en la pantalla de términos
  const handleCancelReject = () => {
    setShowRejectModal(false);
  };

  // Guardar consentimiento y permisos completados
  const handleFinishPermissions = () => {
    recordTermsAcceptance(user?.id, {
      camera: cameraPermission,
      location: locationPermission,
    });
    toast.success('Términos y permisos configurados.');
    navigate('/app');
  };

  // Salir con "Ahora no"
  const handleSkipPermissions = () => {
    recordTermsAcceptance(user?.id, {
      camera: false,
      location: false,
    });
    toast.info('Podrás activar los permisos cuando vayas a reportar.');
    navigate('/app');
  };

  return (
    <div className="min-h-[100dvh] w-full font-manrope select-none flex flex-col bg-[#F4F7FB] md:bg-white">
      
      {/* Navbar visible únicamente en desktop (>= md) */}
      <header className="hidden md:flex flex-shrink-0 border-b border-[#EEF1F5] px-8 lg:px-12 py-4 items-center gap-6 bg-white">
        <Link to="/" className="flex items-center gap-2.5 text-inherit no-underline">
          <img
            src="/logo-icon.webp"
            alt="Reportalo"
            className="w-[20px] h-[26px] object-contain"
          />
          <span className="font-extrabold text-[19px] text-[#263249] tracking-[-0.4px]">
            Reportalo
          </span>
          <span className="font-bold text-[9px] text-[#1E6FCB] bg-[#EEF5FC] px-2 py-1 rounded-[7px] ml-1 uppercase">
            CIUDADANOS
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-4">
          <Link
            to="/app"
            className="font-bold text-[13px] text-[#5B6A7A] hover:text-[#1E6FCB] px-3 py-2 no-underline transition-colors"
          >
            Volver a la aplicación
          </Link>
        </div>
      </header>

      {/* Contenedor principal responsive */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-[100dvh] md:min-h-0">
        
        {/* Columna Principal:
            - En móvil (< md): full-bleed, fondo #F4F7FB, padding natural de pantalla móvil.
            - En desktop (>= md): fondo blanco, ancho proporcionado (max-w-[540px]), alineado y consistente con el Home. */}
        <main className="flex-1 flex flex-col justify-between px-5 sm:px-8 md:px-12 lg:px-16 pt-[max(env(safe-area-inset-top),16px)] md:pt-10 pb-[max(env(safe-area-inset-bottom),20px)] md:pb-10 max-w-[580px] w-full mx-auto md:mx-0">
          
          <AnimatePresence mode="wait">
            
            {/* ========================================================================= */}
            {/* PASO 1: Términos y Privacidad                                             */}
            {/* ========================================================================= */}
            {currentStep === 1 && (
              <motion.div
                key="step-terms"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
                className="flex-1 flex flex-col justify-between w-full"
              >
                {/* Zona superior: Encabezado y 3 Bloques clave */}
                <div>
                  
                  {/* Encabezado */}
                  <div className="mb-4 md:mb-6">
                    <h1 className="font-extrabold text-[22px] sm:text-[24px] md:text-[28px] text-[#243447] tracking-[-0.5px] leading-tight m-0">
                      Términos y privacidad
                    </h1>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="font-bold text-[9px] text-[#2C7A55] bg-[#E3F5EC] rounded-[5px] px-[6px] py-[3px] uppercase tracking-wider">
                        VIGENTE
                      </span>
                      <span className="font-semibold text-[10.5px] md:text-[11.5px] text-[#9AA7B5]">
                        Versión {CURRENT_TERMS_VERSION} · desde {TERMS_EFFECTIVE_DATE}
                      </span>
                    </div>
                  </div>

                  {/* Lista de los 3 bloques informativos */}
                  <div className="flex flex-col gap-2.5 sm:gap-3">
                    
                    {/* Bloque 1: Tratamiento de imágenes */}
                    <div className="bg-white border border-[#E6ECF3] rounded-[15px] p-3.5 sm:p-4 flex gap-3 items-start shadow-xs">
                      <div className="w-[36px] h-[36px] rounded-[10px] bg-[#E8F1FB] flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="material-symbols-rounded filled text-[20px] text-[#1E6FCB]">
                          photo_camera
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-[12.5px] md:text-[13.5px] text-[#263249]">
                          Tratamiento de imágenes
                        </div>
                        <div className="font-medium text-[11px] md:text-[12px] leading-[1.45] text-[#7A8696] mt-1">
                          Tus fotos se procesan en nuestros servidores y en los de un proveedor de análisis, con el único fin de difuminar rostros y patentes y clasificar el reporte.
                        </div>
                      </div>
                    </div>

                    {/* Bloque 2: Qué se guarda */}
                    <div className="bg-white border border-[#E6ECF3] rounded-[15px] p-3.5 sm:p-4 flex gap-3 items-start shadow-xs">
                      <div className="w-[36px] h-[36px] rounded-[10px] bg-[#E8F1FB] flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="material-symbols-rounded filled text-[20px] text-[#1E6FCB]">
                          visibility_off
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-[12.5px] md:text-[13.5px] text-[#263249]">
                          Qué se guarda
                        </div>
                        <div className="font-medium text-[11px] md:text-[12px] leading-[1.45] text-[#7A8696] mt-1">
                          Solo la versión anonimizada. La imagen original se descarta al terminar el procesamiento.
                        </div>
                      </div>
                    </div>

                    {/* Bloque 3: Tus derechos */}
                    <div className="bg-white border border-[#E6ECF3] rounded-[15px] p-3.5 sm:p-4 flex gap-3 items-start shadow-xs">
                      <div className="w-[36px] h-[36px] rounded-[10px] bg-[#E8F1FB] flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="material-symbols-rounded filled text-[20px] text-[#1E6FCB]">
                          gavel
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-[12.5px] md:text-[13.5px] text-[#263249]">
                          Tus derechos
                        </div>
                        <div className="font-medium text-[11px] md:text-[12px] leading-[1.45] text-[#7A8696] mt-1">
                          Podés acceder, rectificar y suprimir tus datos (Ley 25.326). Tu identidad no se comparte con el organismo receptor.
                        </div>
                      </div>
                    </div>

                    {/* Enlace al articulado legal completo */}
                    <button
                      onClick={() => setShowFullTermsModal(true)}
                      type="button"
                      className="flex items-center justify-center gap-1.5 font-bold text-[11.5px] md:text-[12.5px] text-[#1E6FCB] hover:text-[#15539E] cursor-pointer bg-transparent border-0 py-2 transition-colors mx-auto"
                    >
                      <span>Leer el texto completo</span>
                      <span className="material-symbols-rounded text-[16px]">
                        open_in_new
                      </span>
                    </button>

                    {/* Alerta visual si se intentó continuar sin marcar el checkbox */}
                    {showTermsError && !acceptedTerms && (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-[#FFF2E0] border border-[#F7E2C8] rounded-[12px] p-[11px_12px] flex items-center gap-2 mt-2 shadow-2xs"
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
                </div>

                {/* Zona inferior: Checkbox explícito, Botón Aceptar y Rechazar */}
                <div className="pt-4 mt-auto">
                  <label
                    htmlFor="terms-checkbox"
                    className="flex gap-2.5 items-start mb-3.5 cursor-pointer select-none bg-white md:bg-transparent p-3 md:p-0 rounded-[12px] md:rounded-none border md:border-0 border-[#E6ECF3]"
                  >
                    <input
                      id="terms-checkbox"
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
                    <span className="font-semibold text-[11px] md:text-[12px] leading-[1.45] text-[#46566B]">
                      Acepto los términos y el tratamiento de mis imágenes descripto arriba.
                    </span>
                  </label>

                  <motion.button
                    whileHover={acceptedTerms ? { scale: 1.01 } : {}}
                    whileTap={acceptedTerms ? { scale: 0.98 } : {}}
                    onClick={handleAcceptTerms}
                    type="button"
                    className={`w-full rounded-[13px] py-[14px] px-6 text-center font-extrabold text-[14px] md:text-[15px] border-0 transition-all cursor-pointer ${
                      acceptedTerms
                        ? 'bg-[#1E6FCB] text-white shadow-[0px_8px_18px_rgba(30,111,203,0.3)] hover:bg-[#15539E]'
                        : 'bg-[#DDE6EF] text-[#9AA7B5] hover:bg-[#D5DFEA]'
                    }`}
                  >
                    Aceptar y continuar
                  </motion.button>

                  <div className="text-center pt-2.5 pb-0.5">
                    <button
                      onClick={handleRejectTerms}
                      type="button"
                      className="font-bold text-[11.5px] md:text-[12px] text-[#8593A2] hover:text-[#263249] cursor-pointer bg-transparent border-0 transition-colors"
                    >
                      Rechazar
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ========================================================================= */}
            {/* PASO 2: Activá los Permisos                                               */}
            {/* ========================================================================= */}
            {currentStep === 2 && (
              <motion.div
                key="step-permissions"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
                className="flex-1 flex flex-col justify-between w-full"
              >
                {/* Zona superior: Icono, Título y Switches de permisos */}
                <div>
                  
                  {/* Icono de escudo azul */}
                  <div className="w-[54px] h-[54px] md:w-[60px] md:h-[60px] rounded-[18px] bg-[#E8F1FB] flex items-center justify-center mb-4 shadow-xs">
                    <span className="material-symbols-rounded filled text-[30px] md:text-[34px] text-[#1E6FCB]">
                      verified_user
                    </span>
                  </div>

                  {/* Título y subtítulo */}
                  <h1 className="font-extrabold text-[22px] sm:text-[24px] md:text-[28px] text-[#243447] tracking-[-0.5px] leading-tight m-0">
                    Activá los permisos
                  </h1>
                  <p className="font-medium text-[13px] md:text-[14px] leading-[1.5] text-[#8593A2] mt-1.5 mb-5 max-w-[420px]">
                    Reportalo solo los usa al momento de reportar. Podés cambiarlos cuando quieras.
                  </p>

                  {/* Permiso 1: Cámara */}
                  <div className="bg-white border border-[#E6ECF3] rounded-[16px] p-4 flex gap-3.5 items-start mb-3 shadow-xs">
                    <div className="w-10 h-10 flex-shrink-0 rounded-[12px] bg-[#E8F1FB] flex items-center justify-center">
                      <span className="material-symbols-rounded filled text-[22px] text-[#1E6FCB]">
                        photo_camera
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-[13px] md:text-[14px] text-[#263249]">
                        Cámara
                      </div>
                      <div className="font-medium text-[11.5px] md:text-[12.5px] leading-[1.4] text-[#8593A2] mt-0.5">
                        Para capturar la foto que sirve de evidencia.
                      </div>
                    </div>
                    
                    {/* Switch Toggle Cámara */}
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
                  <div className="bg-white border border-[#E6ECF3] rounded-[16px] p-4 flex gap-3.5 items-start mb-3.5 shadow-xs">
                    <div className="w-10 h-10 flex-shrink-0 rounded-[12px] bg-[#E8F1FB] flex items-center justify-center">
                      <span className="material-symbols-rounded filled text-[22px] text-[#1E6FCB]">
                        location_on
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-[13px] md:text-[14px] text-[#263249]">
                        Ubicación
                      </div>
                      <div className="font-medium text-[11.5px] md:text-[12.5px] leading-[1.4] text-[#8593A2] mt-0.5">
                        Para georreferenciar el reporte en el mapa.
                      </div>
                    </div>

                    {/* Switch Toggle Ubicación */}
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
                  <div className="flex items-start gap-2.5 bg-[#E3F5EC] border border-[#D0EADB] rounded-[14px] p-3.5 mb-4 text-left shadow-2xs">
                    <span className="material-symbols-rounded filled text-[18px] text-[#2E9E6B] flex-shrink-0 mt-0.5">
                      shield
                    </span>
                    <span className="font-semibold text-[11px] md:text-[12px] leading-[1.5] text-[#2C7A55]">
                      Tu foto se procesa de forma segura: los rostros y patentes se difuminan automáticamente antes de guardarse. La imagen original nunca se almacena.
                    </span>
                  </div>
                </div>

                {/* Zona inferior de acción */}
                <div className="pt-2 mt-auto">
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleFinishPermissions}
                    type="button"
                    className="w-full bg-[#1E6FCB] text-white rounded-[14px] py-[15px] px-6 text-center font-extrabold text-[15px] shadow-[0px_8px_18px_rgba(30,111,203,0.3)] hover:bg-[#15539E] cursor-pointer border-0 transition-colors"
                  >
                    Continuar
                  </motion.button>
                  <button
                    onClick={handleSkipPermissions}
                    type="button"
                    className="w-full text-center py-2.5 font-bold text-[13px] text-[#8593A2] hover:text-[#263249] cursor-pointer bg-transparent border-0 transition-colors mt-1"
                  >
                    Ahora no
                  </button>
                </div>

              </motion.div>
            )}

          </AnimatePresence>

        </main>

        {/* Sidebar desktop (>= md) armonizada 100% con WelcomePage, LoginPage y Municipios */}
        <aside className="hidden md:flex w-[380px] lg:w-[420px] flex-shrink-0 bg-[#F4F7FB] border-l border-[#EEF1F5] p-8 flex-col justify-between gap-4">
          <div>
            <div className="font-extrabold text-[11px] text-[#8593A2] tracking-[0.5px] mb-4 uppercase">
              Marco Legal y Garantías
            </div>

            <div className="flex flex-col gap-3">
              <motion.div
                whileHover={{ y: -2 }}
                className="bg-white border border-[#E6ECF3] rounded-[13px] p-3.5 flex gap-3 shadow-xs"
              >
                <span className="w-[28px] h-[28px] rounded-[8px] bg-[#EEF5FC] text-[#1E6FCB] font-extrabold text-[12px] flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-rounded text-[16px]">verified</span>
                </span>
                <div>
                  <div className="font-bold text-[13px] text-[#263249]">
                    Ley Nacional 25.326
                  </div>
                  <div className="font-medium text-[11px] leading-[1.45] text-[#7A8696] mt-0.5">
                    Tus datos se encuentran resguardados bajo la normativa de protección de datos personales.
                  </div>
                </div>
              </motion.div>

              <motion.div
                whileHover={{ y: -2 }}
                className="bg-white border border-[#E6ECF3] rounded-[13px] p-3.5 flex gap-3 shadow-xs"
              >
                <span className="w-[28px] h-[28px] rounded-[8px] bg-[#EEF5FC] text-[#1E6FCB] font-extrabold text-[12px] flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-rounded text-[16px]">lock</span>
                </span>
                <div>
                  <div className="font-bold text-[13px] text-[#263249]">
                    Cuarentena de fotos cifrada
                  </div>
                  <div className="font-medium text-[11px] leading-[1.45] text-[#7A8696] mt-0.5">
                    El procesamiento se realiza en memoria volátil; la imagen original se destruye de inmediato.
                  </div>
                </div>
              </motion.div>

              <motion.div
                whileHover={{ y: -2 }}
                className="bg-white border border-[#E6ECF3] rounded-[13px] p-3.5 flex gap-3 shadow-xs"
              >
                <span className="w-[28px] h-[28px] rounded-[8px] bg-[#EEF5FC] text-[#1E6FCB] font-extrabold text-[12px] flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-rounded text-[16px]">visibility_off</span>
                </span>
                <div>
                  <div className="font-bold text-[13px] text-[#263249]">
                    Anonimato frente al organismo
                  </div>
                  <div className="font-medium text-[11px] leading-[1.45] text-[#7A8696] mt-0.5">
                    El municipio sólo recibe el reclamo geolocalizado con la foto sanitizada.
                  </div>
                </div>
              </motion.div>
            </div>
          </div>

          <div className="flex items-start gap-2 pt-3 border-t border-[#EEF1F5]">
            <span className="material-symbols-rounded filled text-[17px] text-[#1E6FCB] flex-shrink-0 mt-0.5">
              verified_user
            </span>
            <span className="font-semibold text-[11px] leading-[1.5] text-[#56657A]">
              Consentimiento auditable y verificable según estándares internacionales.
            </span>
          </div>
        </aside>

      </div>

      {/* Modal de Lectura de Texto Completo */}
      {showFullTermsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[20px] max-w-[580px] w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-extrabold text-base text-[#243447] m-0">
                Términos y Condiciones Completos
              </h3>
              <button
                onClick={() => setShowFullTermsModal(false)}
                type="button"
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer border-0 bg-transparent"
              >
                ✕
              </button>
            </div>

            <div className="px-6 py-5 overflow-y-auto font-sans text-xs leading-relaxed text-slate-600 whitespace-pre-line">
              {FULL_TERMS_AND_CONDITIONS}
            </div>

            <div className="px-6 py-3.5 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowFullTermsModal(false)}
                type="button"
                className="bg-[#1E6FCB] text-white rounded-xl py-2.5 px-5 font-bold text-xs hover:bg-[#15539E] cursor-pointer border-0"
              >
                Entendido
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal / Bottom Sheet de Confirmación de Rechazo */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-[#182230]/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, y: 25, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 25, scale: 0.96 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="w-full max-w-[380px] bg-white rounded-[20px] p-[20px_18px_16px] shadow-[0px_20px_40px_rgba(10,20,40,0.32)] overflow-hidden text-left"
          >
            {/* Icono block */}
            <div className="w-[40px] h-[40px] rounded-[12px] bg-[#FDECEA] flex items-center justify-center text-[#C0392B] mb-[13px]">
              <span className="material-symbols-rounded text-[22px]">
                block
              </span>
            </div>

            {/* Título */}
            <h3 className="font-extrabold text-[16px] text-[#243447] tracking-[-0.2px] m-0">
              ¿Rechazar los términos?
            </h3>

            {/* Descripción */}
            <p className="font-medium text-[11.5px] leading-[1.55] text-[#56657A] mt-[7px] mb-0">
              Sin tu consentimiento no podemos procesar las imágenes, así que no vas a poder usar Reportalo. Podés volver y aceptar cuando quieras.
            </p>

            {/* Botones de acción */}
            <div className="flex flex-col gap-[9px] mt-[16px]">
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleConfirmReject}
                type="button"
                className="w-full bg-[#C0392B] hover:bg-[#A93226] text-white rounded-[12px] p-[13px] text-center font-extrabold text-[13px] border-0 cursor-pointer transition-colors"
              >
                Rechazar y salir
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleCancelReject}
                type="button"
                className="w-full bg-[#F2F5F9] hover:bg-[#E5EBF2] text-[#46566B] rounded-[12px] p-[13px] text-center font-extrabold text-[13px] border-0 cursor-pointer transition-colors"
              >
                Volver a los términos
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
};
