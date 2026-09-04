import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReportReviewStep } from '../components/report/ReportReviewStep';

describe('REP-2203: Visor de fotos dentro del Paso 3 (Revisión)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('UT-REV-01: Al presionar "Ver todas" abre el modal de fotos sin salir del Paso 3', async () => {
    const mockList = [
      { id: '1', previewUrl: 'blob:mock1', name: 'foto1.jpg' },
      { id: '2', previewUrl: 'blob:mock2', name: 'foto2.jpg' },
    ];

    render(
      <ReportReviewStep
        evidenceList={mockList}
        selectedCategory={{ id: '1', name: 'Tránsito' }}
        description="Descripción de prueba"
        geolocation={{ lat: -34.6037, lng: -58.3816 }}
        address="CABA · GPS (-34.6037, -58.3816)"
        hasAcceptedTerms={true}
        onBack={vi.fn()}
        onSubmitReport={vi.fn()}
        onAcceptTermsAndSubmit={vi.fn()}
        onOpenTerms={vi.fn()}
      />
    );

    // Clic en "Ver todas"
    const viewAllBtn = screen.getByRole('button', { name: /ver todas/i });
    fireEvent.click(viewAllBtn);

    // Debe abrir el modal dentro del paso 3
    expect(screen.getByText(/Fotos adjuntas al reporte \(2\)/i)).toBeInTheDocument();
    
    // Al tocar "Volver a la revisión", cierra el modal y se queda en el paso 3
    const returnBtn = screen.getByRole('button', { name: /volver a la revisión/i });
    fireEvent.click(returnBtn);

    await waitFor(() => {
      expect(screen.queryByText(/Fotos adjuntas al reporte \(2\)/i)).not.toBeInTheDocument();
      expect(screen.getByText('Revisá antes de enviar')).toBeInTheDocument();
    });
  });
});
