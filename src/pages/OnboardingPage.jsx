import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

export const OnboardingPage = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);

  // Finalizar onboarding y continuar al flujo de términos y permisos
  const handleFinish = () => {
    try {
      localStorage.setItem('reportalo_onboarding_completed', 'true');
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
    // Tras el onboarding, se guía al usuario a aceptar los términos y permisos
    navigate('/terminos');
  };

  // Avanzar al siguiente paso
  const handleNext = () => {
    if (currentStep < 2) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleFinish();
    }
  };

  // Datos de los 3 pasos de onboarding
  const steps = [
    {
      id: 'step-1',
      title: 'Una foto es un reclamo',
      description:
        'Sacás la foto de lo que está mal en tu barrio y Reportalo la convierte en un reclamo formal ante quien tiene que resolverlo.',
      renderIllustration: () => (
        <div className="h-[250px] rounded-[20px] bg-[#EEF3F9] border border-[#E6ECF3] flex flex-col items-center justify-center gap-3 shadow-inner">
          <span className="material-symbols-rounded filled text-[52px] text-[#1E6FCB]">
            add_a_photo
          </span>
          <span className="font-semibold text-[10.5px] text-[#9AA7B5] tracking-[0.4px] uppercase">
            ILUSTRACIÓN · foto de un incidente
          </span>
        </div>
      ),
    },
    {
      id: 'step-2',
      title: 'Tu foto se protege sola',
      description:
        'Los rostros y las patentes se difuminan automáticamente antes de guardarse. La imagen original nunca se almacena.',
      renderIllustration: () => (
        <div className="h-[250px] rounded-[20px] bg-[#E9F5EF] border border-[#D5EBE0] flex flex-col items-center justify-center gap-3.5 shadow-inner">
          <span className="material-symbols-rounded filled text-[52px] text-[#2E9E6B]">
            blur_on
          </span>
          <div className="flex items-center gap-2 bg-white rounded-[10px] py-2 px-3 shadow-[0px_3px_10px_rgba(20,40,80,0.08)]">
            <span className="w-[26px] h-[26px] rounded-[7px] bg-[repeating-linear-gradient(45deg,#C9D5E2_0px,#C9D5E2_3px,#E2E9F0_3px,#E2E9F0_6px)] flex-shrink-0" />
            <span className="material-symbols-rounded text-[15px] text-[#2E9E6B]">
              arrow_forward
            </span>
            <span className="w-[26px] h-[26px] rounded-[7px] bg-[#E3F5EC] flex items-center justify-center font-['Material_Symbols_Rounded'] text-[15px] filled text-[#2E9E6B] flex-shrink-0">
              shield
            </span>
          </div>
        </div>
      ),
    },
    {
      id: 'step-3',
      title: 'Seguí cada reporte',
      description:
        'Vas viendo en qué estado está tu reclamo, quién lo tiene que resolver y qué fundamento legal lo respalda.',
      renderIllustration: () => (
        <div className="h-[250px] rounded-[20px] bg-[#EEF3F9] border border-[#E6ECF3] flex flex-col justify-center gap-2.5 px-7 shadow-inner text-left">
          {/* 1. Enviado */}
          <div className="flex items-center gap-2.5">
            <span className="w-[18px] h-[18px] rounded-full bg-[#2E9E6B] flex items-center justify-center text-white text-[12px] material-symbols-rounded flex-shrink-0">
              check
            </span>
            <span className="font-bold text-[12px] text-[#34435A]">
              Enviado
            </span>
          </div>
          <div className="w-[2px] h-[12px] bg-[#CFD8E2] ml-2 -my-1" />

          {/* 2. En revisión */}
          <div className="flex items-center gap-2.5">
            <span className="w-[18px] h-[18px] rounded-full bg-[#1E6FCB] flex items-center justify-center text-white text-[12px] material-symbols-rounded flex-shrink-0">
              visibility
            </span>
            <span className="font-bold text-[12px] text-[#34435A]">
              En revisión
            </span>
          </div>
          <div className="w-[2px] h-[12px] bg-[#CFD8E2] ml-2 -my-1" />

          {/* 3. Notificado */}
          <div className="flex items-center gap-2.5">
            <span className="w-[18px] h-[18px] rounded-full border-2 border-[#CFD8E2] flex-shrink-0" />
            <span className="font-bold text-[12px] text-[#9AA7B5]">
              Notificado
            </span>
          </div>
          <div className="w-[2px] h-[12px] bg-[#CFD8E2] ml-2 -my-1" />

          {/* 4. Resuelto */}
          <div className="flex items-center gap-2.5">
            <span className="w-[18px] h-[18px] rounded-full border-2 border-[#CFD8E2] flex-shrink-0" />
            <span className="font-bold text-[12px] text-[#9AA7B5]">
              Resuelto
            </span>
          </div>
        </div>
      ),
    },
  ];

  const current = steps[currentStep];

  return (
    <div className="min-h-[100dvh] w-full font-manrope select-none flex flex-col bg-white">
      
      {/* Header superior desktop (>= md) */}
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
          <span className="font-bold text-[9px] text-[#1E6FCB] bg-[#EEF5FC] px-2 py-1 rounded-[7px] ml-1 uppercase">
            CIUDADANOS
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-4">
          <button
            onClick={handleFinish}
            type="button"
            className="font-bold text-[13px] text-[#9AA7B5] hover:text-[#1E6FCB] px-3 py-2 cursor-pointer bg-transparent border-0 transition-colors"
          >
            Saltar onboarding
          </button>
        </div>
      </header>

      {/* Contenedor principal responsive */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-[100dvh] md:min-h-0">
        
        {/* Columna Principal / Onboarding */}
        <main className="flex-1 flex flex-col px-6 md:px-12 lg:px-16 pt-[max(env(safe-area-inset-top),10px)] md:pt-8 pb-[max(env(safe-area-inset-bottom),18px)] md:pb-10 justify-between items-center">
          
          {/* Barra superior de acción (Botón Saltar en móvil) */}
          <div className="w-full max-w-[340px] md:max-w-[440px] flex justify-end">
            {currentStep < 2 ? (
              <button
                onClick={handleFinish}
                type="button"
                className="font-bold text-[12.5px] text-[#9AA7B5] hover:text-[#1E6FCB] p-1 cursor-pointer bg-transparent border-0 transition-colors"
              >
                Saltar
              </button>
            ) : (
              <span className="font-bold text-[12.5px] text-[#DDE4EC] select-none p-1">
                Saltar
              </span>
            )}
          </div>

          {/* Tarjeta del paso con animación Framer Motion */}
          <div className="w-full max-w-[340px] md:max-w-[440px] my-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={current.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
                className="flex flex-col"
              >
                {/* Ilustración */}
                <div className="mt-2.5 md:mt-4">
                  {current.renderIllustration()}
                </div>

                {/* Título */}
                <h1 className="font-extrabold text-[24px] md:text-[28px] text-[#243447] mt-7 tracking-[-0.5px] leading-tight">
                  {current.title}
                </h1>

                {/* Descripción */}
                <p className="font-medium text-[13.5px] md:text-[14.5px] leading-[1.6] text-[#7A8696] mt-2.5">
                  {current.description}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Zona inferior: Paginador y Botón Siguiente/Empezar */}
          <div className="w-full max-w-[340px] md:max-w-[440px] pt-4">
            
            {/* Paginador de puntos interactivo */}
            <div className="flex items-center justify-center gap-1.5 mb-4">
              {[0, 1, 2].map((index) => (
                <button
                  key={index}
                  onClick={() => setCurrentStep(index)}
                  aria-label={`Ir al paso ${index + 1}`}
                  type="button"
                  className={`h-[6px] rounded-[3px] transition-all cursor-pointer border-0 p-0 ${
                    currentStep === index
                      ? 'w-[22px] bg-[#1E6FCB]'
                      : 'w-[6px] bg-[#DDE4EC] hover:bg-slate-300'
                  }`}
                />
              ))}
            </div>

            {/* Botón CTA: Siguiente o Empezar */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleNext}
              type="button"
              className="w-full bg-[#1E6FCB] text-white rounded-[14px] py-[15px] px-6 text-center font-extrabold text-[15px] shadow-[0px_8px_18px_rgba(30,111,203,0.3)] hover:bg-[#15539E] cursor-pointer border-0 transition-colors"
            >
              {currentStep === 2 ? 'Empezar' : 'Siguiente'}
            </motion.button>
          </div>
        </main>

        {/* Sidebar desktop (>= md) armonizada con el Home y /municipios */}
        <aside className="hidden md:flex w-[380px] lg:w-[420px] flex-shrink-0 bg-[#F4F7FB] border-l border-[#EEF1F5] p-8 flex-col justify-between gap-4">
          <div>
            <div className="font-extrabold text-[11px] text-[#8593A2] tracking-[0.5px] mb-4 uppercase">
              Cómo funciona Reportalo
            </div>

            <div className="flex flex-col gap-3">
              <motion.div
                whileHover={{ y: -2 }}
                onClick={() => setCurrentStep(0)}
                className={`border rounded-[13px] p-3.5 flex gap-3 shadow-sm cursor-pointer transition-all ${
                  currentStep === 0
                    ? 'bg-white border-[#1E6FCB] ring-1 ring-[#1E6FCB]/20'
                    : 'bg-white/80 border-[#E6ECF3] hover:bg-white'
                }`}
              >
                <span
                  className={`w-[28px] h-[28px] rounded-[8px] font-extrabold text-[12px] flex items-center justify-center flex-shrink-0 ${
                    currentStep === 0
                      ? 'bg-[#1E6FCB] text-white'
                      : 'bg-[#EEF5FC] text-[#1E6FCB]'
                  }`}
                >
                  1
                </span>
                <div>
                  <div className="font-bold text-[13px] text-[#263249]">
                    Una foto es un reclamo
                  </div>
                  <div className="font-medium text-[11px] leading-[1.45] text-[#7A8696] mt-0.5">
                    Sacás la foto y la IA de Reportalo encuadra el organismo responsable.
                  </div>
                </div>
              </motion.div>

              <motion.div
                whileHover={{ y: -2 }}
                onClick={() => setCurrentStep(1)}
                className={`border rounded-[13px] p-3.5 flex gap-3 shadow-sm cursor-pointer transition-all ${
                  currentStep === 1
                    ? 'bg-white border-[#1E6FCB] ring-1 ring-[#1E6FCB]/20'
                    : 'bg-white/80 border-[#E6ECF3] hover:bg-white'
                }`}
              >
                <span
                  className={`w-[28px] h-[28px] rounded-[8px] font-extrabold text-[12px] flex items-center justify-center flex-shrink-0 ${
                    currentStep === 1
                      ? 'bg-[#1E6FCB] text-white'
                      : 'bg-[#EEF5FC] text-[#1E6FCB]'
                  }`}
                >
                  2
                </span>
                <div>
                  <div className="font-bold text-[13px] text-[#263249]">
                    Privacidad y Anonimización
                  </div>
                  <div className="font-medium text-[11px] leading-[1.45] text-[#7A8696] mt-0.5">
                    Difuminado automático de rostros y patentes antes de almacenarse.
                  </div>
                </div>
              </motion.div>

              <motion.div
                whileHover={{ y: -2 }}
                onClick={() => setCurrentStep(2)}
                className={`border rounded-[13px] p-3.5 flex gap-3 shadow-sm cursor-pointer transition-all ${
                  currentStep === 2
                    ? 'bg-white border-[#1E6FCB] ring-1 ring-[#1E6FCB]/20'
                    : 'bg-white/80 border-[#E6ECF3] hover:bg-white'
                }`}
              >
                <span
                  className={`w-[28px] h-[28px] rounded-[8px] font-extrabold text-[12px] flex items-center justify-center flex-shrink-0 ${
                    currentStep === 2
                      ? 'bg-[#1E6FCB] text-white'
                      : 'bg-[#EEF5FC] text-[#1E6FCB]'
                  }`}
                >
                  3
                </span>
                <div>
                  <div className="font-bold text-[13px] text-[#263249]">
                    Seguimiento en tiempo real
                  </div>
                  <div className="font-medium text-[11px] leading-[1.45] text-[#7A8696] mt-0.5">
                    Consultá el estado y las notas oficiales de tu caso hasta resolverse.
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
              Tu identidad nunca se comparte con el organismo receptor.
            </span>
          </div>
        </aside>

      </div>

    </div>
  );
};
