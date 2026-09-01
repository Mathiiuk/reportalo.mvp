import React from 'react';
import {
  Check,
  Info,
  Sparkles,
  Construction,
  Truck,
  Leaf,
  Store,
  HelpCircle,
} from 'lucide-react';
import { motion } from 'framer-motion';

// Mapeo seguro de iconos Lucide correspondientes a Material Symbols
const ICON_MAP = {
  construction: Construction,
  local_shipping: Truck,
  eco: Leaf,
  storefront: Store,
};

/**
 * Componente UI para el Paso 2: Categoría y Descripción del Reporte (REP-2200 / User Journey v2).
 */
export const ReportDetailsStep = ({
  categories = [],
  selectedCategory,
  description,
  onSelectCategory,
  onChangeDescription,
  onBack,
  onContinue,
}) => {
  const currentCategory = categories.find((cat) => cat.id === selectedCategory?.id) || selectedCategory;

  return (
    <div
      data-testid="report-details-step"
      className="w-full h-full flex flex-col justify-between bg-[#F4F7FB]"
    >
      {/* 1. Header con progreso de 3 pasos */}
      <div className="flex-0 bg-white px-4 pt-3 pb-3 border-b border-[#EEF1F5] shadow-2xs">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBack}
            aria-label="Volver a la cámara"
            className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-[#5B6A7A] transition-colors cursor-pointer border-0 bg-transparent p-0"
          >
            <span className="material-symbols-rounded text-[22px]">arrow_back</span>
          </button>
          <span className="font-extrabold text-[16px] text-[#263249] tracking-tight">
            Nuevo reporte
          </span>
        </div>

        {/* Stepper horizontal: 1 Foto (check verde) -> 2 Detalle (azul activo) -> 3 Enviar (gris) */}
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

          {/* Paso 2: Detalle activo */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="w-5 h-5 rounded-full bg-[#1E6FCB] flex items-center justify-center font-extrabold text-[11px] text-white">
              2
            </span>
            <span className="font-bold text-[11px] text-[#1E6FCB]">
              Detalle
            </span>
          </div>

          <span className="flex-1 h-[2px] bg-[#DDE4EC]"></span>

          {/* Paso 3: Enviar pendiente */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="w-5 h-5 rounded-full bg-[#DDE4EC] flex items-center justify-center font-extrabold text-[11px] text-[#8A97A6]">
              3
            </span>
            <span className="font-semibold text-[11px] text-[#9AA7B5]">
              Enviar
            </span>
          </div>
        </div>
      </div>

      {/* 2. Cuerpo del Formulario */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3 max-w-lg mx-auto w-full">
        {/* Título de sección categorías */}
        <div className="font-bold text-[11.5px] text-[#56657A]">
          Categoría del incumplimiento
        </div>

        {/* Grilla 2x2 de Categorías */}
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Categorías">
          {categories.map((cat) => {
            const isSelected = selectedCategory?.id === cat.id;
            const IconComponent = ICON_MAP[cat.icon] || HelpCircle;

            return (
              <button
                key={cat.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => onSelectCategory(cat)}
                className={`relative bg-white rounded-xl p-2.5 text-left transition-all cursor-pointer border ${
                  isSelected
                    ? 'border-transparent shadow-sm'
                    : 'border-[#E6ECF3] hover:border-slate-300'
                }`}
                style={{ minHeight: '68px' }}
              >
                {/* Icono de Material Symbols con color de categoría */}
                <span
                  className="material-symbols-rounded text-[21px]"
                  style={{
                    color: cat.color,
                    fontVariationSettings: '"FILL" 1',
                  }}
                >
                  {cat.icon}
                </span>

                <div className="font-bold text-[11px] leading-tight text-[#34435A] mt-1.5">
                  {cat.name}
                </div>

                {/* Borde activo y check si está seleccionada */}
                {isSelected && (
                  <>
                    <div
                      className="absolute inset-0 rounded-xl pointer-events-none"
                      style={{ border: `2.5px solid ${cat.color}` }}
                    />
                    <span
                      className="absolute top-1.5 right-1.5 w-4.5 h-4.5 rounded-full flex items-center justify-center text-white"
                      style={{ backgroundColor: cat.color }}
                    >
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>

        {/* Banner de Ejemplo según la categoría seleccionada */}
        {currentCategory?.example && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-2 rounded-xl p-2.5"
            style={{
              backgroundColor: currentCategory.bgLight || '#F4F0FD',
            }}
          >
            <Info
              className="w-4 h-4 flex-shrink-0 mt-0.5"
              style={{ color: currentCategory.color || '#7C5CD6' }}
            />
            <span
              className="font-medium text-[10.5px] leading-relaxed"
              style={{ color: currentCategory.color || '#5B4A8A' }}
            >
              {currentCategory.example}
            </span>
          </motion.div>
        )}

        {/* Campo de Descripción */}
        <div className="flex flex-col">
          <label
            htmlFor="report-description"
            className="font-bold text-[11.5px] text-[#56657A] mb-1.5"
          >
            Descripción
          </label>
          <div className="bg-white border border-[#E6ECF3] rounded-xl p-2.5 focus-within:border-[#1E6FCB] focus-within:ring-2 focus-within:ring-[#1E6FCB]/15 transition-all">
            <textarea
              id="report-description"
              value={description}
              onChange={(e) => onChangeDescription(e.target.value)}
              placeholder="Describí brevemente lo que observás (ej.: vehículo obstruyendo rampa, derrame, bache profundo)..."
              rows={3}
              className="w-full text-[11.5px] leading-relaxed font-medium text-[#46566B] placeholder:text-[#94A3B8] border-0 outline-none resize-none bg-transparent"
            />
          </div>
        </div>

        {/* Banner Informativo de Análisis Legal Posterior */}
        <div className="flex items-start gap-2 bg-white border border-dashed border-[#D4DDE7] rounded-xl p-2.5">
          <span className="material-symbols-rounded text-[17px] text-[#8593A2] flex-shrink-0 mt-0.5">
            auto_awesome
          </span>
          <span className="font-medium text-[10.5px] leading-relaxed text-[#7A8696]">
            El análisis legal se hace después de guardar el reporte. Lo vas a ver en el detalle.
          </span>
        </div>
      </div>

      {/* 3. Footer con Botón Continuar */}
      <div className="flex-0 bg-white border-t border-[#EEF1F5] p-3">
        <button
          type="button"
          onClick={onContinue}
          disabled={!selectedCategory}
          aria-label="Continuar"
          className={`w-full py-3.5 px-4 rounded-[13px] text-center font-extrabold text-[14px] text-white transition-all border-0 ${
            selectedCategory
              ? 'bg-[#1E6FCB] shadow-[0_8px_18px_rgba(30,111,203,0.3)] hover:brightness-105 active:scale-98 cursor-pointer'
              : 'bg-slate-300 cursor-not-allowed opacity-70'
          }`}
        >
          Continuar
        </button>
      </div>
    </div>
  );
};
