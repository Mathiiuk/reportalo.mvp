import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  processAllEvidencesThroughQuarantine,
  PIPELINE_STEPS,
} from '../../services/quarantinePipelineService';

/**
 * Pantalla de protección y anonimización de fotos en el servidor ("Protegiendo tus fotos…").
 * Integra el pipeline server-side de cuarentena (REP-2404) con principio fail-safe ante errores.
 *
 * @param {object} props
 * @param {Array} props.evidenceList Lista de fotos capturadas
 * @param {string} props.categoryName Nombre de la categoría del reporte
 * @param {string} props.clientSideId Identificador de correlación del reporte
 * @param {Function} props.onProcessingComplete Callback ejecutado al completar con éxito
 * @param {Function} props.onErrorBack Callback para regresar al paso anterior en caso de error
 * @param {Function} [props.processFn] Función opcional para inyectar o mockear el pipeline
 * @param {number} [props.durationMs] Tiempo mínimo de animación para visualización armónica
 * @param {boolean} [props.simulateError] Bandera para simular error fail-safe en pruebas
 */
export const ReportProcessingScreen = ({
  evidenceList = [],
  categoryName = 'Infracción de tránsito',
  clientSideId = null,
  onProcessingComplete,
  onErrorBack,
  processFn = null,
  durationMs = 3200,
  simulateError = false,
}) => {
  // Índice del paso actual mostrado al usuario
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  // Porcentaje numérico de progreso de la barra (15% a 100%)
  const [progress, setProgress] = useState(15);
  // Bandera de estado de error bajo principio fail-safe
  const [hasError, setHasError] = useState(false);
  // Mensaje descriptivo del error para el usuario
  const [errorMessage, setErrorMessage] = useState('');
  // Contador de reintentos
  const [retryTrigger, setRetryTrigger] = useState(0);
  // Cantidad de zonas sensibles detectadas
  const [detectedCount, setDetectedCount] = useState(3);

  // Referencia para evitar dobles llamadas a onProcessingComplete
  const hasCompletedRef = useRef(false);

  // URL de la primera fotografía para el visor o fallback de prueba
  const photoUrl = evidenceList[0]?.previewUrl || '/assets/street-scene.png';

  // Función principal de ejecución del pipeline de cuarentena
  const executePipeline = useCallback(async () => {
    // Restablecemos estados al iniciar o reintentar
    hasCompletedRef.current = false;
    setHasError(false);
    setErrorMessage('');
    setProgress(15);
    setCurrentStepIndex(0);

    // Marca de tiempo inicial para calcular la duración mínima
    const startTime = Date.now();

    // Variable que contendrá el resultado asíncrono
    let pipelineResult = null;

    // Lanzamos el procesamiento de imágenes en paralelo con la animación
    const runnerPromise = (async () => {
      try {
        if (processFn) {
          // Si se inyectó una función personalizada (ej. en tests)
          pipelineResult = await processFn({
            evidenceList,
            clientSideId,
            simulateError,
          });
        } else {
          // Invocamos el servicio oficial del pipeline de cuarentena
          pipelineResult = await processAllEvidencesThroughQuarantine({
            evidenceList,
            clientSideId,
            simulateError,
          });
        }
      } catch (err) {
        pipelineResult = {
          success: false,
          error: err.message || 'Error inesperado en el servidor.',
          failSafeTriggered: true,
        };
      }
    })();

    // Intervalo de animación visual suave
    const interval = setInterval(async () => {
      // Tiempo transcurrido desde el inicio
      const elapsed = Date.now() - startTime;
      // Cálculo del porcentaje en base a la duración configurada
      const pct = Math.min(96, Math.round((elapsed / durationMs) * 100));
      setProgress(pct);

      // Determinación del paso de texto actual
      const stepIdx = Math.min(
        PIPELINE_STEPS.length - 1,
        Math.floor((elapsed / durationMs) * PIPELINE_STEPS.length)
      );
      setCurrentStepIndex(stepIdx);

      // Si se cumplió el tiempo mínimo estipulado
      if (elapsed >= durationMs) {
        clearInterval(interval);
        // Esperamos que termine el procesamiento real si aún estaba en curso
        await runnerPromise;

        // Verificamos si el pipeline fue exitoso
        if (pipelineResult && pipelineResult.success) {
          // Llevamos la barra al 100%
          setProgress(100);
          setCurrentStepIndex(PIPELINE_STEPS.length - 1);
          if (pipelineResult.entitiesDetectedCount) {
            setDetectedCount(pipelineResult.entitiesDetectedCount);
          }

          // Invocamos el callback de éxito una sola vez
          if (onProcessingComplete && !hasCompletedRef.current) {
            hasCompletedRef.current = true;
            onProcessingComplete(pipelineResult.processedEvidences || evidenceList);
          }
        } else {
          // Si el pipeline falló, activamos el estado de error fail-safe
          setHasError(true);
          setErrorMessage(
            pipelineResult?.error ||
              'No se pudo completar la protección de tus fotos de forma segura.'
          );
        }
      }
    }, 40);

    return () => {
      clearInterval(interval);
    };
  }, [
    evidenceList,
    clientSideId,
    durationMs,
    onProcessingComplete,
    processFn,
    simulateError,
  ]);

  // Efecto que inicia o reintenta el pipeline
  useEffect(() => {
    let cleanupFn;
    executePipeline().then((fn) => {
      cleanupFn = fn;
    });
    return () => {
      if (typeof cleanupFn === 'function') cleanupFn();
    };
  }, [executePipeline, retryTrigger]);

  // Manejador para reintentar el procesamiento de fotos
  const handleRetry = () => {
    setRetryTrigger((prev) => prev + 1);
  };

  // Manejador para volver atrás y tomar una nueva foto
  const handleBackToCapture = () => {
    if (onErrorBack) {
      onErrorBack();
    }
  };

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
          className={`relative rounded-[18px] overflow-hidden h-[258px] ${
            hasError ? 'bg-[#2D1B1B]' : 'bg-[#2A313C]'
          } flex-shrink-0 transition-colors duration-300`}
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
              backgroundColor: hasError
                ? 'rgba(30, 10, 10, 0.75)'
                : 'rgba(10, 14, 20, 0.58)',
              backdropFilter: 'blur(3px)',
              WebkitBackdropFilter: 'blur(3px)',
            }}
          />

          {!hasError && (
            <>
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
                  background:
                    'linear-gradient(rgba(46, 159, 229, 0), rgba(46, 159, 229, 0.3))',
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
                style={{
                  animation: '3.2s ease-in-out 0s infinite normal none running repPulseAnim',
                }}
              >
                <div className="absolute left-0 top-0 w-3.5 h-3.5 border-l-2 border-t-2 border-[#7FD4FF] rounded-tl-[5px]" />
                <div className="absolute right-0 top-0 w-3.5 h-3.5 border-r-2 border-t-2 border-[#7FD4FF] rounded-tr-[5px]" />
                <div className="absolute left-0 bottom-0 w-3.5 h-3.5 border-l-2 border-b-2 border-[#7FD4FF] rounded-bl-[5px]" />
                <div className="absolute right-0 bottom-0 w-3.5 h-3.5 border-r-2 border-b-2 border-[#7FD4FF] rounded-br-[5px]" />
              </div>

              {/* Zona 2: Bounding Box Patente (Derecha abajo) */}
              <div
                className="absolute right-[16%] top-[56%] w-[74px] h-[30px] pointer-events-none"
                style={{
                  animation: '3.2s ease-in-out 0.6s infinite normal none running repPulseAnim',
                }}
              >
                <div className="absolute left-0 top-0 w-3 h-3 border-l-2 border-t-2 border-[#7FD4FF] rounded-tl-[4px]" />
                <div className="absolute right-0 top-0 w-3 h-3 border-r-2 border-t-2 border-[#7FD4FF] rounded-tr-[4px]" />
                <div className="absolute left-0 bottom-0 w-3 h-3 border-l-2 border-b-2 border-[#7FD4FF] rounded-bl-[4px]" />
                <div className="absolute right-0 bottom-0 w-3 h-3 border-r-2 border-b-2 border-[#7FD4FF] rounded-br-[4px]" />
              </div>

              {/* Zona 3: Bounding Box Elemento secundario (Centro arriba) */}
              <div
                className="absolute left-[59%] top-[19%] w-[30px] h-[30px] pointer-events-none"
                style={{
                  animation: '3.2s ease-in-out 1.2s infinite normal none running repPulseAnim',
                }}
              >
                <div className="absolute left-0 top-0 w-2.5 h-2.5 border-l-2 border-t-2 border-[#7FD4FF]/75 rounded-tl-[4px]" />
                <div className="absolute right-0 bottom-0 w-2.5 h-2.5 border-r-2 border-b-2 border-[#7FD4FF]/75 rounded-br-[4px]" />
              </div>

              {/* Badge inferior: zonas detectadas */}
              <div
                className="absolute left-[14px] bottom-[12px] flex items-center gap-[6px] rounded-[20px] py-[6px] px-[11px]"
                style={{
                  background: 'rgba(10, 20, 32, 0.62)',
                  border: '1px solid rgba(127, 212, 255, 0.28)',
                }}
              >
                <span
                  className="w-[6px] h-[6px] rounded-full bg-[#7FD4FF]"
                  style={{
                    animation: '1.1s ease-in-out 0s infinite normal none running repPulseAnim',
                  }}
                />
                <span className="font-bold text-[9px] text-[#CFE8FA] tracking-[0.4px]">
                  {`${detectedCount} zonas detectadas`}
                </span>
              </div>
            </>
          )}

          {hasError && (
            <div
              data-testid="fail-safe-badge-indicator"
              className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center"
            >
              <span className="font-['Material_Symbols_Rounded'] text-[44px] text-[#FF6B6B] mb-2">
                shield_with_heart
              </span>
              <span className="text-white font-bold text-[14px]">
                Protección interrumpida
              </span>
              <span className="text-[#FFA8A8] text-[11.5px] mt-1">
                La foto original se eliminó para cuidar tu privacidad.
              </span>
            </div>
          )}
        </div>

        {/* 2. Título y descripción (Normal o Fail-Safe) */}
        {!hasError ? (
          <>
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
                  style={{
                    animation: '1.1s ease-in-out 0s infinite normal none running repPulseAnim',
                  }}
                />
                <span className="font-bold text-[11.5px] text-white">
                  {PIPELINE_STEPS[currentStepIndex]}
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
          </>
        ) : (
          /* Vista Fail-Safe ante error en cuarentena */
          <div
            data-testid="quarantine-fail-safe-view"
            className="flex-1 flex flex-col mt-6"
          >
            <div className="font-extrabold text-[20px] text-white tracking-[-0.3px]">
              No pudimos proteger tu foto
            </div>
            <p className="font-medium text-[13px] leading-[1.5] text-[#A6B2C0] mt-2">
              Por seguridad, la imagen original fue descartada automáticamente de nuestros servidores para cuidar tu privacidad.
            </p>

            <div className="mt-4 p-3 rounded-xl bg-[#241717] border border-[#5C2A2A] text-[#FFA8A8] text-[12px]">
              {errorMessage || 'Ocurrió un inconveniente al anonimizar la imagen.'}
            </div>

            {/* Botones de acción fail-safe */}
            <div className="mt-auto mb-4 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={handleRetry}
                className="w-full h-12 bg-[#2E9FE5] hover:bg-[#258AC8] active:scale-[0.98] transition-all rounded-xl font-bold text-[14px] text-white flex items-center justify-center gap-2 shadow-lg shadow-[#2E9FE5]/20"
              >
                <span className="font-['Material_Symbols_Rounded'] text-[18px]">
                  refresh
                </span>
                Reintentar protección
              </button>

              <button
                type="button"
                onClick={handleBackToCapture}
                className="w-full h-11 bg-white/10 hover:bg-white/15 active:scale-[0.98] transition-all rounded-xl font-semibold text-[13.5px] text-[#C8D2DD] flex items-center justify-center gap-2"
              >
                <span className="font-['Material_Symbols_Rounded'] text-[18px]">
                  photo_camera
                </span>
                Volver a sacar la foto
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportProcessingScreen;

