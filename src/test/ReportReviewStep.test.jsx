import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReportReviewStep } from '../components/report/ReportReviewStep';
import { DEFAULT_REPORT_CATEGORIES } from '../services/categoriesService';

describe('REP-2200: ReportReviewStep y Modal "Antes de enviar" (Journey v2)', () => {
  const mockEvidenceList = [
    { id: '1', previewUrl: 'blob:mock1', name: 'foto1.jpg' },
    { id: '2', previewUrl: 'blob:mock2', name: 'foto2.jpg' },
  ];
  const mockCategory = DEFAULT_REPORT_CATEGORIES[1]; // Infracción de tránsito

  it('UT-RV-01: Renderiza el stepper con los 3 pasos completados/activos', () => {
    render(
      <ReportReviewStep
        evidenceList={mockEvidenceList}
        selectedCategory={mockCategory}
        description="Camión de gran porte circulando por calle residencial"
        geolocation={{ lat: -34.663, lng: -58.365 }}
        address="Av. Mitre 1240, Avellaneda"
        hasAcceptedTerms={false}
        onBack={vi.fn()}
        onSubmitReport={vi.fn()}
        onAcceptTermsAndSubmit={vi.fn()}
        onViewAllPhotos={vi.fn()}
        onOpenTerms={vi.fn()}
      />
    );

    expect(screen.getByText('Foto')).toBeInTheDocument();
    expect(screen.getByText('Detalle')).toBeInTheDocument();
    expect(screen.getByText('Enviar')).toBeInTheDocument();
  });

  it('UT-RV-08 (REP-2500-PRESEL): avisa cuando la localidad fue detectada automáticamente', () => {
    // La sugerencia por centroide es aproximada, asi que tiene que ser visible
    // y corregible: el locality_id define que organismo recibe el reclamo.
    render(
      <ReportReviewStep
        evidenceList={mockEvidenceList}
        selectedCategory={mockCategory}
        description="Auto sobre la vereda"
        geolocation={{ lat: -34.6187, lng: -58.4436 }}
        address="Caballito"
        hasConfirmedLocality
        isLocalityAutoSuggested
        onBack={vi.fn()}
        onSubmitReport={vi.fn()}
        onOpenAdjustLocation={vi.fn()}
      />
    );

    expect(screen.getByTestId('auto-locality-hint')).toBeInTheDocument();
    expect(screen.queryByTestId('missing-locality-hint')).not.toBeInTheDocument();
  });

  it('UT-RV-09 (REP-2500-PRESEL): con localidad elegida a mano no muestra el aviso de detección', () => {
    render(
      <ReportReviewStep
        evidenceList={mockEvidenceList}
        selectedCategory={mockCategory}
        description="Auto sobre la vereda"
        geolocation={{ lat: -34.6187, lng: -58.4436 }}
        address="Caballito"
        hasConfirmedLocality
        isLocalityAutoSuggested={false}
        onBack={vi.fn()}
        onSubmitReport={vi.fn()}
        onOpenAdjustLocation={vi.fn()}
      />
    );

    expect(screen.queryByTestId('auto-locality-hint')).not.toBeInTheDocument();
  });

  it('UT-RV-00: Si no se confirmó la localidad (R-1/R-2), "Enviar reporte" abre el ajuste de ubicación en vez del modal de consentimiento', () => {
    const onOpenAdjustLocationMock = vi.fn();
    const onSubmitMock = vi.fn();

    render(
      <ReportReviewStep
        evidenceList={mockEvidenceList}
        selectedCategory={mockCategory}
        description="Camión de gran porte"
        geolocation={null}
        address="Av. Mitre 1240, Avellaneda"
        hasConfirmedLocality={false}
        hasAcceptedTerms={true}
        onBack={vi.fn()}
        onSubmitReport={onSubmitMock}
        onAcceptTermsAndSubmit={vi.fn()}
        onViewAllPhotos={vi.fn()}
        onOpenTerms={vi.fn()}
        onOpenAdjustLocation={onOpenAdjustLocationMock}
      />
    );

    expect(screen.getByTestId('missing-locality-hint')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Enviar reporte/i }));

    expect(onOpenAdjustLocationMock).toHaveBeenCalledTimes(1);
    expect(onSubmitMock).not.toHaveBeenCalled();
  });

  it('UT-RV-02: Si el usuario NO aceptó términos previamente, hacer clic en "Enviar reporte" abre el modal "Antes de enviar"', async () => {
    render(
      <ReportReviewStep
        evidenceList={mockEvidenceList}
        selectedCategory={mockCategory}
        description="Camión de gran porte"
        geolocation={null}
        address="Av. Mitre 1240, Avellaneda"
        hasConfirmedLocality={true}
        hasAcceptedTerms={false}
        onBack={vi.fn()}
        onSubmitReport={vi.fn()}
        onAcceptTermsAndSubmit={vi.fn()}
        onViewAllPhotos={vi.fn()}
        onOpenTerms={vi.fn()}
      />
    );

    const submitBtn = screen.getByRole('button', { name: /Enviar reporte/i });
    fireEvent.click(submitBtn);

    expect(screen.getByText('Antes de enviar')).toBeInTheDocument();
    // UJ v3.3 · M13: texto de la hoja de consentimiento (REP-3791 Bloque 2)
    expect(screen.getByText(/Difuminamos rostros y patentes en el servidor, antes de guardar/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Acepto y envío/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ahora no/i })).toBeInTheDocument();
  });

  it('UT-RV-03: Al presionar "Acepto y envío" se invoca onAcceptTermsAndSubmit', () => {
    const onAcceptMock = vi.fn();

    render(
      <ReportReviewStep
        evidenceList={mockEvidenceList}
        selectedCategory={mockCategory}
        description="Camión de gran porte"
        geolocation={null}
        address="Av. Mitre 1240, Avellaneda"
        hasConfirmedLocality={true}
        hasAcceptedTerms={false}
        onBack={vi.fn()}
        onSubmitReport={vi.fn()}
        onAcceptTermsAndSubmit={onAcceptMock}
        onViewAllPhotos={vi.fn()}
        onOpenTerms={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Enviar reporte/i }));
    fireEvent.click(screen.getByRole('button', { name: /Acepto y envío/i }));

    expect(onAcceptMock).toHaveBeenCalledTimes(1);
  });

  it('UT-RV-04: Al presionar "Ahora no" se cierra el modal y vuelve al paso 3 intacto sin enviar', async () => {
    const onAcceptMock = vi.fn();
    const onSubmitMock = vi.fn();

    render(
      <ReportReviewStep
        evidenceList={mockEvidenceList}
        selectedCategory={mockCategory}
        description="Camión de gran porte"
        geolocation={null}
        address="Av. Mitre 1240, Avellaneda"
        hasConfirmedLocality={true}
        hasAcceptedTerms={false}
        onBack={vi.fn()}
        onSubmitReport={onSubmitMock}
        onAcceptTermsAndSubmit={onAcceptMock}
        onViewAllPhotos={vi.fn()}
        onOpenTerms={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Enviar reporte/i }));
    fireEvent.click(screen.getByRole('button', { name: /Ahora no/i }));

    await waitFor(() => {
      expect(screen.queryByText('Antes de enviar')).not.toBeInTheDocument();
    });
    expect(onAcceptMock).not.toHaveBeenCalled();
    expect(onSubmitMock).not.toHaveBeenCalled();
  });
});

