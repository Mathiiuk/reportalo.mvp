import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, MapPin } from 'lucide-react';
import {
  CONTACT_EMAIL,
  FOOTER_TAGLINE,
  PLACE,
  SHOW_CONTACT_EMAIL,
  UNLZ_URL,
  footerGroups,
} from '../../content/siteInfo';

/**
 * Footer compartido (REP-3866). Porta a React el web component `<rep-footer>` del handoff de Iván (REP-3865): mismos
 * textos, grupos, orden y comportamiento, con los tokens `rep-*` de la app (cambian solos con el tema oscuro).
 *
 * - `variant="ciudadano"` (portal ciudadano) o `"municipios"` (landing de Municipios): cambian los enlaces, la frase,
 *   el chip «MUNICIPIOS» y a dónde lleva el logo (handoff §5.2).
 * - No va en pantallas de tarea ni en teléfono con barra de pestañas (handoff §5.3): eso lo decide quien lo monta.
 * - No muestra la versión. El año sale del navegador.
 * - El correo institucional se oculta hasta que REP-3873 confirme la recepción (SHOW_CONTACT_EMAIL).
 *
 * @param {{ variant?: 'ciudadano'|'municipios', portalHref?: string, className?: string }} props
 */
export const SiteFooter = ({ variant = 'ciudadano', portalHref = '/', className = '' }) => {
  const isMunicipios = variant === 'municipios';
  const groups = footerGroups(isMunicipios ? 'municipios' : 'ciudadano', portalHref);
  // Si el logo de la UNLZ no carga, queda «UNLZ» en texto para que el enlace no quede vacío
  const [unlzFailed, setUnlzFailed] = useState(false);

  return (
    <footer data-testid="site-footer" data-variant={isMunicipios ? 'municipios' : 'ciudadano'} className={`border-t border-rep-border bg-rep-surface font-manrope ${className}`}>
      <div className="mx-auto flex max-w-[1200px] flex-col gap-8 px-6 pb-6 pt-11">
        <div className="grid grid-cols-1 gap-x-14 gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
          <div className="flex max-w-[380px] flex-col gap-3.5">
            <Link
              to={isMunicipios ? '/municipios' : '/'}
              aria-label="Reportalo, inicio"
              className="rep-focus inline-flex min-h-touch items-center gap-[9px] self-start rounded-lg no-underline"
            >
              <img src="/logo-icon.webp" alt="" className="h-[25px] w-[19px] object-contain" />
              <span className="text-[18px] font-extrabold tracking-[-0.4px] text-rep-ink">
                Reportalo<sup className="text-[0.5em] tracking-normal">™</sup>
              </span>
              {isMunicipios && (
                <span className="rounded-[7px] bg-rep-accent-soft px-2 py-1 text-[10px] font-bold tracking-[0.3px] text-rep-accent">
                  MUNICIPIOS
                </span>
              )}
            </Link>
            <p className="m-0 text-pretty text-[14px] font-medium leading-[1.6] text-rep-ink-body">
              {FOOTER_TAGLINE[isMunicipios ? 'municipios' : 'ciudadano']}
            </p>
            <div>
              {SHOW_CONTACT_EMAIL && (
                <>
                  <div className="text-[11px] font-bold tracking-[0.8px] text-rep-ink-muted">CONTACTO INSTITUCIONAL</div>
                  <a
                    href={`mailto:${CONTACT_EMAIL}`}
                    className="rep-focus inline-flex min-h-touch items-center gap-2 self-start rounded-lg text-[14.5px] font-bold text-rep-accent no-underline hover:text-rep-accent-strong"
                  >
                    <Mail aria-hidden="true" className="h-[19px] w-[19px] flex-none" strokeWidth={2} />
                    {CONTACT_EMAIL}
                  </a>
                </>
              )}
              <div className="flex items-center gap-2 text-[13.5px] font-medium text-rep-ink-muted">
                <MapPin aria-hidden="true" className="h-[19px] w-[19px] flex-none" strokeWidth={2} />
                {PLACE}
              </div>
            </div>
          </div>

          <nav aria-label="Pie de página" className="grid grid-cols-2 gap-x-7 gap-y-6 md:grid-cols-3">
            {groups.map((group) => (
              <div key={group.title}>
                <h2 className="m-0 mb-1 text-[11px] font-extrabold uppercase tracking-[1px] text-rep-ink-muted">{group.title}</h2>
                <ul className="m-0 flex list-none flex-col p-0">
                  {group.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        to={link.to}
                        className="rep-focus inline-flex min-h-touch items-center rounded-lg text-[14.5px] font-semibold text-rep-ink no-underline hover:text-rep-accent"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="flex flex-col items-center gap-x-6 gap-y-1.5 border-t border-rep-border pt-4 text-center md:flex-row md:flex-wrap md:justify-between md:text-left">
          <span className="text-[13px] font-medium leading-[1.5] text-rep-ink-muted">
            © {new Date().getFullYear()} Reportalo™. Todos los derechos reservados.
          </span>
          <div className="flex items-end gap-2.5 text-[13px] font-medium text-rep-ink-muted">
            <span className="flex h-[13px] items-center leading-none">Hecho en</span>
            <a
              href={UNLZ_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Universidad Nacional de Lomas de Zamora, se abre en una pestaña nueva"
              title="Universidad Nacional de Lomas de Zamora"
              className="rep-focus inline-flex min-h-touch items-end rounded-md no-underline hover:opacity-80"
            >
              {unlzFailed ? (
                <span className="text-[16px] font-extrabold tracking-[0.6px] text-[#0000F0] dark:text-[#9DB0FF]">UNLZ</span>
              ) : (
                <img src="/assets/unlz-logo.png" alt="" className="block h-12 w-auto object-contain" onError={() => setUnlzFailed(true)} />
              )}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
