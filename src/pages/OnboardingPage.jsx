import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ImagePlus, ScanFace, ArrowRight, Shield, Check, Eye } from 'lucide-react';
import { useIsDesktopLayout } from '../hooks/useMediaQuery';
import { BrandBar } from '../components/layout/BrandBar';

export const OnboardingPage = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  // D04 a D06 (UJ v3.3, REP-3791 Bloque 11-C): «el carrusel se vuelve horizontal».
  const isDesktop = useIsDesktopLayout();

  // Finalizar onboarding y continuar a la activación de permisos por única vez
  const handleFinish = () => {
    try {
      localStorage.setItem('reportalo_onboarding_completed', 'true');
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }

    const permissionsConfigured =
      typeof window !== 'undefined' &&
      localStorage.getItem('reportalo_permissions_configured') === 'true';

    if (permissionsConfigured) {
      navigate('/mapa');
    } else {
      navigate('/permisos');
    }
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
      // D04: «El copy dice "Subís la foto", no "Sacás la foto": en escritorio no hay cámara».
      descriptionDesktop:
        'Subís la foto de lo que está mal en tu barrio y Reportalo la convierte en un reclamo formal ante quien tiene que resolverlo.',
      renderIllustration: (heightClass) => (
        <div className={`${heightClass} rounded-[20px] bg-rep-accent-soft border border-rep-border flex flex-col items-center justify-center gap-3 shadow-inner`}>
          {/* Pictograma (decisión de UX, REP-3791 Bloque 7-B): reemplaza el marcador de ilustración */}
          <span aria-hidden="true" data-testid="onboarding-pictogram-1" className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-rep-surface shadow-rep-card">
            <ImagePlus className="h-12 w-12 text-rep-accent" strokeWidth={1.75} />
            <span className="absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-full bg-rep-accent text-rep-on-accent shadow-rep-accent">
              <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
            </span>
          </span>
        </div>
      ),
    },
    {
      id: 'step-2',
      title: 'Tu foto se protege sola',
      description:
        'Los rostros y las patentes se difuminan automáticamente antes de guardarse. La imagen original nunca se almacena.',
      renderIllustration: (heightClass) => (
        <div className={`${heightClass} rounded-[20px] bg-[#E9F5EF] border border-[#D5EBE0] flex flex-col items-center justify-center gap-3.5 shadow-inner`}>
          <ScanFace className="w-[52px] h-[52px] text-rep-success" strokeWidth={1.5} />
          <div className="flex items-center gap-2 bg-rep-surface rounded-[10px] py-2 px-3 shadow-[0px_3px_10px_rgba(20,40,80,0.08)]">
            <span className="w-[26px] h-[26px] rounded-[7px] bg-[repeating-linear-gradient(45deg,#C9D5E2_0px,#C9D5E2_3px,#E2E9F0_3px,#E2E9F0_6px)] flex-shrink-0" />
            <ArrowRight className="w-[15px] h-[15px] text-rep-success" strokeWidth={2.25} />
            <span className="w-[26px] h-[26px] rounded-[7px] bg-rep-success-soft flex items-center justify-center text-rep-success flex-shrink-0">
              <Shield className="w-[15px] h-[15px]" strokeWidth={2.25} />
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
      renderIllustration: (heightClass) => (
        <div className={`${heightClass} rounded-[20px] bg-rep-accent-soft border border-rep-border flex flex-col justify-center gap-2.5 px-7 shadow-inner text-left`}>
          {/* 1. Enviado */}
          <div className="flex items-center gap-2.5">
            <span className="w-[18px] h-[18px] rounded-full bg-rep-success flex items-center justify-center text-white flex-shrink-0">
              <Check className="w-[12px] h-[12px]" strokeWidth={3} />
            </span>
            <span className="font-bold text-[12px] text-rep-ink">
              Enviado
            </span>
          </div>
          <div className="w-[2px] h-[12px] bg-[#CFD8E2] ml-2 -my-1" />

          {/* 2. En revisión */}
          <div className="flex items-center gap-2.5">
            <span className="w-[18px] h-[18px] rounded-full bg-rep-accent flex items-center justify-center text-white flex-shrink-0">
              <Eye className="w-[12px] h-[12px]" strokeWidth={2.5} />
            </span>
            <span className="font-bold text-[12px] text-rep-ink">
              En revisión
            </span>
          </div>
          <div className="w-[2px] h-[12px] bg-[#CFD8E2] ml-2 -my-1" />

          {/* 3. Notificado */}
          <div className="flex items-center gap-2.5">
            <span className="w-[18px] h-[18px] rounded-full border-2 border-[#CFD8E2] flex-shrink-0" />
            <span className="font-bold text-[12px] text-rep-ink-faint">
              Notificado
            </span>
          </div>
          <div className="w-[2px] h-[12px] bg-[#CFD8E2] ml-2 -my-1" />

          {/* 4. Resuelto */}
          <div className="flex items-center gap-2.5">
            <span className="w-[18px] h-[18px] rounded-full border-2 border-[#CFD8E2] flex-shrink-0" />
            <span className="font-bold text-[12px] text-rep-ink-faint">
              Resuelto
            </span>
          </div>
        </div>
      ),
    },
  ];

  const current = steps[currentStep];

  // Paginador de puntos (el mismo en teléfono y escritorio)
  const Dots = ({ className = '' }) => (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {[0, 1, 2].map((index) => (
        <button
          key={index}
          onClick={() => setCurrentStep(index)}
          aria-label={`Ir al paso ${index + 1}`}
          type="button"
          className={`h-[6px] rounded-[3px] transition-all cursor-pointer border-0 p-0 ${
            currentStep === index ? 'w-[22px] bg-rep-accent' : 'w-[6px] bg-rep-track hover:bg-slate-300'
          }`}
        />
      ))}
    </div>
  );

  // D04 a D06: tarjeta horizontal centrada. Ilustración a la izquierda; a la derecha, paso,
  // título, texto y una sola fila con el CTA, el paginador y «Saltar».
  if (isDesktop) {
    return (
      <div className="flex min-h-[100dvh] w-full select-none flex-col bg-rep-bg font-manrope">
        <BrandBar showUser />
        <main className="flex flex-1 items-center justify-center px-10 py-12">
          <AnimatePresence mode="wait">
            <motion.section
              key={current.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
              aria-label={`Paso ${currentStep + 1} de 3`}
              className="grid w-full max-w-[860px] grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] items-center gap-10 rounded-3xl border border-rep-border bg-rep-surface p-8 shadow-rep-float"
            >
              <div>{current.renderIllustration('h-[260px]')}</div>
              <div className="flex flex-col">
                <span className="text-[12px] font-extrabold uppercase tracking-[0.12em] text-rep-ink-faint">
                  Paso {currentStep + 1} de 3
                </span>
                <h1 className="m-0 mt-2 text-rep-title-d text-rep-ink">{current.title}</h1>
                <p className="m-0 mt-3 text-rep-body-d text-rep-ink-muted">{current.descriptionDesktop || current.description}</p>
                <div className="mt-8 flex items-center gap-6">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleNext}
                    type="button"
                    className="rep-focus min-h-touch cursor-pointer rounded-[14px] border-0 bg-rep-accent px-8 py-[14px] text-rep-button text-rep-on-accent shadow-rep-accent transition-colors hover:bg-rep-accent-strong"
                  >
                    {currentStep === 2 ? 'Empezar' : 'Siguiente'}
                  </motion.button>
                  <Dots />
                  {currentStep < 2 ? (
                    <button
                      onClick={handleFinish}
                      type="button"
                      className="rep-focus ml-auto min-h-touch cursor-pointer rounded border-0 bg-transparent px-2 text-rep-body-d font-bold text-rep-ink-faint transition-colors hover:text-rep-accent"
                    >
                      Saltar
                    </button>
                  ) : (
                    <span aria-hidden="true" className="ml-auto select-none px-2 text-rep-body-d font-bold text-rep-divider">
                      Saltar
                    </span>
                  )}
                </div>
              </div>
            </motion.section>
          </AnimatePresence>
        </main>
      </div>
    );
  }

  // M04 a M06: carrusel vertical en el teléfono (sin cambios de diseño en este bloque)
  return (
    <div className="min-h-[100dvh] w-full font-manrope select-none flex flex-col bg-rep-surface">
      <div className="flex-1 flex flex-col overflow-hidden min-h-[100dvh]">
        <main className="flex-1 flex flex-col px-6 pt-[max(env(safe-area-inset-top),10px)] pb-[max(env(safe-area-inset-bottom),18px)] justify-between items-center">
          
          {/* Barra superior de acción (Botón Saltar en móvil) */}
          <div className="w-full max-w-[340px] flex justify-end">
            {currentStep < 2 ? (
              <button
                onClick={handleFinish}
                type="button"
                className="font-bold text-[12.5px] text-rep-ink-faint hover:text-rep-accent p-1 cursor-pointer bg-transparent border-0 transition-colors"
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
          <div className="w-full max-w-[340px] my-auto">
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
                <div className="mt-2.5">
                  {current.renderIllustration('h-[250px]')}
                </div>

                {/* Título */}
                <h1 className="font-extrabold text-[24px] text-rep-ink mt-7 tracking-[-0.5px] leading-tight">
                  {current.title}
                </h1>

                {/* Descripción */}
                <p className="font-medium text-[13.5px] leading-[1.6] text-rep-ink-muted mt-2.5">
                  {current.description}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Zona inferior: Paginador y Botón Siguiente/Empezar */}
          <div className="w-full max-w-[340px] pt-4">
            
            {/* Paginador de puntos interactivo */}
            <Dots className="justify-center mb-4" />

            {/* Botón CTA: Siguiente o Empezar */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleNext}
              type="button"
              className="w-full bg-rep-accent text-white rounded-[14px] py-[15px] px-6 text-center font-extrabold text-[15px] shadow-[0px_8px_18px_rgba(30,111,203,0.3)] hover:bg-rep-accent-strong cursor-pointer border-0 transition-colors"
            >
              {currentStep === 2 ? 'Empezar' : 'Siguiente'}
            </motion.button>
          </div>
        </main>
      </div>
    </div>
  );
};
