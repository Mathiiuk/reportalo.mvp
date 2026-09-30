import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import { ArrowLeft, MailCheck, Clock, Info } from 'lucide-react';
import { useIsDesktopLayout } from '../hooks/useMediaQuery';
import { BrandBar } from '../components/layout/BrandBar';

export const CheckEmailPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signInWithMagicLink } = useAuth();
  // D03 (UJ v3.3, REP-3791 Bloque 11-C): en escritorio, tarjeta centrada y la línea cambia a
  // «Abrilo en esta misma computadora»; sin columna lateral.
  const isDesktop = useIsDesktopLayout();

  // Obtener el email dinámicamente desde el estado de navegación o query params
  const emailParam = new URLSearchParams(location.search).get('email');
  const userEmail = location.state?.email || emailParam || 'tu correo';

  // UJ v3.3 · M03: reenvío con cuenta regresiva de 60 s para evitar abuso.
  // Antes arrancaba en 45 s, tomados de un mockup anterior.
  const [countdown, setCountdown] = useState(60);
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
  const formattedTime = `${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, '0')}`;

  return (
    <div className="min-h-[100dvh] w-full font-manrope select-none flex flex-col bg-rep-bg">
      {isDesktop && <BrandBar />}

      <div className="flex-1 flex flex-col overflow-hidden min-h-[100dvh] desktop:min-h-0">
        
        {/* Columna Principal / Vista 'Revisá tu correo' */}
        <main className="flex-1 flex flex-col px-6 pt-[max(env(safe-area-inset-top),12px)] pb-[max(env(safe-area-inset-bottom),16px)] justify-between desktop:justify-center desktop:items-center desktop:px-10 desktop:py-12">
          
          {/* Botón de retroceso: solo en el teléfono (M03) */}
          {!isDesktop && (
          <div className="w-full max-w-[420px] mx-auto">
            <button
              onClick={handleGoBack}
              type="button"
              aria-label="Volver a la pantalla de login"
              className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-rep-ink-label hover:bg-slate-200/60 active:scale-95 transition-all cursor-pointer border-0 bg-transparent"
            >
              <ArrowLeft className="w-[22px] h-[22px]" strokeWidth={2.25} />
            </button>
          </div>
          )}

          {/* Tarjeta central de confirmación con animación */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="w-full max-w-[340px] mx-auto flex flex-col items-center justify-center text-center my-auto pb-4 desktop:my-0 desktop:max-w-[400px] desktop:rounded-3xl desktop:border desktop:border-rep-border desktop:bg-rep-surface desktop:p-8 desktop:shadow-rep-float"
          >
            {/* Icono central de buzón / email enviado */}
            <div className="w-[82px] h-[82px] rounded-[26px] bg-rep-accent-soft flex items-center justify-center mb-[22px] shadow-sm">
              <MailCheck className="w-[42px] h-[42px] text-rep-accent" strokeWidth={1.75} />
            </div>

            {/* Título */}
            <h1 className="font-extrabold text-[22px] desktop:text-[24px] text-rep-ink tracking-[-0.4px] leading-tight m-0">
              Revisá tu correo
            </h1>

            {/* Bajada con email en tiempo real */}
            <p className="font-medium text-[13px] desktop:text-[14px] leading-[1.55] text-rep-ink-muted mt-2 mb-0">
              Te enviamos un enlace de acceso a
            </p>
            <div className="font-extrabold text-[13.5px] desktop:text-[15px] text-rep-accent mt-[3px] break-all max-w-[300px]">
              {userEmail}
            </div>

            <p className="font-medium text-[12.5px] desktop:text-[13px] leading-[1.5] text-rep-ink-muted mt-3.5 max-w-[230px] desktop:max-w-[280px]">
              {isDesktop
                ? 'Abrilo en esta misma computadora y entrás directo.'
                : 'Tocá el enlace desde este teléfono y entrás directo.'}
            </p>

            {/* Botón: Abrir mi correo */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleOpenEmailApp}
              type="button"
              className="mt-[26px] w-full bg-rep-accent text-white rounded-[14px] py-[15px] px-5 text-center font-extrabold text-[15px] shadow-[0px_8px_18px_rgba(30,111,203,0.3)] hover:bg-rep-accent-strong cursor-pointer border-0 transition-colors"
            >
              Abrir mi correo
            </motion.button>

            {/* Temporizador de reenvío / Acción de reenvío */}
            <div className="mt-3.5 flex items-center justify-center gap-1.5 min-h-[28px]">
              {countdown > 0 ? (
                <>
                  <Clock className="w-[15px] h-[15px] text-rep-ink-faint" strokeWidth={2.25} />
                  <span className="font-bold text-[12.5px] text-rep-ink-faint">
                    Reenviar en {formattedTime}
                  </span>
                </>
              ) : (
                <button
                  onClick={handleResend}
                  disabled={isResending}
                  type="button"
                  className="rep-focus min-h-touch font-bold text-[13px] text-rep-accent hover:text-rep-accent-strong cursor-pointer bg-transparent border-0 underline transition-colors disabled:opacity-50"
                >
                  {isResending ? 'Enviando nuevo enlace...' : 'Reenviar enlace de acceso'}
                </button>
              )}
            </div>

            {/* D03: el vencimiento del enlace va dentro de la tarjeta */}
            {isDesktop && (
              <div className="mt-4 flex w-full items-start gap-2 rounded-[12px] bg-rep-surface-sunken p-[11px_12px] text-left">
                <Info className="mt-[1px] h-[17px] w-[17px] flex-shrink-0 text-rep-ink-muted" strokeWidth={2.25} />
                <span className="text-[12px] font-medium leading-[1.45] text-rep-ink-muted">
                  El enlace vence en 15 minutos y sirve una sola vez.
                </span>
              </div>
            )}
          </motion.div>

          {/* Tarjeta inferior informativa: Vencimiento en 15 min (M03) */}
          {!isDesktop && (
          <div className="w-full max-w-[340px] mx-auto mb-2 flex items-start gap-2 bg-rep-surface border border-rep-border rounded-[12px] p-[11px_12px] shadow-sm text-left">
            <Info className="w-[17px] h-[17px] text-rep-ink-muted flex-shrink-0 mt-[1px]" strokeWidth={2.25} />
            <span className="font-medium text-[11px] leading-[1.45] text-rep-ink-muted">
              El enlace vence en 15 minutos y sirve una sola vez.
            </span>
          </div>
          )}

        </main>


      </div>

    </div>
  );
};
