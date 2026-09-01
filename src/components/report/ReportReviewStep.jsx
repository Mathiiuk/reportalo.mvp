import React from 'react';
import {
  Check,
  Clock,
  MapPin,
  Info,
  Send,
  ArrowLeft,
} from 'lucide-react';

/**
 * Componente UI para el Paso 3: Revisión y Envío del Reporte (User Journey v2).
 */
export const ReportReviewStep = ({
  evidenceList = [],
  selectedCategory,
  description,
  geolocation,
  address,
  onBack,
  onSubmit,
  onViewAllPhotos,
  onOpenTerms,
}) => {
  const photoCount = evidenceList.length;
  const photoLabel = `${photoCount} ${photoCount === 1 ? 'foto adjunta' : 'fotos adjuntas'}`;

  // Dirección visible: si no hay dirección geocodificada, mostrar coordenadas o Avellaneda por defecto
  const displayAddress =
    address ||
    (geolocation?.lat
      ? `Lat: ${geolocation.lat.toFixed(4)}, Lng: ${geolocation.lng.toFixed(4)}`
      : 'Av. Mitre 1240, Avellaneda');

  return (
    <div
      data-testid="report-review-step"
      className="w-full h-full flex flex-col justify-between bg-[#F4F7FB]"
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
                onClick={onViewAllPhotos || onBack}
                className="font-bold text-[10.5px] text-[#1E6FCB] bg-transparent border-0 cursor-pointer hover:underline p-0"
              >
                Ver todas
              </button>
            )}
          </div>

          <div className="flex gap-2">
            {/* Miniaturas de fotos */}
            {evidenceList.slice(0, 2).map((item, idx) => (
              <div
                key={item.id || idx}
                className="w-16 h-16 rounded-[11px] overflow-hidden bg-[#CFD8E2] border border-slate-200 shadow-xs flex-shrink-0"
              >
                <img
                  src={item.previewUrl}
                  alt={`Evidencia ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}

            {/* Texto informativo offline/privacidad */}
            <div className="flex-1 flex flex-col justify-center gap-1 pl-1">
              <div className="inline-flex items-center gap-1 text-[#8593A2]">
                <span className="material-symbols-rounded text-[14px]">schedule</span>
                <span className="font-bold text-[9.5px]">
                  Todavía en tu teléfono
                </span>
              </div>
              <span className="font-medium text-[9.5px] leading-tight text-[#8593A2]">
                Se suben y se anonimizan al enviar
              </span>
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
              {selectedCategory?.name || 'Infracción de tránsito'}
            </span>
          </div>

          <div className="h-[1px] bg-[#EEF1F5]" />

          {/* Fila Descripción */}
          <div>
            <div className="font-semibold text-[11px] text-[#8593A2] mb-1">
              Descripción
            </div>
            <div className="font-medium text-[11.5px] leading-relaxed text-[#46566B]">
              {description || 'Sin descripción detallada.'}
            </div>
          </div>

          <div className="h-[1px] bg-[#EEF1F5]" />

          {/* Fila Ubicación */}
          <div className="flex items-center gap-2">
            <span className="material-symbols-rounded text-[18px] text-[#1E6FCB] flex-shrink-0">
              location_on
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-[10px] text-[#8593A2]">
                Ubicación
              </div>
              <div className="font-bold text-[11.5px] text-[#34435A] truncate">
                {displayAddress}
              </div>
            </div>
          </div>
        </div>

        {/* Tarjeta 3: Banner de Identidad Anónima */}
        <div className="flex items-start gap-2 bg-[#FFF7EE] border border-[#F7E2C8] rounded-xl p-2.5">
          <span className="material-symbols-rounded text-[17px] text-[#E07C1A] flex-shrink-0 mt-0.5" style={{ fontVariationSettings: '"FILL" 1' }}>
            info
          </span>
          <span className="font-medium text-[10.5px] leading-relaxed text-[#8A6A3E]">
            Tu identidad permanece anónima para el organismo receptor.
          </span>
        </div>
      </div>

      {/* 3. Footer con Botón Enviar reporte y disclaimer de Términos */}
      <div className="flex-0 bg-white border-t border-[#EEF1F5] p-3 flex flex-col">
        <button
          type="button"
          onClick={onSubmit}
          aria-label="Enviar reporte"
          className="w-full py-3.5 px-4 rounded-[13px] bg-[#1E6FCB] shadow-[0_8px_18px_rgba(30,111,203,0.3)] hover:brightness-105 active:scale-98 text-center flex items-center justify-center gap-2 text-white font-extrabold text-[14px] cursor-pointer border-0 transition-all"
        >
          <span>Enviar reporte</span>
          <span className="material-symbols-rounded text-[18px]">send</span>
        </button>

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
      </div>
    </div>
  );
};
