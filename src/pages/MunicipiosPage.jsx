import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, ScanFace, EyeOff, Gavel } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { CityTexture } from '../components/common/CityTexture';

/**
 * Landing institucional Municipios · UJ v3.3 D21 v2 (handoff REP-3830, REP-3535).
 * MVP solo informativo (decisión PO 15/10): qué es Reportalo, cómo funciona, privacidad
 * y «Ir al portal ciudadano». Planes, demo, contratación e «Ingresar» no se renderizan.
 */

// Destino de «Ir al portal ciudadano» — propuesta UX §07, pendiente de confirmación del PO.
const PORTAL_GUEST = '/';
const PORTAL_AUTH = '/mapa';

// Mismo velo azul del hero ciudadano (D01, WelcomePage)
const BAND_GRADIENT = 'linear-gradient(160deg, rgb(42, 123, 214), rgb(21, 83, 158))';

const STATS = [
  { value: '100%', label: 'Fotos anonimizadas' },
  { value: 'Ley 25.326', label: 'Datos personales' },
  { value: '5', label: 'Categorías de reporte' },
];

const STEPS = [
  { title: 'El usuario reporta', text: 'Foto anonimizada y ubicación exacta, sin exponer su identidad.' },
  { title: 'La IA encuadra el caso', text: 'Detecta la norma aplicable y el organismo competente.' },
  { title: 'El organismo responde', text: 'Lo cierra como Resuelto o Desestimado, siempre con motivo.' },
];

// Taxonomía vigente (§05). En la landing solo se muestran estos cuatro.
const STATUS_PILLS = [
  { label: 'Recibido', className: 'bg-rep-divider text-rep-ink-body' },
  { label: 'En análisis', className: 'bg-rep-accent-soft text-rep-accent' },
  { label: 'Derivado', className: 'bg-rep-warning-soft text-[#9A5A12]' },
  { label: 'Resuelto', className: 'bg-rep-success-soft text-[#2C7A55]' },
];

// Textos de M05, M02 y RT-05 tal cual los entrega el handoff
const PRIVACY = [
  {
    icon: ScanFace,
    color: 'text-rep-success',
    title: 'Evidencia anonimizada',
    text: 'Los rostros y las patentes se difuminan automáticamente antes de guardarse. La imagen original nunca se almacena.',
  },
  {
    icon: EyeOff,
    color: 'text-rep-accent',
    title: 'Qué recibe el organismo',
    text: 'Foto anonimizada, ubicación, categoría, descripción y norma aplicable. La identidad del usuario nunca se comparte con el organismo.',
  },
  {
    icon: Gavel,
    color: 'text-rep-ink-body',
    title: 'Ley 25.326',
    text: 'El usuario acepta los términos antes de enviar y ese consentimiento queda registrado con fecha y versión.',
  },
];

// Enlace principal: reposo / hover / foco / presionado (§04). Es <a>, no botón.
const CTA_BASE =
  'rep-focus inline-flex min-h-touch items-center justify-center gap-2 rounded-xl py-3 font-bold no-underline transition-[background-color,transform] duration-120 active:scale-[.98]';

const scrollToSection = (id) => {
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  document.getElementById(id)?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
};

