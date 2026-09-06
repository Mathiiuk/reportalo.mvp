import React, { useState, useEffect } from 'react';

/**
 * Pantalla de protección y anonimización de fotos en el servidor ("Protegiendo tus fotos…").
 * Diseño exacto User Journey v3.1 / Sprint 10 (conforme a la maqueta y especificación de diseño).
 */
export const ReportProcessingScreen = ({
  evidenceList = [],
  categoryName = 'Infracción de tránsito',
  onProcessingComplete,
  durationMs = 3200,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [progress, setProgress] = useState(15);

  const photoUrl = evidenceList[0]?.previewUrl || '/assets/street-scene.png';

  const processingSteps = [
    'Analizando la foto',
    'Difuminando rostros',
    'Difuminando patentes de terceros',
    'Difuminando datos sensibles',
  ];

  useEffect(() => {
    // Progreso dinámico suave
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / durationMs) * 100));
      setProgress(pct);

      const stepIdx = Math.min(
        processingSteps.length - 1,
        Math.floor((elapsed / durationMs) * processingSteps.length)
      );
      setCurrentStepIndex(stepIdx);

      if (elapsed >= durationMs) {
        clearInterval(interval);
        if (onProcessingComplete) {
          onProcessingComplete();
        }
      }
    }, 40);

    return () => clearInterval(interval);
  }, [durationMs, onProcessingComplete, processingSteps.length]);

  return (
    <div
      data-testid="report-processing-screen"
      className="relative w-full h-full flex-1 min-h-0 bg-[#0E1116] overflow-hidden flex flex-col font-manrope select-none text-white"
    >
      <style>{`
        @keyframes repScanBeam {
          0% { top: -58px; }
          50% { top: 220px; }
          100% { top: -58px; }
        }
        @keyframes repScanLine {
          0% { top: 0px; }
          50% { top: 256px; }
          100% { top: 0px; }
        }
        @keyframes repPulseAnim {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.97); }
        }
      `}</style>

      <div className="flex-1 flex flex-col px-5 sm:px-6 md:px-8 pt-4 pb-4 max-w-md mx-auto w-full">
        {/* 1. Visor de escaneo de foto con rejilla y zonas detectadas */}
        <div
          className="relative rounded-[18px] overflow-hidden h-[258px] bg-[#2A313C] flex-shrink-0"
          style={{
            backgroundImage: `url(${photoUrl})`,
            backgroundPosition: 'center 34%',
            backgroundSize: 'cover',
            backgroundRepeat: 'no-repeat',
          }}
        >
          {/* Filtro oscuro + blur */}
          <div
            className="absolute inset-0"
            style={{
              backgroundColor: 'rgba(10, 14, 20, 0.58)',
              backdropFilter: 'blur(3px)',
              WebkitBackdropFilter: 'blur(3px)',
            }}
          />

          {/* Rejilla cibernética azul */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:
                'linear-gradient(rgba(46, 159, 229, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(46, 159, 229, 0.1) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />

          {/* Haz de escaneo láser continuo */}
          <div
            className="absolute left-0 right-0 h-[60px] pointer-events-none"
            style={{
              background: 'linear-gradient(rgba(46, 159, 229, 0), rgba(46, 159, 229, 0.3))',
              animation: '3.2s ease-in-out 0s infinite normal none running repScanBeam',
            }}
          />
          <div
            className="absolute left-0 right-0 h-[2px] pointer-events-none"
            style={{
              background:
                'linear-gradient(90deg, rgba(46, 159, 229, 0), rgb(127, 212, 255), rgba(46, 159, 229, 0))',
              boxShadow: 'rgba(46, 159, 229, 0.9) 0px 0px 12px',
              animation: '3.2s ease-in-out 0s infinite normal none running repScanLine',
            }}
          />

          {/* Zona 1: Bounding Box Rostro/Sujeto (Izquierda) */}
          <div
            className="absolute left-[24%] top-[30%] w-[58px] h-[70px] pointer-events-none"
            style={{ animation: '3.2s ease-in-out 0s infinite normal none running repPulseAnim' }}
          >
            <div className="absolute left-0 top-0 w-3.5 h-3.5 border-l-2 border-t-2 border-[#7FD4FF] rounded-tl-[5px]" />
            <div className="absolute right-0 top-0 w-3.5 h-3.5 border-r-2 border-t-2 border-[#7FD4FF] rounded-tr-[5px]" />
            <div className="absolute left-0 bottom-0 w-3.5 h-3.5 border-l-2 border-b-2 border-[#7FD4FF] rounded-bl-[5px]" />
            <div className="absolute right-0 bottom-0 w-3.5 h-3.5 border-r-2 border-b-2 border-[#7FD4FF] rounded-br-[5px]" />
          </div>

          {/* Zona 2: Bounding Box Patente (Derecha abajo) */}
          <div
            className="absolute right-[16%] top-[56%] w-[74px] h-[30px] pointer-events-none"
            style={{ animation: '3.2s ease-in-out 0.6s infinite normal none running repPulseAnim' }}
          >
            <div className="absolute left-0 top-0 w-3 h-3 border-l-2 border-t-2 border-[#7FD4FF] rounded-tl-[4px]" />
            <div className="absolute right-0 top-0 w-3 h-3 border-r-2 border-t-2 border-[#7FD4FF] rounded-tr-[4px]" />
            <div className="absolute left-0 bottom-0 w-3 h-3 border-l-2 border-b-2 border-[#7FD4FF] rounded-bl-[4px]" />
            <div className="absolute right-0 bottom-0 w-3 h-3 border-r-2 border-b-2 border-[#7FD4FF] rounded-br-[4px]" />
          </div>

          {/* Zona 3: Bounding Box Elemento secundario (Centro arriba) */}
          <div
            className="absolute left-[59%] top-[19%] w-[30px] h-[30px] pointer-events-none"
            style={{ animation: '3.2s ease-in-out 1.2s infinite normal none running repPulseAnim' }}
          >
            <div className="absolute left-0 top-0 w-2.5 h-2.5 border-l-2 border-t-2 border-[#7FD4FF]/75 rounded-tl-[4px]" />
            <div className="absolute right-0 bottom-0 w-2.5 h-2.5 border-r-2 border-b-2 border-[#7FD4FF]/75 rounded-br-[4px]" />
          </div>

          {/* Badge inferior: 3 zonas detectadas */}
          <div
            className="absolute left-[14px] bottom-[12px] flex items-center gap-[6px] rounded-[20px] py-[6px] px-[11px]"
            style={{
              background: 'rgba(10, 20, 32, 0.62)',
              border: '1px solid rgba(127, 212, 255, 0.28)',
            }}
          >
            <span
              className="w-[6px] h-[6px] rounded-full bg-[#7FD4FF]"
              style={{ animation: '1.1s ease-in-out 0s infinite normal none running repPulseAnim' }}
            />
            <span className="font-bold text-[9px] text-[#CFE8FA] tracking-[0.4px]">
              3 zonas detectadas
            </span>
          </div>
        </div>

        {/* 2. Título y descripción */}
        <div className="font-extrabold text-[21px] text-white mt-[24px] tracking-[-0.3px]">
          Protegiendo tus fotos…
        </div>
        <div className="font-medium text-[12.5px] leading-[1.55] text-[#8A95A3] mt-[7px]">
          Tarda unos segundos y no tenés que hacer nada más: cuando termina, el reporte sale.
        </div>

        {/* 3. Barra de Progreso */}
        <div
          className="mt-[20px] h-[5px] rounded-[3px] overflow-hidden"
          style={{ background: 'rgba(255, 255, 255, 0.12)' }}
        >
          <div
            className="h-full rounded-[3px] transition-all duration-75 ease-out"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, rgb(30, 111, 203), rgb(46, 159, 229))',
            }}
          />
        </div>

        {/* 4. Lista de comprobación y pasos en tiempo real */}
        <div className="flex flex-col gap-[10px] mt-[18px]">
          {/* Paso 1: Fotos subidas */}
          <div className="flex items-center gap-[9px]">
            <span className="w-[18px] h-[18px] rounded-full bg-[#2E9E6B] flex items-center justify-center font-['Material_Symbols_Rounded'] text-[12px] text-white flex-shrink-0">
              check
            </span>
            <span className="font-semibold text-[11.5px] text-[#C8D2DD]">
              Fotos subidas de forma cifrada
            </span>
          </div>

          {/* Paso 2: Dinámico */}
          <div className="flex items-center gap-[9px]">
            <span
              className="w-[18px] h-[18px] rounded-full border-2 border-[#2E9FE5] flex-shrink-0"
              style={{ animation: '1.1s ease-in-out 0s infinite normal none running repPulseAnim' }}
            />
            <span className="font-bold text-[11.5px] text-white">
              {processingSteps[currentStepIndex]}
            </span>
          </div>

          {/* Nota de categoría */}
          <div className="flex items-center gap-[9px]">
            <span className="font-['Material_Symbols_Rounded'] text-[15px] text-[#6B7684] flex-shrink-0">
              category
            </span>
            <span className="font-semibold text-[11px] leading-[1.35] text-[#6B7684]">
              Los pasos cambian según la categoría del reporte ({categoryName}).
            </span>
          </div>
        </div>

        {/* 5. Banner inferior: Descarte de imagen original */}
        <div
          className="mt-auto mb-[16px] flex items-center gap-[8px] rounded-[12px] p-[11px_12px]"
          style={{ background: 'rgba(255, 255, 255, 0.07)' }}
        >
          <span className="font-['Material_Symbols_Rounded'] text-[16px] text-[#8A95A3] flex-shrink-0">
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
