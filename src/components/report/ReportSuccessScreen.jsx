import React from 'react';

/**
 * Pantalla de confirmación tras el envío del reporte ("Reporte enviado").
 * Diseño exacto User Journey v3.1 / Sprint 10 con animación de transición fluida desde el procesamiento.
 */
export const ReportSuccessScreen = ({
  reportCode = '#RP-2048',
  category,
  agencyName = 'Municipio de Avellaneda',
  onViewReport,
  onReturnToMap,
  onViewTerms,
}) => {
  // Hora amigable del reporte (ej: "Hoy 14:32")
  const currentTime = new Date().toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const timeLabel = `Hoy ${currentTime}`;

  const categoryName = (category?.name || 'Tránsito').toUpperCase();
  const categoryColor = category?.color || '#F78E35';
  const categoryBg = category?.bgLight || '#FFF2E6';

  return (
    <div
      data-testid="report-success-screen"
      className="relative w-full h-[100dvh] overflow-hidden flex flex-col font-manrope select-none"
      style={{
        animation: '0.8s cubic-bezier(0.16, 1, 0.3, 1) 0s 1 normal forwards running repBg',
      }}
    >
      <style>{`
        @keyframes repBg {
          0% { background-color: rgb(14, 17, 22); }
          100% { background-color: rgb(244, 247, 251); }
        }
        @keyframes repRise {
          0% { transform: translateY(18px); }
          100% { transform: translateY(0); }
        }
        @keyframes repPop {
          0% { opacity: 0; transform: scale(0.3); }
          60% { opacity: 1; transform: scale(1.16); }
          80% { transform: scale(0.96); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes repInk {
          0% { color: rgb(255, 255, 255); }
          100% { color: rgb(38, 50, 73); }
        }
        @keyframes repFadeUp {
          0% { opacity: 0; transform: translateY(14px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2 sm:px-6 md:px-8 flex flex-col max-w-md mx-auto w-full">
        {/* 1. Header de Éxito con Animación repRise, repPop y repInk */}
        <div
          className="flex flex-col items-center text-center mb-3"
          style={{
            animation: '0.7s cubic-bezier(0.16, 1, 0.3, 1) 0s 1 normal forwards running repRise',
          }}
        >
          <span
            className="material-symbols-rounded text-[44px]"
            style={{
              fontVariationSettings: '"FILL" 1',
              color: 'rgb(46, 158, 107)',
              animation: '0.65s cubic-bezier(0.34, 1.56, 0.64, 1) 0.05s 1 normal forwards running repPop',
            }}
          >
            check_circle
          </span>
          <div
            className="font-extrabold text-[20px] mt-1.5 tracking-tight"
            style={{
              animation: '0.7s ease-out 0s 1 normal forwards running repInk',
            }}
          >
            Reporte enviado
          </div>
          <div
            className="font-medium text-[12px] leading-[1.4] text-[#6A7888] mt-1 max-w-[230px]"
            style={{
              opacity: 0,
              animation: '0.6s ease-out 0.15s 1 normal forwards running repFadeUp',
            }}
          >
            Tu evidencia ya está en camino al organismo competente.
          </div>
        </div>

        {/* 2. Tarjetas y Detalles con Animación repFadeUp */}
        <div
          style={{
            opacity: 0,
            animation: '0.65s ease-out 0.22s 1 normal forwards running repFadeUp',
          }}
        >
          {/* Tarjeta 1: Código de Reporte, Categoría y Organismo */}
          <div className="bg-white border border-[#E6ECF3] rounded-[14px] p-[11px_13px] mb-[9px]">
            <div className="flex items-center justify-between">
              <span
                data-testid="success-report-code"
                className="font-extrabold text-[13px] text-[#263249]"
              >
                {reportCode}
              </span>
              <span
                className="font-bold text-[9px] px-[9px] py-[5px] rounded-[9px] tracking-wider"
                style={{
                  color: categoryColor,
                  backgroundColor: categoryBg,
                }}
              >
                {categoryName}
              </span>
            </div>

            <div className="h-[1px] bg-[#EEF1F5] my-[9px]" />

            <div className="flex items-center gap-[9px]">
              <span className="material-symbols-rounded text-[18px] text-[#1E6FCB]">
                account_balance
              </span>
              <span className="font-semibold text-[11.5px] text-[#46566B]">
                {agencyName}
              </span>
            </div>
          </div>

          {/* Tarjeta 2: Línea de Tiempo del Estado */}
          <div className="bg-white border border-[#E6ECF3] rounded-[14px] p-[10px_13px]">
            {/* Paso 1: Enviado */}
            <div className="flex gap-[10px] items-start">
              <span className="w-[20px] h-[20px] rounded-full bg-[#2E9E6B] flex items-center justify-center font-['Material_Symbols_Rounded'] text-[13px] text-white flex-shrink-0">
                check
              </span>
              <div>
                <div className="font-bold text-[12px] text-[#263249]">
                  Enviado
                </div>
                <div className="font-medium text-[10px] text-[#9AA7B5]">
                  {timeLabel}
                </div>
              </div>
            </div>

            <div className="w-[2px] h-[4px] bg-[#DDE4EC] ml-[9px]" />

            {/* Paso 2: En revisión */}
            <div className="flex gap-[10px] items-start">
              <span className="w-[20px] h-[20px] rounded-full border-2 border-[#DDE4EC] flex-shrink-0" />
              <div className="font-bold text-[12px] text-[#9AA7B5] pt-[1px]">
                En revisión
              </div>
            </div>

            <div className="w-[2px] h-[4px] bg-[#DDE4EC] ml-[9px]" />

            {/* Paso 3: Notificado al responsable */}
            <div className="flex gap-[10px] items-start">
              <span className="w-[20px] h-[20px] rounded-full border-2 border-[#DDE4EC] flex-shrink-0" />
              <div className="font-bold text-[12px] text-[#9AA7B5] pt-[1px]">
                Notificado al responsable
              </div>
            </div>

            <div className="w-[2px] h-[4px] bg-[#DDE4EC] ml-[9px]" />

            {/* Paso 4: Resuelto */}
            <div className="flex gap-[10px] items-start">
              <span className="w-[20px] h-[20px] rounded-full border-2 border-[#DDE4EC] flex-shrink-0" />
              <div className="font-bold text-[12px] text-[#9AA7B5] pt-[1px]">
                Resuelto
              </div>
            </div>

            <div className="h-[1px] bg-[#EEF1F5] my-[10px_8px]" />

            {/* Nota Descartado */}
            <div className="flex gap-[8px] items-start">
              <span className="material-symbols-rounded text-[15px] text-[#C3CED9] flex-shrink-0 mt-[1px]">
                block
              </span>
              <span className="font-semibold text-[9.5px] leading-[1.35] text-[#9AA7B5]">
                También puede cerrarse como <b className="text-[#56657A]">Descartado</b>, con el motivo a la vista.
              </span>
            </div>
          </div>

          {/* Fila de Constancia de Consentimiento */}
          <div className="flex items-start gap-[8px] mt-[9px] px-[2px]">
            <span
              className="material-symbols-rounded text-[16px] text-[#2E9E6B] flex-shrink-0"
              style={{ fontVariationSettings: '"FILL" 1' }}
            >
              verified_user
            </span>
            <span className="font-semibold text-[10px] leading-[1.35] text-[#1E6FCB]">
              Consentimiento registrado · v1.2 · {timeLabel.toLowerCase()} ·{' '}
              <button
                type="button"
                onClick={onViewTerms}
                className="font-bold text-[#1E6FCB] underline cursor-pointer bg-transparent border-0 p-0 hover:text-[#15539E]"
              >
                Ver constancia
              </button>
            </span>
          </div>
        </div>
      </div>

      {/* 3. Footer con Botones de Acción */}
      <div
        className="flex-0 p-[0px_16px_12px] max-w-md mx-auto w-full z-20"
        style={{
          opacity: 0,
          animation: '0.65s ease-out 0.3s 1 normal forwards running repFadeUp',
        }}
      >
        <button
          type="button"
          onClick={onViewReport}
          aria-label="Ver el reporte"
          className="w-full bg-[#1E6FCB] rounded-[13px] p-[13px] text-center shadow-[rgba(30,111,203,0.3)_0px_8px_18px] border-0 cursor-pointer text-white font-extrabold text-[14px] hover:brightness-105 active:scale-98 transition-all block"
        >
          Ver el reporte
        </button>

        <button
          type="button"
          onClick={onReturnToMap}
          aria-label="Volver al mapa"
          className="w-full text-center p-[6px] bg-transparent border-0 cursor-pointer font-bold text-[13px] text-[#1E6FCB] hover:text-[#15539E] transition-colors block mt-1"
        >
          Volver al mapa
        </button>
      </div>
    </div>
  );
};

export default ReportSuccessScreen;
