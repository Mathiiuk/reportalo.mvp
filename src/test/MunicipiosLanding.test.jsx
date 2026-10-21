import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MunicipiosPage } from '../pages/MunicipiosPage';
import { AuthContext } from '../context/AuthContext';

// REP-3535 · Landing institucional Municipios (MVP informativo, handoff REP-3830 §08).
// Escenarios en .agents/workflow/features/REP-3535.feature.

// Renderiza la landing con o sin sesión simulada
const renderLanding = (session = null) =>
  render(
    <AuthContext.Provider value={{ user: session?.user ?? null, session, loading: false }}>
      <MemoryRouter initialEntries={['/municipios']}>
        <MunicipiosPage />
      </MemoryRouter>
    </AuthContext.Provider>
  );

describe('REP-3535: Landing institucional Municipios', () => {
  it('Secciones informativas: hero, Cómo funciona, Privacidad y banda del portal, en ese orden', () => {
    renderLanding();

    const hero = screen.getByRole('heading', { level: 1, name: /Los reclamos de tus usuarios, con evidencia y encuadre legal/i });
    const how = screen.getByRole('heading', { name: /Cómo funciona/i });
    const privacy = screen.getByRole('heading', { name: /Privacidad y marco legal/i });
    const band = screen.getByText(/¿Querés reportar algo de tu ciudad\?/i);

    // compareDocumentPosition: FOLLOWING (4) indica que el segundo nodo va después del primero
    expect(hero.compareDocumentPosition(how) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(how.compareDocumentPosition(privacy) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(privacy.compareDocumentPosition(band) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // Contenido ajustado según la tabla de la sección 02 del handoff
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText(/Categorías de reporte/i)).toBeInTheDocument();
    expect(screen.queryByText(/configurables/i)).not.toBeInTheDocument();
    expect(screen.getByText(/El organismo responde/i)).toBeInTheDocument();
    ['Recibido', 'En análisis', 'Derivado', 'Resuelto'].forEach((estado) =>
      expect(within(screen.getByRole('list', { name: /Estados del reporte/i })).getByText(estado)).toBeInTheDocument()
    );
  });

  it('Volver al portal sin sesión: los dos CTA llevan a la portada ciudadana', () => {
    renderLanding();

    // Los dos CTA de la página (el footer compartido de REP-3866 trae otro enlace al portal, con el mismo destino)
    const links = screen
      .getAllByRole('link', { name: /portal ciudadano/i })
      .filter((link) => !link.closest('[data-testid="site-footer"]'));
    expect(links).toHaveLength(2);
    links.forEach((link) => expect(link).toHaveAttribute('href', '/'));
  });

  it('Volver al portal con sesión: los dos CTA llevan al mapa', () => {
    renderLanding({ user: { id: 'u-1' } });

    screen.getAllByRole('link', { name: /portal ciudadano/i }).forEach((link) =>
      expect(link).toHaveAttribute('href', '/mapa')
    );
  });

  it('Anclas: «Cómo funciona» y «Privacidad» apuntan a su sección y la desplazan', () => {
    renderLanding();
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    const nav = screen.getByRole('navigation', { name: /Secciones/i });
    const howLink = within(nav).getByRole('link', { name: /Cómo funciona/i });
    const privacyLink = within(nav).getByRole('link', { name: /Privacidad/i });

    expect(howLink).toHaveAttribute('href', '#como-funciona');
    expect(privacyLink).toHaveAttribute('href', '#privacidad');
    expect(document.getElementById('como-funciona')).toBeInTheDocument();
    expect(document.getElementById('privacidad')).toBeInTheDocument();

    fireEvent.click(privacyLink);
    expect(scrollIntoView).toHaveBeenCalled();
    // La sección compensa la barra fija para que el título no quede tapado
    expect(document.getElementById('privacidad').className).toMatch(/scroll-mt-/);
  });

  it('Sin CTA comerciales: no aparecen planes, demo, contratación, «Ingresar» ni la nota de correo oficial', () => {
    renderLanding();

    const text = document.body.textContent;
    [/Ver planes/i, /\bPlanes\b/i, /Solicitar una demo/i, /Contratar Reportalo/i, /Ingresar/i, /correo oficial/i, /próximamente/i]
      .forEach((pattern) => expect(text).not.toMatch(pattern));
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('Teléfono y accesibilidad: todos los CTA tienen 44 px de alto mínimo y anillo de foco', () => {
    renderLanding();

    screen.getAllByRole('link').forEach((link) => {
      expect(link.className).toMatch(/min-h-touch/);
      expect(link.className).toMatch(/rep-focus/);
    });
  });
});
