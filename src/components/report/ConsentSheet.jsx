import React, { useEffect, useRef } from 'react';
import { Shield, Trash2, Gavel, ArrowRight, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CURRENT_TERMS_VERSION } from '../../services/termsService';
import { useIsDesktopLayout } from '../../hooks/useMediaQuery';

const CONSENT_POINTS = [
  { icon: Shield, text: 'Difuminamos rostros y patentes en el servidor, antes de guardar.' },
  { icon: Trash2, text: 'Guardamos solo la versión anonimizada. El original se descarta.' },
  { icon: Gavel, text: 'Podés pedir acceso, rectificación y supresión (Ley 25.326).' },
];

/**
 * Hoja de consentimiento versionada «Antes de enviar» (UJ v3.3 · M13 / D14 · REP-3543).
 * Componente nombrado en el §10 del UJ («ConsentSheet»).
 *
 * - El botón es el acto: «Acepto y envío», sin casilla previa.
 * - Se muestra solo si no hay aceptación vigente de la versión actual de los términos.
 * - «Ahora no» cierra la hoja y deja el paso 3 intacto.
 * Teléfono: hoja inferior · escritorio (≥ 1025 px): diálogo centrado.
 */
export const ConsentSheet = ({
  open,
  termsVersion = CURRENT_TERMS_VERSION,
  onAccept,
  onDismiss,
  onOpenTerms,
}) => {
  const acceptButtonRef = useRef(null);
  const isDesktop = useIsDesktopLayout();

  // Foco inicial en la acción principal y cierre con Escape
  useEffect(() => {
    if (!open) return undefined;
    const focusTimer = setTimeout(() => acceptButtonRef.current?.focus(), 60);
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onDismiss?.();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onDismiss]);

  const panelMotion = isDesktop
    ? { initial: { opacity: 0, scale: 0.97 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.97 }, transition: { duration: 0.16 } }
    : { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' }, transition: { type: 'spring', damping: 28, stiffness: 300 } };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center desktop:items-center desktop:p-6">
          <motion.div
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onDismiss}
            className="absolute inset-0 bg-black/55"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="consent-sheet-title"
            aria-describedby="consent-sheet-intro"
            {...panelMotion}
            className="relative z-10 flex w-full max-w-md flex-col rounded-t-[28px] bg-rep-surface px-6 pt-3 pb-[max(20px,env(safe-area-inset-bottom,20px))] shadow-2xl desktop:max-w-[520px] desktop:rounded-3xl desktop:p-8"
          >
            <div aria-hidden="true" className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-rep-track desktop:hidden" />

            <h2 id="consent-sheet-title" className="m-0 text-rep-title text-rep-ink">
              Antes de enviar
            </h2>
            <p id="consent-sheet-intro" className="m-0 mt-2 text-rep-body text-rep-ink-body desktop:text-rep-body-d">
              Para enviar el reporte necesitamos tu consentimiento para tratar las fotos y la ubicación que aportás.
            </p>

            <ul className="m-0 mt-4 flex list-none flex-col gap-3 p-0">
              {CONSENT_POINTS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3">
                  <Icon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rep-accent" strokeWidth={2.25} />
                  <span className="text-rep-body text-rep-ink-body desktop:text-rep-body-d">{text}</span>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={onOpenTerms}
              className="rep-focus mt-5 inline-flex min-h-touch items-center gap-1.5 self-start rounded-lg text-rep-body font-bold text-rep-accent hover:underline desktop:w-full desktop:justify-between desktop:self-stretch desktop:rounded-xl desktop:bg-rep-accent-soft desktop:px-4 desktop:hover:no-underline"
            >
              <span>Leer términos y privacidad · v{termsVersion}</span>
              <ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={2.25} />
            </button>

            <button
              ref={acceptButtonRef}
              type="button"
              onClick={onAccept}
              aria-label="Acepto y envío"
              className="rep-focus mt-4 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-rep-accent px-4 text-rep-button text-rep-on-accent shadow-rep-accent transition-[transform,background-color] duration-120 hover:bg-rep-accent-strong active:scale-[0.98]"
            >
              <span>Acepto y envío</span>
              <Send aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={2.25} />
            </button>

            <button
              type="button"
              onClick={onDismiss}
              aria-label="Ahora no"
              className="rep-focus mt-1 min-h-touch w-full rounded-xl text-rep-body font-bold text-rep-ink-muted transition-colors duration-120 hover:text-rep-ink"
            >
              Ahora no
            </button>

            <p className="m-0 mt-1 text-center text-rep-label font-medium text-rep-ink-muted">
              Queda registrada la versión y la fecha. Solo te lo pedimos de nuevo si cambian los términos.
            </p>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ConsentSheet;
