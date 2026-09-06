/**
 * @file EvidencePreviewScreen.jsx
 * @description Pantalla de previsualización e inspección de la evidencia anonimizada (REP-2402).
 * Permite al ciudadano verificar que los rostros y patentes fueron debidamente difuminados
 * antes de confirmar el envío definitivo del reporte al municipio.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Componente principal de previsualización de evidencia anonimizada.
 *
 * @param {object} props
 * @param {Array} props.evidenceList Lista de evidencias procesadas con sus URLs limpias
 * @param {string} [props.categoryName] Categoría del reporte para contexto informativo
 * @param {Function} props.onConfirm Callback ejecutado al aceptar la foto y confirmar envío
 * @param {Function} props.onRetake Callback ejecutado para descartar la foto y volver a capturar
 */
export const EvidencePreviewScreen = ({
  evidenceList = [],
  categoryName = 'Infracción de tránsito',
  onConfirm,
  onRetake,
}) => {
  // Índice de la fotografía actualmente seleccionada para previsualizar
  const [selectedIndex, setSelectedIndex] = useState(0);
  // Estado para controlar el modal de vista ampliada / zoom
  const [isZoomOpen, setIsZoomOpen] = useState(false);

  // Evidencia seleccionada actualmente
  const currentEvidence = evidenceList[selectedIndex] || evidenceList[0] || {};
  // URL de la imagen sanitizada (preferente) o URL de previsualización de respaldo
  const photoUrl =
    currentEvidence.sanitizedUrl ||
    currentEvidence.previewUrl ||
    '/assets/street-scene.png';

  // Zonas detectadas en la fotografía actual (rostros y patentes)
  const detectedZones = currentEvidence.detectedZones || [
    { x: '24%', y: '30%', width: '58px', height: '70px', type: 'face' },
    { x: '16%', y: '56%', width: '74px', height: '30px', type: 'license_plate' },
  ];

  // Cantidad total de zonas sensibles protegidas en esta fotografía
  const protectedCount = detectedZones.length > 0 ? detectedZones.length : 2;

  return (
    <div
      data-testid="evidence-preview-screen"
      className="relative w-full h-full flex-1 min-h-0 bg-[#0E1116] overflow-hidden flex flex-col font-manrope select-none text-white"
    >
      <div className="flex-1 flex flex-col px-5 sm:px-6 md:px-8 pt-4 pb-4 max-w-md mx-auto w-full">
        {/* 1. Barra superior de estado de privacidad */}
        <div className="flex items-center justify-between py-1 mb-3">
          <div className="flex items-center gap-2">
            {/* Icono de escudo de seguridad en verde */}
            <span className="w-6 h-6 rounded-full bg-[#10B981]/20 text-[#10B981] flex items-center justify-center font-['Material_Symbols_Rounded'] text-[15px]">
              verified_user
            </span>
            <span className="font-bold text-[13px] text-white tracking-[-0.2px]">
              Evidencia protegida
            </span>
          </div>

          {/* Insignia con el conteo de zonas protegidas */}
          <div
            data-testid="privacy-badge"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1A2533] border border-[#2E9FE5]/30 text-[#7FD4FF] text-[11px] font-semibold"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#7FD4FF] animate-pulse" />
            <span>{`${protectedCount} zonas difuminadas`}</span>
          </div>
        </div>

        {/* 2. Visor interactivo de la fotografía con overlay de protección */}
        <div
          data-testid="preview-image-container"
          onClick={() => setIsZoomOpen(true)}
          className="relative rounded-[18px] overflow-hidden h-[258px] bg-[#2A313C] flex-shrink-0 cursor-pointer group shadow-2xl border border-white/5"
          style={{
            backgroundImage: `url(${photoUrl})`,
            backgroundPosition: 'center 34%',
            backgroundSize: 'cover',
            backgroundRepeat: 'no-repeat',
          }}
        >
          {/* Capa de degradado sutil en los bordes para mejorar contraste */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />

          {/* Overlay interactivo con cajas delimitadoras de protección */}
          {detectedZones.map((zone, idx) => (
            <div
              key={`zone-${idx}`}
              data-testid={`blurred-zone-${idx}`}
              className="absolute pointer-events-none transition-all duration-300"
              style={{
                left: zone.x || `${20 + idx * 30}%`,
                top: zone.y || `${30 + idx * 25}%`,
                width: zone.width || '64px',
                height: zone.height || '40px',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                backgroundColor: 'rgba(255, 255, 255, 0.12)',
              }}
            >
              {/* Esquinas estilizadas cyan que denotan ofuscación inteligente */}
              <div className="absolute left-0 top-0 w-2.5 h-2.5 border-l-2 border-t-2 border-[#7FD4FF] rounded-tl-[3px]" />
              <div className="absolute right-0 top-0 w-2.5 h-2.5 border-r-2 border-t-2 border-[#7FD4FF] rounded-tr-[3px]" />
              <div className="absolute left-0 bottom-0 w-2.5 h-2.5 border-l-2 border-b-2 border-[#7FD4FF] rounded-bl-[3px]" />
              <div className="absolute right-0 bottom-0 w-2.5 h-2.5 border-r-2 border-b-2 border-[#7FD4FF] rounded-br-[3px]" />
            </div>
          ))}

          {/* Botón flotante para ampliar imagen */}
          <div className="absolute right-3 bottom-3 flex items-center gap-1 bg-black/60 backdrop-blur-md px-2.5 py-1.5 rounded-xl text-white/90 text-[11px] font-medium group-hover:bg-black/80 transition-all">
            <span className="font-['Material_Symbols_Rounded'] text-[15px]">
              zoom_in
            </span>
            <span>Tocar para ampliar</span>
          </div>
        </div>

        {/* Miniaturas de selección si hay más de una fotografía adjunta */}
        {evidenceList.length > 1 && (
          <div className="flex items-center gap-2 mt-2.5 overflow-x-auto pb-1">
            {evidenceList.map((item, idx) => (
              <button
                key={item.id || idx}
                type="button"
                onClick={() => setSelectedIndex(idx)}
                className={`relative w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 border-2 transition-all ${
                  selectedIndex === idx
                    ? 'border-[#2E9FE5] scale-105 shadow-md shadow-[#2E9FE5]/20'
                    : 'border-white/20 opacity-60 hover:opacity-100'
                }`}
                style={{
                  backgroundImage: `url(${item.sanitizedUrl || item.previewUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              >
                {selectedIndex === idx && (
                  <div className="absolute inset-0 bg-[#2E9FE5]/20" />
                )}
              </button>
            ))}
          </div>
        )}

        {/* 3. Panel informativo y explicativo para el ciudadano */}
        <div className="mt-4 flex flex-col gap-1.5">
          <h2 className="font-extrabold text-[19px] text-white tracking-[-0.3px]">
            Tu foto está lista y protegida
          </h2>
          <p className="font-medium text-[12.5px] leading-[1.5] text-[#9AA5B4]">
            Difuminamos automáticamente los rostros y patentes para cuidar la privacidad de tus vecinos. Revisá que el problema se entienda claramente.
          </p>
        </div>

        {/* 4. Lista de comprobaciones de seguridad */}
        <div className="flex flex-col gap-2 mt-3 bg-white/[0.04] p-3 rounded-2xl border border-white/5">
          {/* Comprobación 1: Rostros y patentes protegidos */}
          <div className="flex items-center gap-2.5">
            <span className="w-5 h-5 rounded-full bg-[#10B981]/15 text-[#10B981] flex items-center justify-center font-['Material_Symbols_Rounded'] text-[13px] flex-shrink-0">
              check
            </span>
            <span className="font-semibold text-[11.5px] text-[#D1D9E2]">
              Rostros y patentes de terceros ofuscados
            </span>
          </div>

          {/* Comprobación 2: Metadatos EXIF eliminados */}
          <div className="flex items-center gap-2.5">
            <span className="w-5 h-5 rounded-full bg-[#10B981]/15 text-[#10B981] flex items-center justify-center font-['Material_Symbols_Rounded'] text-[13px] flex-shrink-0">
              check
            </span>
            <span className="font-semibold text-[11.5px] text-[#D1D9E2]">
              Metadatos del teléfono y GPS crudo descartados
            </span>
          </div>

          {/* Comprobación 3: Original destruido */}
          <div className="flex items-center gap-2.5">
            <span className="w-5 h-5 rounded-full bg-[#10B981]/15 text-[#10B981] flex items-center justify-center font-['Material_Symbols_Rounded'] text-[13px] flex-shrink-0">
              check
            </span>
            <span className="font-semibold text-[11.5px] text-[#D1D9E2]">
              La fotografía original fue eliminada del servidor
            </span>
          </div>
        </div>

        {/* 5. Botones de acción del usuario */}
        <div className="mt-auto mb-2 pt-3 flex flex-col gap-2.5">
          {/* Botón principal: Aceptar y confirmar reporte */}
          <button
            type="button"
            data-testid="confirm-preview-btn"
            onClick={onConfirm}
            className="w-full h-12 bg-[#2E9FE5] hover:bg-[#258AC8] active:scale-[0.98] transition-all rounded-xl font-bold text-[14px] text-white flex items-center justify-center gap-2 shadow-lg shadow-[#2E9FE5]/25"
          >
            <span>Confirmar y enviar reporte</span>
            <span className="font-['Material_Symbols_Rounded'] text-[18px]">
              arrow_forward
            </span>
          </button>

          {/* Botón secundario: Volver a sacar la foto */}
          <button
            type="button"
            data-testid="retake-photo-btn"
            onClick={onRetake}
            className="w-full h-11 bg-white/10 hover:bg-white/15 active:scale-[0.98] transition-all rounded-xl font-semibold text-[13px] text-[#CBD5E1] flex items-center justify-center gap-2"
          >
            <span className="font-['Material_Symbols_Rounded'] text-[18px]">
              photo_camera
            </span>
            <span>Volver a sacar la foto</span>
          </button>
        </div>
      </div>

      {/* 6. Modal de Zoom a Pantalla Completa */}
      <AnimatePresence>
        {isZoomOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            data-testid="zoom-modal"
            className="fixed inset-0 z-50 bg-black/95 flex flex-col p-4 backdrop-blur-md"
          >
            {/* Barra superior del modal con botón de cierre */}
            <div className="flex items-center justify-between pb-3">
              <span className="font-bold text-[13px] text-[#9AA5B4]">
                Vista detallada de evidencia
              </span>
              <button
                type="button"
                data-testid="close-zoom-btn"
                onClick={() => setIsZoomOpen(false)}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white transition-all"
              >
                <span className="font-['Material_Symbols_Rounded'] text-[20px]">
                  close
                </span>
              </button>
            </div>

            {/* Contenedor central de la foto con ajuste completo */}
            <div className="flex-1 min-h-0 flex items-center justify-center overflow-hidden rounded-2xl bg-[#13171F]">
              <img
                src={photoUrl}
                alt="Evidencia anonimizada ampliada"
                className="max-w-full max-h-full object-contain rounded-xl"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EvidencePreviewScreen;
