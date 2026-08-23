// ==============================================================================
// Página Principal: Landing con Colapso de Autenticación (HomePage.jsx)
// ==============================================================================

import React, { useState } from 'react';
import { ShieldCheck, Sparkles, Clock, MapPin, Lock } from 'lucide-react';
import { Logo } from '../components/common/Logo';
import { Button } from '../components/common/Button';
import { AuthCollapse } from '../components/auth/AuthCollapse';

export const HomePage = () => {
  // Estado para controlar qué formulario está desplegado ('login' | 'register' | null)
  const [activeForm, setActiveForm] = useState(null);

  const toggleForm = (formType) => {
    setActiveForm((prev) => (prev === formType ? null : formType));
  };

  return (
    <div className="min-h-screen w-full bg-surface-muted flex flex-col justify-between items-center px-5 pt-8 pb-6 safe-top safe-bottom">
      <div className="w-full max-w-md mx-auto flex flex-col items-center text-center">
        {/* 1. Header & Logo */}
        <header className="mb-6 flex flex-col items-center gap-2">
          <Logo size="lg" showText={false} />
          <h1 className="text-3xl font-extrabold tracking-tight text-content-primary">
            Reportalo
          </h1>
          <p className="text-sm font-semibold text-primary tracking-wide">
            Tu ciudad. Tu voz.
          </p>
        </header>

        {/* 2. Hero Message */}
        <div className="mb-6 max-w-xs">
          <p className="text-base text-content-secondary leading-relaxed">
            Reportá lo que ves en tu ciudad, con evidencia verificada y tu identidad protegida.
          </p>
        </div>

        {/* 3. Propuesta de Valor (3 Beneficios Clave) */}
        <div className="w-full flex flex-col gap-3 my-2 text-left">
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

        {/* 4. Botones de Activación del Colapso */}
        <div className="w-full flex flex-col gap-3 mt-6">
          <Button
            variant="accent"
            size="lg"
            onClick={() => toggleForm('register')}
          >
            Registrarse
          </Button>

          <Button
            variant="outline"
            size="lg"
            onClick={() => toggleForm('login')}
          >
            Iniciar sesión
          </Button>
        </div>

        {/* 5. Colapso Animado de Autenticación */}
        <AuthCollapse
          activeForm={activeForm}
          onSwitchForm={(form) => setActiveForm(form)}
          onClose={() => setActiveForm(null)}
        />
      </div>

      {/* 6. Microcopy Inferior de Privacidad */}
      <footer className="mt-8 flex items-center justify-center gap-1.5 text-xs text-content-tertiary">
        <Lock className="w-3.5 h-3.5 text-content-secondary" />
        <span>Tu privacidad es parte del diseño.</span>
      </footer>
    </div>
  );
};
