import React, { useRef } from 'react';
import {
  Check,
  Info,
  Sparkles,
  Construction,
  Truck,
  Leaf,
  Store,
  HeartHandshake,
  HelpCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ReportFlowHeader } from './ReportFlowHeader';
import { getCategoryTone } from './categoryTone';

// Ícono Lucide por código de ícono de la categoría (bundleado, no depende de una fuente externa)
const ICON_MAP = {
  construction: Construction,
  local_shipping: Truck,
  eco: Leaf,
  storefront: Store,
  heart_handshake: HeartHandshake,
};

const ARROW_STEP = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

/**
 * Paso 2 del alta de reporte: categoría y descripción.
 * UJ v3.3 · M10 «Clasificar» (REP-3791 Bloque 1 · mobile). Mismo contrato de props que antes.
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
  const radioRefs = useRef([]);
  const currentCategory =
    categories.find((cat) => cat.id === selectedCategory?.id) || selectedCategory;
  const currentTone = currentCategory ? getCategoryTone(currentCategory) : null;

  const selectedIndex = categories.findIndex((cat) => cat.id === selectedCategory?.id);
  const tabbableIndex = selectedIndex >= 0 ? selectedIndex : 0;

  // Grupo de opciones accesible: las flechas mueven la selección (patrón ARIA radiogroup)
  const handleRadioKeyDown = (event, index) => {
    const delta = ARROW_STEP[event.key];
    if (!delta || categories.length === 0) return;
    event.preventDefault();
    const nextIndex = (index + delta + categories.length) % categories.length;
    onSelectCategory(categories[nextIndex]);
    radioRefs.current[nextIndex]?.focus();
  };

  return (
    <div data-testid="report-details-step" className="flex h-full w-full flex-col bg-rep-bg">
      <ReportFlowHeader step={2} onBack={onBack} backLabel="Volver a la cámara" />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-4">
          {/* Categoría */}
          <section className="flex flex-col gap-2.5" aria-labelledby="report-category-label">
            <h2 id="report-category-label" className="m-0 text-rep-label font-bold text-rep-ink-label">
              Categoría del incumplimiento
            </h2>

            <div
              role="radiogroup"
              aria-labelledby="report-category-label"
              aria-describedby={!selectedCategory ? 'report-category-required' : undefined}
              className="grid grid-cols-2 gap-2.5"
            >
              {categories.map((cat, index) => {
                const isSelected = selectedCategory?.id === cat.id;
                const tone = getCategoryTone(cat);
                const IconComponent = ICON_MAP[cat.icon] || HelpCircle;

                return (
                  <button
                    key={cat.id}
                    ref={(element) => {
                      radioRefs.current[index] = element;
                    }}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    tabIndex={index === tabbableIndex ? 0 : -1}
                    onClick={() => onSelectCategory(cat)}
                    onKeyDown={(event) => handleRadioKeyDown(event, index)}
                    className="rep-focus relative flex min-h-[88px] flex-col items-start gap-2 rounded-2xl border border-rep-border bg-rep-surface p-3.5 text-left shadow-rep-card transition-[transform,filter] duration-120 active:scale-[0.98] md:hover:brightness-[.96] dark:md:hover:brightness-[1.06]"
                  >
                    <IconComponent
                      aria-hidden="true"
                      className="h-6 w-6"
                      style={{ color: tone.base }}
                      strokeWidth={2.25}
                    />
                    <span className="pr-6 text-rep-body font-bold leading-tight text-rep-ink">
                      {cat.name}
                    </span>

                    {isSelected && (
                      <>
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 rounded-2xl"
                          style={{ boxShadow: `inset 0 0 0 2.5px ${tone.base}` }}
                        />
                        <span
                          aria-hidden="true"
                          className="absolute right-2.5 top-2.5 flex h-[22px] w-[22px] items-center justify-center rounded-full text-rep-on-accent"
                          style={{ backgroundColor: tone.base }}
                        >
                          <Check className="h-3.5 w-3.5" strokeWidth={3} />
                        </span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>

            {/* REP-2202: si falta la categoría, se indica qué falta completar */}
            {!selectedCategory && (
              <p id="report-category-required" role="status" className="m-0 text-rep-label text-rep-danger">
                Elegí una categoría para continuar.
              </p>
            )}
          </section>

          {/* Ejemplos de la categoría elegida */}
          <AnimatePresence mode="wait" initial={false}>
            {currentCategory?.example && (
              <motion.div
                key={currentCategory.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="flex items-start gap-2.5 rounded-2xl p-3.5"
                style={{ backgroundColor: currentTone.soft }}
              >
                <Info
                  aria-hidden="true"
                  className="mt-0.5 h-[18px] w-[18px] shrink-0"
                  style={{ color: currentTone.base }}
                  strokeWidth={2.25}
                />
                <p className="m-0 text-rep-label font-medium" style={{ color: currentTone.ink }}>
                  {currentCategory.example}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Descripción */}
          <div className="flex flex-col gap-2">
            <label htmlFor="report-description" className="text-rep-label font-bold text-rep-ink-label">
              Descripción
            </label>
            <textarea
              id="report-description"
              value={description}
              onChange={(event) => onChangeDescription(event.target.value)}
              placeholder="Describí brevemente lo que observás (ej.: vehículo obstruyendo rampa, derrame, bache profundo)..."
              rows={3}
              className="block w-full select-text resize-none rounded-2xl border border-rep-border bg-rep-surface px-3.5 py-3 text-rep-input text-rep-ink-body outline-none transition-colors duration-120 placeholder:text-rep-ink-faint focus:border-rep-accent focus:ring-2 focus:ring-rep-accent/15"
            />
          </div>

          {/* Anticipa dónde aparece el fundamento legal (el análisis corre después de guardar) */}
          <div className="flex items-start gap-2.5 rounded-2xl border border-dashed border-rep-border bg-rep-surface p-3.5">
            <Sparkles aria-hidden="true" className="mt-0.5 h-[18px] w-[18px] shrink-0 text-rep-ink-muted" strokeWidth={2} />
            <p className="m-0 text-rep-label font-medium text-rep-ink-muted">
              El análisis legal se hace después de guardar el reporte. Lo vas a ver en el detalle.
            </p>
          </div>
        </div>
      </div>

      {/* Acción principal */}
      <div className="shrink-0 border-t border-rep-divider bg-rep-surface px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom,12px))]">
        <div className="mx-auto w-full max-w-lg">
          <button
            type="button"
            onClick={onContinue}
            disabled={!selectedCategory}
            aria-describedby={!selectedCategory ? 'report-category-required' : undefined}
            className="rep-focus flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-rep-accent px-4 text-rep-button text-rep-on-accent shadow-rep-accent transition-[transform,background-color] duration-120 hover:bg-rep-accent-strong active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none disabled:hover:bg-rep-accent disabled:active:scale-100"
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportDetailsStep;
