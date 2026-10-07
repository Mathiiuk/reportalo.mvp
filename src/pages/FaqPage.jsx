import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, Construction, Headset, HeartHandshake, Leaf, Phone, Store, Truck } from 'lucide-react';
// Solo el peso 700 en alfabeto latino, para los números de los pasos. Se sirve desde la app (sin red), igual que Manrope.
import '@fontsource/jetbrains-mono/latin-700.css';
import { AppLayout } from '../components/layout/AppLayout';
import { FAQ_CONTACT, FAQ_ITEMS } from '../content/faqContent';

// Ícono y colores de cada tarjeta de categoría. Las cuatro con token propio cambian solas con el tema;
// «Vulnerabilidad social» no tiene token y usa el mismo rosa que el resto de la app (categoriesService).
const CATEGORY_STYLE = {
  infra: { Icon: Construction, card: 'bg-cat-infra-soft', icon: 'text-cat-infra' },
  transito: { Icon: Truck, card: 'bg-cat-transito-soft', icon: 'text-cat-transito' },
  ambiente: { Icon: Leaf, card: 'bg-cat-ambiente-soft', icon: 'text-cat-ambiente' },
  vulnerabilidad: { Icon: HeartHandshake, card: 'bg-[#FDEFF3] dark:bg-[#3A1F2A]', icon: 'text-[#D6336C] dark:text-[#F28BAE]' },
  comercio: { Icon: Store, card: 'bg-cat-comercio-soft', icon: 'text-cat-comercio' },
};

// Convierte «**texto**» del contenido en negrita, sin interpretar ningún otro formato
const renderRich = (text) =>
  text.split(/\*\*(.+?)\*\*/g).map((part, index) =>
    index % 2 === 1 ? (
      <strong key={index} className="font-bold text-rep-ink">
        {part}
      </strong>
    ) : (
      part
    )
  );

/**
 * Preguntas frecuentes (REP-3554). Ruta `/faq`, alcanzable desde Perfil. Sigue el diseño exportado en
 * docs/export/faq: encabezado con la marca, acordeón en una sola tarjeta y bloque de contacto al pie.
 * El contenido vive en src/content/faqContent.js, así que cambiarlo no obliga a tocar esta pantalla.
 * Se muestra una respuesta por vez (abrir una cierra la anterior) y la primera arranca abierta.
 */
