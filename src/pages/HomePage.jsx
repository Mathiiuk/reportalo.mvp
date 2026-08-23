// ==============================================================================
// Página Principal: Landing Mobile-First con Transición Deslizable (HomePage.jsx)
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Sparkles, Clock, Lock, ArrowLeft, MapPin } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useOnboarding } from '../hooks/useOnboarding';
import { Logo } from '../components/common/Logo';
import { Button } from '../components/common/Button';
import { LoginForm } from '../components/auth/LoginForm';
import { RegisterForm } from '../components/auth/RegisterForm';

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
    <div className="min-h-screen w-full bg-surface-muted flex flex-col justify-between items-center px-5 pt-6 pb-6 safe-top safe-bottom overflow-x-hidden">
      <div className="w-full max-w-md mx-auto flex flex-col items-center">
        <AnimatePresence mode="wait">
          {/* VISTA 1: LANDING PRINCIPAL (Hero, 3 Beneficios y Botones) */}
          {activeForm === null ? (
            <motion.div
              key="landing-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
              className="w-full flex flex-col items-center text-center"
            >
              {/* 1. Header & Logo */}
              <header className="mb-5 flex flex-col items-center gap-2 mt-2">
                <Logo size="lg" showText={false} />
                <h1 className="text-3xl font-extrabold tracking-tight text-content-primary">
                  Reportalo
                </h1>
                <p className="text-sm font-semibold text-primary tracking-wide">
                  Tu ciudad. Tu voz.
                </p>
              </header>

              {/* 2. Hero Message */}
              <div className="mb-5 max-w-xs">
                <p className="text-base text-content-secondary leading-relaxed">
                  Reportá lo que ves en tu ciudad, con evidencia verificada y tu identidad protegida.
                </p>
              </div>

              {/* 3. Propuesta de Valor (3 Beneficios Clave) */}
              <div className="w-full flex flex-col gap-3 my-1 text-left">
                {/* Beneficio 1 */}
                <div className="p-3.5 bg-white rounded-2xl border border-slate-100 shadow-card flex items-start gap-3.5">
                  <div className="p-2 rounded-xl bg-primary-light text-primary flex-shrink-0 mt-0.5">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-content-primary">
                      Tu identidad protegida
                    </h2>
                    <p className="text-xs text-content-secondary mt-0.5 leading-snug">
                      Tus datos personales no se comparten innecesariamente con el organismo receptor.
                    </p>
                  </div>
                </div>

                {/* Beneficio 2 */}
                <div className="p-3.5 bg-white rounded-2xl border border-slate-100 shadow-card flex items-start gap-3.5">
                  <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 flex-shrink-0 mt-0.5">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-content-primary">
                      La IA encuentra a quién corresponde
                    </h2>
                    <p className="text-xs text-content-secondary mt-0.5 leading-snug">
                      Reportalo analiza el caso para ayudarte a encontrar el área municipal correcta.
                    </p>
                  </div>
                </div>

                {/* Beneficio 3 */}
                <div className="p-3.5 bg-white rounded-2xl border border-slate-100 shadow-card flex items-start gap-3.5">
                  <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 flex-shrink-0 mt-0.5">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-content-primary">
                      Seguimiento hasta resolverse
                    </h2>
                    <p className="text-xs text-content-secondary mt-0.5 leading-snug">
                      Podés seguir el estado de tu reporte en tiempo real desde la aplicación.
                    </p>
                  </div>
                </div>
              </div>

              {/* 4. Botones Principales de Entrada */}
              <div className="w-full flex flex-col gap-3 mt-6">
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
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="w-full flex flex-col"
            >
              {/* Barra Superior con botón Volver y Logo */}
              <div className="flex items-center justify-between mb-4 w-full">
                <button
                  type="button"
                  onClick={() => setActiveForm(null)}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-content-primary hover:text-primary p-2 -ml-2 rounded-xl active:bg-slate-100 transition-colors touch-target cursor-pointer"
                  aria-label="Volver a la pantalla principal"
                >
                  <ArrowLeft className="w-5 h-5" />
                  <span>Volver</span>
                </button>

                <div className="flex items-center gap-1.5 text-primary font-bold text-sm">
                  <MapPin className="w-4 h-4" />
                  <span>Reportalo</span>
                </div>
              </div>

              {/* Contenedor del Formulario Activo */}
              <div className="p-5 md:p-6 bg-white rounded-3xl border border-slate-100 shadow-xl w-full">
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
      <footer className="mt-8 flex items-center justify-center gap-1.5 text-xs text-content-tertiary">
        <Lock className="w-3.5 h-3.5 text-content-secondary" />
        <span>Tu privacidad es parte del diseño.</span>
      </footer>
    </div>
  );
};
