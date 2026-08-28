import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import {
  getTermsRejectionRecord,
  formatRejectionDate,
} from '../services/termsService';

export const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signInWithGoogle, signInWithMagicLink, authError, clearError } = useAuth();
  const [isSubmittingGoogle, setIsSubmittingGoogle] = useState(false);
  const [isSubmittingMagicLink, setIsSubmittingMagicLink] = useState(false);
  const [emailInput, setEmailInput] = useState('');

  // Verificación de estado de rechazo: solo se activa si proviene de una acción explícita de rechazo
  const isRejected = Boolean(location.state?.rejected);
  const rejectionRecord = isRejected
    ? location.state?.rejectionRecord || getTermsRejectionRecord()
    : null;

  // Validación de formato de correo electrónico
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.trim());

  // Retorno a la pantalla de bienvenida
  const handleGoBack = () => {
    clearError();
    navigate('/');
  };

  // Manejo del inicio de sesión con Google OAuth (REP-2100)
  const handleGoogleLogin = async () => {
    setIsSubmittingGoogle(true);
    clearError();
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        setIsSubmittingGoogle(false);
        toast.error(error.message || 'Error al iniciar sesión con Google.');
      }
    } catch (err) {
      setIsSubmittingGoogle(false);
      toast.error('Ocurrió un error inesperado al conectar con Google.');
    }
  };

  // Manejo del envío de Magic Link (REP-2101)
  const handleMagicLinkSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!isValidEmail || isSubmittingMagicLink) return;

    setIsSubmittingMagicLink(true);
    clearError();

    try {
      const normalizedEmail = emailInput.trim().toLowerCase();
      const { error } = await signInWithMagicLink(normalizedEmail);

      if (error) {
        setIsSubmittingMagicLink(false);
        toast.error(error.message || 'No se pudo enviar el enlace.');
      } else {
        toast.success('¡Enlace enviado! Revisa tu bandeja de entrada.');
        navigate('/check-email', { state: { email: normalizedEmail } });
      }
    } catch (err) {
      setIsSubmittingMagicLink(false);
      toast.error('Ocurrió un error inesperado al enviar el enlace.');
    }
  };

  return (
    <div className="min-h-[100dvh] w-full font-manrope select-none flex flex-col bg-white">
      
      {/* Navbar desktop (>= md) */}
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
          <span className="font-bold text-[9px] text-[#1E6FCB] bg-[#EEF5FC] px-2 py-1 rounded-[7px] ml-1">
            CIUDADANOS
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-4">
          <button
            onClick={handleGoBack}
            type="button"
            className="flex items-center gap-1.5 font-bold text-[13px] text-[#5B6A7A] hover:text-[#1E6FCB] px-3 py-2 cursor-pointer bg-transparent border-0 transition-colors"
          >
            <span className="material-symbols-rounded text-[18px]">
              arrow_back
            </span>
            Volver al inicio
          </button>
        </div>
      </header>

      {/* Contenedor principal responsive */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-[100dvh] md:min-h-0">
        
        {/* Columna Principal / Formulario de Login */}
        <main className="flex-1 flex flex-col px-6 md:px-12 lg:px-16 pt-[max(env(safe-area-inset-top),16px)] md:pt-10 pb-[max(env(safe-area-inset-bottom),20px)] md:pb-10 justify-between md:justify-center md:items-center">
          
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-[420px] mx-auto md:mx-0"
          >
            {/* Si proviene de rechazo de términos, mostrar el banner de alerta */}
            {isRejected && (
              <div className="bg-[#FDECEA] border border-[#F7D2CC] rounded-[14px] p-[13px_14px] flex gap-[9px] mb-4 shadow-2xs text-left">
                <span className="material-symbols-rounded text-[18px] text-[#C0392B] flex-shrink-0 mt-0.5">
                  gavel
                </span>
                <div>
                  <div className="font-extrabold text-[11.5px] text-[#8A3B30]">
                    Rechazaste los términos
                  </div>
                  <div className="font-medium text-[10.5px] leading-[1.45] text-[#8A3B30] mt-[3px]">
                    {formatRejectionDate(rejectionRecord?.rejected_at)}. Para usar Reportalo tenés que aceptar la versión vigente.
                  </div>
                </div>
              </div>
            )}

            {/* Encabezado adaptativo: Específico de Rechazo o Estándar */}
            {isRejected ? (
              <div className="flex flex-col items-center text-center my-4">
                <div className="w-[76px] h-[76px] rounded-[22px] bg-white flex items-center justify-center mb-[18px] shadow-[0px_8px_18px_rgba(20,40,80,0.1)] border border-[#E6ECF3]/60">
                  <img
                    src="/logo-icon.webp"
                    alt="Reportalo"
                    className="w-[38px] h-[50px] object-contain"
                  />
                </div>
                <h1 className="font-extrabold text-[20px] md:text-[24px] text-[#243447] tracking-[-0.3px] m-0">
                  Entrar a Reportalo
                </h1>
                <p className="font-medium text-[11.5px] md:text-[12.5px] leading-[1.5] text-[#7A8696] mt-[8px] max-w-[210px] m-0">
                  Te mandamos un enlace de acceso. No hace falta contraseña.
                </p>
              </div>
            ) : (
              <>
                {/* Botón de retroceso móvil (< md) */}
                <button
                  onClick={handleGoBack}
                  type="button"
                  aria-label="Volver a la pantalla de bienvenida"
                  className="md:hidden w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-[#5B6A7A] hover:bg-slate-100 active:scale-95 transition-all cursor-pointer border-0 bg-transparent"
                >
                  <span className="material-symbols-rounded text-[22px]">
                    arrow_back
                  </span>
                </button>

                {/* Logo en móvil (< md) */}
                <div className="flex md:hidden items-center gap-2 mt-2">
                  <img
                    src="/logo-icon.webp"
                    alt="Reportalo Icon"
                    className="w-[18px] h-[24px] object-contain"
                  />
                  <span className="font-extrabold text-[17px] text-[#263249]">
                    Reportalo
                  </span>
                </div>

                {/* Encabezado y bajada estándar */}
                <h1 className="font-extrabold text-[23px] md:text-[30px] text-[#243447] mt-[18px] md:mt-0 tracking-[-0.5px] leading-tight">
                  Ingresá a Reportalo
                </h1>
                <p className="font-medium text-[13px] md:text-[14px] leading-[1.45] text-[#8593A2] mt-[5px]">
                  Sin contraseñas. Elegí cómo querés entrar.
                </p>
              </>
            )}

            {/* Mensaje de error si la autenticación falla */}
            {authError && (
              <div
                role="alert"
                className="mt-3.5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2"
              >
                <span className="material-symbols-rounded filled text-base text-red-600 flex-shrink-0">
                  error
                </span>
                <span className="flex-1">{authError}</span>
                <button
                  onClick={clearError}
                  type="button"
                  className="text-red-500 hover:text-red-800 font-bold ml-1 bg-transparent border-0 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {/* En modo estándar mostrar login con Google y separador */}
            {!isRejected && (
              <>
                {/* Botón: Continuar con Google (OAuth REP-2100) */}
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleGoogleLogin}
                  disabled={isSubmittingGoogle || isSubmittingMagicLink}
                  type="button"
                  className="mt-6 w-full flex items-center justify-center gap-[10px] bg-white border-[1.5px] border-[#DDE4EC] rounded-[14px] p-[14px] hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer disabled:opacity-60 shadow-sm"
                >
                  {isSubmittingGoogle ? (
                    <span className="text-sm font-semibold text-[#5B6A7A] animate-pulse">
                      Conectando con Google...
                    </span>
                  ) : (
                    <>
                      <span className="w-5 h-5 rounded-full bg-white border border-[#EEF1F5] flex items-center justify-center font-extrabold text-[12px] text-[#4285F4] flex-shrink-0">
                        G
                      </span>
                      <span className="font-bold text-[14px] text-[#3A4658]">
                        Continuar con Google
                      </span>
                    </>
                  )}
                </motion.button>

                {/* Separador 'o' */}
                <div className="flex items-center gap-[9px] my-5">
                  <span className="flex-1 h-[1px] bg-[#EEF1F5]"></span>
                  <span className="font-semibold text-[11px] text-[#AAB4BF]">o</span>
                  <span className="flex-1 h-[1px] bg-[#EEF1F5]"></span>
                </div>
              </>
            )}

            {/* Formulario de Correo / Magic Link (REP-2101) */}
            <form onSubmit={handleMagicLinkSubmit} className={isRejected ? 'mt-2' : ''}>
              {!isRejected && (
                <label
                  htmlFor="email"
                  className="block font-bold text-[11.5px] text-[#56657A] mb-[6px]"
                >
                  Tu correo
                </label>
              )}
              <div
                className={`flex items-center gap-[9px] bg-white border ${
                  isValidEmail
                    ? 'border-[#1E6FCB] shadow-[0px_0px_0px_3px_rgba(30,111,203,0.12)]'
                    : 'border-[#DDE6EF]'
                } rounded-[13px] py-[13px] px-[14px] transition-all`}
              >
                <input
                  id="email"
                  type="email"
                  placeholder={isRejected ? 'vecina@correo.com' : 'lucia.f@mail.com'}
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  disabled={isSubmittingMagicLink}
                  autoComplete="email"
                  required
                  className="font-medium text-[12px] md:text-[13px] text-[#46566B] placeholder-[#AAB4BF] flex-1 bg-transparent border-0 outline-none p-0"
                />
              </div>

              <motion.button
                whileHover={isValidEmail && !isSubmittingMagicLink ? { scale: 1.01 } : {}}
                whileTap={isValidEmail && !isSubmittingMagicLink ? { scale: 0.98 } : {}}
                type="submit"
                disabled={!isValidEmail || isSubmittingMagicLink}
                className={`w-full mt-3 rounded-[13px] py-[14px] px-4 text-center border-0 font-extrabold text-[14px] md:text-[15px] text-white transition-all ${
                  isValidEmail && !isSubmittingMagicLink
                    ? 'bg-[#1E6FCB] shadow-[0px_8px_18px_rgba(30,111,203,0.3)] hover:bg-[#15539E] cursor-pointer'
                    : 'bg-[#1E6FCB]/70 opacity-80 cursor-not-allowed shadow-none'
                }`}
              >
                {isSubmittingMagicLink ? (
                  <span className="flex items-center justify-center gap-2 text-white">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    Enviando enlace...
                  </span>
                ) : isRejected ? (
                  'Enviarme el enlace'
                ) : (
                  'Enviarme un enlace'
                )}
              </motion.button>

              {/* Enlace para volver a ver los términos en caso de rechazo */}
              {isRejected && (
                <div className="text-center pt-2.5">
                  <Link
                    to="/terminos"
                    className="font-bold text-[11.5px] text-[#1E6FCB] hover:underline no-underline cursor-pointer"
                  >
                    Ver los términos otra vez
                  </Link>
                </div>
              )}
            </form>
          </motion.div>

          {/* Tarjeta de resguardo de identidad en móvil (< md) */}
          <div className="md:hidden mt-8 mb-2 flex items-start gap-2 bg-[#EEF5FC] border border-[#D4E6F8] rounded-[12px] p-[12px] max-w-[420px] w-full mx-auto">
            <span className="material-symbols-rounded filled text-[17px] text-[#1E6FCB] flex-shrink-0 mt-[1px]">
              shield
            </span>
            <p className="font-medium text-[11.5px] leading-[1.45] text-[#46566B] m-0">
              Tu cuenta sirve para seguir tus reportes; tu identidad nunca se comparte con el organismo.
            </p>
          </div>
        </main>

        {/* Sidebar desktop (>= md) */}
        <aside className="hidden md:flex w-[380px] lg:w-[420px] flex-shrink-0 bg-[#F4F7FB] border-l border-[#EEF1F5] p-8 flex-col justify-between gap-4">
          <div>
            <div className="font-extrabold text-[11px] text-[#8593A2] tracking-[0.5px] mb-4 uppercase">
              Seguridad y Privacidad
            </div>

            <div className="flex flex-col gap-3">
              <motion.div
                whileHover={{ y: -2 }}
                className="bg-white border border-[#E6ECF3] rounded-[13px] p-3.5 flex gap-3 shadow-sm"
              >
                <span className="w-[28px] h-[28px] rounded-[8px] bg-[#EEF5FC] text-[#1E6FCB] font-extrabold text-[12px] flex items-center justify-center flex-shrink-0">
                  1
                </span>
                <div>
                  <div className="font-bold text-[13px] text-[#263249]">
                    Tu identidad nunca se comparte
                  </div>
                  <div className="font-medium text-[11px] leading-[1.45] text-[#7A8696] mt-0.5">
                    El organismo receptor únicamente recibe la evidencia técnica y la ubicación.
                  </div>
                </div>
              </motion.div>

              <motion.div
                whileHover={{ y: -2 }}
                className="bg-white border border-[#E6ECF3] rounded-[13px] p-3.5 flex gap-3 shadow-sm"
              >
                <span className="w-[28px] h-[28px] rounded-[8px] bg-[#EEF5FC] text-[#1E6FCB] font-extrabold text-[12px] flex items-center justify-center flex-shrink-0">
                  2
                </span>
                <div>
                  <div className="font-bold text-[13px] text-[#263249]">
                    Sin necesidad de contraseñas
                  </div>
                  <div className="font-medium text-[11px] leading-[1.45] text-[#7A8696] mt-0.5">
                    Recibí un enlace directo en tu correo de un solo uso o entrá con Google.
                  </div>
                </div>
              </motion.div>

              <motion.div
                whileHover={{ y: -2 }}
                className="bg-white border border-[#E6ECF3] rounded-[13px] p-3.5 flex gap-3 shadow-sm"
              >
                <span className="w-[28px] h-[28px] rounded-[8px] bg-[#EEF5FC] text-[#1E6FCB] font-extrabold text-[12px] flex items-center justify-center flex-shrink-0">
                  3
                </span>
                <div>
                  <div className="font-bold text-[13px] text-[#263249]">
                    Historial centralizado
                  </div>
                  <div className="font-medium text-[11px] leading-[1.45] text-[#7A8696] mt-0.5">
                    Seguí la evolución de todos tus reclamos en un solo lugar.
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
              Tu cuenta sirve para seguir tus reportes; tu identidad nunca se comparte con el organismo.
            </span>
          </div>
        </aside>

      </div>

    </div>
  );
};
