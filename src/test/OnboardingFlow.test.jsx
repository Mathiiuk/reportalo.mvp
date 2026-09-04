import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { OnboardingPage } from '../pages/OnboardingPage';

describe('REP-3519: Flujo de Onboarding Ciudadano de 3 Pasos', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('UT-OB-01: Renderiza el Paso 1 ("Una foto es un reclamo") con ilustración y paginador inicial', () => {
    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /Una foto es un reclamo/i, level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/Sacás la foto de lo que está mal en tu barrio/i)).toBeInTheDocument();
    expect(screen.getByText(/ILUSTRACIÓN · foto de un incidente/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Saltar/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: /Siguiente/i })).toBeInTheDocument();
  });

  it('UT-OB-02: Avanza secuencialmente a través de los 3 pasos con el botón "Siguiente"', async () => {
    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>
    );

    const nextBtn = screen.getByRole('button', { name: /Siguiente/i });

    // Paso 1 -> Paso 2
    fireEvent.click(nextBtn);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Tu foto se protege sola/i })).toBeInTheDocument();
      expect(screen.getByText(/Los rostros y las patentes se difuminan automáticamente/i)).toBeInTheDocument();
    });

    // Paso 2 -> Paso 3
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/i }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Seguí cada reporte/i })).toBeInTheDocument();
      expect(screen.getByText(/Enviado/i)).toBeInTheDocument();
      expect(screen.getByText(/En revisión/i)).toBeInTheDocument();
      expect(screen.getByText(/Notificado/i)).toBeInTheDocument();
      expect(screen.getByText(/Resuelto/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Empezar/i })).toBeInTheDocument();
    });
  });

  it('UT-OB-03: El botón "Saltar" guarda el estado de completado y redirige a /mapa', async () => {
    const MapDestination = () => <div data-testid="map-screen">Citizen Map Screen</div>;

    render(
      <MemoryRouter initialEntries={['/onboarding']}>
        <Routes>
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/mapa" element={<MapDestination />} />
        </Routes>
      </MemoryRouter>
    );

    const skipButtons = screen.getAllByRole('button', { name: /Saltar/i });
    fireEvent.click(skipButtons[0]);

    await waitFor(() => {
      expect(localStorage.getItem('reportalo_onboarding_completed')).toBe('true');
      expect(screen.getByTestId('map-screen')).toBeInTheDocument();
    });
  });

  it('UT-OB-04: El botón "Empezar" en el Paso 3 finaliza el onboarding y navega a /mapa', async () => {
    const MapDestination = () => <div data-testid="map-screen">Citizen Map Screen</div>;

    render(
      <MemoryRouter initialEntries={['/onboarding']}>
        <Routes>
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/mapa" element={<MapDestination />} />
        </Routes>
      </MemoryRouter>
    );

    // Avanzamos hasta el paso 3
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/i }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Tu foto se protege sola/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Siguiente/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Empezar/i })).toBeInTheDocument();
    });

    const startBtn = screen.getByRole('button', { name: /Empezar/i });
    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(localStorage.getItem('reportalo_onboarding_completed')).toBe('true');
      expect(screen.getByTestId('map-screen')).toBeInTheDocument();
    });
  });

  it('UT-OB-05: El paginador interactivo permite cambiar de paso directamente', async () => {
    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>
    );

    const step3Pill = screen.getByRole('button', { name: /Ir al paso 3/i });
    fireEvent.click(step3Pill);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Seguí cada reporte/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Empezar/i })).toBeInTheDocument();
    });
  });
});
