import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import { AppLayout } from '../components/layout/AppLayout';
import { FAQ_ITEMS } from '../content/faqContent';

/**
 * Preguntas frecuentes (REP-3554). Ruta `/faq`, alcanzable desde Perfil. Es contenido estático y sin soporte ni
 * integraciones: las preguntas viven en src/content/faqContent.js, así que cambiarlas no obliga a tocar esta pantalla.
 * Cada pregunta se abre y se cierra por separado (acordeón accesible: botón con aria-expanded + región con nombre).
 */
export const FaqPage = () => {
  const navigate = useNavigate();
  const [openIds, setOpenIds] = useState(() => new Set());

  const toggle = (id) =>
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <AppLayout activeTab="perfil">
      <div className="flex-1 overflow-y-auto bg-rep-bg px-4 pb-28 pt-5 sm:px-6 md:px-10 desktop:pb-10">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          <header className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => navigate('/perfil')}
              aria-label="Volver al perfil"
              className="rep-focus -ml-2 flex min-h-touch min-w-touch items-center justify-center rounded-full text-rep-ink-label transition-colors duration-120 hover:bg-rep-divider"
            >
              <ArrowLeft aria-hidden="true" className="h-6 w-6" strokeWidth={2.25} />
            </button>
            <h1 className="m-0 text-rep-title text-rep-ink md:text-rep-title-d">Preguntas frecuentes</h1>
          </header>

          <p className="m-0 text-rep-body text-rep-ink-muted md:text-rep-body-d">
            Respuestas rápidas a las dudas más comunes sobre cómo usar Reportalo.
          </p>

          <ul data-testid="faq-list" className="m-0 flex list-none flex-col gap-2.5 p-0">
            {FAQ_ITEMS.map((item) => {
              const isOpen = openIds.has(item.id);
              const buttonId = `faq-pregunta-${item.id}`;
              const panelId = `faq-respuesta-${item.id}`;
              return (
                <li key={item.id} className="overflow-hidden rounded-2xl border border-rep-border bg-rep-surface shadow-rep-card">
                  <h2 className="m-0">
                    <button
                      type="button"
                      id={buttonId}
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      onClick={() => toggle(item.id)}
                      className="rep-focus flex min-h-touch w-full items-center gap-3 border-0 bg-transparent px-4 py-3.5 text-left text-rep-body font-bold text-rep-ink md:text-rep-body-d"
                    >
                      <span className="flex-1">{item.question}</span>
                      <ChevronDown
                        aria-hidden="true"
                        className={`h-5 w-5 shrink-0 text-rep-ink-faint transition-transform duration-120 motion-reduce:transition-none ${isOpen ? 'rotate-180' : ''}`}
                        strokeWidth={2.25}
                      />
                    </button>
                  </h2>
                  <div id={panelId} role="region" aria-labelledby={buttonId} hidden={!isOpen} className="px-4 pb-4">
                    <p className="m-0 text-rep-body text-rep-ink-body md:text-rep-body-d">{item.answer}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </AppLayout>
  );
};

export default FaqPage;
