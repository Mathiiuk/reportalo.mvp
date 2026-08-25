// ==============================================================================
// Página Principal: Primera Pantalla de Bienvenida (HomePage.jsx)
// ==============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { useOnboarding } from '../hooks/useOnboarding';
import { supabase } from '../utils/supabase';
import { toast } from 'sonner';

export const HomePage = () => {
  const { isAuthenticated, loading, signInWithGoogle, signInWithEmail, user } = useAuth();
  const { onboardingStatus, setRegistered } = useOnboarding();
  const navigate = useNavigate();

  const [activeForm, setActiveForm] = useState(null);
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resentTimer, setResentTimer] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errorMsg = params.get('error_description') || params.get('error');
    const errorCode = params.get('error_code');

    if (errorMsg || errorCode) {
      if (errorCode === 'signup_disabled') {
        toast.error('Los registros están deshabilitados en el panel de Supabase (Activar "Allow new users to sign up").');
      } else {
        toast.error(`Error de autenticación: ${errorMsg || errorCode}`);
      }
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!loading && isAuthenticated) {
      // Verificar si el usuario ya completó onboarding (Supabase metadata o localStorage)
      // Priorizar metadata de Supabase (persistente en DB) sobre localStorage
      const hasCompletedInMetadata = user?.user_metadata?.onboarding_completed === true;
      const hasCompletedInLocal = onboardingStatus === 'completed';

      if (hasCompletedInMetadata || hasCompletedInLocal) {
        // Si estaba en localStorage pero no en Supabase, sincronizar
        if (hasCompletedInLocal && !hasCompletedInMetadata) {
          // Guardar en Supabase para persistencia futura
          supabase.auth.updateUser({
            data: { onboarding_completed: true },
          });
        }
        navigate('/map', { replace: true });
      } else {
        if (onboardingStatus === 'new') {
          setRegistered();
        }
        navigate('/onboarding', { replace: true });
      }
    }
  }, [isAuthenticated, loading, onboardingStatus, navigate, setRegistered, user]);

  useEffect(() => {
    if (resentTimer <= 0) return;
    const interval = setInterval(() => {
      setResentTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resentTimer]);

  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Error con Google OAuth:', error);
      toast.error('No se pudo iniciar sesión con Google.');
    }
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      toast.warning('Ingresá tu correo electrónico.');
      return;
    }
    setIsLoading(true);
    try {
      await signInWithEmail(email);
      setActiveForm('email-sent');
      setResentTimer(60);
      toast.success('Revisá tu correo para continuar.');
    } catch (error) {
      console.error('Error al enviar enlace:', error);
      toast.error('No pudimos enviar el enlace. Intentá nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = useCallback(async () => {
    if (resentTimer > 0) return;
    setIsLoading(true);
    try {
      await signInWithEmail(email);
      setResentTimer(60);
      toast.success('Enlace reenviado.');
    } catch (error) {
      toast.error('No pudimos reenviar el enlace.');
    } finally {
      setIsLoading(false);
    }
  }, [email, resentTimer, signInWithEmail]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center overflow-x-hidden">
      <AnimatePresence mode="wait">
        {/* VISTA 1: BIENVENIDA */}
        {activeForm === null && (
          <motion.div
            key="welcome-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="w-full min-h-[100dvh] flex flex-col bg-[#1E6FCB] px-6"
          >
            <div className="flex-1 flex flex-col justify-center items-center text-center pt-8 pb-4">
              {/* Logo */}
              <div className="mb-6 flex items-center justify-center">
                <img
                  src="/logo-icon.webp"
                  alt="Logo Reportalo"
                  className="w-28 h-32 object-contain select-none transition-transform hover:scale-105 duration-200 drop-shadow-sm"
                />
              </div>

              <h1 className="text-white text-[38px] font-extrabold tracking-[-0.6px] leading-tight">
                Reportalo
              </h1>

              <p className="mt-3.5 text-white/90 text-[15px] font-medium leading-relaxed max-w-[280px]">
                Reportá lo que ves en tu ciudad, con evidencia verificada y tu identidad protegida.
              </p>

              <div className="flex flex-col items-start mt-8 w-full max-w-[310px] gap-3.5 mx-auto">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-rounded filled text-[22px] text-[#9FD0FF] shrink-0">shield</span>
                  <span className="text-white/95 text-[15px] font-semibold text-left">Anónimo ante el organismo receptor</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="material-symbols-rounded filled text-[22px] text-[#9FD0FF] shrink-0">auto_awesome</span>
                  <span className="text-white/95 text-[15px] font-semibold text-left">La IA encuentra a quién corresponde</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="material-symbols-rounded filled text-[22px] text-[#9FD0FF] shrink-0">map</span>
                  <span className="text-white/95 text-[15px] font-semibold text-left">Seguimiento hasta resolverse</span>
                </div>
              </div>
            </div>

            <div className="w-full max-w-[340px] mx-auto flex flex-col pb-6 safe-bottom gap-3 mt-auto">
              <button
                type="button"
                onClick={() => setActiveForm('login')}
                className="w-full cursor-pointer transition-all duration-150 active:scale-[0.98] bg-white rounded-[22px] py-[18px] text-center font-extrabold text-lg text-[#1E6FCB] shadow-[0_8px_20px_rgba(0,0,0,0.12)] border-none"
              >
                Comenzar
              </button>
              <p className="text-center px-2 text-white/80 text-[13px] font-medium leading-relaxed">
                Entrás con tu correo, sin crear contraseña.
              </p>
            </div>
          </motion.div>
        )}

        {/* VISTA 2: LOGIN — Magic Link + Google */}
        {activeForm === 'login' && (
          <motion.div
            key="login-view"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.2 }}
            className="w-full min-h-[100dvh] bg-white flex flex-col safe-top safe-bottom"
          >
            <div className="w-full max-w-md mx-auto flex-1 flex flex-col px-6 pt-3 pb-4">
              {/* Flecha volver */}
              <button
                type="button"
                onClick={() => setActiveForm(null)}
                className="flex items-center justify-center cursor-pointer text-2xl text-[#334155] bg-transparent border-none p-1 -ml-1 w-fit hover:opacity-80 transition-opacity"
                aria-label="Volver"
              >
                <span className="material-symbols-rounded text-[26px]">arrow_back</span>
              </button>

              {/* Logo + nombre */}
              <div className="flex items-center gap-2.5 mt-4">
                <img src="/logo-icon.webp" alt="Logo Reportalo" className="w-6 h-7 object-contain" />
                <span className="text-[20px] font-extrabold text-[#1B365D]">Reportalo</span>
              </div>

              {/* Título */}
              <h2 className="text-[28px] font-extrabold text-[#1B365D] mt-5 tracking-tight">
                Ingresá a Reportalo
              </h2>

              {/* Subtítulo */}
              <p className="text-[15px] font-medium text-[#64748B] mt-1 leading-snug max-w-[280px]">
                Sin contraseñas. Elegí cómo querés entrar.
              </p>

              {/* Botón Google */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="flex items-center justify-center cursor-pointer transition-all duration-150 active:scale-[0.98] mt-7 gap-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[20px] py-[15px] px-4 w-full shadow-xs hover:bg-[#F1F5F9]"
              >
                <span className="w-[22px] h-[22px] rounded-full bg-white border border-[#E2E8F0] flex items-center justify-center text-[13px] font-extrabold text-[#4285F4] shadow-xs">
                  G
                </span>
                <span className="text-[15px] font-bold text-[#1E293B]">
                  Continuar con Google
                </span>
              </button>

              {/* Separador "o" */}
              <div className="flex items-center gap-3 my-6 w-full">
                <span className="flex-1 h-px bg-[#E2E8F0]" />
                <span className="text-xs font-semibold text-[#94A3B8]">o</span>
                <span className="flex-1 h-px bg-[#E2E8F0]" />
              </div>

              {/* Formulario Email */}
              <form onSubmit={handleEmailSubmit} className="w-full">
                {/* Label correo */}
                <label className="block text-[13px] font-bold text-[#475569] mb-2">
                  Tu correo
                </label>

                {/* Input correo */}
                <div className="flex items-center gap-3 bg-white border-2 border-[#1E6FCB] rounded-[20px] px-4 py-3.5 shadow-sm">
                  <span className="material-symbols-rounded text-[22px] text-[#1E6FCB] shrink-0">
                    mail
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="lucia.f@mail.com"
                    autoComplete="email"
                    inputMode="email"
                    autoCapitalize="none"
                    spellCheck="false"
                    disabled={isLoading}
                    className="flex-1 outline-none border-none bg-transparent text-[15px] font-medium text-[#1E293B] placeholder:text-[#94A3B8]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full cursor-pointer transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-4 bg-[#1E6FCB] rounded-[20px] py-[16px] text-center border-none shadow-[0_10px_25px_-5px_rgba(30,111,203,0.35)] hover:bg-[#1860B3]"
                >
                  <span className="font-extrabold text-base text-white">
                    {isLoading ? 'Enviando...' : 'Enviarme un enlace'}
                  </span>
                </button>
              </form>

              {/* Bloque de privacidad */}
              <div className="flex items-start mt-auto gap-3 bg-[#F0F6FE] border border-[#D6E6F8] rounded-[18px] p-4 mt-auto mb-2">
                <span className="material-symbols-rounded filled text-[20px] text-[#1E6FCB] shrink-0 mt-0.5">
                  shield
                </span>
                <span className="text-[13px] font-medium text-[#475569] leading-relaxed">
                  Tu cuenta sirve para seguir tus reportes; tu identidad nunca se comparte con el organismo.
                </span>
              </div>
            </div>
          </motion.div>
        )}

        {/* VISTA 3: CORREO ENVIADO */}
        {activeForm === 'email-sent' && (
          <motion.div
            key="email-sent-view"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.2 }}
            className="w-full min-h-[100dvh] flex flex-col safe-top safe-bottom bg-[#F4F7FB]"
          >
            <div className="w-full max-w-md mx-auto flex-1 flex flex-col px-[26px] pt-2.5">
              {/* Flecha volver */}
              <button
                type="button"
                onClick={() => setActiveForm('login')}
                className="flex items-center justify-center cursor-pointer text-2xl text-[#5B6A7A] bg-transparent border-none p-0 w-fit"
                aria-label="Volver"
              >
                <span className="material-symbols-rounded">arrow_back</span>
              </button>

              {/* Contenido centrado */}
              <div className="flex-1 flex flex-col items-center justify-center text-center pb-8">
                {/* Icono */}
                <div className="w-[90px] h-[90px] rounded-[28px] bg-[#E8F1FB] flex items-center justify-center mb-6">
                  <span className="material-symbols-rounded filled text-[46px] text-[#1E6FCB]">forward_to_inbox</span>
                </div>

                {/* Título */}
                <h2 className="text-[26px] font-extrabold text-[#243447] tracking-[-0.5px]">
                  Revisá tu correo
                </h2>

                {/* Subtítulo */}
                <p className="text-[15px] font-medium text-[#7A8696] mt-2.5 leading-relaxed">
                  Te enviamos un enlace de acceso a
                </p>

                {/* Email */}
                <p className="text-[15px] font-extrabold text-[#1E6FCB] mt-1">
                  {email}
                </p>

                {/* Instrucción */}
                <p className="text-sm font-medium text-[#8593A2] mt-4 max-w-[240px] leading-relaxed">
                  Tocá el enlace desde este teléfono y entrás directo.
                </p>

                {/* Botón Abrir mi correo */}
                <button
                  type="button"
                  className="w-full cursor-pointer transition-all duration-150 active:scale-[0.98] mt-7 bg-[#1E6FCB] rounded-2xl py-[17px] text-center border-none shadow-[0_8px_18px_rgba(30,111,203,0.3)]"
                >
                  <span className="font-extrabold text-[17px] text-white">Abrir mi correo</span>
                </button>

                {/* Reenviar timer */}
                <div className="flex items-center gap-[7px] mt-4">
                  <span className="material-symbols-rounded text-[17px] text-[#AAB4BF]">schedule</span>
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resentTimer > 0 || isLoading}
                    className="cursor-pointer disabled:cursor-not-allowed font-bold text-[14px] bg-transparent border-none p-0"
                    style={{ color: resentTimer > 0 ? '#9AA7B5' : '#1E6FCB' }}
                  >
                    {resentTimer > 0 ? `Reenviar en ${formatTime(resentTimer)}` : 'Reenviar enlace'}
                  </button>
                </div>
              </div>

              {/* Bloque de info */}
              <div className="flex items-start gap-2.5 bg-white border border-[#E6ECF3] rounded-[13px] p-3.5 mb-4">
                <span className="material-symbols-rounded text-[19px] text-[#8593A2] shrink-0">info</span>
                <span className="text-[13px] font-medium text-[#6A7888] leading-relaxed">
                  El enlace vence en 15 minutos y sirve una sola vez.
                </span>
              </div>
            </div>

            {/* Drag Handle */}
            <div className="flex items-center justify-center w-full h-[18px] shrink-0 bg-[#F4F7FB]">
              <div className="25px h-1 rounded-[3px] bg-black/18" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
