import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Check, Shapes, Trash2, ShieldAlert, RefreshCw, Camera, Sun, Focus, Clock } from 'lucide-react';
import {
  processAllEvidencesThroughQuarantine,
  describeProtectionFailure,
  PIPELINE_STEPS,
} from '../../services/quarantinePipelineService';

/**
 * Pantalla de protección y anonimización de fotos en el servidor ("Protegiendo tus fotos…").
 * UJ v3.3 · M14 (teléfono) y D15 (escritorio: foto y pasos lado a lado). REP-3791 Bloque 2:
 * solo cambia la capa visual; el pipeline de cuarentena y su manejo fail-safe no se tocaron.
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
 * @param {Function} [props.onSaveForLater] Deja el reporte en la cola de pendientes (señal débil)
 * @param {number} [props.timeoutMs] Espera máxima del pipeline antes de pasar el reporte a la cola
 */
export const ReportProcessingScreen = ({
  evidenceList = [],
  categoryName = 'Infracción de tránsito',
  clientSideId = null,
  onProcessingComplete,
  onErrorBack,
  onDiscard = null,
  processFn = null,
  durationMs = 3200,
  simulateError = false,
  onSaveForLater = null,
  timeoutMs = 45000,
}) => {
  // Índice del paso actual mostrado al usuario
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  // Porcentaje numérico de progreso de la barra (15% a 100%)
  const [progress, setProgress] = useState(15);
  // Bandera de estado de error bajo principio fail-safe
  const [hasError, setHasError] = useState(false);
  // Motivo de la falla que devolvió el servidor (REP-3793), para explicarla sin detalle técnico
  const [failureReason, setFailureReason] = useState(null);
  // Contador de reintentos
  const [retryTrigger, setRetryTrigger] = useState(0);

  // Referencia para evitar dobles llamadas a onProcessingComplete
  const hasCompletedRef = useRef(false);
  // Se venció la espera y el reporte pasó a la cola: un resultado que llegue tarde se ignora
  const abandonedRef = useRef(false);
  // Por ref y no en las dependencias: si cambiara la referencia, el pipeline se reiniciaría
  const onSaveForLaterRef = useRef(onSaveForLater);
  onSaveForLaterRef.current = onSaveForLater;

  // URL de la primera fotografía para el visor o fallback de prueba
  const photoUrl = evidenceList[0]?.previewUrl || '/assets/street-scene.png';

  // Función principal de ejecución del pipeline de cuarentena
  const executePipeline = useCallback(async () => {
    // Restablecemos estados al iniciar o reintentar
    hasCompletedRef.current = false;
    abandonedRef.current = false;
    setHasError(false);
    setFailureReason(null);
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

    // Temporizador de espera máxima (se arma más abajo, junto al intervalo)
    let watchdog = null;

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
        // Si mientras tanto se venció la espera, el reporte ya está en la cola: no se sigue
        if (abandonedRef.current) return;
        clearTimeout(watchdog);

        // Verificamos si el pipeline fue exitoso
        if (pipelineResult && pipelineResult.success) {
          // Llevamos la barra al 100%
          setProgress(100);
          setCurrentStepIndex(PIPELINE_STEPS.length - 1);

          // Invocamos el callback de éxito una sola vez
          if (onProcessingComplete && !hasCompletedRef.current) {
            hasCompletedRef.current = true;
            onProcessingComplete(pipelineResult.processedEvidences || evidenceList);
          }
        } else {
          // Si el pipeline falló, activamos el estado de error fail-safe: el reporte no avanza
          setHasError(true);
          setFailureReason(pipelineResult?.reason || 'unknown');
        }
      }
    }, 40);

    // Con señal débil la subida puede no terminar nunca. Pasado timeoutMs, si hay a dónde
    // mandarlo, el reporte queda en la cola de pendientes y el ciudadano vuelve al mapa.
    watchdog = setTimeout(() => {
      if (hasCompletedRef.current || !onSaveForLaterRef.current || timeoutMs <= 0) return;
      abandonedRef.current = true;
      clearInterval(interval);
      onSaveForLaterRef.current();
    }, timeoutMs);

    return () => {
      clearInterval(interval);
      clearTimeout(watchdog);
    };
  }, [
    evidenceList,
    clientSideId,
    durationMs,
    onProcessingComplete,
    processFn,
    simulateError,
    timeoutMs,
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

  // Lista completa: la subida cifrada ya ocurrió y el resto avanza con el progreso del pipeline
  const steps = ['Fotos subidas de forma cifrada', ...PIPELINE_STEPS];
  // Explicación de la falla para el ciudadano (sin detalle técnico)
  const failureDescription = describeProtectionFailure(failureReason);
  const activeStep = currentStepIndex + 1;

  return (
    <div
      data-testid="report-processing-screen"
      className="relative flex h-full min-h-0 w-full flex-1 select-none flex-col overflow-hidden bg-rep-camera font-manrope text-white"
    >
      <style>{`
        @keyframes repScanBeam { 0% { top: -58px; } 50% { top: 220px; } 100% { top: -58px; } }
        @keyframes repScanLine { 0% { top: 0px; } 50% { top: 256px; } 100% { top: 0px; } }
        @keyframes repPulseAnim { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.97); } }
        /* UJ v3.3 §10: la animación respeta «prefiere menos movimiento» y cae a un indicador estático */
        @media (prefers-reduced-motion: reduce) { .rep-anim { animation: none !important; } }
      `}</style>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-4 pt-[max(16px,env(safe-area-inset-top,16px))] desktop:max-w-[1100px] desktop:flex-row desktop:items-center desktop:justify-center desktop:gap-14 desktop:px-10">
        {/* 1. Visor de escaneo */}
        <div
          className={`relative h-[258px] shrink-0 overflow-hidden rounded-[18px] transition-colors duration-300 desktop:h-[340px] desktop:w-[460px] ${
            hasError ? 'bg-[#2D1B1B]' : 'bg-[#2A313C]'
          }`}
          style={{
            backgroundImage: `url(${photoUrl})`,
            backgroundPosition: 'center 34%',
            backgroundSize: 'cover',
            backgroundRepeat: 'no-repeat',
          }}
        >
          {/* Velo oscuro de espera: es solo visual, no es la anonimización (esa ocurre en el servidor) */}
          <div
            className="absolute inset-0"
            style={{
              backgroundColor: hasError ? 'rgba(30, 10, 10, 0.75)' : 'rgba(10, 14, 20, 0.58)',
              backdropFilter: 'blur(3px)',
              WebkitBackdropFilter: 'blur(3px)',
            }}
          />

          {!hasError && (
            <>
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  backgroundImage:
                    'linear-gradient(rgba(46, 159, 229, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(46, 159, 229, 0.1) 1px, transparent 1px)',
                  backgroundSize: '24px 24px',
                }}
              />
              <div
                className="rep-anim pointer-events-none absolute left-0 right-0 h-[60px]"
                style={{
                  background: 'linear-gradient(rgba(46, 159, 229, 0), rgba(46, 159, 229, 0.3))',
                  animation: 'repScanBeam 3.2s ease-in-out infinite',
                }}
              />
              <div
                className="rep-anim pointer-events-none absolute left-0 right-0 h-[2px]"
                style={{
                  background: 'linear-gradient(90deg, rgba(46, 159, 229, 0), rgb(127, 212, 255), rgba(46, 159, 229, 0))',
                  boxShadow: 'rgba(46, 159, 229, 0.9) 0px 0px 12px',
                  animation: 'repScanLine 3.2s ease-in-out infinite',
                }}
              />
              {[
                { box: 'left-[24%] top-[30%] h-[70px] w-[58px]', delay: '0s' },
                { box: 'right-[16%] top-[56%] h-[30px] w-[74px]', delay: '0.6s' },
                { box: 'left-[59%] top-[19%] h-[30px] w-[30px]', delay: '1.2s' },
              ].map(({ box, delay }) => (
                <div
                  key={box}
                  className={`rep-anim pointer-events-none absolute ${box}`}
                  style={{ animation: `repPulseAnim 3.2s ease-in-out ${delay} infinite` }}
                >
                  <div className="absolute left-0 top-0 h-3 w-3 rounded-tl-[5px] border-l-2 border-t-2 border-[#7FD4FF]" />
                  <div className="absolute right-0 top-0 h-3 w-3 rounded-tr-[5px] border-r-2 border-t-2 border-[#7FD4FF]" />
                  <div className="absolute bottom-0 left-0 h-3 w-3 rounded-bl-[5px] border-b-2 border-l-2 border-[#7FD4FF]" />
                  <div className="absolute bottom-0 right-0 h-3 w-3 rounded-br-[5px] border-b-2 border-r-2 border-[#7FD4FF]" />
                </div>
              ))}

              <div className="absolute bottom-3 left-3.5 flex items-center gap-1.5 rounded-full border border-[#7FD4FF]/30 bg-[#0A1420]/60 px-3 py-1.5">
                <span
                  aria-hidden="true"
                  className="rep-anim h-1.5 w-1.5 rounded-full bg-[#7FD4FF]"
                  style={{ animation: 'repPulseAnim 1.1s ease-in-out infinite' }}
                />
                {/* REP-3793: antes mostraba «3 zonas detectadas» fijo; el conteo real llega recién al terminar */}
                <span className="text-rep-label font-bold tracking-wide text-[#CFE8FA]">
                  Buscando rostros y patentes
                </span>
              </div>
            </>
          )}

          {hasError && (
            <div
              data-testid="fail-safe-badge-indicator"
              className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center"
            >
              <ShieldAlert aria-hidden="true" className="mb-2 h-11 w-11 text-[#FF6B6B]" strokeWidth={2} />
              <span className="text-rep-body font-bold text-white">Protección interrumpida</span>
              <span className="mt-1 text-rep-label text-[#FFA8A8]">
                La foto original se eliminó para cuidar tu privacidad.
              </span>
            </div>
          )}
        </div>

        {/* 2. Estado del proceso */}
        <div className="flex min-h-0 flex-1 flex-col desktop:max-w-[440px] desktop:flex-none">
          {!hasError ? (
            <>
              <h1 className="m-0 mt-6 text-rep-title text-white desktop:mt-0 desktop:text-rep-title-d">Protegiendo tus fotos…</h1>
              <p className="m-0 mt-2 text-rep-body text-rep-camera-ink-muted desktop:text-rep-body-d">
                Tarda unos segundos y no tenés que hacer nada más: cuando termina, el reporte sale.
              </p>

              <div
                role="progressbar"
                aria-label="Progreso de la protección de fotos"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
                className="mt-5 h-[5px] overflow-hidden rounded-full bg-white/10"
              >
                <div
                  className="h-full rounded-full transition-all duration-75 ease-out"
                  style={{
                    width: `${progress}%`,
                    background: 'linear-gradient(90deg, rgb(var(--rep-accent)), rgb(var(--rep-camera-accent)))',
                  }}
                />
              </div>

              {/* Teléfono: paso hecho + paso en curso · escritorio: lista completa (D15) */}
              <ol aria-live="polite" className="m-0 mt-5 flex list-none flex-col gap-3 p-0">
                {steps.map((label, idx) => {
                  const isDone = idx < activeStep;
                  const isCurrent = idx === activeStep;
                  const showOnPhone = idx === 0 || isCurrent;
                  return (
                    <li key={label} className={`${showOnPhone ? 'flex' : 'hidden desktop:flex'} items-center gap-2.5`}>
                      {isDone ? (
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rep-success text-rep-on-accent">
                          <Check aria-hidden="true" className="h-3 w-3" strokeWidth={3} />
                        </span>
                      ) : isCurrent ? (
                        <span
                          aria-hidden="true"
                          className="rep-anim h-5 w-5 shrink-0 rounded-full border-2 border-rep-camera-accent"
                          style={{ animation: 'repPulseAnim 1.1s ease-in-out infinite' }}
                        />
                      ) : (
                        <span aria-hidden="true" className="h-5 w-5 shrink-0 rounded-full bg-white/10" />
                      )}
                      <span
                        className={`text-rep-body desktop:text-rep-body-d ${
                          isCurrent ? 'font-bold text-white' : isDone ? 'font-semibold text-white/85' : 'font-medium text-white/45'
                        }`}
                      >
                        {label}
                      </span>
                    </li>
                  );
                })}
              </ol>

              <div className="mt-5 flex items-start gap-2.5">
                <Shapes aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-rep-camera-ink-muted" strokeWidth={2} />
                <span className="text-rep-label font-semibold text-rep-camera-ink-muted desktop:text-rep-label-d">
                  Los pasos cambian según la categoría del reporte ({categoryName}).
                </span>
              </div>

              <div className="mb-4 mt-auto flex items-center gap-2.5 rounded-xl bg-white/[0.07] px-3 py-3 desktop:mb-0 desktop:mt-4 desktop:bg-transparent desktop:px-0">
                <Trash2 aria-hidden="true" className="h-4 w-4 shrink-0 text-rep-camera-ink-muted" strokeWidth={2} />
                <span className="text-rep-label font-medium text-rep-camera-ink-muted desktop:text-rep-label-d">
                  Al terminar, la imagen original se descarta del servidor.
                </span>
              </div>
            </>
          ) : (
            /* Vista fail-safe ante error en cuarentena · UJ v3.3 · M21 (Bloque 4) · REP-3793: texto según el motivo */
            <div data-testid="quarantine-fail-safe-view" className="mt-6 flex flex-1 flex-col desktop:mt-0">
              <h1 className="m-0 text-rep-title text-white desktop:text-rep-title-d">No pudimos proteger tu foto</h1>
              <p className="m-0 mt-2 text-rep-body text-white/75 desktop:text-rep-body-d">
                No podemos garantizar el pixelado de rostros y patentes, así que por seguridad no la guardamos: la original se descartó de nuestros servidores.
              </p>

              <p
                role="alert"
                data-testid="fail-safe-reason"
                className="m-0 mt-4 rounded-xl border border-rep-danger/40 bg-rep-danger/20 p-3 text-rep-label text-white/90"
              >
                {failureDescription.detail}
              </p>

              {failureDescription.photoTips && (
              <ul className="m-0 mt-4 flex list-none flex-col gap-2.5 p-0">
                <li className="flex items-center gap-2.5 text-rep-body text-white/85">
                  <Sun aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-rep-camera-accent" strokeWidth={2.25} />
                  Buscá más luz o acercate un poco
                </li>
                <li className="flex items-center gap-2.5 text-rep-body text-white/85">
                  <Focus aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-rep-camera-accent" strokeWidth={2.25} />
                  Esperá que enfoque antes de disparar
                </li>
              </ul>
              )}

              <div className="mb-4 mt-auto flex flex-col gap-2 desktop:mt-6">
                <button
                  type="button"
                  onClick={handleBackToCapture}
                  className="rep-focus flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-rep-camera-accent text-rep-button text-rep-camera transition-transform duration-120 active:scale-[0.98] focus-visible:ring-offset-rep-camera"
                >
                  <Camera aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={2.25} />
                  Cambiar foto
                </button>
                <button
                  type="button"
                  onClick={handleRetry}
                  className="rep-focus flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-white/10 text-rep-body font-semibold text-white/85 transition-colors duration-120 hover:bg-white/15 focus-visible:ring-offset-rep-camera"
                >
                  <RefreshCw aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={2.25} />
                  Reintentar protección
                </button>
                {/* Si la falla fue de señal, el ciudadano puede dejarlo en la cola y seguir */}
                {onSaveForLater && (
                  <button
                    type="button"
                    onClick={onSaveForLater}
                    className="rep-focus flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-white/10 text-rep-body font-semibold text-white/85 transition-colors duration-120 hover:bg-white/15 focus-visible:ring-offset-rep-camera"
                  >
                    <Clock aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={2.25} />
                    Guardar y enviar cuando haya señal
                  </button>
                )}
                {onDiscard && (
                  <button
                    type="button"
                    onClick={onDiscard}
                    className="rep-focus min-h-touch w-full rounded-xl text-rep-body font-bold text-[#FF8A80] focus-visible:ring-offset-rep-camera"
                  >
                    Descartar el reporte
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportProcessingScreen;

