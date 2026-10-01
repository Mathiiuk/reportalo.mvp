import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import {
  getTermsRejectionRecord,
  formatRejectionDate,
} from '../services/termsService';
import { ArrowLeft, Gavel, AlertCircle, Shield, Mail } from 'lucide-react';
import { useIsDesktopLayout } from '../hooks/useMediaQuery';
import { BrandBar } from '../components/layout/BrandBar';

export const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signInWithGoogle, signInWithMagicLink, authError, clearError } = useAuth();
  const [isSubmittingGoogle, setIsSubmittingGoogle] = useState(false);
  const [isSubmittingMagicLink, setIsSubmittingMagicLink] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  // D02 (UJ v3.3, REP-3791 Bloque 11-C): en escritorio, tarjeta centrada de 400 px, sin columna
  // lateral ni ilustración de relleno. Mismo orden que M02: Google arriba, correo abajo.
  const isDesktop = useIsDesktopLayout();

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
    <div className="min-h-[100dvh] w-full font-manrope select-none flex flex-col bg-rep-surface desktop:bg-rep-bg">
      {isDesktop && <BrandBar />}

      <div className="flex-1 flex flex-col overflow-hidden min-h-[100dvh] desktop:min-h-0">
        
        {/* Columna Principal / Formulario de Login */}
        <main className="flex-1 flex flex-col px-6 pt-[max(env(safe-area-inset-top),16px)] pb-[max(env(safe-area-inset-bottom),20px)] justify-between desktop:justify-center desktop:items-center desktop:px-10 desktop:py-12">
          
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-[420px] mx-auto desktop:max-w-[400px] desktop:rounded-3xl desktop:border desktop:border-rep-border desktop:bg-rep-surface desktop:p-8 desktop:shadow-rep-float"
          >
            {/* Si proviene de rechazo de términos, mostrar el banner de alerta */}
            {isRejected && (
              <div className="bg-rep-danger-soft border border-rep-danger/30 rounded-[14px] p-[13px_14px] flex gap-[9px] mb-4 shadow-2xs text-left">
                <Gavel className="w-[18px] h-[18px] text-rep-danger flex-shrink-0 mt-0.5" strokeWidth={2.25} />
                <div>
                  <div className="font-extrabold text-[11.5px] text-rep-danger">
                    Rechazaste los términos
                  </div>
                  <div className="font-medium text-[10.5px] leading-[1.45] text-rep-danger mt-[3px]">
                    {formatRejectionDate(rejectionRecord?.rejected_at)}. Para usar Reportalo tenés que aceptar la versión vigente.
                  </div>
                </div>
              </div>
            )}

            {/* Encabezado adaptativo: Específico de Rechazo o Estándar */}
            {isRejected ? (
              <div className="flex flex-col items-center text-center my-4">
                <div className="w-[76px] h-[76px] rounded-[22px] bg-rep-surface flex items-center justify-center mb-[18px] shadow-[0px_8px_18px_rgba(20,40,80,0.1)] border border-rep-border/60">
                  <img
                    src="/logo-icon.webp"
                    alt="Reportalo"
                    className="w-[38px] h-[50px] object-contain"
                  />
                </div>
                <h1 className="font-extrabold text-[20px] desktop:text-[22px] text-rep-ink tracking-[-0.3px] m-0">
                  Entrar a Reportalo
                </h1>
                <p className="font-medium text-[11.5px] desktop:text-[12.5px] leading-[1.5] text-rep-ink-muted mt-[8px] max-w-[210px] m-0">
                  Te mandamos un enlace de acceso. No hace falta contraseña.
                </p>
              </div>
            ) : (
              <>
                {/* Botón de retroceso y logo: solo en el teléfono (M02). En escritorio están en la barra. */}
                {!isDesktop && (
                <>
                <button
                  onClick={handleGoBack}
                  type="button"
                  aria-label="Volver a la pantalla de bienvenida"
                  className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-rep-ink-label hover:bg-rep-divider active:scale-95 transition-all cursor-pointer border-0 bg-transparent"
                >
                  <ArrowLeft className="w-[22px] h-[22px]" strokeWidth={2.25} />
                </button>

                <div className="flex items-center gap-2 mt-2">
                  <img
                    src="/logo-icon.webp"
                    alt="Reportalo Icon"
                    className="w-[18px] h-[24px] object-contain"
                  />
                  <span className="font-extrabold text-[17px] text-rep-ink">
                    Reportalo<span className="align-super text-[9px] font-bold text-rep-ink-muted">™</span>
                  </span>
                </div>
                </>
                )}

                {/* Encabezado y bajada estándar */}
                <h1 className="font-extrabold text-[23px] desktop:text-[24px] text-rep-ink mt-[18px] desktop:mt-0 tracking-[-0.5px] leading-tight">
                  Ingresá a Reportalo<span className="align-super text-[11px] font-bold text-rep-ink-muted">™</span>
                </h1>
                <p className="font-medium text-[13px] desktop:text-[14px] leading-[1.45] text-rep-ink-muted mt-[5px]">
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
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" strokeWidth={2.25} />
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
                  className="mt-6 w-full flex items-center justify-center gap-[10px] bg-rep-surface border-[1.5px] border-rep-track rounded-[14px] p-[14px] hover:bg-rep-surface-sunken hover:border-rep-ink-faint transition-all cursor-pointer disabled:opacity-60 shadow-sm"
                >
                  {isSubmittingGoogle ? (
                    <span className="text-sm font-semibold text-rep-ink-label animate-pulse">
                      Conectando con Google...
                    </span>
                  ) : (
                    <>
                      {/* Logo «G» de Google (M02 · D02; lo piden también sus pautas de marca para este botón) */}
                      <svg aria-hidden="true" viewBox="0 0 48 48" className="h-5 w-5 flex-shrink-0">
                        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
                        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
                      </svg>
                      <span className="font-bold text-[14px] text-rep-ink-body">
                        Continuar con Google
                      </span>
                    </>
                  )}
                </motion.button>

                {/* Separador 'o' */}
                <div className="flex items-center gap-[9px] my-5">
                  <span className="flex-1 h-[1px] bg-rep-divider"></span>
                  <span className="font-semibold text-[11px] text-rep-ink-faint">o</span>
                  <span className="flex-1 h-[1px] bg-rep-divider"></span>
                </div>
              </>
            )}

            {/* Formulario de Correo / Magic Link (REP-2101) */}
            <form onSubmit={handleMagicLinkSubmit} className={isRejected ? 'mt-2' : ''}>
              {!isRejected && (
                <label
                  htmlFor="email"
                  className="block font-bold text-[11.5px] text-rep-ink-label mb-[6px]"
                >
                  Tu correo
                </label>
              )}
              <div
                className={`flex items-center gap-[9px] bg-rep-surface border ${
                  isValidEmail
                    ? 'border-rep-accent shadow-[0px_0px_0px_3px_rgba(30,111,203,0.12)]'
                    : 'border-rep-track'
                } rounded-[13px] py-[13px] px-[14px] transition-all`}
              >
                <Mail aria-hidden="true" className="h-[18px] w-[18px] flex-shrink-0 text-rep-ink-faint" strokeWidth={2} />
                <input
                  id="email"
                  type="email"
                  placeholder={isRejected ? 'vecina@correo.com' : 'lucia.f@mail.com'}
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  disabled={isSubmittingMagicLink}
                  autoComplete="email"
                  required
                  className="font-medium text-rep-input text-rep-ink-body placeholder:text-rep-ink-faint flex-1 bg-transparent border-0 outline-none p-0"
                />
              </div>

              <motion.button
                whileHover={isValidEmail && !isSubmittingMagicLink ? { scale: 1.01 } : {}}
                whileTap={isValidEmail && !isSubmittingMagicLink ? { scale: 0.98 } : {}}
                type="submit"
                disabled={!isValidEmail || isSubmittingMagicLink}
                className={`w-full mt-3 rounded-[13px] py-[14px] px-4 text-center border-0 font-extrabold text-[14px] desktop:text-[15px] text-white transition-all ${
                  isValidEmail && !isSubmittingMagicLink
                    ? 'bg-rep-accent shadow-[0px_8px_18px_rgba(30,111,203,0.3)] hover:bg-rep-accent-strong cursor-pointer'
                    : 'bg-rep-accent/70 opacity-80 cursor-not-allowed shadow-none'
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
                    className="font-bold text-[11.5px] text-rep-accent hover:underline no-underline cursor-pointer"
                  >
                    Ver los términos otra vez
                  </Link>
                </div>
              )}
            </form>

            {/* D02: la nota de identidad va dentro de la tarjeta, debajo del botón */}
            {isDesktop && (
              <div className="mt-5 flex items-start gap-2 rounded-[12px] border border-rep-accent-border bg-rep-accent-soft p-[12px]">
                <Shield className="mt-[1px] h-[17px] w-[17px] flex-shrink-0 text-rep-accent" strokeWidth={2.25} />
                <p className="m-0 text-[12px] font-medium leading-[1.45] text-rep-ink-body">
                  Tu cuenta sirve para seguir tus reportes; tu identidad nunca se comparte con el organismo.
                </p>
              </div>
            )}
          </motion.div>

          {/* Tarjeta de resguardo de identidad en el teléfono (M02) */}
          {!isDesktop && (
          <div className="mt-8 mb-2 flex items-start gap-2 bg-rep-accent-soft border border-rep-accent-border rounded-[12px] p-[12px] max-w-[420px] w-full mx-auto">
            <Shield className="w-[17px] h-[17px] text-rep-accent flex-shrink-0 mt-[1px]" strokeWidth={2.25} />
            <p className="font-medium text-[11.5px] leading-[1.45] text-rep-ink-body m-0">
              Tu cuenta sirve para seguir tus reportes; tu identidad nunca se comparte con el organismo.
            </p>
          </div>
          )}
        </main>


      </div>

    </div>
  );
};
