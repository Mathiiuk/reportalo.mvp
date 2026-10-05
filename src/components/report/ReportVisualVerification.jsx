import React from 'react';
import { Camera, CheckCircle2, HelpCircle } from 'lucide-react';

/**
 * Verificación de la foto (REP-3820): resultado de la revisión visual automática de cada evidencia (REP-3818).
 *
 * Es ADITIVO y está separado del análisis jurídico (ReportAiAnalysisPanel): otro título, otro ícono, otro texto y una
 * aclaración explícita de que no es un fundamento legal ni cambia el estado del reporte. No cambia estados ni categorías.
 *
 * Decisión funcional (a confirmar por PO/UX): el bloque aparece SOLO si hay al menos un resultado útil. No se muestra
 * mientras no hay resultado, ni si el análisis falló, se omitió o no fue concluyente. Con varias fotos, cada una tiene su
 * propia tarjeta: los resultados no se fusionan en uno solo.
 */

const CARD =
  'flex flex-col gap-3 rounded-2xl border border-rep-border bg-rep-surface p-4 shadow-rep-card desktop:p-5';

// Texto para el ciudadano de cada marca de calidad (rioplatense, sin tecnicismos)
const QUALITY_TEXT = {
  oscura: 'La foto está oscura.',
  borrosa: 'La foto está borrosa.',
  no_se_ve_el_hecho: 'No se ve con claridad la situación.',
  sin_contexto_de_lugar: 'Se ve poco del lugar alrededor.',
};

const COHERENCE_CONFIG = {
  coincide: {
    icon: CheckCircle2,
    tone: 'bg-rep-success-soft text-rep-success',
    text: 'La foto coincide con tu descripción.',
  },
  no_coincide: {
    icon: HelpCircle,
    tone: 'bg-rep-warning-soft text-rep-warning-ink',
    text: 'No pudimos ver en la foto lo que describiste. Tu reporte sigue su curso y un funcionario lo va a revisar.',
  },
};

/** Un resultado se muestra solo si es útil: completado y con una coherencia concluyente. */
export const isUsefulImageResult = (result) =>
  Boolean(result) && result.status === 'completado' && Boolean(COHERENCE_CONFIG[result.coherence]);

/**
 * @param {object} props
 * @param {Array<object>} props.results Filas de report_image_analysis (una por foto)
 * @param {Array<{ id: string }>} props.images Fotos del reporte, en el orden en que se muestran
 * @param {string} [props.categoryName] Categoría que eligió el ciudadano
 */
export const ReportVisualVerification = ({ results = [], images = [], categoryName = null }) => {
  const cards = results
    .filter(isUsefulImageResult)
    .map((result) => ({ result, index: images.findIndex((image) => image.id === result.image_id) }))
    // Solo se muestran resultados de fotos que el reporte tiene
    .filter((card) => card.index !== -1)
    .sort((a, b) => a.index - b.index);

  if (cards.length === 0) return null;

  return (
    <section data-testid="visual-verification" aria-label="Verificación de la foto" aria-live="polite" className={CARD}>
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rep-accent-soft text-rep-accent">
          <Camera aria-hidden="true" size={16} strokeWidth={2.25} />
        </span>
        <h3 className="m-0 flex-1 text-rep-body font-extrabold text-rep-ink desktop:text-rep-body-d">Verificación de la foto</h3>
      </div>

      <p className="m-0 text-rep-label text-rep-ink-muted desktop:text-rep-label-d">
        Es una ayuda automática sobre la imagen. No es un fundamento legal ni cambia el estado de tu reporte.
      </p>

      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {cards.map(({ result, index }) => {
          const config = COHERENCE_CONFIG[result.coherence];
          const Icon = config.icon;
          const suggestedName = result.services?.service_name ?? null;
          const differentCategory = suggestedName && categoryName && suggestedName !== categoryName;
          const quality = (result.quality_flags ?? []).map((flag) => QUALITY_TEXT[flag]).filter(Boolean);
          return (
            <li
              key={result.image_id}
              data-testid="visual-result"
              data-coherence={result.coherence}
              className="flex flex-col gap-1.5 rounded-xl border border-rep-border p-3"
            >
              {images.length > 1 && (
                <span className="text-rep-label font-bold text-rep-ink-label desktop:text-rep-label-d">Foto {index + 1}</span>
              )}
              <div className="flex items-start gap-2">
                <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${config.tone}`}>
                  <Icon aria-hidden="true" size={14} strokeWidth={2.5} />
                </span>
                <p className="m-0 text-rep-body font-bold text-rep-ink desktop:text-rep-body-d">{config.text}</p>
              </div>
              {result.scene_summary && (
                <p className="m-0 text-rep-body text-rep-ink-body desktop:text-rep-body-d">
                  <span className="font-bold">Lo que se ve: </span>
                  {result.scene_summary}
                </p>
              )}
              {differentCategory && (
                <p className="m-0 text-rep-label text-rep-ink-muted desktop:text-rep-label-d">
                  Por lo que se ve, podría corresponder a la categoría «{suggestedName}».
                </p>
              )}
              {quality.length > 0 && (
                <p className="m-0 text-rep-label text-rep-ink-muted desktop:text-rep-label-d">{quality.join(' ')}</p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default ReportVisualVerification;
