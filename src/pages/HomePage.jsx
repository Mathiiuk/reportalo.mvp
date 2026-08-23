// ==============================================================================
// Página Principal: Landing y Flujo de Auth Minimalista (HomePage.jsx)
// ==============================================================================

// Importación de React y hooks de estado/ciclo de vida
import React, { useState, useEffect } from 'react';
// Hook de navegación de React Router
import { useNavigate } from 'react-router-dom';
// Animaciones sutiles y fluidas
import { motion, AnimatePresence } from 'framer-motion';
// Iconografía vectorial
import { ShieldCheck, Sparkles, Clock, Lock, ArrowLeft } from 'lucide-react';
// Hooks de autenticación y onboarding
import { useAuth } from '../hooks/useAuth';
import { useOnboarding } from '../hooks/useOnboarding';
// Componentes de acción y formularios
import { Button } from '../components/common/Button';
import { LoginForm } from '../components/auth/LoginForm';
import { RegisterForm } from '../components/auth/RegisterForm';
// Notificaciones Toast
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

  // Redirigir automáticamente si el usuario ya inició sesión
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
    <div className="min-h-[100dvh] w-full bg-white text-slate-900 flex flex-col items-center safe-top safe-bottom overflow-x-hidden">
      <div className="w-full max-w-md mx-auto min-h-[100dvh] flex flex-col justify-between px-6 pt-6 pb-6">
        <AnimatePresence mode="wait">
          {/* VISTA 1: LANDING PRINCIPAL CON LOGO PNG TRANSPARENTE EN GRANDE */}
          {activeForm === null ? (
            <motion.div
              key="landing-view"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="w-full flex flex-col justify-between flex-1 text-center"
            >
              {/* Sección Superior: Logo Grande sin fondo y Propuesta */}
              <div className="flex flex-col items-center pt-2">
                {/* Logo Oficial PNG Transparente y Recortado en Gran Escala */}
                <div className="my-2 flex items-center justify-center">
                  <img
                    src="/logo-icon.png"
                    alt="Logo Reportalo"
                    className="w-32 h-36 object-contain select-none transition-transform hover:scale-105 duration-200"
                  />
                </div>

                {/* Slogan Principal */}
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 mt-2">
                  Tu ciudad. Tu voz.
                </h1>
                <p className="text-sm text-slate-500 mt-1 max-w-xs font-normal">
                  Reportá lo que ves en tu ciudad, con evidencia verificada y tu identidad protegida.
                </p>

                {/* 3 Beneficios Directos sin Cajas Pesadas */}
                <div className="w-full flex flex-col gap-4 mt-8 text-left">
                  {/* Beneficio 1: Privacidad */}
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-2xl bg-sky-50 text-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                      <ShieldCheck className="w-5 h-5 stroke-[2.2]" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-slate-900 leading-tight">
                        Tu identidad protegida
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5 leading-snug">
                        Tus datos personales no se comparten con el organismo receptor.
                      </p>
                    </div>
                  </div>

                  {/* Beneficio 2: Inteligencia Artificial */}
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Sparkles className="w-5 h-5 stroke-[2.2]" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-slate-900 leading-tight">
                        La IA encuentra a quién corresponde
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5 leading-snug">
                        Analizamos el caso para derivarlo al área municipal correcta.
                      </p>
                    </div>
                  </div>

                  {/* Beneficio 3: Trazabilidad */}
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Clock className="w-5 h-5 stroke-[2.2]" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-slate-900 leading-tight">
                        Seguimiento en tiempo real
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5 leading-snug">
                        Seguí el estado de resolución de cada reporte en el mapa.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sección Inferior: Botones de Acción */}
              <div className="w-full flex flex-col gap-3 mt-8">
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

                {/* Microcopy Inferior de Privacidad */}
                <footer className="mt-4 flex items-center justify-center gap-1.5 text-xs text-slate-400">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-medium">Tu privacidad es parte del diseño.</span>
                </footer>
              </div>
            </motion.div>
          ) : (
            /* VISTA 2: FORMULARIO DIRECTO EN PANTALLA */
            <motion.div
              key="form-view"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.2 }}
              className="w-full flex flex-col justify-between flex-1"
            >
              <div className="w-full flex flex-col">
                {/* Barra Superior con botón Volver y Logo */}
                <header className="w-full flex items-center justify-between mb-4">
                  <button
                    type="button"
                    onClick={() => setActiveForm(null)}
                    className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 active:bg-slate-300 flex items-center justify-center text-slate-700 transition-all cursor-pointer"
                    aria-label="Volver"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>

                  <img
                    src="/logo-icon.png"
                    alt="Logo Reportalo"
                    className="w-7 h-8 object-contain select-none"
                  />
                </header>

                {/* Formulario Renderizado Directamente sobre la Superficie */}
                <div className="w-full">
                  {activeForm === 'login' ? (
                    <LoginForm onSwitchToRegister={() => setActiveForm('register')} />
                  ) : (
                    <RegisterForm onSwitchToLogin={() => setActiveForm('login')} />
                  )}
                </div>
              </div>

              {/* Microcopy Inferior */}
              <footer className="mt-6 flex items-center justify-center gap-1.5 text-xs text-slate-400">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-medium">Tu privacidad es parte del diseño.</span>
              </footer>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
