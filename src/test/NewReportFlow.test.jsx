import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { NewReportPage } from '../pages/NewReportPage';

describe('REP-2200: Iniciar un nuevo reporte ciudadano', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('UT-NR-01: Renderiza la experiencia de captura de fotos del paso 1 con badge de privacidad y disparo', () => {
    render(
      <MemoryRouter initialEntries={['/nuevo-reporte']}>
        <NewReportPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Privacidad activada/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tomar fotografía/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cerrar cámara/i })).toBeInTheDocument();
  });

  it('UT-NR-02: En el paso 1 no permite avanzar sin fotos y al agregar una foto se habilita el avance', () => {
    render(
      <MemoryRouter initialEntries={['/nuevo-reporte']}>
        <NewReportPage />
      </MemoryRouter>
    );

    // Inicialmente no hay botón continuar (requiere al menos 1 foto)
    expect(screen.queryByRole('button', { name: /continuar al siguiente paso/i })).not.toBeInTheDocument();

    const galleryInput = screen.getByTestId('gallery-file-input');
    const validFile = new File(['img'], 'foto.jpg', { type: 'image/jpeg' });
    fireEvent.change(galleryInput, { target: { files: [validFile] } });

    expect(screen.getByRole('button', { name: /continuar al siguiente paso/i })).toBeInTheDocument();
  });

  it('UT-NR-03: Al hacer clic en Cerrar cámara, redirige hacia /mapa sin persistir datos incompletos', () => {
    render(
      <MemoryRouter initialEntries={['/nuevo-reporte']}>
        <Routes>
          <Route path="/nuevo-reporte" element={<NewReportPage />} />
          <Route path="/mapa" element={<div>Pantalla Principal Mapa</div>} />
        </Routes>
      </MemoryRouter>
    );

    const closeBtn = screen.getByRole('button', { name: /cerrar cámara/i });
    fireEvent.click(closeBtn);

    expect(screen.getByText('Pantalla Principal Mapa')).toBeInTheDocument();
  });
});
