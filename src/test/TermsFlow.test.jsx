import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TermsAndPermissionsPage } from '../pages/TermsAndPermissionsPage';

describe('REP-3532 / REP-3603: TermsAndPermissionsPage en Solo Lectura (User Journey v2)', () => {
  // REP-3868: «Condiciones de uso», versión 1.5 y la sección «Fotos» como artículo 4.
  it('UT-TM-01: Renderiza los 6 artículos con el encabezado de la versión vigente', () => {
    render(
      <MemoryRouter initialEntries={['/terminos']}>
        <TermsAndPermissionsPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /Condiciones de uso/i, level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Versión 1.5 · vigente desde 11/2026')).toBeInTheDocument();
    expect(screen.getByText('1. Qué es Reportalo')).toBeInTheDocument();
    expect(screen.getByText('2. Cuándo se pide tu consentimiento')).toBeInTheDocument();
    expect(screen.getByText('3. Tratamiento de imágenes')).toBeInTheDocument();
    expect(screen.getByText('4. Fotos')).toBeInTheDocument();
    expect(screen.getByText('5. Tus derechos')).toBeInTheDocument();
    expect(screen.getByText('6. Conservación')).toBeInTheDocument();
  });

  it('UT-TM-02: Renderiza el banner inferior que aclara que leer no implica aceptación', () => {
    render(
      <MemoryRouter initialEntries={['/terminos']}>
        <TermsAndPermissionsPage />
      </MemoryRouter>
    );

    expect(
      screen.getByText(/Leer esta página no implica aceptación. Se te va a pedir al enviar./i)
    ).toBeInTheDocument();
  });
});
