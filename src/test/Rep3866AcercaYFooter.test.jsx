/**
 * @file Rep3866AcercaYFooter.test.jsx
 * @description REP-3866: «Acerca de Reportalo™» y footer compartido, portados a React desde el handoff de Iván
 * (REP-3865). Cubre los criterios de la sección 9 del LEEME que se pueden probar sin navegador real.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AcercaPage } from '../pages/AcercaPage';
import { SiteFooter } from '../components/layout/SiteFooter';
import { FaqPage } from '../pages/FaqPage';
import { AuthContext } from '../context/AuthContext';
import { normalizeBuildInfo, formatBuildDate, loadBuildInfo } from '../services/buildInfoService';
import { CONTACT_EMAIL, SHOW_CONTACT_EMAIL, SHOW_PRIVACY, TEAM, ABOUT_PARAGRAPHS } from '../content/siteInfo';

const Donde = () => {
  const location = useLocation();
  return <div data-testid="donde">{location.pathname + location.search + location.hash}</div>;
};

const BUILD = {
  version: '1.0.0',
  commit: 'a93da236447a8d35e7e8e186085a15584587355e',
  commitShort: 'a93da23',
  branch: 'staging',
  builtAt: '2026-10-21T01:30:00.000Z',
  env: 'production',
};

const montarAcerca = (url = '/acerca') =>
  render(
    <AuthContext.Provider value={{ session: null, user: null, loading: false, signOut: vi.fn() }}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/acerca" element={<AcercaPage />} />
          <Route path="*" element={<Donde />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );

const mockFetch = (impl) => vi.stubGlobal('fetch', vi.fn(impl));

describe('REP-3866 · /acerca', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('UT-3866-01: muestra el texto institucional, el equipo con sus títulos y la mención especial aparte', async () => {
    mockFetch(async () => ({ ok: true, json: async () => BUILD }));
    montarAcerca();

    expect(screen.getByRole('heading', { level: 1, name: /Acerca de Reportalo/ })).toBeInTheDocument();
    ABOUT_PARAGRAPHS.forEach((p) => expect(screen.getByText(p)).toBeInTheDocument());
    const lista = within(screen.getByRole('heading', { name: 'Equipo' }).closest('section')).getByRole('list');
    const tarjetas = within(lista).getAllByRole('listitem');
    expect(tarjetas).toHaveLength(4);
    // Cada tarjeta, en orden, con su nombre y su título académico
    TEAM.forEach(({ name, title }, i) => {
      expect(within(tarjetas[i]).getByText(name)).toBeInTheDocument();
      expect(within(tarjetas[i]).getByText(title)).toBeInTheDocument();
    });
    const mencion = screen.getByRole('heading', { name: 'Mención especial' }).closest('section');
    expect(within(mencion).getByText('Carlos Ruiz')).toBeInTheDocument();
    expect(within(lista).queryByText('Carlos Ruiz')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('acerca-version')).toHaveAttribute('aria-busy', 'false'));
  });

  it('UT-3866-02: la versión sale de /build-info.json, sin caché, y muestra Build, Compilación y Publicada', async () => {
    mockFetch(async () => ({ ok: true, json: async () => BUILD }));
    montarAcerca();

    const version = screen.getByTestId('acerca-version');
    expect(version).toHaveAttribute('aria-busy', 'true');
    await waitFor(() => expect(within(version).getByText('1.0.0')).toBeInTheDocument());
    expect(within(version).getByText('a93da23')).toHaveAttribute('title', BUILD.commit);
    // 01:30 UTC del 21/10 es todavía 20/10 en Argentina
    expect(within(version).getByText('20/10/2026')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith('/build-info.json', { cache: 'no-store' });
    expect(version).not.toHaveTextContent(/production|staging/);
  });

  it('UT-3866-03: sin build-info.json avisa que no pudo leer la versión y el resto carga igual', async () => {
    mockFetch(async () => ({ ok: false, status: 404 }));
    montarAcerca();

    await waitFor(() => expect(screen.getByText('No pudimos leer la versión')).toBeInTheDocument());
    expect(screen.getByText('La aplicación funciona igual.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Equipo' })).toBeInTheDocument();
  });

  it.each([
    ['/acerca', 'Volver', '/', 'ciudadano'],
    ['/acerca?desde=perfil', 'Volver al perfil', '/perfil', 'ciudadano'],
    ['/acerca?desde=municipios', 'Volver a Municipios', '/municipios', 'municipios'],
  ])('UT-3866-04: %s → botón «%s», respaldo %s y footer %s', async (url, label, fallback, variant) => {
    mockFetch(async () => ({ ok: true, json: async () => BUILD }));
    montarAcerca(url);

    expect(screen.getByTestId('site-footer')).toHaveAttribute('data-variant', variant);
    // Entrada directa (sin historial dentro de la app): va a la ruta de respaldo
    fireEvent.click(screen.getByRole('button', { name: label }));
    expect(screen.getByTestId('donde')).toHaveTextContent(fallback);
  });

  it('UT-3866-05: el correo institucional no se publica mientras REP-3873 no confirme la recepción', async () => {
    mockFetch(async () => ({ ok: true, json: async () => BUILD }));
    const { container } = montarAcerca();
    expect(SHOW_CONTACT_EMAIL).toBe(false);
    expect(screen.queryByText(CONTACT_EMAIL)).not.toBeInTheDocument();
    expect(container.querySelector('a[href^="mailto:"]')).toBeNull();
    await waitFor(() => expect(screen.getByTestId('acerca-version')).toHaveAttribute('aria-busy', 'false'));
  });
});

describe('REP-3866 · footer compartido', () => {
  const montar = (variant, portalHref) =>
    render(
      <MemoryRouter>
        <SiteFooter variant={variant} portalHref={portalHref} />
      </MemoryRouter>
    );
  const hrefs = () => screen.getAllByRole('link').map((a) => a.getAttribute('href'));

  it('UT-3866-06: ciudadano: Acerca de, Para municipios, Preguntas frecuentes, ¿Es una emergencia? y Términos', () => {
    montar('ciudadano');
    const nav = screen.getByRole('navigation', { name: 'Pie de página' });
    expect(within(nav).getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Reportalo™', 'Ayuda', 'Legal']);
    expect(hrefs()).toEqual(expect.arrayContaining(['/', '/acerca', '/municipios', '/faq', '/faq#emergencias', '/terminos']));
    expect(screen.queryByText('Cómo funciona')).not.toBeInTheDocument();
    expect(screen.queryByText('MUNICIPIOS')).not.toBeInTheDocument();
  });

  it('UT-3866-07: municipios: logo a /municipios, chip, Cómo funciona, Privacidad y marco legal y portal ciudadano', () => {
    montar('municipios', '/mapa');
    expect(screen.getByText('MUNICIPIOS')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Reportalo, inicio' })).toHaveAttribute('href', '/municipios');
    expect(hrefs()).toEqual(
      expect.arrayContaining(['/municipios#como-funciona', '/municipios#privacidad', '/acerca?desde=municipios', '/mapa', '/terminos'])
    );
    expect(screen.queryByText('Ayuda')).not.toBeInTheDocument();
    expect(screen.queryByText('¿Es una emergencia?')).not.toBeInTheDocument();
  });

  it('UT-3866-08: sin política de privacidad ni correo hasta que existan; UNLZ en pestaña nueva; todos los enlaces de 44 px', () => {
    montar('ciudadano');
    expect(SHOW_PRIVACY).toBe(false);
    expect(screen.queryByText('Política de privacidad')).not.toBeInTheDocument();
    expect(screen.queryByText(CONTACT_EMAIL)).not.toBeInTheDocument();
    const unlz = screen.getByRole('link', { name: /Universidad Nacional de Lomas de Zamora/ });
    expect(unlz).toHaveAttribute('href', 'https://www.unlz.edu.ar/');
    expect(unlz).toHaveAttribute('target', '_blank');
    expect(unlz).toHaveAttribute('rel', 'noopener noreferrer');
    screen.getAllByRole('link').forEach((link) => {
      expect(link.className).toMatch(/min-h-touch/);
      expect(link.className).toMatch(/rep-focus/);
    });
    expect(screen.getByText(new RegExp(`© ${new Date().getFullYear()} Reportalo™`))).toBeInTheDocument();
  });

  it('UT-3866-09: si el logo de la UNLZ no carga, queda «UNLZ» en texto', () => {
    const { container } = montar('ciudadano');
    fireEvent.error(container.querySelector('img[src="/assets/unlz-logo.png"]'));
    expect(screen.getByText('UNLZ')).toBeInTheDocument();
  });
});

describe('REP-3866 · Preguntas frecuentes públicas y #emergencias', () => {
  it('UT-3866-10: sin sesión, /faq#emergencias abre esa pregunta y se ven el 911, el 107 y el 100', async () => {
    render(
      <AuthContext.Provider value={{ session: null, user: null, loading: false, signOut: vi.fn() }}>
        <MemoryRouter initialEntries={['/faq#emergencias']}>
          <Routes>
            <Route path="/faq" element={<FaqPage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    );
    const boton = screen.getByRole('button', { name: /es una emergencia/i });
    expect(boton).toHaveAttribute('aria-expanded', 'true');
    ['911', '107', '100'].forEach((n) => expect(screen.getByRole('link', { name: new RegExp(`^${n} ·`) })).toBeVisible());
    await waitFor(() => expect(boton).toHaveFocus());
    expect(screen.getByTestId('site-footer')).toBeInTheDocument();
  });
});

describe('REP-3866 · build-info', () => {
  it('UT-3866-11: normaliza el JSON y formatea la fecha en Argentina, sin hora', () => {
    expect(normalizeBuildInfo({ commit: 'abcdef1234567' })).toMatchObject({ commitShort: 'abcdef1', version: '' });
    expect(formatBuildDate('2026-10-20T15:00:00Z')).toBe('20/10/2026');
    expect(formatBuildDate('no es fecha')).toBe('');
  });

  it('UT-3866-12: loadBuildInfo nunca lanza', async () => {
    const roto = () => {
      throw new Error('sin red');
    };
    expect(await loadBuildInfo(roto)).toEqual({ success: false });
  });

  it('UT-3866-13: build y dev generan build-info.json, que no se versiona, y /acerca es una ruta pública de la app', () => {
    const root = resolve(__dirname, '../..');
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
    expect(pkg.scripts.build).toMatch(/^node scripts\/build-info\.mjs && vite build$/);
    expect(pkg.scripts.dev).toMatch(/^node scripts\/build-info\.mjs && vite$/);
    expect(readFileSync(resolve(root, '.gitignore'), 'utf8')).toMatch(/^public\/build-info\.json$/m);
    expect(readFileSync(resolve(root, 'src/App.jsx'), 'utf8')).toMatch(/<Route path="\/acerca" element=\{<AcercaPage \/>\} \/>/);
  });
});