// REP-2204: el botón de envío solo está disponible con los datos mínimos y no se duplica
describe('REP-2204: botón de envío del paso de revisión', () => {
  const evidence = [{ id: '1', previewUrl: 'blob:mock1', name: 'foto1.jpg' }];
  const category = DEFAULT_REPORT_CATEGORIES[0];

  const renderStep = (overrides = {}) => {
    const props = {
      evidenceList: evidence,
      selectedCategory: category,
      description: 'Bache profundo en la esquina',
      geolocation: null,
      address: 'Av. Mitre 1240, Avellaneda',
      hasConfirmedLocality: true,
      hasAcceptedTerms: true,
      isOnline: true,
      onBack: vi.fn(),
      onSubmitReport: vi.fn(),
      onAcceptTermsAndSubmit: vi.fn(),
      onOpenTerms: vi.fn(),
      onOpenAdjustLocation: vi.fn(),
      ...overrides,
    };
    render(<ReportReviewStep {...props} />);
    return props;
  };

  it('UT-SND-01: con los datos mínimos el botón está disponible y envía', () => {
    const { onSubmitReport } = renderStep();
    const button = screen.getByRole('button', { name: /Enviar reporte/i });

    expect(button).not.toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(button);
    expect(onSubmitReport).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('submit-missing')).not.toBeInTheDocument();
  });

  it('UT-SND-02: con la descripción vacía no envía y dice qué falta', () => {
    const { onSubmitReport } = renderStep({ description: '' });
    const button = screen.getByRole('button', { name: /Enviar reporte/i });

    expect(button).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(button);
    expect(onSubmitReport).not.toHaveBeenCalled();
    expect(screen.getByTestId('submit-missing')).toHaveTextContent(/descripción/i);
  });

  it('UT-SND-03: sin fotos ni categoría no envía y lista todo lo que falta', () => {
    const { onSubmitReport } = renderStep({ evidenceList: [], selectedCategory: null });
    fireEvent.click(screen.getByRole('button', { name: /Enviar reporte/i }));

    expect(onSubmitReport).not.toHaveBeenCalled();
    const missing = screen.getByTestId('submit-missing');
    expect(missing).toHaveTextContent(/foto/i);
    expect(missing).toHaveTextContent(/categoría/i);
  });

  it('UT-SND-04: sin ubicación confirmada el botón sigue abriendo el ajuste de ubicación', () => {
    const { onSubmitReport, onOpenAdjustLocation } = renderStep({ hasConfirmedLocality: false });
    const button = screen.getByRole('button', { name: /Enviar reporte/i });

    expect(button).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(button);
    expect(onOpenAdjustLocation).toHaveBeenCalledTimes(1);
    expect(onSubmitReport).not.toHaveBeenCalled();
  });

  it('UT-SND-05: mientras se envía muestra «Enviando…» y no reacciona a más toques', () => {
    const { onSubmitReport, onAcceptTermsAndSubmit } = renderStep({ isSubmitting: true });
    const button = screen.getByRole('button', { name: /Enviando/i });

    expect(button).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(button);
    fireEvent.click(button);
    expect(onSubmitReport).not.toHaveBeenCalled();
    expect(onAcceptTermsAndSubmit).not.toHaveBeenCalled();
  });

  it('UT-SND-06: sin conexión conserva el texto «Guardar reporte sin conexión»', () => {
    renderStep({ isOnline: false });
    expect(screen.getByRole('button', { name: /Guardar reporte sin conexión/i })).toBeInTheDocument();
  });
});
