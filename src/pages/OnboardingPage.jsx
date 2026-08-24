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
    iconColor: 'rgb(30, 111, 203)',
    illustrationBg: 'rgb(238, 243, 249)',
    illustrationBorder: 'rgb(230, 236, 243)',
    illustrationLabel: 'ILUSTRACIÓN · foto de un incidente',
    title: 'Una foto es un reclamo',
    description: 'Sacás la foto de lo que está mal en tu barrio y Reportalo la convierte en un reclamo formal ante quien tiene que resolverlo.',
    buttonLabel: 'Siguiente',
    saltarColor: 'rgb(154, 167, 181)',
  },
  {
    id: 2,
    icon: 'blur_on',
    iconColor: 'rgb(46, 158, 107)',
    illustrationBg: 'rgb(233, 245, 239)',
    illustrationBorder: 'rgb(213, 235, 224)',
    showBlurDemo: true,
    title: 'Tu foto se protege sola',
    description: 'Los rostros y las patentes se difuminan automáticamente antes de guardarse. La imagen original nunca se almacena.',
    buttonLabel: 'Siguiente',
    saltarColor: 'rgb(154, 167, 181)',
  },
  {
    id: 3,
    showTracker: true,
    illustrationBg: 'rgb(238, 243, 249)',
    illustrationBorder: 'rgb(230, 236, 243)',
    title: 'Seguí cada reporte',
    description: 'Vas viendo en qué estado está tu reclamo, quién lo tiene que resolver y qué fundamento legal lo respalda.',
    buttonLabel: 'Empezar',
    saltarColor: 'rgb(221, 228, 236)',
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
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col" style={{ padding: '8px 24px 0px' }}>
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
                className="cursor-pointer"
                style={{
                  fontFamily: '700 14px Manrope',
                  color: step.saltarColor,
                  fontSize: '14px',
                  fontWeight: 700,
                  background: 'none',
                  border: 'none',
                  padding: '6px 0',
                }}
              >
                Saltar
              </button>
            </div>

            {/* Ilustración */}
            <div
              className="flex flex-col items-center justify-center"
              style={{
                marginTop: '16px',
                height: '280px',
                borderRadius: '22px',
                background: step.illustrationBg,
                border: `1px solid ${step.illustrationBorder}`,
                gap: step.showBlurDemo ? '16px' : '14px',
                padding: step.showTracker ? '0 28px' : '0',
              }}
            >
              {step.showBlurDemo ? (
                <>
                  <span className="material-symbols-rounded filled" style={{ fontSize: '58px', color: step.iconColor }}>{step.icon}</span>
                  <div className="flex items-center" style={{ gap: '10px', background: 'rgb(255, 255, 255)', borderRadius: '12px', padding: '10px 14px', boxShadow: 'rgba(20, 40, 80, 0.08) 0px 3px 10px' }}>
                    <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'repeating-linear-gradient(45deg, rgb(201, 213, 226) 0px, rgb(201, 213, 226) 3px, rgb(226, 233, 240) 3px, rgb(226, 233, 240) 6px)' }} />
                    <span className="material-symbols-rounded" style={{ fontSize: '18px', color: step.iconColor }}>arrow_forward</span>
                    <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgb(227, 245, 236)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="material-symbols-rounded filled" style={{ fontSize: '18px', color: step.iconColor }}>shield</span>
                    </div>
                  </div>
                </>
              ) : step.showTracker ? (
                <div className="flex flex-col">
                  <div className="flex items-center" style={{ gap: '12px' }}>
                    <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgb(46, 158, 107)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="material-symbols-rounded" style={{ fontSize: '14px', color: 'rgb(255, 255, 255)' }}>check</span>
                    </div>
                    <span style={{ fontFamily: '700 14px Manrope', color: 'rgb(52, 67, 90)', fontSize: '14px', fontWeight: 700 }}>Enviado</span>
                  </div>
                  <div style={{ width: '2px', height: '14px', background: 'rgb(207, 216, 226)', marginLeft: '10px' }} />
                  <div className="flex items-center" style={{ gap: '12px' }}>
                    <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgb(30, 111, 203)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="material-symbols-rounded" style={{ fontSize: '14px', color: 'rgb(255, 255, 255)' }}>visibility</span>
                    </div>
                    <span style={{ fontFamily: '700 14px Manrope', color: 'rgb(52, 67, 90)', fontSize: '14px', fontWeight: 700 }}>En revisión</span>
                  </div>
                  <div style={{ width: '2px', height: '14px', background: 'rgb(207, 216, 226)', marginLeft: '10px' }} />
                  <div className="flex items-center" style={{ gap: '12px' }}>
                    <div style={{ width: '22px', height: '22px', borderRadius: '50%', border: '2px solid rgb(207, 216, 226)' }} />
                    <span style={{ fontFamily: '700 14px Manrope', color: 'rgb(154, 167, 181)', fontSize: '14px', fontWeight: 700 }}>Notificado</span>
                  </div>
                  <div style={{ width: '2px', height: '14px', background: 'rgb(207, 216, 226)', marginLeft: '10px' }} />
                  <div className="flex items-center" style={{ gap: '12px' }}>
                    <div style={{ width: '22px', height: '22px', borderRadius: '50%', border: '2px solid rgb(207, 216, 226)' }} />
                    <span style={{ fontFamily: '700 14px Manrope', color: 'rgb(154, 167, 181)', fontSize: '14px', fontWeight: 700 }}>Resuelto</span>
                  </div>
                </div>
              ) : (
                <>
                  <span className="material-symbols-rounded filled" style={{ fontSize: '58px', color: step.iconColor }}>{step.icon}</span>
                  <span style={{ fontFamily: '600 12px Manrope', color: 'rgb(154, 167, 181)', letterSpacing: '0.4px', fontSize: '12px', fontWeight: 600 }}>{step.illustrationLabel}</span>
                </>
              )}
            </div>

            {/* Título */}
            <div style={{ fontFamily: '800 28px Manrope', color: 'rgb(36, 52, 71)', marginTop: '32px', letterSpacing: '-0.5px', fontSize: '28px', fontWeight: 800, lineHeight: 1.15 }}>
              {step.title}
            </div>

            {/* Descripción */}
            <div style={{ fontFamily: '500 15px / 1.6 Manrope', color: 'rgb(122, 134, 150)', marginTop: '12px', fontSize: '15px', fontWeight: 500, lineHeight: 1.6 }}>
              {step.description}
            </div>

            {/* Bottom: Indicadores + Botón */}
            <div className="mt-auto" style={{ paddingBottom: '20px' }}>
              {/* Indicadores de progreso */}
              <div className="flex items-center justify-center" style={{ gap: '8px', marginBottom: '18px' }}>
                {STEPS.map((_, i) => (
                  <span
                    key={i}
                    style={{
                      width: i === currentStep ? '26px' : '8px',
                      height: '8px',
                      borderRadius: '4px',
                      background: i === currentStep ? 'rgb(30, 111, 203)' : 'rgb(221, 228, 236)',
                      transition: 'all 0.2s ease',
                    }}
                  />
                ))}
              </div>

              {/* Botón */}
              <button
                type="button"
                onClick={handleNext}
                className="w-full cursor-pointer transition-all duration-150 active:scale-[0.98]"
                style={{
                  background: 'rgb(30, 111, 203)',
                  borderRadius: '16px',
                  padding: '18px',
                  textAlign: 'center',
                  border: 'none',
                  boxShadow: 'rgba(30, 111, 203, 0.3) 0px 8px 18px',
                }}
              >
                <span style={{ fontFamily: '800 17px Manrope', color: 'rgb(255, 255, 255)', fontSize: '17px', fontWeight: 800 }}>
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
