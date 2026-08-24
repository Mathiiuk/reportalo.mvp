// ==============================================================================
// Página Principal: Primera Pantalla de Bienvenida (HomePage.jsx)
// ==============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { useOnboarding } from '../hooks/useOnboarding';
import { toast } from 'sonner';

export const HomePage = () => {
  const { isAuthenticated, loading, signInWithGoogle, signInWithEmail } = useAuth();
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
      if (onboardingStatus === 'completed') {
        navigate('/map', { replace: true });
      } else {
        if (onboardingStatus === 'new') {
          setRegistered();
        }
        navigate('/onboarding', { replace: true });
      }
    }
  }, [isAuthenticated, loading, onboardingStatus, navigate, setRegistered]);

  // Timer para reenvío
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
      navigate('/onboarding', { replace: true });
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
            className="w-full min-h-[100dvh] flex flex-col"
            style={{
              background: 'linear-gradient(165deg, rgb(42, 123, 214), rgb(21, 83, 158))',
              padding: '0 28px',
            }}
          >
            <div className="flex-1 flex flex-col justify-center items-center text-center">
              <div className="my-2 flex items-center justify-center">
                <img
                  src="/logo-icon.webp"
                  alt="Logo Reportalo"
                  className="w-32 h-36 object-contain select-none transition-transform hover:scale-105 duration-200"
                />
              </div>

              <div style={{ fontFamily: '800 42px Manrope', color: 'rgb(255, 255, 255)', letterSpacing: '-0.8px', fontSize: '42px', fontWeight: 800 }}>
                Reportalo
              </div>

              <div className="mt-3" style={{ fontFamily: '500 18px / 1.6 Manrope', color: 'rgba(255, 255, 255, 0.86)', maxWidth: '280px', fontSize: '18px', fontWeight: 500, lineHeight: 1.6 }}>
                Reportá lo que ves en tu ciudad, con evidencia verificada y tu identidad protegida.
              </div>

              <div className="flex flex-col items-center mt-7 w-full" style={{ gap: '13px' }}>
                <div className="flex items-center" style={{ gap: '10px' }}>
                  <span className="material-symbols-rounded filled" style={{ fontSize: '22px', color: 'rgb(159, 208, 255)' }}>shield</span>
                  <span style={{ fontFamily: '600 16px Manrope', color: 'rgba(255, 255, 255, 0.92)', textAlign: 'left', fontSize: '16px', fontWeight: 600 }}>Anónimo ante el organismo receptor</span>
                </div>
                <div className="flex items-center" style={{ gap: '10px' }}>
                  <span className="material-symbols-rounded filled" style={{ fontSize: '22px', color: 'rgb(159, 208, 255)' }}>auto_awesome</span>
                  <span style={{ fontFamily: '600 16px Manrope', color: 'rgba(255, 255, 255, 0.92)', textAlign: 'left', fontSize: '16px', fontWeight: 600 }}>La IA encuentra a quién corresponde</span>
                </div>
                <div className="flex items-center" style={{ gap: '10px' }}>
                  <span className="material-symbols-rounded filled" style={{ fontSize: '22px', color: 'rgb(159, 208, 255)' }}>map</span>
                  <span style={{ fontFamily: '600 16px Manrope', color: 'rgba(255, 255, 255, 0.92)', textAlign: 'left', fontSize: '16px', fontWeight: 600 }}>Seguimiento hasta resolverse</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col pb-6 safe-bottom" style={{ gap: '12px' }}>
              <button type="button" onClick={() => setActiveForm('login')} className="w-full cursor-pointer transition-all duration-150 active:scale-[0.98]" style={{ background: 'rgb(255, 255, 255)', borderRadius: '16px', padding: '18px', textAlign: 'center', fontFamily: '800 18px Manrope', color: 'rgb(30, 111, 203)', boxShadow: 'rgba(0, 0, 0, 0.14) 0px 8px 18px', border: 'none', fontSize: '18px', fontWeight: 800 }}>
                Comenzar
              </button>
              <div className="text-center px-2" style={{ fontFamily: '500 14px / 1.4 Manrope', color: 'rgba(255, 255, 255, 0.7)', fontSize: '14px', fontWeight: 500, lineHeight: 1.4 }}>
                Entrás con tu correo, sin crear contraseña.
              </div>
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
            <div className="w-full max-w-md mx-auto flex-1 flex flex-col" style={{ padding: '10px 24px 0px' }}>
              {/* Flecha volver */}
              <button type="button" onClick={() => setActiveForm(null)} className="flex items-center justify-center cursor-pointer" style={{ fontSize: '24px', color: 'rgb(91, 106, 122)', background: 'none', border: 'none', padding: 0, width: 'fit-content' }} aria-label="Volver">
                <span className="material-symbols-rounded">arrow_back</span>
              </button>

              {/* Logo + nombre */}
              <div className="flex items-center" style={{ gap: '9px', marginTop: '18px' }}>
                <img src="/logo-icon.webp" alt="Logo Reportalo" style={{ width: '20px', height: '26px', objectFit: 'contain' }} />
                <span style={{ fontFamily: '800 19px Manrope', color: 'rgb(38, 50, 73)', fontSize: '19px', fontWeight: 800 }}>Reportalo</span>
              </div>

              {/* Título */}
              <div style={{ fontFamily: '800 26px Manrope', color: 'rgb(36, 52, 71)', marginTop: '24px', letterSpacing: '-0.5px', fontSize: '26px', fontWeight: 800 }}>
                Ingresá a Reportalo
              </div>

              {/* Subtítulo */}
              <div style={{ fontFamily: '500 15px / 1.45 Manrope', color: 'rgb(133, 147, 162)', marginTop: '6px', fontSize: '15px', fontWeight: 500, lineHeight: 1.45 }}>
                Sin contraseñas. Elegí cómo querés entrar.
              </div>

              {/* Botón Google */}
              <button type="button" onClick={handleGoogleLogin} className="flex items-center justify-center cursor-pointer transition-all duration-150 active:scale-[0.98]" style={{ marginTop: '28px', gap: '11px', background: 'rgb(255, 255, 255)', border: '1.5px solid rgb(221, 228, 236)', borderRadius: '16px', padding: '16px', width: '100%' }}>
                <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgb(255, 255, 255)', border: '1px solid rgb(238, 241, 245)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '800 13px Manrope', color: 'rgb(66, 133, 244)', fontSize: '13px', fontWeight: 800 }}>G</span>
                <span style={{ fontFamily: '700 16px Manrope', color: 'rgb(58, 70, 88)', fontSize: '16px', fontWeight: 700 }}>Continuar con Google</span>
              </button>

              {/* Separador "o" */}
              <div className="flex items-center" style={{ gap: '10px', margin: '22px 0px' }}>
                <span style={{ flex: '1 1 0%', height: '1px', background: 'rgb(238, 241, 245)' }} />
                <span style={{ fontFamily: '600 12px Manrope', color: 'rgb(170, 180, 191)', fontSize: '12px', fontWeight: 600 }}>o</span>
                <span style={{ flex: '1 1 0%', height: '1px', background: 'rgb(238, 241, 245)' }} />
              </div>

              {/* Label correo */}
              <div style={{ fontFamily: '700 13px Manrope', color: 'rgb(86, 101, 122)', marginBottom: '7px', fontSize: '13px', fontWeight: 700 }}>Tu correo</div>

              {/* Input correo */}
              <form onSubmit={handleEmailSubmit}>
                <div className="flex items-center" style={{ gap: '10px', background: 'rgb(255, 255, 255)', border: '2px solid rgb(30, 111, 203)', borderRadius: '14px', padding: '14px 14px', boxShadow: 'rgba(30, 111, 203, 0.12) 0px 0px 0px 3px' }}>
                  <span className="material-symbols-rounded" style={{ fontSize: '20px', color: 'rgb(30, 111, 203)' }}>mail</span>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck="false" disabled={isLoading} className="flex-1 outline-none border-none bg-transparent" style={{ fontFamily: '600 15px Manrope', color: 'rgb(70, 86, 107)', fontSize: '15px', fontWeight: 600 }} />
                </div>

                <button type="submit" disabled={isLoading} className="w-full cursor-pointer transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed" style={{ marginTop: '18px', background: 'rgb(30, 111, 203)', borderRadius: '16px', padding: '17px', textAlign: 'center', border: 'none', boxShadow: 'rgba(30, 111, 203, 0.3) 0px 8px 18px' }}>
                  <span style={{ fontFamily: '800 17px Manrope', color: 'rgb(255, 255, 255)', fontSize: '17px', fontWeight: 800 }}>
                    {isLoading ? 'Enviando...' : 'Enviarme un enlace'}
                  </span>
                </button>
              </form>

              {/* Bloque de privacidad */}
              <div className="flex items-start mt-auto" style={{ gap: '10px', background: 'rgb(238, 245, 252)', border: '1px solid rgb(212, 230, 248)', borderRadius: '13px', padding: '13px 14px', marginBottom: '16px', marginTop: 'auto' }}>
                <span className="material-symbols-rounded filled" style={{ fontSize: '19px', color: 'rgb(30, 111, 203)', flexShrink: 0 }}>shield</span>
                <span style={{ fontFamily: '500 13px / 1.45 Manrope', color: 'rgb(70, 86, 107)', fontSize: '13px', fontWeight: 500, lineHeight: 1.45 }}>
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
            className="w-full min-h-[100dvh] flex flex-col safe-top safe-bottom"
            style={{ background: 'rgb(244, 247, 251)' }}
          >
            <div className="w-full max-w-md mx-auto flex-1 flex flex-col" style={{ padding: '10px 26px 0px' }}>
              {/* Flecha volver */}
              <button type="button" onClick={() => setActiveForm('login')} className="flex items-center justify-center cursor-pointer" style={{ fontSize: '24px', color: 'rgb(91, 106, 122)', background: 'none', border: 'none', padding: 0, width: 'fit-content' }} aria-label="Volver">
                <span className="material-symbols-rounded">arrow_back</span>
              </button>

              {/* Contenido centrado */}
              <div className="flex-1 flex flex-col items-center justify-center text-center" style={{ paddingBottom: '32px' }}>
                {/* Icono forward_to_inbox */}
                <div style={{ width: '90px', height: '90px', borderRadius: '28px', background: 'rgb(232, 241, 251)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
                  <span className="material-symbols-rounded filled" style={{ fontSize: '46px', color: 'rgb(30, 111, 203)' }}>forward_to_inbox</span>
                </div>

                {/* Título */}
                <div style={{ fontFamily: '800 26px Manrope', color: 'rgb(36, 52, 71)', letterSpacing: '-0.5px', fontSize: '26px', fontWeight: 800 }}>
                  Revisá tu correo
                </div>

                {/* Subtítulo */}
                <div style={{ fontFamily: '500 15px / 1.55 Manrope', color: 'rgb(122, 134, 150)', marginTop: '10px', fontSize: '15px', fontWeight: 500, lineHeight: 1.55 }}>
                  Te enviamos un enlace de acceso a
                </div>

                {/* Email */}
                <div style={{ fontFamily: '800 15px Manrope', color: 'rgb(30, 111, 203)', marginTop: '4px', fontSize: '15px', fontWeight: 800 }}>
                  {email}
                </div>

                {/* Instrucción */}
                <div style={{ fontFamily: '500 14px / 1.5 Manrope', color: 'rgb(133, 147, 162)', marginTop: '16px', maxWidth: '240px', fontSize: '14px', fontWeight: 500, lineHeight: 1.5 }}>
                  Tocá el enlace desde este teléfono y entrás directo.
                </div>

                {/* Botón Abrir mi correo */}
                <button type="button" className="w-full cursor-pointer transition-all duration-150 active:scale-[0.98]" style={{ marginTop: '28px', background: 'rgb(30, 111, 203)', borderRadius: '16px', padding: '17px', textAlign: 'center', border: 'none', boxShadow: 'rgba(30, 111, 203, 0.3) 0px 8px 18px' }}>
                  <span style={{ fontFamily: '800 17px Manrope', color: 'rgb(255, 255, 255)', fontSize: '17px', fontWeight: 800 }}>Abrir mi correo</span>
                </button>

                {/* Reenviar timer */}
                <div className="flex items-center" style={{ gap: '7px', marginTop: '16px' }}>
                  <span className="material-symbols-rounded" style={{ fontSize: '17px', color: 'rgb(170, 180, 191)' }}>schedule</span>
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resentTimer > 0 || isLoading}
                    className="cursor-pointer disabled:cursor-not-allowed"
                    style={{
                      fontFamily: '700 14px Manrope',
                      color: resentTimer > 0 ? 'rgb(154, 167, 181)' : 'rgb(30, 111, 203)',
                      fontSize: '14px',
                      fontWeight: 700,
                      background: 'none',
                      border: 'none',
                      padding: 0,
                    }}
                  >
                    {resentTimer > 0 ? `Reenviar en ${formatTime(resentTimer)}` : 'Reenviar enlace'}
                  </button>
                </div>
              </div>

              {/* Bloque de info */}
              <div className="flex items-start" style={{ gap: '10px', background: 'rgb(255, 255, 255)', border: '1px solid rgb(230, 236, 243)', borderRadius: '13px', padding: '13px 14px', marginBottom: '16px' }}>
                <span className="material-symbols-rounded" style={{ fontSize: '19px', color: 'rgb(133, 147, 162)', flexShrink: 0 }}>info</span>
                <span style={{ fontFamily: '500 13px / 1.45 Manrope', color: 'rgb(106, 120, 136)', fontSize: '13px', fontWeight: 500, lineHeight: 1.45 }}>
                  El enlace vence en 15 minutos y sirve una sola vez.
                </span>
              </div>
            </div>

            {/* Drag Handle */}
            <div className="flex items-center justify-center w-full" style={{ height: '18px', flexShrink: 0, background: 'rgb(244, 247, 251)' }}>
              <div style={{ width: '100px', height: '4px', borderRadius: '3px', background: 'rgba(0, 0, 0, 0.18)' }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
