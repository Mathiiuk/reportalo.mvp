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

  it('UT-RV-02: Si el usuario NO aceptó términos previamente, hacer clic en "Enviar reporte" abre el modal "Antes de enviar"', async () => {
    render(
      <ReportReviewStep
        evidenceList={mockEvidenceList}
        selectedCategory={mockCategory}
        description="Camión de gran porte"
        geolocation={null}
        address="Av. Mitre 1240, Avellaneda"
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
    expect(screen.getByText(/Para enviar el reporte necesitamos tu consentimiento/i)).toBeInTheDocument();
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
