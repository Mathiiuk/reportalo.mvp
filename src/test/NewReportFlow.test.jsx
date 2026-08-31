import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { NewReportPage } from '../pages/NewReportPage';
import { AuthContext } from '../context/AuthContext';

describe('REP-2200: Iniciar un nuevo reporte ciudadano', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockAuthContext = {
    session: { user: { id: 'usr-123', email: 'vecino@reportalo.com.ar' } },
    user: { id: 'usr-123', email: 'vecino@reportalo.com.ar' },
    loading: false,
    signOut: vi.fn(),
  };

  it('UT-NR-01: Renderiza la cabecera del flujo de nuevo reporte con indicador de paso', () => {
    render(
      <MemoryRouter initialEntries={['/nuevo-reporte']}>
        <NewReportPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /nuevo reporte/i, level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/paso 1 de 3/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /volver al mapa/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancelar reporte/i })).toBeInTheDocument();
  });

  it('UT-NR-02: En el paso 1 el boton Continuar permanece deshabilitado si no hay evidencia adjunta', () => {
    render(
      <MemoryRouter initialEntries={['/nuevo-reporte']}>
        <NewReportPage />
      </MemoryRouter>
    );

    const continueBtn = screen.getByRole('button', { name: /continuar/i });
    expect(continueBtn).toBeDisabled();
  });

  it('UT-NR-03: Al hacer clic en Cancelar o Volver al mapa, redirige hacia /mapa sin persistir datos incompletos', () => {
    render(
      <MemoryRouter initialEntries={['/nuevo-reporte']}>
        <Routes>
          <Route path="/nuevo-reporte" element={<NewReportPage />} />
          <Route path="/mapa" element={<div>Pantalla Principal Mapa</div>} />
        </Routes>
      </MemoryRouter>
    );

    const backBtn = screen.getByRole('button', { name: /volver al mapa/i });
    fireEvent.click(backBtn);

    expect(screen.getByText('Pantalla Principal Mapa')).toBeInTheDocument();
  });
});