export const FaqPage = () => {
  const navigate = useNavigate();
  const [openId, setOpenId] = useState(FAQ_ITEMS[0]?.id ?? null);

  const toggle = (id) => setOpenId((current) => (current === id ? null : id));

  return (
    <AppLayout activeTab="perfil">
      <div className="flex-1 overflow-y-auto bg-rep-bg px-4 pb-28 pt-2 tablet:px-6 desktop:pb-16">
        <div className="mx-auto w-full max-w-[820px]">
          <button
            type="button"
            onClick={() => navigate('/perfil')}
            aria-label="Volver al perfil"
            title="Volver al perfil"
            className="rep-focus -ml-2 flex min-h-touch min-w-touch items-center justify-center rounded-full text-rep-ink transition-colors duration-120 hover:bg-rep-divider hover:text-rep-accent"
          >
            <ArrowLeft aria-hidden="true" className="h-6 w-6" strokeWidth={2.25} />
          </button>

          <header className="pb-7 pt-6 tablet:pb-11 tablet:pt-12">
            {/* Marca armada con el ícono y texto (no con la imagen del logotipo) para que se lea en los dos temas */}
            <div aria-hidden="true" className="flex items-center gap-2.5">
              <img src="/logo-icon.webp" alt="" className="h-[34px] w-auto object-contain tablet:h-[42px]" />
              <span className="text-[26px] font-extrabold leading-none tracking-[-0.03em] text-rep-ink tablet:text-[32px]">
                Reportalo
                <sup className="ml-0.5 align-super text-[11px] font-extrabold tracking-normal">™</sup>
              </span>
            </div>
            <h1 className="m-0 mt-[22px] text-pretty text-[32px] font-extrabold leading-[1.1] tracking-[-0.8px] text-rep-ink tablet:mt-[30px] tablet:text-[42px] tablet:tracking-[-1.2px]">
              Preguntas frecuentes
            </h1>
            <p className="m-0 mt-3.5 max-w-[560px] text-pretty text-[15px] font-medium leading-[1.6] text-rep-ink-body">
              Todo lo que necesitás saber para reportar, seguir tus reportes y cuidar tus datos.
            </p>
          </header>

          <ul
            data-testid="faq-list"
            className="m-0 list-none divide-y divide-rep-border overflow-hidden rounded-2xl border border-rep-border bg-rep-surface p-0 shadow-rep-card tablet:rounded-[20px]"
          >
            {FAQ_ITEMS.map((item) => {
              const isOpen = openId === item.id;
              const buttonId = `faq-pregunta-${item.id}`;
              const panelId = `faq-respuesta-${item.id}`;
              return (
                <li key={item.id}>
                  <h2 className="m-0">
                    <button
                      type="button"
                      id={buttonId}
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      onClick={() => toggle(item.id)}
                      className="flex min-h-[56px] w-full items-center gap-3 border-0 bg-transparent p-4 text-left outline-none transition-colors duration-120 [-webkit-tap-highlight-color:transparent] hover:bg-rep-surface-sunken focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-rep-accent tablet:gap-4 tablet:px-[26px] tablet:py-[22px]"
                    >
                      <span className="flex-1 text-[16px] font-extrabold leading-[1.4] tracking-[-0.2px] text-rep-ink [overflow-wrap:anywhere] tablet:text-[17px]">
                        {item.question}
                      </span>
                      <span
                        aria-hidden="true"
                        className={`flex h-8 w-8 flex-none items-center justify-center rounded-full transition-[transform,background-color,color] duration-200 motion-reduce:transition-none ${
                          isOpen ? 'rotate-180 bg-rep-accent text-rep-on-accent' : 'bg-rep-divider text-rep-ink-body'
                        }`}
                      >
                        <ChevronDown className="h-5 w-5" strokeWidth={2.25} />
                      </span>
                    </button>
                  </h2>
                  {/* La altura se anima con grid (0fr → 1fr). Cerrada queda con visibility:hidden para que ni el
                      lector de pantalla ni el teclado entren a una respuesta que no se ve. */}
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={buttonId}
                    style={{ visibility: isOpen ? 'visible' : 'hidden' }}
                    className={`grid transition-[grid-template-rows,visibility] duration-300 ease-in-out motion-reduce:transition-none ${
                      isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="flex max-w-[640px] flex-col gap-3 px-4 pb-5 tablet:px-[26px] tablet:pb-6">
                        {item.answer.map((paragraph) => (
                          <p
                            key={paragraph}
                            className="m-0 text-pretty text-[15px] font-medium leading-[1.65] text-rep-ink-body [overflow-wrap:anywhere]"
                          >
                            {renderRich(paragraph)}
                          </p>
                        ))}

                        {item.steps && (
                          <ol className="m-0 flex list-none flex-col gap-3 p-0">
                            {item.steps.map((step, index) => (
                              <li key={step} className="flex items-baseline gap-3 text-[15px] font-medium leading-[1.6] text-rep-ink-body">
                                <span aria-hidden="true" className="font-['JetBrains_Mono',ui-monospace,monospace] text-[12px] font-bold text-rep-accent">
                                  {String(index + 1).padStart(2, '0')}
                                </span>
                                <span>{step}</span>
                              </li>
                            ))}
                          </ol>
                        )}

                        {item.categories && (
                          <ul className="m-0 grid list-none grid-cols-1 gap-2.5 p-0 tablet:grid-cols-[repeat(auto-fit,minmax(240px,1fr))]">
                            {item.categories.map((category) => {
                              const { Icon, card, icon } = CATEGORY_STYLE[category.key];
                              return (
                                <li key={category.key} className={`flex items-start gap-3 rounded-[14px] p-3.5 ${card}`}>
                                  <Icon aria-hidden="true" className={`h-[22px] w-[22px] flex-none ${icon}`} strokeWidth={2} />
                                  <div>
                                    <div className="text-[14px] font-extrabold text-rep-ink">{category.title}</div>
                                    <div className="mt-0.5 text-[13px] font-medium leading-[1.5] text-rep-ink-body">{category.description}</div>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        )}

                        {item.phones && (
                          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                            {item.phones.map((phone) => (
                              <li key={phone.number} className="flex-[1_1_100%] tablet:flex-none">
                                <a
                                  href={`tel:${phone.number}`}
                                  className="rep-focus flex min-h-touch items-center justify-center gap-2 rounded-full bg-rep-danger-soft px-4 py-2.5 text-[14px] font-extrabold text-rep-danger no-underline [-webkit-tap-highlight-color:transparent]"
                                >
                                  <Phone aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={2.25} />
                                  {phone.number} · {phone.label}
                                </a>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <section
            aria-labelledby="faq-contacto-titulo"
            className="mt-5 flex flex-wrap items-center gap-4 rounded-2xl border border-rep-border bg-rep-surface px-[18px] py-5 tablet:mt-7 tablet:rounded-[20px] tablet:px-[26px] tablet:py-6"
          >
            <Headset aria-hidden="true" className="h-[26px] w-[26px] flex-none text-rep-accent" strokeWidth={2} />
            <div className="min-w-[200px] flex-1">
              <h2 id="faq-contacto-titulo" className="m-0 text-[15px] font-extrabold text-rep-ink">
                {FAQ_CONTACT.title}
              </h2>
              <p className="m-0 mt-0.5 text-[14px] font-medium leading-[1.5] text-rep-ink-body">{FAQ_CONTACT.description}</p>
            </div>
            <a
              href={`mailto:${FAQ_CONTACT.email}`}
              data-testid="faq-contact-btn"
              className="rep-focus flex min-h-touch w-full items-center justify-center rounded-full bg-rep-accent px-[18px] py-[11px] text-[14px] font-extrabold text-rep-on-accent no-underline transition-colors duration-120 [-webkit-tap-highlight-color:transparent] hover:bg-rep-accent-strong tablet:w-auto"
            >
              {FAQ_CONTACT.cta}
            </a>
          </section>

          <p className="m-0 mt-8 text-[12.5px] font-medium text-rep-ink-muted">Reportalo™</p>
        </div>
      </div>
    </AppLayout>
  );
};

export default FaqPage;
