import React, { useState } from 'react';
import {
  Check,
  MapPin,
  Send,
  Shield,
  Trash2,
  Gavel,
  ArrowRight,
  ArrowLeft,
  Share2,
  X,
  Camera,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Componente UI para el Paso 3: Revisión y Modal "Antes de enviar" (User Journey v2).
 * Incluye visor modal de fotos para no perder el estado ni retroceder de paso.
 */
export const ReportReviewStep = ({
  evidenceList = [],
  selectedCategory,
  description,
  geolocation,
  address,
  hasAcceptedTerms = false,
  isOnline = true,
  draftStatus = 'DRAFT_LOCAL',
  onBack,
  onSubmitReport,
  onAcceptTermsAndSubmit,
  onOpenTerms,
  onOpenAdjustLocation,
}) => {

  const [showConsentModal, setShowConsentModal] = useState(false);
  const [showPhotosGalleryModal, setShowPhotosGalleryModal] = useState(false);
  const photoCount = evidenceList.length;
  const photoLabel = `${photoCount} ${photoCount === 1 ? 'foto adjunta' : 'fotos adjuntas'}`;

  const displayAddress =
    address ||
    (geolocation?.lat
      ? `Lat: ${geolocation.lat.toFixed(4)}, Lng: ${geolocation.lng.toFixed(4)}`
      : 'Av. Mitre 1240, Avellaneda');

  const handleSendClick = () => {
    if (hasAcceptedTerms) {
      // Quien ya aceptó pasa derecho al envío
      onSubmitReport();
    } else {
      // Primer reporte: abre el modal bottom sheet de consentimiento
      setShowConsentModal(true);
    }
  };

  const handleAcceptAndSend = () => {
    setShowConsentModal(false);
    onAcceptTermsAndSubmit();
  };

  return (
    <div
      data-testid="report-review-step"
      className="relative w-full h-full flex flex-col justify-between bg-[#F4F7FB]"
    >
      {/* 1. Header con stepper de 3 pasos completados */}
      <div className="flex-0 bg-white px-4 pt-3 pb-3 border-b border-[#EEF1F5] shadow-2xs">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBack}
            aria-label="Volver al detalle"
            className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-[#5B6A7A] transition-colors cursor-pointer border-0 bg-transparent p-0"
          >
            <span className="material-symbols-rounded text-[22px]">arrow_back</span>
          </button>
          <span className="font-extrabold text-[16px] text-[#263249] tracking-tight">
            Nuevo reporte
          </span>
        </div>

        {/* Stepper horizontal: 1 Foto (check verde) -> 2 Detalle (check verde) -> 3 Enviar (azul activo) */}
        <div className="flex items-center gap-1.5 mt-3 px-1">
          {/* Paso 1: Foto completada */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="w-5 h-5 rounded-full bg-[#2E9E6B] flex items-center justify-center text-white">
              <Check className="w-3 h-3 stroke-[3]" />
            </span>
            <span className="font-bold text-[11px] text-[#2E9E6B]">
              Foto
            </span>
          </div>

          <span className="flex-1 h-[2px] bg-[#1E6FCB]"></span>

          {/* Paso 2: Detalle completado */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="w-5 h-5 rounded-full bg-[#2E9E6B] flex items-center justify-center text-white">
              <Check className="w-3 h-3 stroke-[3]" />
            </span>
            <span className="font-bold text-[11px] text-[#2E9E6B]">
              Detalle
            </span>
          </div>

          <span className="flex-1 h-[2px] bg-[#1E6FCB]"></span>

          {/* Paso 3: Enviar activo */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="w-5 h-5 rounded-full bg-[#1E6FCB] flex items-center justify-center font-extrabold text-[11px] text-white">
              3
            </span>
            <span className="font-bold text-[11px] text-[#1E6FCB]">
              Enviar
            </span>
          </div>
        </div>
      </div>

      {/* 2. Cuerpo con tarjetas de resumen */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2.5 max-w-lg mx-auto w-full">
        {/* Título de sección */}
        <div className="font-bold text-[11.5px] text-[#56657A]">
          Revisá antes de enviar
        </div>

        {/* Tarjeta 1: Evidencias fotográficas */}
        <div className="bg-white border border-[#E6ECF3] rounded-[13px] p-3 shadow-2xs">
          <div className="flex items-center justify-between mb-2.5">
            <span className="font-bold text-[12px] text-[#263249]">
              {photoLabel}
            </span>
            {photoCount > 0 && (
              <button
                type="button"
                onClick={() => setShowPhotosGalleryModal(true)}
                className="font-bold text-[10.5px] text-[#1E6FCB] bg-transparent border-0 cursor-pointer hover:underline p-0"
              >
                Ver todas
              </button>
            )}
          </div>

          <div className="flex gap-2 items-center">
            {/* Miniaturas de fotos */}
            <div
              className="flex gap-2 cursor-pointer"
              onClick={() => setShowPhotosGalleryModal(true)}
              title="Abrir visor de fotos"
            >
              {evidenceList.slice(0, 3).map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="w-16 h-16 rounded-[11px] overflow-hidden bg-[#CFD8E2] border border-slate-200 shadow-xs flex-shrink-0 hover:scale-105 transition-transform"
                >
                  <img
                    src={item.previewUrl}
                    alt={`Evidencia ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>

            {/* Texto informativo offline/privacidad */}
            <div className="flex-1 flex flex-col justify-center gap-1 pl-1">
              {!isOnline || draftStatus === 'PENDING_SYNC' ? (
                <>
                  <div className="inline-flex items-center gap-1 text-[#D97706]">
                    <span className="material-symbols-rounded text-[14px]">cloud_off</span>
                    <span className="font-bold text-[9.5px]">
                      Evidencia local (PENDING_SYNC)
                    </span>
                  </div>
                  <span className="font-medium text-[9.5px] leading-tight text-[#8593A2]">
                    Pendiente de procesar por el servidor
                  </span>
                </>
              ) : (
                <>
                  <div className="inline-flex items-center gap-1 text-[#8593A2]">
                    <span className="material-symbols-rounded text-[14px]">schedule</span>
                    <span className="font-bold text-[9.5px]">
                      Todavía en tu teléfono
                    </span>
                  </div>
                  <span className="font-medium text-[9.5px] leading-tight text-[#8593A2]">
                    Se suben y se anonimizan al enviar
                  </span>
                </>
              )}
            </div>

          </div>
        </div>

        {/* Tarjeta 2: Detalles del Reporte (Categoría, Descripción, Ubicación) */}
        <div className="bg-white border border-[#E6ECF3] rounded-[13px] p-3.5 flex flex-col gap-2.5 shadow-2xs">
          {/* Fila Categoría */}
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[11px] text-[#8593A2]">
              Categoría
            </span>
            <span
              className="font-bold text-[10.5px] px-2.5 py-1 rounded-[9px]"
              style={{
                color: selectedCategory?.color || '#F78E35',
                backgroundColor: selectedCategory?.bgLight || '#FFF2E6',
              }}
            >
              {selectedCategory?.name || 'Tránsito'}
            </span>
          </div>

          <div className="h-[1px] bg-[#EEF1F5]" />

          {/* Fila Descripción */}
          <div>
            <div className="font-semibold text-[11px] text-[#8593A2] mb-1">
              Descripción
            </div>
            <div className="font-medium text-[11.5px] leading-relaxed text-[#46566B]">
              {description || 'Camión de gran porte circulando por calle residencial, a las 14:30.'}
            </div>
          </div>

          <div className="h-[1px] bg-[#EEF1F5]" />

          {/* Fila Ubicación */}
          <div className="flex items-center gap-2">
            <span className="material-symbols-rounded text-[17px] text-[#1E6FCB] flex-shrink-0">
              location_on
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-[10px] text-[#8593A2]">
                Ubicación
              </div>
              <div className="font-bold text-[11px] text-[#34435A] truncate">
                {displayAddress}
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenAdjustLocation}
              aria-label="Ajustar ubicación"
              className="font-extrabold text-[10px] text-[#1E6FCB] bg-[#E8F1FB] hover:bg-[#D7E8FA] rounded-[9px] py-1.5 px-3 cursor-pointer border-0 transition-colors flex-shrink-0"
            >
              Ajustar
            </button>
          </div>
        </div>

        {/* Tarjeta 3: Banner de Identidad Anónima */}
        <div className="flex items-start gap-2 bg-[#FFF7EE] border border-[#F7E2C8] rounded-xl p-2.5">
          <span
            className="material-symbols-rounded text-[17px] text-[#E07C1A] flex-shrink-0 mt-0.5"
            style={{ fontVariationSettings: '"FILL" 1' }}
          >
            info
          </span>
          <span className="font-medium text-[10.5px] leading-relaxed text-[#8A6A3E]">
            Tu identidad permanece anónima para el organismo receptor.
          </span>
        </div>
      </div>

      {/* 3. Footer con Botón Enviar reporte y disclaimer de Términos */}
      <div className="flex-0 bg-white border-top border-[#EEF1F5] p-3 flex flex-col">
        <button
          type="button"
          onClick={handleSendClick}
          aria-label={!isOnline ? 'Guardar reporte offline' : 'Enviar reporte'}
          className="w-full py-3.5 px-4 rounded-[13px] bg-[#1E6FCB] shadow-[0_8px_18px_rgba(30,111,203,0.3)] hover:brightness-105 active:scale-98 text-center flex items-center justify-center gap-2 text-white font-extrabold text-[14px] cursor-pointer border-0 transition-all"
        >
          <span>{!isOnline ? 'Guardar reporte (Offline)' : 'Enviar reporte'}</span>
          <span className="material-symbols-rounded text-[18px]">
            {!isOnline ? 'save' : 'send'}
          </span>
        </button>


        {!hasAcceptedTerms && (
          <div className="text-center pt-2">
            <span className="font-medium text-[9.5px] leading-relaxed text-[#9AA7B5]">
              Antes de enviar te vamos a pedir aceptar los{' '}
              <button
                type="button"
                onClick={onOpenTerms}
                className="text-[#8593A2] underline bg-transparent border-0 p-0 cursor-pointer font-medium text-[9.5px]"
              >
                términos
              </button>
              .
            </span>
          </div>
        )}
      </div>

      {/* 4. MODAL DE VISUALIZACIÓN DE FOTOS DEL REPORTE */}
      <AnimatePresence>
        {showPhotosGalleryModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col justify-between p-4"
          >
            {/* Header del modal */}
            <div className="flex items-center justify-between pt-[max(8px,env(safe-area-inset-top,8px))]">
              <span className="font-extrabold text-[15px] text-white">
                Fotos adjuntas al reporte ({photoCount})
              </span>
              <button
                type="button"
                onClick={() => setShowPhotosGalleryModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white cursor-pointer border-0"
                aria-label="Cerrar visor de fotos"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Grid de fotos en tamaño grande */}
            <div className="flex-1 overflow-y-auto py-4 grid grid-cols-2 gap-3.5 items-center justify-center max-w-md mx-auto w-full">
              {evidenceList.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="relative rounded-2xl overflow-hidden aspect-square border-2 border-white/20 bg-slate-900 shadow-lg"
                >
                  <img src={item.previewUrl} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 font-extrabold text-[10px] text-white">
                    #{idx + 1}
                  </span>
                </div>
              ))}
            </div>

            {/* Footer del modal: volver al Paso 3 intacto */}
            <div className="flex flex-col gap-2 max-w-md mx-auto w-full pb-[max(8px,env(safe-area-inset-bottom,8px))]">
              <button
                type="button"
                onClick={() => setShowPhotosGalleryModal(false)}
                className="w-full py-3.5 rounded-xl bg-[#1E6FCB] text-white font-extrabold text-[13.5px] cursor-pointer border-0 hover:bg-[#15539E] transition-colors"
              >
                Volver a la revisión
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5. MODAL BOTTOM SHEET: "Antes de enviar" (DECISIÓN D01) */}
      <AnimatePresence>
        {showConsentModal && (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            {/* Backdrop oscuro */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowConsentModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />

            {/* Sheet modal flotante */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 280 }}
              className="relative w-full max-w-md bg-white rounded-t-[28px] p-6 pb-[max(24px,env(safe-area-inset-bottom,24px))] shadow-2xl flex flex-col gap-3 z-10"
            >
              {/* Handle superior de arrastre */}
              <div className="w-12 h-1.5 rounded-full bg-slate-200 mx-auto mb-1" />

              {/* Título */}
              <div className="font-extrabold text-[18px] text-[#243447] tracking-tight">
                Antes de enviar
              </div>

              {/* Puntos clave de consentimiento */}
              <div className="flex flex-col gap-2.5 my-1">
                <div className="flex gap-2.5 items-start">
                  <span
                    className="material-symbols-rounded text-[18px] text-[#1E6FCB] flex-shrink-0"
                    style={{ fontVariationSettings: '"FILL" 1' }}
                  >
                    visibility_off
                  </span>
                  <span className="font-medium text-[11.5px] leading-snug text-[#46566B]">
                    El organismo receptor nunca ve tus datos personales.
                  </span>
                </div>

                <div className="flex gap-2.5 items-start">
                  <span
                    className="material-symbols-rounded text-[18px] text-[#1E6FCB] flex-shrink-0"
                    style={{ fontVariationSettings: '"FILL" 1' }}
                  >
                    blur_on
                  </span>
                  <span className="font-medium text-[11.5px] leading-snug text-[#46566B]">
                    Rostros y patentes se difuminan antes de guardarse.
                  </span>
                </div>

                <div className="flex gap-2.5 items-start">
                  <span
                    className="material-symbols-rounded text-[18px] text-[#1E6FCB] flex-shrink-0"
                    style={{ fontVariationSettings: '"FILL" 1' }}
                  >
                    delete_forever
                  </span>
                  <span className="font-medium text-[11.5px] leading-snug text-[#46566B]">
                    Guardamos solo la versión anonimizada. El original se descarta.
                  </span>
                </div>

                <div className="flex gap-2.5 items-start">
                  <span
                    className="material-symbols-rounded text-[18px] text-[#1E6FCB] flex-shrink-0"
                    style={{ fontVariationSettings: '"FILL" 1' }}
                  >
                    gavel
                  </span>
                  <span className="font-medium text-[11.5px] leading-snug text-[#46566B]">
                    Podés pedir acceso, rectificación y supresión (Ley 25.326).
                  </span>
                </div>
              </div>

              {/* Link a leer términos completos */}
              <button
                type="button"
                onClick={onOpenTerms}
                className="inline-flex items-center gap-1.5 font-bold text-[11.5px] text-[#1E6FCB] bg-transparent border-0 p-0 cursor-pointer my-3 text-left hover:underline"
              >
                <span>Leer términos y privacidad · v1.2</span>
                <span className="material-symbols-rounded text-[15px]">arrow_forward</span>
              </button>

              {/* Botón Principal: "Acepto y envío" */}
              <button
                type="button"
                onClick={handleAcceptAndSend}
                aria-label="Acepto y envío"
                className="w-full py-3.5 px-4 rounded-[13px] bg-[#1E6FCB] shadow-[0_8px_18px_rgba(30,111,203,0.3)] hover:brightness-105 active:scale-98 text-center flex items-center justify-center gap-2 text-white font-extrabold text-[14px] cursor-pointer border-0 transition-all"
              >
                <span>Acepto y envío</span>
                <span className="material-symbols-rounded text-[18px]">send</span>
              </button>

              {/* Botón Secundario: "Ahora no" (vuelve al Paso 3 intacto sin bloquear) */}
              <button
                type="button"
                onClick={() => setShowConsentModal(false)}
                aria-label="Ahora no"
                className="text-center py-2.5 font-bold text-[12px] text-[#8593A2] hover:text-[#56657A] bg-transparent border-0 cursor-pointer transition-colors"
              >
                Ahora no
              </button>

              <div className="text-center">
                <span className="font-medium text-[9.5px] leading-relaxed text-[#9AA7B5]">
                  Queda registrada la versión y la fecha de tu aceptación.
                </span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ReportReviewStep;
