import React from 'react';
import { motion } from 'framer-motion';

/**
 * Pantalla de confirmación tras el envío del reporte ("Reporte enviado").
 * Diseño exacto User Journey v3.1 / Sprint 10.
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
      className="relative w-full h-[100dvh] bg-[#F4F7FB] overflow-hidden flex flex-col font-manrope select-none"
    >
      <div className="flex-1 overflow-y-auto p-4 sm:px-6 md:px-8 flex flex-col max-w-md mx-auto w-full">
        {/* 1. Header de Éxito con Icono Check */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="flex flex-col items-center text-center mb-3 pt-2"
        >
          <span
            className="material-symbols-rounded text-[44px] text-[#2E9E6B]"
            style={{ fontVariationSettings: '"FILL" 1' }}
          >
            check_circle
          </span>
          <h1 className="font-extrabold text-[20px] text-[#243447] mt-1.5 tracking-tight m-0">
            Reporte enviado
          </h1>
          <p className="font-medium text-[12px] leading-relaxed text-[#6A7888] mt-1 max-w-[240px] m-0">
            Tu evidencia ya está en camino al organismo competente.
          </p>
        </motion.div>

        {/* 2. Tarjeta 1: Código de Reporte, Categoría y Organismo */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="bg-white border border-[#E6ECF3] rounded-[14px] p-3 sm:p-3.5 mb-2.5 shadow-2xs"
        >
          <div className="flex items-center justify-between">
            <span
              data-testid="success-report-code"
              className="font-extrabold text-[13px] text-[#263249]"
            >
              {reportCode}
            </span>
            <span
              className="font-bold text-[9px] px-2 py-1 rounded-[9px] uppercase tracking-wider"
              style={{
                color: categoryColor,
                backgroundColor: categoryBg,
              }}
            >
              {categoryName}
            </span>
          </div>

          <div className="h-[1px] bg-[#EEF1F5] my-2.5" />

          <div className="flex items-center gap-2">
            <span className="material-symbols-rounded text-[18px] text-[#1E6FCB]">
              account_balance
            </span>
            <span className="font-semibold text-[11.5px] text-[#46566B]">
              {agencyName}
            </span>
          </div>
        </motion.div>

        {/* 3. Tarjeta 2: Línea de Tiempo del Estado */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.2 }}
          className="bg-white border border-[#E6ECF3] rounded-[14px] p-3 sm:p-3.5 shadow-2xs flex flex-col"
        >
          {/* Paso 1: Enviado (Activo/Verde) */}
          <div className="flex gap-2.5 items-start">
            <span className="w-5 h-5 rounded-full bg-[#2E9E6B] flex items-center justify-center font-['Material_Symbols_Rounded'] text-[13px] text-white flex-shrink-0">
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

          <div className="w-[2px] h-[5px] bg-[#DDE4EC] ml-[9px]" />

          {/* Paso 2: En revisión */}
          <div className="flex gap-2.5 items-start">
            <span className="w-5 h-5 rounded-full border-2 border-[#DDE4EC] flex-shrink-0" />
            <div className="font-bold text-[12px] text-[#9AA7B5] pt-0.5">
              En revisión
            </div>
          </div>

          <div className="w-[2px] h-[5px] bg-[#DDE4EC] ml-[9px]" />

          {/* Paso 3: Notificado */}
          <div className="flex gap-2.5 items-start">
            <span className="w-5 h-5 rounded-full border-2 border-[#DDE4EC] flex-shrink-0" />
            <div className="font-bold text-[12px] text-[#9AA7B5] pt-0.5">
              Notificado al responsable
            </div>
          </div>

          <div className="w-[2px] h-[5px] bg-[#DDE4EC] ml-[9px]" />

          {/* Paso 4: Resuelto */}
          <div className="flex gap-2.5 items-start">
            <span className="w-5 h-5 rounded-full border-2 border-[#DDE4EC] flex-shrink-0" />
            <div className="font-bold text-[12px] text-[#9AA7B5] pt-0.5">
              Resuelto
            </div>
          </div>

          <div className="h-[1px] bg-[#EEF1F5] my-2.5" />

          {/* Nota Descartado */}
          <div className="flex gap-2 items-start">
            <span className="material-symbols-rounded text-[15px] text-[#C3CED9] flex-shrink-0 mt-0.5">
              block
            </span>
            <span className="font-semibold text-[9.5px] leading-snug text-[#9AA7B5]">
              También puede cerrarse como <b className="text-[#56657A]">Descartado</b>, con el motivo a la vista.
            </span>
          </div>
        </motion.div>

        {/* 4. Fila de Constancia de Consentimiento */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, delay: 0.3 }}
          className="flex items-start gap-2 mt-2.5 px-0.5"
        >
          <span
            className="material-symbols-rounded text-[16px] text-[#2E9E6B] flex-shrink-0 mt-0.5"
            style={{ fontVariationSettings: '"FILL" 1' }}
          >
            verified_user
          </span>
          <span className="font-semibold text-[10px] leading-snug text-[#1E6FCB]">
            Consentimiento registrado · v1.2 · {timeLabel.toLowerCase()} ·{' '}
            <button
              type="button"
              onClick={onViewTerms}
              className="font-bold text-[#1E6FCB] underline cursor-pointer bg-transparent border-0 p-0 hover:text-[#15539E]"
            >
              Ver constancia
            </button>
          </span>
        </motion.div>
      </div>

      {/* 5. Footer con Botones de Acción */}
      <footer className="flex-0 bg-white border-t border-[#EEF1F5] p-3 sm:px-4 flex flex-col gap-2 max-w-md mx-auto w-full z-20">
        <button
          type="button"
          onClick={onViewReport}
          aria-label="Ver el reporte"
          className="w-full bg-[#1E6FCB] rounded-[13px] py-3.5 px-4 text-center shadow-[0_8px_18px_rgba(30,111,203,0.3)] border-0 cursor-pointer text-white font-extrabold text-[14px] hover:brightness-105 active:scale-98 transition-all"
        >
          Ver el reporte
        </button>

        <button
          type="button"
          onClick={onReturnToMap}
          aria-label="Volver al mapa"
          className="text-center py-1.5 bg-transparent border-0 cursor-pointer font-bold text-[13px] text-[#1E6FCB] hover:text-[#15539E] transition-colors"
        >
          Volver al mapa
        </button>
      </footer>
    </div>
  );
};

export default ReportSuccessScreen;
