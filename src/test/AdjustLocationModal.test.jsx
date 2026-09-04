import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdjustLocationModal } from '../components/report/AdjustLocationModal';
import { ReportReviewStep } from '../components/report/ReportReviewStep';

// Mock de maplibre-gl para entorno JSDOM
vi.mock('maplibre-gl', () => {
  return {
    supported: vi.fn(() => true),
    setWorkerUrl: vi.fn(),
    Map: vi.fn(() => ({
      on: vi.fn((event, cb) => {
        if (event === 'load' || event === 'style.load') cb();
      }),
      addControl: vi.fn(),
      remove: vi.fn(),
      resize: vi.fn(),
      flyTo: vi.fn(),
      getCenter: vi.fn(() => ({ lat: -34.6625, lng: -58.365 })),
    })),
    Marker: vi.fn(() => ({
      setLngLat: vi.fn().mockReturnThis(),
      addTo: vi.fn().mockReturnThis(),
      remove: vi.fn(),
    })),
  };
});

describe('REP-2201 / Sprint 10: Ajuste interactivo de ubicación en el reporte ("¿Dónde ocurrió?")', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('UT-LOC-01: El botón "Ajustar" en ReportReviewStep dispara onOpenAdjustLocation', () => {
    const handleOpenAdjustLocation = vi.fn();

    render(
      <ReportReviewStep
        evidenceList={[{ id: '1', previewUrl: 'blob:mock' }]}
        selectedCategory={{ id: '1', name: 'Tránsito' }}
        description="Vehículo mal estacionado"
        geolocation={{ lat: -34.6625, lng: -58.365 }}
        address="Av. Mitre 1240, Avellaneda"
        hasAcceptedTerms={true}
        onBack={vi.fn()}
        onSubmitReport={vi.fn()}
        onAcceptTermsAndSubmit={vi.fn()}
        onOpenTerms={vi.fn()}
        onOpenAdjustLocation={handleOpenAdjustLocation}
      />
    );

    const adjustBtn = screen.getByRole('button', { name: /ajustar ubicación/i });
    expect(adjustBtn).toBeInTheDocument();

    fireEvent.click(adjustBtn);
    expect(handleOpenAdjustLocation).toHaveBeenCalledTimes(1);
  });

  it('UT-LOC-02: AdjustLocationModal renderiza la pantalla "¿Dónde ocurrió?", instrucciones y datos de dirección', () => {
    const handleConfirm = vi.fn();
    const handleClose = vi.fn();

    render(
      <AdjustLocationModal
        initialCoordinates={{ lat: -34.6625, lng: -58.365 }}
        onConfirm={handleConfirm}
        onClose={handleClose}
      />
    );

    // Header
    expect(screen.getByText('¿Dónde ocurrió?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /volver a la revisión/i })).toBeInTheDocument();

    // Banner de ayuda
    expect(screen.getByText('Arrastrá el mapa para corregir el punto exacto.')).toBeInTheDocument();

    // Botón GPS
    expect(screen.getByRole('button', { name: /mi ubicación actual/i })).toBeInTheDocument();

    // Dirección resuelta y botón de confirmación
    expect(screen.getByTestId('adjust-street-address')).toHaveTextContent('Av. Mitre 1240');
    expect(screen.getByTestId('adjust-locality-address')).toHaveTextContent('Avellaneda, Buenos Aires · precisión ±8 m');

    const confirmBtn = screen.getByRole('button', { name: /confirmar ubicación/i });
    expect(confirmBtn).toBeInTheDocument();

    fireEvent.click(confirmBtn);
    expect(handleConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        street: 'Av. Mitre 1240',
        locality: 'Avellaneda, Buenos Aires',
        fullAddress: 'Av. Mitre 1240, Avellaneda',
        accuracy: 8,
      })
    );
  });

  it('UT-LOC-03: Al tocar la flecha de volver en AdjustLocationModal dispara onClose', () => {
    const handleClose = vi.fn();

    render(
      <AdjustLocationModal
        initialCoordinates={{ lat: -34.6625, lng: -58.365 }}
        onConfirm={vi.fn()}
        onClose={handleClose}
      />
    );

    const backBtn = screen.getByRole('button', { name: /volver a la revisión/i });
    fireEvent.click(backBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('UT-LOC-04: Si las coordenadas iniciales están fuera del Bounding Box de CABA/Avellaneda, utiliza el centro por defecto de la zona', () => {
    // Coordenadas en Córdoba / fuera de CABA y Avellaneda
    const outOfBoundsCoords = { lat: -31.4201, lng: -64.1888 };

    render(
      <AdjustLocationModal
        initialCoordinates={outOfBoundsCoords}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );

    // Debe renderizar la dirección por defecto dentro del Bounding Box de CABA/Avellaneda
    expect(screen.getByTestId('adjust-street-address')).toBeInTheDocument();
  });
});
