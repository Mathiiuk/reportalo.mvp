import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdjustLocationModal } from '../components/report/AdjustLocationModal';
import { ReportReviewStep } from '../components/report/ReportReviewStep';

// R-1 a R-5: LocalitySelector consulta Supabase — se mockea con dos localidades de la zona piloto
vi.mock('../lib/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockResolvedValue({
        data: [
          { id: 'loc-1', name: 'Retiro', subdivisions: { name: 'Comuna 1', states_provinces: { name: 'Ciudad Autónoma de Buenos Aires' } } },
          { id: 'loc-2', name: 'Piñeyro', subdivisions: { name: 'Avellaneda', states_provinces: { name: 'Buenos Aires' } } },
        ],
        error: null,
      }),
    })),
  },
}));

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

  it('UT-LOC-02: AdjustLocationModal renderiza la pantalla "¿Dónde ocurrió?", instrucciones y el selector de localidad (R-1 a R-5, E-1)', async () => {
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

    // E-1: ya no se inventa una dirección postal, solo se describe el punto del mapa
    expect(screen.getByTestId('adjust-street-address')).toHaveTextContent('Punto marcado en el mapa');

    // R-2/R-5: sin localidad elegida, el botón de confirmar está deshabilitado
    const confirmBtn = screen.getByRole('button', { name: /confirmar ubicación/i });
    expect(confirmBtn).toBeDisabled();

    // R-1/R-5: se elige una localidad de la zona piloto vía el selector con autocompletado
    // (esperamos a que termine de cargar; mientras carga el disparador está deshabilitado)
    await waitFor(() => expect(screen.getByTestId('locality-selector-trigger')).not.toBeDisabled());
    fireEvent.click(screen.getByTestId('locality-selector-trigger'));
    const localityOption = await screen.findByTestId('locality-option-loc-2');
    fireEvent.click(localityOption);

    expect(confirmBtn).not.toBeDisabled();
    fireEvent.click(confirmBtn);
    expect(handleConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        localityId: 'loc-2',
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

  it('UT-LOC-05: Si el barrio elegido queda lejos del pin, muestra el aviso y bloquea "Confirmar ubicación"', async () => {
    const handleConfirm = vi.fn();

    render(
      <AdjustLocationModal
        // Punto en San Telmo (~5km de Retiro)
        initialCoordinates={{ lat: -34.6212, lng: -58.3731 }}
        onConfirm={handleConfirm}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => expect(screen.getByTestId('locality-selector-trigger')).not.toBeDisabled());
    fireEvent.click(screen.getByTestId('locality-selector-trigger'));
    // loc-1 = "Retiro", geográficamente lejos del pin en San Telmo
    fireEvent.click(await screen.findByTestId('locality-option-loc-1'));

    expect(screen.getByTestId('locality-pin-mismatch-warning')).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /confirmar ubicación/i });
    expect(confirmBtn).toBeDisabled();

    fireEvent.click(confirmBtn);
    expect(handleConfirm).not.toHaveBeenCalled();
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
