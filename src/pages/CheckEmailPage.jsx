import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';

export const CheckEmailPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signInWithMagicLink } = useAuth();

  // Obtener el email dinámicamente desde el estado de navegación o query params
  const emailParam = new URLSearchParams(location.search).get('email');
  const userEmail = location.state?.email || emailParam || 'tu correo';

  // Temporizador de cuenta regresiva (inicia en 45 segundos según mockup)
  const [countdown, setCountdown] = useState(45);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (countdown <= 0) return;

    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown]);

  // Retornar a la pantalla de login
  const handleGoBack = () => {
    navigate('/login');
  };

  // Reenviar el Magic Link
  const handleResend = async () => {
    if (countdown > 0 || isResending) return;
    if (!userEmail || userEmail === 'tu correo') {
      navigate('/login');
      return;
    }

    setIsResending(true);
    try {
      const { error } = await signInWithMagicLink(userEmail);
      if (!error) {
        toast.success('¡Nuevo enlace enviado! Revisá tu bandeja de entrada.');
        setCountdown(60);
      }
    } finally {
      setIsResending(false);
    }
  };

  // Abrir cliente de correo nativo o webmail
  const handleOpenEmailApp = () => {
    // Si es un dominio popular, podemos ofrecer sugerencia o disparar mailto
    const domain = userEmail.includes('@') ? userEmail.split('@')[1].toLowerCase() : '';

    if (domain === 'gmail.com') {
      window.open('https://mail.google.com', '_blank', 'noopener,noreferrer');
    } else if (domain === 'outlook.com' || domain === 'hotmail.com' || domain === 'live.com') {
      window.open('https://outlook.live.com', '_blank', 'noopener,noreferrer');
    } else if (domain === 'yahoo.com') {
      window.open('https://mail.yahoo.com', '_blank', 'noopener,noreferrer');
    } else {
      window.location.href = 'mailto:';
    }
  };

  // Formato del tiempo mm:ss
  const formattedTime = `0:${countdown < 10 ? '0' : ''}${countdown}`;

  return (
    <div className="min-h-[100dvh] w-full font-manrope select-none flex flex-col bg-[#F4F7FB] md:bg-white">
      
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
            Volver a opciones de acceso
          </button>
        </div>
      </header>

      {/* Contenedor principal responsive */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-[100dvh] md:min-h-0">
        
        {/* Columna Principal / Vista 'Revisá tu correo' */}
        <main className="flex-1 flex flex-col px-6 md:px-12 lg:px-16 pt-[max(env(safe-area-inset-top),12px)] md:pt-10 pb-[max(env(safe-area-inset-bottom),16px)] md:pb-10 justify-between md:justify-center md:items-center">
          
          {/* Botón de retroceso en móvil (< md) */}
          <div className="w-full max-w-[420px] mx-auto md:hidden">
            <button
              onClick={handleGoBack}
              type="button"
              aria-label="Volver a la pantalla de login"
              className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-[#5B6A7A] hover:bg-slate-200/60 active:scale-95 transition-all cursor-pointer border-0 bg-transparent"
            >
              <span className="material-symbols-rounded text-[22px]">
                arrow_back
              </span>
            </button>
          </div>

          {/* Tarjeta central de confirmación con animación */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="w-full max-w-[340px] md:max-w-[420px] mx-auto flex flex-col items-center justify-center text-center my-auto pb-4"
          >
            {/* Icono central de buzón / email enviado */}
            <div className="w-[82px] h-[82px] rounded-[26px] bg-[#E8F1FB] flex items-center justify-center mb-[22px] shadow-sm">
              <span className="material-symbols-rounded filled text-[42px] text-[#1E6FCB]">
                forward_to_inbox
              </span>
            </div>

            {/* Título */}
            <h1 className="font-extrabold text-[22px] md:text-[28px] text-[#243447] tracking-[-0.4px] leading-tight m-0">
              Revisá tu correo
            </h1>

            {/* Bajada con email en tiempo real */}
            <p className="font-medium text-[13px] md:text-[14px] leading-[1.55] text-[#7A8696] mt-2 mb-0">
              Te enviamos un enlace de acceso a
            </p>
            <div className="font-extrabold text-[13.5px] md:text-[15px] text-[#1E6FCB] mt-[3px] break-all max-w-[300px]">
              {userEmail}
            </div>

            <p className="font-medium text-[12.5px] md:text-[13px] leading-[1.5] text-[#8593A2] mt-3.5 max-w-[230px] md:max-w-[280px]">
              Tocá el enlace desde este teléfono y entrás directo.
            </p>

            {/* Botón: Abrir mi correo */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleOpenEmailApp}
              type="button"
              className="mt-[26px] w-full bg-[#1E6FCB] text-white rounded-[14px] py-[15px] px-5 text-center font-extrabold text-[15px] shadow-[0px_8px_18px_rgba(30,111,203,0.3)] hover:bg-[#15539E] cursor-pointer border-0 transition-colors"
            >
              Abrir mi correo
            </motion.button>

            {/* Temporizador de reenvío / Acción de reenvío */}
            <div className="mt-3.5 flex items-center justify-center gap-1.5 min-h-[28px]">
              {countdown > 0 ? (
                <>
                  <span className="material-symbols-rounded text-[15px] text-[#AAB4BF]">
                    schedule
                  </span>
                  <span className="font-bold text-[12.5px] text-[#9AA7B5]">
                    Reenviar en {formattedTime}
                  </span>
                </>
              ) : (
                <button
                  onClick={handleResend}
                  disabled={isResending}
                  type="button"
                  className="font-bold text-[13px] text-[#1E6FCB] hover:text-[#15539E] cursor-pointer bg-transparent border-0 underline transition-colors disabled:opacity-50"
                >
                  {isResending ? 'Enviando nuevo enlace...' : 'Reenviar enlace de acceso'}
                </button>
              )}
            </div>
          </motion.div>

          {/* Tarjeta inferior informativa: Vencimiento en 15 min */}
          <div className="w-full max-w-[340px] md:max-w-[420px] mx-auto mb-2 flex items-start gap-2 bg-white border border-[#E6ECF3] rounded-[12px] p-[11px_12px] shadow-sm text-left">
            <span className="material-symbols-rounded text-[17px] text-[#8593A2] flex-shrink-0 mt-[1px]">
              info
            </span>
            <span className="font-medium text-[11px] leading-[1.45] text-[#6A7888]">
              El enlace vence en 15 minutos y sirve una sola vez.
            </span>
          </div>

        </main>

        {/* Sidebar desktop (>= md) armonizada con el resto de la app */}
        <aside className="hidden md:flex w-[380px] lg:w-[420px] flex-shrink-0 bg-[#F4F7FB] border-l border-[#EEF1F5] p-8 flex-col justify-between gap-4">
          <div>
            <div className="font-extrabold text-[11px] text-[#8593A2] tracking-[0.5px] mb-4 uppercase">
              Cómo ingresar con Magic Link
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
                    Revisá tu bandeja de entrada
                  </div>
                  <div className="font-medium text-[11px] leading-[1.45] text-[#7A8696] mt-0.5">
                    Buscá el correo enviado por Reportalo (si no lo ves, chequeá la carpeta de Spam).
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
                    Hacé clic en el enlace
                  </div>
                  <div className="font-medium text-[11px] leading-[1.45] text-[#7A8696] mt-0.5">
                    El botón dentro del email te redirigirá de manera segura a la plataforma.
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
                    Acceso instantáneo y seguro
                  </div>
                  <div className="font-medium text-[11px] leading-[1.45] text-[#7A8696] mt-0.5">
                    Tu sesión quedará iniciada automáticamente sin contraseñas.
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
              Tu identidad se mantiene resguardada ante el municipio al reportar.
            </span>
          </div>
        </aside>

      </div>

    </div>
  );
};
