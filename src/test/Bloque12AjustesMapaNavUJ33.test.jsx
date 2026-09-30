/**
 * @file Bloque12AjustesMapaNavUJ33.test.jsx
 * @description REP-3798 · ajustes tras la validación de Iván (30/09/2026):
 * - «Reportar» pasa al medio de la barra de pestañas, naranja y con ícono de cámara.
 * - La pantalla de captura siempre permite subir una imagen de la galería.
 * - El mapa ya no muestra «Reportes visibles».
 * - El aviso «Ubicación desactivada» no queda detrás de los botones de filtros.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, session: { user: { id: 'u1' } } }) }));

import { AppTabBar } from '../components/layout/AppLayout';
import { EvidenceCaptureStep } from '../components/report/EvidenceCaptureStep';

describe('REP-3798 · barra de pestañas con «Reportar» en el medio', () => {
  it('UT-B12-01: el botón «Reportar» queda entre la segunda y la tercera pestaña', () => {
    render(<MemoryRouter><AppTabBar activeTab="mapa" /></MemoryRouter>);
    const nav = screen.getByRole('navigation', { name: 'Navegación principal' });
    const labels = within(nav).getAllByRole('button').map((button) => button.getAttribute('aria-label'));
    expect(labels).toEqual(['Mapa', 'Mis reportes', 'Reportar', 'Alertas y novedades', 'Perfil']);
  });

  it('UT-B12-02: el botón es naranja y lleva un ícono de cámara', () => {
    render(<MemoryRouter><AppTabBar activeTab="mapa" /></MemoryRouter>);
    const button = screen.getByTestId('tab-report-button');
    expect(button.querySelector('span')?.className).toContain('bg-[#E07C1A]');
    expect(button.querySelector('svg')).toBeInTheDocument();
  });
});

describe('REP-3798 · captura con subida de imagen', () => {
  const renderCapture = (evidenceList = []) =>
    render(
      <MemoryRouter>
        <EvidenceCaptureStep
          evidenceList={evidenceList}
          onCaptureFile={vi.fn()}
          onClearEvidence={vi.fn()}
          onRemovePhoto={vi.fn()}
          onCancel={vi.fn()}
          onContinue={vi.fn()}
        />
      </MemoryRouter>
    );

  it('UT-B12-03: sin fotos hay un botón de texto para subir una imagen de la galería', () => {
    renderCapture();
    expect(screen.getByTestId('gallery-upload-button')).toHaveTextContent(/subir imagen/i);
  });

  it('UT-B12-04: con una foto ya sacada el botón para subir otra sigue disponible', () => {
    renderCapture([{ id: 'e1', previewUrl: 'blob:1', name: 'f.jpg' }]);
    expect(screen.getByTestId('gallery-upload-button')).toBeInTheDocument();
  });

  it('UT-B12-05: al llegar al máximo de fotos el botón desaparece', () => {
    renderCapture([1, 2, 3, 4].map((n) => ({ id: `e${n}`, previewUrl: `blob:${n}`, name: `f${n}.jpg` })));
    expect(screen.queryByTestId('gallery-upload-button')).not.toBeInTheDocument();
  });

  it('UT-B12-06: el botón abre el selector de archivos de la galería (sin capture)', () => {
    renderCapture();
    const input = screen.getByTestId('gallery-file-input');
    const click = vi.spyOn(input, 'click');
    fireEvent.click(screen.getByTestId('gallery-upload-button'));
    expect(click).toHaveBeenCalled();
    expect(input).not.toHaveAttribute('capture');
  });
});

describe('REP-3798 · mapa sin «Reportes visibles» y con el aviso de ubicación bien ubicado', () => {
  // jsdom no calcula posiciones: se verifica el código fuente, como en LayoutBreakpointH58
  const fuente = readFileSync(resolve(process.cwd(), 'src/components/map/CitizenMap.jsx'), 'utf8');

  it('UT-B12-07: el mapa ya no muestra el contador «Reportes visibles»', () => {
    expect(fuente).not.toMatch(/Reportes visibles/i);
  });

  it('UT-B12-08: el aviso de ubicación deja libre la columna de filtros (no usa el `right-18` inexistente)', () => {
    expect(fuente).not.toContain('right-18');
    expect(fuente).toContain('right-[76px]');
  });
});
