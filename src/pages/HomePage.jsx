// ==============================================================================
// Página Principal: Landing Mobile-First Pulida (HomePage.jsx)
// ==============================================================================

// Importación de React y hooks de estado/ciclo de vida
import React, { useState, useEffect } from 'react';
// Hook de navegación de React Router
import { useNavigate } from 'react-router-dom';
// Utilidades de animación fluida para móvil
import { motion, AnimatePresence } from 'framer-motion';
// Iconografía temática de la interfaz
import { ShieldCheck, Sparkles, Clock, Lock, ArrowLeft } from 'lucide-react';
// Hooks de estado global
import { useAuth } from '../hooks/useAuth';
import { useOnboarding } from '../hooks/useOnboarding';
// Componentes visuales y de marca
import { Logo } from '../components/common/Logo';
import { Button } from '../components/common/Button';
import { LoginForm } from '../components/auth/LoginForm';
import { RegisterForm } from '../components/auth/RegisterForm';
// Notificaciones emergentes
import { toast } from 'sonner';

export const HomePage = () => {
  const { isAuthenticated, loading } = useAuth();
  const { onboardingStatus, setRegistered } = useOnboarding();
  const navigate = useNavigate();

  // Estado para controlar qué formulario está activo ('login' | 'register' | null)
  const [activeForm, setActiveForm] = useState(null);

  // Detectar y notificar errores provenientes de OAuth (ej. signups_disabled)
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
      // Limpiar los parámetros de la URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Redirigir automáticamente si el usuario ya inició sesión (ej. tras redirección de Google OAuth)
  useEffect(() => {
    if (!loading && isAuthenticated) {
      if (onboardingStatus === 'completed') {
        navigate('/map', { replace: true });
      } else {
        if (onboardingStatus === 'new') {
          setRegistered();
        }
        navigate('/permisos', { replace: true });
      }
    }
  }, [isAuthenticated, loading, onboardingStatus, navigate, setRegistered]);

  return (
    <div className="min-h-[100dvh] w-full bg-surface-muted flex flex-col justify-between items-center px-4.5 sm:px-6 pt-5 pb-6 safe-top safe-bottom overflow-x-hidden">
      <div className="w-full max-w-md mx-auto flex flex-col items-center flex-1 justify-center">
        <AnimatePresence mode="wait">
          {/* VISTA 1: LANDING PRINCIPAL (Hero, 3 Beneficios y Botones) */}
          {activeForm === null ? (
            <motion.div
              key="landing-view"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="w-full flex flex-col items-center text-center my-auto"
            >
              {/* 1. Header de Marca con Logo Oficial */}
              <header className="mb-4 flex flex-col items-center gap-2">
                <Logo size="lg" showText={false} />
                <h1 className="text-3xl font-extrabold tracking-tight text-content-primary">
                  Reportalo
                </h1>
                <p className="text-sm font-semibold text-primary tracking-wide">
                  Tu ciudad. Tu voz.
                </p>
              </header>

              {/* 2. Mensaje Principal de Propuesta de Valor */}
              <div className="mb-5 max-w-xs">
                <p className="text-sm md:text-base text-content-secondary leading-relaxed font-medium">
                  Reportá lo que ves en tu ciudad, con evidencia verificada y tu identidad protegida.
                </p>
              </div>

              {/* 3. Propuesta de Valor (3 Beneficios Clave con Tarjetas Modernas) */}
              <div className="w-full flex flex-col gap-2.5 my-1 text-left">
                {/* Beneficio 1: Privacidad */}
                <div className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-start gap-3.5 transition-all hover:border-slate-300">
                  <div className="w-9 h-9 rounded-xl bg-primary-light text-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                    <ShieldCheck className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-content-primary leading-tight">
                      Tu identidad protegida
                    </h2>
                    <p className="text-xs text-content-secondary mt-0.5 leading-snug">
                      Tus datos personales no se comparten innecesariamente con el organismo receptor.
                    </p>
                  </div>
                </div>

                {/* Beneficio 2: Inteligencia Artificial */}
                <div className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-start gap-3.5 transition-all hover:border-slate-300">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Sparkles className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-content-primary leading-tight">
                      La IA encuentra a quién corresponde
                    </h2>
                    <p className="text-xs text-content-secondary mt-0.5 leading-snug">
                      Reportalo analiza el caso para ayudarte a encontrar el área municipal correcta.
                    </p>
                  </div>
                </div>

                {/* Beneficio 3: Trazabilidad */}
                <div className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-start gap-3.5 transition-all hover:border-slate-300">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Clock className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-content-primary leading-tight">
                      Seguimiento hasta resolverse
                    </h2>
                    <p className="text-xs text-content-secondary mt-0.5 leading-snug">
                      Podés seguir el estado de tu reporte en tiempo real desde la aplicación.
                    </p>
                  </div>
                </div>
              </div>

              {/* 4. Botones Principales de Entrada */}
              <div className="w-full flex flex-col gap-2.5 mt-5">
                <Button
                  variant="accent"
                  size="lg"
                  onClick={() => setActiveForm('register')}
                >
                  Registrarse
                </Button>

                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setActiveForm('login')}
                >
                  Iniciar sesión
                </Button>
              </div>
            </motion.div>
          ) : (
            /* VISTA 2: FORMULARIO DESPLEGADO HACIA ARRIBA (Login / Registro) */
            <motion.div
              key="form-view"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="w-full flex flex-col my-auto"
            >
              {/* Barra Superior con botón Volver y Logo Oficial */}
              <div className="flex items-center justify-between mb-3 w-full px-0.5">
                <button
                  type="button"
                  onClick={() => setActiveForm(null)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200/80 px-3 py-2 rounded-xl transition-all active:scale-95 cursor-pointer shadow-2xs"
                  aria-label="Volver a la pantalla principal"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Volver</span>
                </button>

                <Logo size="sm" showText={true} />
              </div>

              {/* Contenedor del Formulario Activo */}
              <div className="p-5 md:p-6 bg-white rounded-3xl border border-slate-200/80 shadow-md w-full">
                {activeForm === 'login' ? (
                  <LoginForm onSwitchToRegister={() => setActiveForm('register')} />
                ) : (
                  <RegisterForm onSwitchToLogin={() => setActiveForm('login')} />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 5. Microcopy Inferior de Privacidad */}
      <footer className="mt-4 flex items-center justify-center gap-1.5 text-xs text-content-tertiary">
        <Lock className="w-3.5 h-3.5 text-content-secondary" />
        <span className="font-medium">Tu privacidad es parte del diseño.</span>
      </footer>
    </div>
  );
};
