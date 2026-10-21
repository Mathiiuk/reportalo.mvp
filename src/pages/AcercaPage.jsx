import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Mail } from 'lucide-react';
import { SiteFooter } from '../components/layout/SiteFooter';
import { loadBuildInfo, formatBuildDate } from '../services/buildInfoService';
import {
  ABOUT_BACK,
  ABOUT_PARAGRAPHS,
  CONTACT_DESCRIPTION,
  CONTACT_EMAIL,
  SHOW_CONTACT_EMAIL,
  SPECIAL_MENTION,
  TEAM,
} from '../content/siteInfo';

const CARD = 'rounded-[18px] border border-rep-border bg-rep-surface';

/** Una columna del bloque de versión: rótulo arriba, valor centrado abajo. */
const VersionItem = ({ label, children }) => (
  <div className="flex min-w-0 flex-col items-center gap-[5px] px-2 py-4 text-center md:px-[22px] md:py-[18px]">
    <dt className="text-[10px] font-bold tracking-[0.4px] text-rep-ink-muted md:text-[11px] md:tracking-[0.8px]">{label}</dt>
    <dd className="m-0 flex flex-wrap items-center justify-center gap-2">{children}</dd>
  </div>
);

const Skeleton = () => (
  <span aria-hidden="true" className="block h-[18px] w-16 animate-pulse rounded-md bg-rep-divider motion-reduce:animate-none md:w-[110px]" />
);

/**
 * «Acerca de Reportalo™» (REP-3866). Porta a React la página `/acerca` del handoff de Iván (REP-3865) con los mismos
 * textos y orden: barra con volver, texto institucional, equipo, mención especial, versión y contacto, y el footer.
 *
 * - Pública: no pide sesión.
 * - `?desde=perfil|municipios` cambia solo el botón de volver y la variante del footer (handoff §5.1).
 * - La versión sale de /build-info.json (scripts/build-info.mjs): ningún valor está escrito a mano.
 * - El contacto se oculta hasta que REP-3873 confirme la recepción del correo (SHOW_CONTACT_EMAIL).
 */
