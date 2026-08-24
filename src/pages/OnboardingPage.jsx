// ==============================================================================
// Página de Onboarding: 3 pantallas explicativas (OnboardingPage.jsx)
// ==============================================================================

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const STEPS = [
  {
    id: 1,
    icon: 'add_a_photo',
    iconColor: 'text-[#1E6FCB]',
    illustrationBg: 'bg-[#EEF3F9]',
    illustrationBorder: 'border-[#E6ECF3]',
    illustrationLabel: 'ILUSTRACIÓN · foto de un incidente',
    title: 'Una foto es un reclamo',
    description: 'Sacás la foto de lo que está mal en tu barrio y Reportalo la convierte en un reclamo formal ante quien tiene que resolverlo.',
    buttonLabel: 'Siguiente',
    saltarColor: 'text-[#9AA7B5]',
  },
  {
    id: 2,
    icon: 'blur_on',
    iconColor: 'text-[#2E9E6B]',
    illustrationBg: 'bg-[#E9F5EF]',
    illustrationBorder: 'border-[#D5EBE0]',
    showBlurDemo: true,
    title: 'Tu foto se protege sola',
    description: 'Los rostros y las patentes se difuminan automáticamente antes de guardarse. La imagen original nunca se almacena.',
    buttonLabel: 'Siguiente',
    saltarColor: 'text-[#9AA7B5]',
  },
  {
    id: 3,
    showTracker: true,
    illustrationBg: 'bg-[#EEF3F9]',
    illustrationBorder: 'border-[#E6ECF3]',
    title: 'Seguí cada reporte',
    description: 'Vas viendo en qué estado está tu reclamo, quién lo tiene que resolver y qué fundamento legal lo respalda.',
    buttonLabel: 'Empezar',
    saltarColor: 'text-[#DDE4EC]',
  },
];

export const OnboardingPage = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);

  const step = STEPS[currentStep];
  const isLast = currentStep === STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      navigate('/terminos', { replace: true });
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleSkip = () => {
    navigate('/terminos', { replace: true });
  };

  return (
    <div className="min-h-[100dvh] w-full bg-white flex flex-col safe-top safe-bottom">
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col px-6 pt-2">
        <AnimatePresence mode="wait">
          <motion.div
            key={step.id}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25 }}
            className="flex-1 flex flex-col"
          >
            {/* Saltar */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSkip}
                className={`cursor-pointer font-bold text-sm bg-transparent border-none py-1.5 px-0 ${step.saltarColor}`}
              >
                Saltar
              </button>
            </div>

            {/* Ilustración */}
            <div
              className={`flex flex-col items-center justify-center mt-4 h-[280px] rounded-[22px] border ${step.illustrationBg} ${step.illustrationBorder} ${step.showBlurDemo ? 'gap-4' : 'gap-3.5'} ${step.showTracker ? 'px-7' : ''}`}
            >
              {step.showBlurDemo ? (
                <>
                  <span className={`material-symbols-rounded filled text-[58px] ${step.iconColor}`}>{step.icon}</span>
                  <div className="flex items-center gap-2.5 bg-white rounded-xl p-3.5 shadow-[0_3px_10px_rgba(20,40,80,0.08)]">
                    <div className="w-[30px] h-[30px] rounded-lg bg-[repeating-linear-gradient(45deg,#C9D5E2_0px,#C9D5E2_3px,#E2E9F0_3px,#E2E9F0_6px)]" />
                    <span className={`material-symbols-rounded text-lg ${step.iconColor}`}>arrow_forward</span>
                    <div className="w-[30px] h-[30px] rounded-lg bg-[#E3F5EC] flex items-center justify-center">
                      <span className={`material-symbols-rounded filled text-lg ${step.iconColor}`}>shield</span>
                    </div>
                  </div>
                </>
              ) : step.showTracker ? (
                <div className="flex flex-col">
                  <div className="flex items-center gap-3">
                    <div className="w-[22px] h-[22px] rounded-full bg-[#2E9E6B] flex items-center justify-center">
                      <span className="material-symbols-rounded text-sm text-white">check</span>
                    </div>
                    <span className="text-sm font-bold text-[#34435A]">Enviado</span>
                  </div>
                  <div className="w-0.5 h-3.5 bg-[#CFD8E2] ml-[10px]" />
                  <div className="flex items-center gap-3">
                    <div className="w-[22px] h-[22px] rounded-full bg-[#1E6FCB] flex items-center justify-center">
                      <span className="material-symbols-rounded text-sm text-white">visibility</span>
                    </div>
                    <span className="text-sm font-bold text-[#34435A]">En revisión</span>
                  </div>
                  <div className="w-0.5 h-3.5 bg-[#CFD8E2] ml-[10px]" />
                  <div className="flex items-center gap-3">
                    <div className="w-[22px] h-[22px] rounded-full border-2 border-[#CFD8E2]" />
                    <span className="text-sm font-bold text-[#9AA7B5]">Notificado</span>
                  </div>
                  <div className="w-0.5 h-3.5 bg-[#CFD8E2] ml-[10px]" />
                  <div className="flex items-center gap-3">
                    <div className="w-[22px] h-[22px] rounded-full border-2 border-[#CFD8E2]" />
                    <span className="text-sm font-bold text-[#9AA7B5]">Resuelto</span>
                  </div>
                </div>
              ) : (
                <>
                  <span className={`material-symbols-rounded filled text-[58px] ${step.iconColor}`}>{step.icon}</span>
                  <span className="text-xs font-semibold text-[#9AA7B5] tracking-wide">{step.illustrationLabel}</span>
                </>
              )}
            </div>

            {/* Título */}
            <h2 className="text-[28px] font-extrabold text-[#243447] mt-8 tracking-[-0.5px] leading-tight">
              {step.title}
            </h2>

            {/* Descripción */}
            <p className="text-[15px] font-medium text-[#7A8696] mt-3 leading-relaxed">
              {step.description}
            </p>

            {/* Bottom: Indicadores + Botón */}
            <div className="mt-auto pb-5">
              {/* Indicadores de progreso */}
              <div className="flex items-center justify-center gap-2 mb-[18px]">
                {STEPS.map((_, i) => (
                  <span
                    key={i}
                    className={`h-2 rounded-full transition-all duration-200 ${i === currentStep ? 'w-[26px] bg-[#1E6FCB]' : 'w-2 bg-[#DDE4EC]'}`}
                  />
                ))}
              </div>

              {/* Botón */}
              <button
                type="button"
                onClick={handleNext}
                className="w-full cursor-pointer transition-all duration-150 active:scale-[0.98] bg-[#1E6FCB] rounded-2xl py-[18px] text-center border-none shadow-[0_8px_18px_rgba(30,111,203,0.3)]"
              >
                <span className="font-extrabold text-[17px] text-white">
                  {step.buttonLabel}
                </span>
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