export const MunicipiosPage = () => {
  const location = useLocation();
  const { session } = useAuth();
  const portalHref = session ? PORTAL_AUTH : PORTAL_GUEST;

  // Entrada directa con ancla (ej. /municipios#privacidad)
  useEffect(() => {
    if (location.hash) scrollToSection(location.hash.slice(1));
  }, [location.hash]);

  const handleAnchor = (event, id) => {
    event.preventDefault();
    window.history.replaceState(null, '', `#${id}`);
    scrollToSection(id);
  };

  return (
    <div className="min-h-[100dvh] w-full bg-rep-surface font-manrope text-rep-ink">
      {/* Barra superior fija */}
      <header className="sticky top-0 z-50 border-b border-rep-divider bg-rep-surface pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-[60px] max-w-[1200px] items-center gap-2.5 px-[18px] md:h-[72px] md:gap-6 md:px-8 lg:gap-10 lg:px-12">
          <Link
            to="/municipios"
            aria-label="Reportalo Municipios, inicio"
            className="rep-focus flex min-h-touch items-center gap-2.5 rounded text-inherit no-underline"
          >
            <img src="/logo-icon.webp" alt="" className="h-[21px] w-4 object-contain md:h-[31px] md:w-6" />
            <span className="text-base font-extrabold tracking-[-0.5px] text-rep-ink md:text-[22px]">
              Reportalo<span className="align-super text-[0.5em]">™</span>
            </span>
            <span className="rounded-[8px] bg-rep-accent-soft px-1.5 py-[3px] text-[9px] font-bold tracking-[.3px] text-rep-accent md:px-2.5 md:py-[5px] md:text-[11px]">
              MUNICIPIOS
            </span>
          </Link>

          <nav aria-label="Secciones" className="hidden gap-6 md:flex lg:gap-[30px]">
            {[
              { id: 'como-funciona', label: 'Cómo funciona' },
              { id: 'privacidad', label: 'Privacidad' },
            ].map(({ id, label }) => (
              <a
                key={id}
                href={`#${id}`}
                onClick={(event) => handleAnchor(event, id)}
                className="rep-focus flex min-h-touch items-center whitespace-nowrap rounded text-[15px] font-semibold text-rep-ink-label no-underline transition-colors hover:text-rep-accent"
              >
                {label}
              </a>
            ))}
          </nav>

          <Link
            to={portalHref}
            className={`${CTA_BASE} ml-auto whitespace-nowrap bg-rep-accent px-3 text-[13px] text-rep-on-accent hover:bg-rep-accent-strong hover:text-rep-on-accent active:bg-rep-accent-strong md:px-5 md:text-[15px]`}
          >
            <span className="hidden md:inline">Ir al portal ciudadano</span>
            <span className="md:hidden">Portal ciudadano</span>
            <ArrowRight className="hidden h-[18px] w-[18px] md:block" strokeWidth={2.25} aria-hidden="true" />
          </Link>
        </div>
      </header>

      <main>
        <div className="mx-auto max-w-[1200px] px-[18px] md:px-8 lg:px-12">
          {/* Hero + Cómo funciona */}
          <section aria-labelledby="hero-title" className="grid grid-cols-1 border-b border-rep-divider lg:grid-cols-[minmax(0,1fr)_480px]">
            <div className="pb-6 pt-7 md:pb-10 md:pt-14 lg:pb-14 lg:pr-14 lg:pt-[72px]">
              <h1
                id="hero-title"
                className="m-0 max-w-[640px] text-balance text-[28px] font-extrabold leading-[1.08] tracking-[-0.8px] text-[#1F2C3D] md:text-[42px] md:tracking-[-1.6px] lg:text-[52px]"
              >
                Los reclamos de tus usuarios, con evidencia y encuadre legal
              </h1>
              <p className="mt-3 max-w-[580px] text-pretty text-[15px] font-medium leading-[1.6] text-rep-ink-muted md:mt-5 md:text-lg">
                Recibí reportes georreferenciados, con fotos ya anonimizadas y la norma que aplica identificada. Tus inspectores trabajan casos, no capturas de pantalla.
              </p>
              <ul className="m-0 mt-[22px] grid list-none grid-cols-3 gap-2 p-0 md:mt-12 md:flex md:flex-wrap md:gap-12">
                {STATS.map(({ value, label }) => (
                  <li key={label}>
                    <div className="text-xl font-extrabold leading-none text-rep-accent md:text-[32px]">{value}</div>
                    <div className="mt-2 text-[10px] font-semibold uppercase tracking-[.4px] text-rep-ink-muted md:text-xs">{label}</div>
                  </li>
                ))}
              </ul>
            </div>

            <aside
              id="como-funciona"
              aria-labelledby="how-title"
              className="-mx-[18px] flex scroll-mt-[60px] flex-col gap-2.5 border-t border-rep-divider bg-rep-bg px-[18px] py-[22px] md:-mx-8 md:scroll-mt-[72px] md:gap-3.5 md:p-8 lg:-mr-12 lg:ml-0 lg:border-l lg:border-t-0 lg:p-10"
            >
              <h2 id="how-title" className="m-0 text-xs font-extrabold uppercase tracking-[.8px] text-rep-ink-muted">
                Cómo funciona
              </h2>
              <ol className="m-0 flex list-none flex-col gap-2.5 p-0 md:gap-3.5">
                {STEPS.map(({ title, text }, index) => (
                  <li key={title} className="flex items-center gap-3.5 rounded-2xl border border-rep-border bg-rep-surface p-3 md:items-start md:p-[18px]">
                    <span className="flex h-7 w-7 flex-none items-center justify-center rounded-[10px] bg-rep-accent-soft text-xs font-extrabold text-rep-accent md:h-[34px] md:w-[34px] md:text-sm">
                      {index + 1}
                    </span>
                    <div>
                      <p className="m-0 text-[15px] font-bold text-rep-ink">{title}</p>
                      <p className="m-0 mt-[3px] hidden text-[13.5px] font-medium leading-[1.5] text-rep-ink-muted md:block">{text}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <ul aria-label="Estados del reporte" className="m-0 mt-1 hidden list-none flex-wrap gap-[7px] p-0 md:flex">
                {STATUS_PILLS.map(({ label, className }) => (
                  <li key={label} className={`rounded-[7px] px-[9px] py-[5px] text-xs font-bold ${className}`}>
                    {label}
                  </li>
                ))}
              </ul>
            </aside>
          </section>

          {/* Privacidad y marco legal */}
          <section id="privacidad" aria-labelledby="priv-title" className="scroll-mt-[60px] py-[26px] md:scroll-mt-[72px] md:py-14">
            <h2 id="priv-title" className="m-0 mb-3.5 text-[19px] font-extrabold tracking-[-0.6px] text-[#1F2C3D] md:mb-5 md:text-[28px]">
              Privacidad y marco legal
            </h2>
            <ul className="m-0 grid list-none grid-cols-1 gap-3.5 p-0 md:grid-cols-2 md:gap-5 lg:grid-cols-3">
              {PRIVACY.map(({ icon: Icon, color, title, text }) => (
                <li
                  key={title}
                  className="grid grid-cols-[24px_1fr] gap-x-2.5 md:block md:rounded-2xl md:bg-rep-bg md:p-[22px] md:last:col-span-2 lg:last:col-span-1"
                >
                  <Icon className={`row-span-2 h-5 w-5 md:h-6 md:w-6 ${color}`} strokeWidth={2} aria-hidden="true" />
                  <p className="m-0 text-sm font-bold text-rep-ink md:mt-2.5 md:text-base">{title}</p>
                  <p className="m-0 mt-0.5 text-pretty text-[13px] font-medium leading-[1.6] text-rep-ink-muted md:mt-1.5 md:text-sm">{text}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Banda final con fondo de mapa y velo azul (D01) */}
        <section aria-labelledby="band-title" className="relative overflow-hidden text-white" style={{ background: BAND_GRADIENT }}>
          <CityTexture opacity={0.14} className="absolute inset-0 h-full w-full text-white" />
          <div className="relative mx-auto flex max-w-[1200px] flex-col items-stretch gap-3.5 px-[18px] pb-[calc(24px+env(safe-area-inset-bottom))] pt-6 md:flex-row md:items-center md:gap-6 md:px-8 md:pb-[calc(44px+env(safe-area-inset-bottom))] md:pt-11 lg:px-12">
            <div className="flex-1">
              <h2 id="band-title" className="m-0 text-lg font-extrabold tracking-[-0.4px] md:text-2xl">
                ¿Querés reportar algo de tu ciudad?
              </h2>
              <p className="m-0 mt-1.5 text-[13.5px] font-medium text-white/90 md:text-[15px]">
                El portal ciudadano es gratuito y entrás con tu correo, sin contraseña.
              </p>
            </div>
            <Link
              to={portalHref}
              className={`${CTA_BASE} w-full bg-white px-5 text-[15px] font-extrabold text-rep-accent hover:bg-rep-accent-soft hover:text-rep-accent focus-visible:ring-white focus-visible:ring-offset-rep-accent-strong md:w-auto`}
            >
              Ir al portal ciudadano
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
};