export const AcercaPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const desde = searchParams.get('desde');
  const back = ABOUT_BACK[desde] || ABOUT_BACK.ciudadano;
  const footerVariant = desde === 'municipios' ? 'municipios' : 'ciudadano';

  // undefined = cargando · null = no se pudo leer · objeto = datos del build
  const [buildInfo, setBuildInfo] = useState(undefined);
  useEffect(() => {
    let isMounted = true;
    loadBuildInfo().then((result) => {
      if (isMounted) setBuildInfo(result.success ? result.info : null);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    document.title = 'Acerca de · Reportalo™';
  }, []);

  // Si se llegó navegando dentro de la app se vuelve atrás; con un enlace compartido, a la ruta de respaldo
  const handleBack = () => {
    if ((window.history.state?.idx ?? 0) > 0) navigate(-1);
    else navigate(back.fallback);
  };

  const loading = buildInfo === undefined;

  return (
    <div data-testid="acerca-page" lang="es-AR" className="flex min-h-[100dvh] w-full flex-col bg-rep-bg font-manrope text-rep-ink">
      <header className="sticky top-0 z-20 flex items-center gap-[9px] border-b border-rep-border bg-rep-surface py-2.5 pl-4 pr-7 pt-[max(10px,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={handleBack}
          aria-label={back.label}
          title={back.label}
          className="rep-focus flex h-11 w-11 items-center justify-center rounded-full border-0 bg-transparent text-rep-ink hover:bg-rep-accent-soft hover:text-rep-accent"
        >
          <ArrowLeft aria-hidden="true" className="h-6 w-6" strokeWidth={2.25} />
        </button>
        <img src="/logo-icon.webp" alt="" className="h-[21px] w-4 object-contain" />
        <span className="text-[14px] font-extrabold tracking-[-0.2px]">Reportalo™</span>
        <span className="text-[12px] font-semibold text-rep-ink-muted">Acerca de</span>
      </header>

      <main className="mx-auto w-full max-w-[1120px] flex-1 px-6 pb-[88px]">
        <div className="pb-8 pt-10 md:pb-10 md:pt-16">
          <h1 className="m-0 text-pretty text-[34px] font-extrabold leading-[1.1] tracking-[-1.2px] md:text-[42px]">
            Acerca de Reportalo<span className="align-super text-[0.35em] tracking-normal">™</span>
          </h1>
          {ABOUT_PARAGRAPHS.map((paragraph, index) => (
            <p
              key={paragraph}
              className={`m-0 text-pretty text-[16px] font-medium leading-[1.65] text-rep-ink-body ${index === 0 ? 'mt-4' : 'mt-3'}`}
            >
              {paragraph}
            </p>
          ))}
        </div>

        <section aria-labelledby="h-equipo" className="flex flex-col gap-4">
          <h2 id="h-equipo" className="m-0 text-[22px] font-extrabold tracking-[-0.4px]">Equipo</h2>
          <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 md:grid-cols-2 lg:grid-cols-4">
            {TEAM.map((person) => (
              <li key={person.name} className={`${CARD} flex flex-col gap-1.5 px-[22px] py-5`}>
                <span className="text-[18px] font-extrabold tracking-[-0.2px]">{person.name}</span>
                <span className="text-pretty text-[14px] font-semibold leading-[1.45] text-rep-ink-body">{person.title}</span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="h-mencion" className="mt-12 flex flex-col gap-4">
          <h2 id="h-mencion" className="m-0 text-[22px] font-extrabold tracking-[-0.4px]">Mención especial</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className={`${CARD} flex flex-col gap-1.5 px-[22px] py-5`}>
              <span className="text-[18px] font-extrabold tracking-[-0.2px]">{SPECIAL_MENTION.name}</span>
              <span className="text-[14px] font-semibold leading-[1.45] text-rep-ink-body">{SPECIAL_MENTION.title}</span>
            </div>
          </div>
        </section>

        <section id="version" aria-labelledby="h-version" className="mt-12 flex scroll-mt-20 flex-col gap-4">
          <h2 id="h-version" className="m-0 text-[22px] font-extrabold tracking-[-0.4px]">Versión de la aplicación</h2>
          <div data-testid="acerca-version" className={`${CARD} overflow-hidden`} aria-live="polite" aria-busy={loading}>
            {loading && <span className="sr-only">Cargando datos de versión</span>}
            {buildInfo === null ? (
              <div className="flex flex-col items-center gap-0.5 px-[22px] py-5 text-center">
                <strong className="text-[15px] font-extrabold">No pudimos leer la versión</strong>
                <span className="text-[14px] font-medium leading-[1.5] text-rep-ink-body">La aplicación funciona igual.</span>
              </div>
            ) : (
              <dl className="m-0 grid grid-cols-3">
                <VersionItem label="BUILD">
                  {loading ? <Skeleton /> : <span className="font-mono text-[14px] font-bold md:text-[17px]">{buildInfo.version}</span>}
                </VersionItem>
                <VersionItem label="COMPILACIÓN">
                  {loading ? (
                    <Skeleton />
                  ) : (
                    <span title={buildInfo.commit} className="font-mono text-[14px] font-bold md:text-[17px]">
                      {buildInfo.commitShort}
                    </span>
                  )}
                </VersionItem>
                <VersionItem label="PUBLICADA">
                  {loading ? <Skeleton /> : <span className="text-[13px] font-bold leading-[1.5] md:text-[15px]">{formatBuildDate(buildInfo.builtAt)}</span>}
                </VersionItem>
              </dl>
            )}
          </div>
        </section>

        {SHOW_CONTACT_EMAIL && (
          <section aria-labelledby="h-contacto" className="mt-12 flex flex-col gap-4">
            <h2 id="h-contacto" className="m-0 text-[22px] font-extrabold tracking-[-0.4px]">Contacto institucional</h2>
            <div className={`${CARD} flex flex-wrap items-center gap-4 p-[22px]`}>
              <span aria-hidden="true" className="flex h-11 w-11 flex-none items-center justify-center rounded-[14px] bg-rep-accent-soft text-rep-accent">
                <Mail className="h-6 w-6" strokeWidth={2} />
              </span>
              <div className="flex flex-[1_1_220px] flex-col gap-[3px]">
                <strong className="text-[16px] font-extrabold">{CONTACT_EMAIL}</strong>
                <span className="text-[14px] font-medium leading-[1.5] text-rep-ink-body">{CONTACT_DESCRIPTION}</span>
              </div>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="rep-focus inline-flex min-h-touch items-center rounded-full bg-rep-accent px-5 text-[14px] font-extrabold text-rep-on-accent no-underline hover:bg-rep-accent-strong"
              >
                Escribinos
              </a>
            </div>
          </section>
        )}
      </main>

      <SiteFooter variant={footerVariant} />
    </div>
  );
};

export default AcercaPage;
