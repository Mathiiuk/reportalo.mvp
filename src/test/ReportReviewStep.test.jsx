import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReportReviewStep } from '../components/report/ReportReviewStep';
import { DEFAULT_REPORT_CATEGORIES } from '../services/categoriesService';

describe('REP-2200: ReportReviewStep (Paso 3 del Journey v2)', () => {
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
        onBack={vi.fn()}
        onSubmit={vi.fn()}
        onViewAllPhotos={vi.fn()}
        onOpenTerms={vi.fn()}
      />
    );

    expect(screen.getByText('Foto')).toBeInTheDocument();
    expect(screen.getByText('Detalle')).toBeInTheDocument();
    expect(screen.getByText('Enviar')).toBeInTheDocument();
  });

  it('UT-RV-02: Renderiza la tarjeta de fotos con badge "Todavía en tu teléfono" y conteo correcto', () => {
    render(
      <ReportReviewStep
        evidenceList={mockEvidenceList}
        selectedCategory={mockCategory}
        description="Descripción de prueba"
        geolocation={null}
        address="Av. Mitre 1240, Avellaneda"
        onBack={vi.fn()}
        onSubmit={vi.fn()}
        onViewAllPhotos={vi.fn()}
        onOpenTerms={vi.fn()}
      />
    );

    expect(screen.getByText(/2 fotos adjuntas/i)).toBeInTheDocument();
    expect(screen.getByText(/Todavía en tu teléfono/i)).toBeInTheDocument();
    expect(screen.getByText(/Se suben y se anonimizan al enviar/i)).toBeInTheDocument();
  });

  it('UT-RV-03: Renderiza categoría, descripción, dirección y disclaimer de anonimato', () => {
    render(
      <ReportReviewStep
        evidenceList={mockEvidenceList}
        selectedCategory={mockCategory}
        description="Camión de gran porte"
        geolocation={null}
        address="Av. Mitre 1240, Avellaneda"
        onBack={vi.fn()}
        onSubmit={vi.fn()}
        onViewAllPhotos={vi.fn()}
        onOpenTerms={vi.fn()}
      />
    );

    expect(screen.getByText('Infracción de tránsito')).toBeInTheDocument();
    expect(screen.getByText('Camión de gran porte')).toBeInTheDocument();
    expect(screen.getByText('Av. Mitre 1240, Avellaneda')).toBeInTheDocument();
    expect(screen.getByText(/Tu identidad permanece anónima/i)).toBeInTheDocument();
  });

  it('UT-RV-04: El botón "Enviar reporte" acciona el callback onSubmit', () => {
    const onSubmitMock = vi.fn();

    render(
      <ReportReviewStep
        evidenceList={mockEvidenceList}
        selectedCategory={mockCategory}
        description="Camión de gran porte"
        geolocation={null}
        address="Av. Mitre 1240, Avellaneda"
        onBack={vi.fn()}
        onSubmit={onSubmitMock}
        onViewAllPhotos={vi.fn()}
        onOpenTerms={vi.fn()}
      />
    );

    const submitBtn = screen.getByRole('button', { name: /Enviar reporte/i });
    fireEvent.click(submitBtn);
    expect(onSubmitMock).toHaveBeenCalledTimes(1);
  });
});
