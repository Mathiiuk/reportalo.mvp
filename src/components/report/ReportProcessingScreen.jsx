import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Pantalla de protección y anonimización de fotos en el servidor ("Protegiendo tus fotos…").
 * Diseño exacto User Journey v3.1 / Sprint 10.
 */
export const ReportProcessingScreen = ({
  evidenceList = [],
  categoryName = 'Tránsito',
  onProcessingComplete,
  durationMs = 3200,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  const photoUrl = evidenceList[0]?.previewUrl || '/assets/street-scene.png';

  const processingSteps = [
    'Analizando la foto',
    'Difuminando rostros',
    'Difuminando patentes de terceros',
    'Difuminando datos sensibles',
  ];

  useEffect(() => {
    // Animación de la barra de progreso
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 2;
      });
    }, durationMs / 50);

    // Ciclo de pasos de procesamiento
    const stepInterval = setInterval(() => {
      setCurrentStepIndex((prev) => (prev + 1) % processingSteps.length);
    }, durationMs / 4);

    // Finalización del procesamiento
    const completeTimer = setTimeout(() => {
      if (onProcessingComplete) {
        onProcessingComplete();
      }
    }, durationMs);

    return () => {
      clearInterval(progressInterval);
      clearInterval(stepInterval);
      clearTimeout(completeTimer);
    };
  }, [durationMs, onProcessingComplete, processingSteps.length]);

  return (
    <div
      data-testid="report-processing-screen"
      className="relative w-full h-[100dvh] bg-[#0E1116] overflow-hidden flex flex-col font-manrope select-none text-white"
    >
      <div className="flex-1 flex flex-col px-5 sm:px-6 md:px-8 pt-4 pb-4 max-w-md mx-auto w-full">
        {/* 1. Visor de escaneo de foto con rejilla y zonas detectadas */}
        <div className="relative rounded-[18px] overflow-hidden h-[258px] bg-[#2A313C] flex-shrink-0">
          {/* Foto base con fondo */}
          <img
            src={photoUrl}
            alt="Escaneando evidencia"
            className="w-full h-full object-cover"
          />

          {/* Filtro oscuro + blur de procesamiento */}
          <div className="absolute inset-0 bg-[#0A0E14]/60 backdrop-blur-[3px]" />

          {/* Rejilla cibernética azul */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `
                linear-gradient(rgba(46, 159, 229, 0.1) 1px, transparent 1px),
                linear-gradient(90deg, rgba(46, 159, 229, 0.1) 1px, transparent 1px)
              `,
              backgroundSize: '24px 24px',
            }}
          />

          {/* Haz de escaneo láser continuo */}
          <motion.div
            className="absolute left-0 right-0 h-[60px] pointer-events-none"
            style={{
              background: 'linear-gradient(rgba(46, 159, 229, 0), rgba(46, 159, 229, 0.3))',
            }}
            animate={{
              y: [-60, 258, -60],
            }}
            transition={{
              duration: 3.2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
          <motion.div
            className="absolute left-0 right-0 h-[2px] pointer-events-none shadow-[0_0_12px_rgba(46,159,229,0.9)]"
            style={{
              background:
                'linear-gradient(90deg, rgba(46, 159, 229, 0), rgb(127, 212, 255), rgba(46, 159, 229, 0))',
            }}
            animate={{
              y: [0, 258, 0],
            }}
            transition={{
              duration: 3.2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />

          {/* Zona 1: Bounding Box Rostro/Sujeto (Izquierda) */}
          <div className="absolute left-[24%] top-[30%] w-[58px] h-[70px] pointer-events-none animate-pulse">
            <div className="absolute left-0 top-0 w-3.5 h-3.5 border-l-2 border-t-2 border-[#7FD4FF] rounded-tl-[5px]" />
            <div className="absolute right-0 top-0 w-3.5 h-3.5 border-r-2 border-t-2 border-[#7FD4FF] rounded-tr-[5px]" />
            <div className="absolute left-0 bottom-0 w-3.5 h-3.5 border-l-2 border-b-2 border-[#7FD4FF] rounded-bl-[5px]" />
            <div className="absolute right-0 bottom-0 w-3.5 h-3.5 border-r-2 border-b-2 border-[#7FD4FF] rounded-br-[5px]" />
          </div>

          {/* Zona 2: Bounding Box Patente (Derecha abajo) */}
          <div className="absolute right-[16%] top-[56%] w-[74px] h-[30px] pointer-events-none animate-pulse">
            <div className="absolute left-0 top-0 w-3 h-3 border-l-2 border-t-2 border-[#7FD4FF] rounded-tl-[4px]" />
            <div className="absolute right-0 top-0 w-3 h-3 border-r-2 border-t-2 border-[#7FD4FF] rounded-tr-[4px]" />
            <div className="absolute left-0 bottom-0 w-3 h-3 border-l-2 border-b-2 border-[#7FD4FF] rounded-bl-[4px]" />
            <div className="absolute right-0 bottom-0 w-3 h-3 border-r-2 border-b-2 border-[#7FD4FF] rounded-br-[4px]" />
          </div>

          {/* Zona 3: Bounding Box Elemento secundario (Centro arriba) */}
          <div className="absolute left-[59%] top-[19%] w-[30px] h-[30px] pointer-events-none animate-pulse">
            <div className="absolute left-0 top-0 w-2.5 h-2.5 border-l-2 border-t-2 border-[#7FD4FF]/75 rounded-tl-[4px]" />
            <div className="absolute right-0 bottom-0 w-2.5 h-2.5 border-r-2 border-b-2 border-[#7FD4FF]/75 rounded-br-[4px]" />
          </div>

          {/* Badge inferior: Zonas detectadas */}
          <div className="absolute left-3.5 bottom-3 flex items-center gap-1.5 bg-[#0A1420]/65 border border-[#7FD4FF]/30 rounded-full py-1.5 px-3">
            <span className="w-1.5 h-1.5 rounded-full bg-[#7FD4FF] animate-ping" />
            <span className="font-bold text-[9px] text-[#CFE8FA] tracking-[0.4px]">
              3 zonas detectadas
            </span>
          </div>
        </div>

        {/* 2. Título y descripción */}
        <h1 className="font-extrabold text-[21px] text-white mt-6 tracking-[-0.3px] leading-tight m-0">
          Protegiendo tus fotos…
        </h1>
        <p className="font-medium text-[12.5px] leading-[1.55] text-[#8A95A3] mt-2 m-0">
          Tarda unos segundos y no tenés que hacer nada más: cuando termina, el reporte sale.
        </p>

        {/* 3. Barra de Progreso */}
        <div className="mt-5 h-[5px] rounded-[3px] bg-white/12 overflow-hidden">
          <motion.div
            className="h-full rounded-[3px] bg-gradient-to-r from-[#1E6FCB] to-[#2E9FE5]"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* 4. Lista de comprobación y pasos en tiempo real */}
        <div className="flex flex-col gap-2.5 mt-4.5">
          {/* Paso 1 Fijo: Fotos subidas */}
          <div className="flex items-center gap-2.5">
            <span className="w-4.5 h-4.5 rounded-full bg-[#2E9E6B] flex items-center justify-center font-['Material_Symbols_Rounded'] text-[12px] text-white flex-shrink-0">
              check
            </span>
            <span className="font-semibold text-[11.5px] text-[#C8D2DD]">
              Fotos subidas de forma cifrada
            </span>
          </div>

          {/* Paso Dinámico Rotativo */}
          <div className="relative h-5">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStepIndex}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.25 }}
                className="absolute inset-0 flex items-center gap-2.5"
              >
                <span className="w-4.5 h-4.5 rounded-full border-2 border-[#2E9FE5] flex-shrink-0 animate-pulse" />
                <span className="font-bold text-[11.5px] text-white">
                  {processingSteps[currentStepIndex]}
                </span>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Nota de categoría */}
          <div className="flex items-center gap-2.5 text-[#6B7684]">
            <span className="material-symbols-rounded text-[15px] flex-shrink-0">
              category
            </span>
            <span className="font-semibold text-[11px] leading-[1.35]">
              Los pasos cambian según la categoría del reporte ({categoryName}).
            </span>
          </div>
        </div>

        {/* 5. Banner inferior: Descarte de imagen original */}
        <div className="mt-auto mb-2 flex items-center gap-2 bg-white/7 rounded-xl p-3">
          <span className="material-symbols-rounded text-[16px] text-[#8A95A3] flex-shrink-0">
            delete_forever
          </span>
          <span className="font-medium text-[10.5px] leading-[1.45] text-[#8A95A3]">
            Al terminar, la imagen original se descarta del servidor.
          </span>
        </div>
      </div>
    </div>
  );
};

export default ReportProcessingScreen;
