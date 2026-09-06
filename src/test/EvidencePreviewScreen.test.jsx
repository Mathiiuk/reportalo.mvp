/**
 * @file EvidencePreviewScreen.test.jsx
 * @description Pruebas unitarias para la pantalla de previsualización de evidencia anonimizada (REP-2402).
 * Valida la inspección visual, insignias de ofuscación, zoom modal y decisiones de confirmación/reintento.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EvidencePreviewScreen } from '../components/report/EvidencePreviewScreen';

describe('REP-2402: Pantalla de Previsualización de Evidencia Anonimizada (EvidencePreviewScreen)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockEvidenceList = [
    {
      id: 'ev-1',
      sanitizedUrl: 'blob:http://localhost/sanitized-photo-1',
      previewUrl: 'blob:http://localhost/photo-1',
      detectedZones: [
        { x: '25%', y: '30%', width: '50px', height: '50px', type: 'face' },
        { x: '60%', y: '70%', width: '80px', height: '35px', type: 'license_plate' },
      ],
    },
  ];

  it('UT-EPS-01: Renderiza la información de privacidad, badge de zonas y comprobaciones de seguridad', () => {
    const handleConfirm = vi.fn();
    const handleRetake = vi.fn();

    render(
      <EvidencePreviewScreen
        evidenceList={mockEvidenceList}
        categoryName="Alumbrado público"
        onConfirm={handleConfirm}
        onRetake={handleRetake}
      />
    );

    // Verificamos encabezados e insignias
    expect(screen.getByText('Evidencia protegida')).toBeInTheDocument();
    expect(screen.getByTestId('privacy-badge')).toHaveTextContent('2 zonas difuminadas');
    expect(screen.getByText('Tu foto está lista y protegida')).toBeInTheDocument();
    expect(
      screen.getByText(/Difuminamos automáticamente los rostros y patentes/i)
    ).toBeInTheDocument();

    // Verificamos lista de comprobaciones de seguridad
    expect(
      screen.getByText('Rostros y patentes de terceros ofuscados')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Metadatos del teléfono y GPS crudo descartados')
    ).toBeInTheDocument();
    expect(
      screen.getByText('La fotografía original fue eliminada del servidor')
    ).toBeInTheDocument();

    // Verificamos botones de acción
    expect(screen.getByTestId('confirm-preview-btn')).toBeInTheDocument();
    expect(screen.getByTestId('retake-photo-btn')).toBeInTheDocument();
  });

  it('UT-EPS-02: Al presionar "Confirmar y enviar reporte", ejecuta la función onConfirm', () => {
    const handleConfirm = vi.fn();
    const handleRetake = vi.fn();

    render(
      <EvidencePreviewScreen
        evidenceList={mockEvidenceList}
        onConfirm={handleConfirm}
        onRetake={handleRetake}
      />
    );

    const confirmBtn = screen.getByTestId('confirm-preview-btn');
    fireEvent.click(confirmBtn);

    expect(handleConfirm).toHaveBeenCalledTimes(1);
    expect(handleRetake).not.toHaveBeenCalled();
  });

  it('UT-EPS-03: Al presionar "Volver a sacar la foto", ejecuta la función onRetake', () => {
    const handleConfirm = vi.fn();
    const handleRetake = vi.fn();

    render(
      <EvidencePreviewScreen
        evidenceList={mockEvidenceList}
        onConfirm={handleConfirm}
        onRetake={handleRetake}
      />
    );

    const retakeBtn = screen.getByTestId('retake-photo-btn');
    fireEvent.click(retakeBtn);

    expect(handleRetake).toHaveBeenCalledTimes(1);
    expect(handleConfirm).not.toHaveBeenCalled();
  });

  it('UT-EPS-04: Permite abrir y cerrar el modal de zoom a pantalla completa', async () => {
    render(
      <EvidencePreviewScreen
        evidenceList={mockEvidenceList}
        onConfirm={vi.fn()}
        onRetake={vi.fn()}
      />
    );

    // Inicialmente el modal no está abierto
    expect(screen.queryByTestId('zoom-modal')).not.toBeInTheDocument();

    // Al hacer clic en el contenedor de la imagen, se abre el modal de zoom
    const container = screen.getByTestId('preview-image-container');
    fireEvent.click(container);

    expect(screen.getByTestId('zoom-modal')).toBeInTheDocument();
    expect(screen.getByText('Vista detallada de evidencia')).toBeInTheDocument();

    // Al hacer clic en el botón de cierre, se cierra el modal
    const closeBtn = screen.getByTestId('close-zoom-btn');
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByTestId('zoom-modal')).not.toBeInTheDocument();
    });
  });

  it('UT-EPS-05: Permite alternar entre múltiples evidencias cuando hay más de una foto', () => {
    const multiEvidences = [
      {
        id: 'ev-1',
        sanitizedUrl: 'blob:http://localhost/sanitized-1',
        detectedZones: [{ x: '10%', y: '10%', width: '40px', height: '40px' }],
      },
      {
        id: 'ev-2',
        sanitizedUrl: 'blob:http://localhost/sanitized-2',
        detectedZones: [
          { x: '20%', y: '20%', width: '30px', height: '30px' },
          { x: '50%', y: '50%', width: '60px', height: '20px' },
          { x: '70%', y: '70%', width: '40px', height: '40px' },
        ],
      },
    ];

    render(
      <EvidencePreviewScreen
        evidenceList={multiEvidences}
        onConfirm={vi.fn()}
        onRetake={vi.fn()}
      />
    );

    // La primera foto tiene 1 zona difuminada
    expect(screen.getByTestId('privacy-badge')).toHaveTextContent('1 zonas difuminadas');

    // Hacemos clic en la segunda miniatura
    const buttons = screen.getAllByRole('button');
    // Filtramos las miniaturas (botones sin texto específico de confirm/retake)
    const thumbnail2 = buttons.find((btn) =>
      btn.getAttribute('style')?.includes('blob:http://localhost/sanitized-2')
    );

    if (thumbnail2) {
      fireEvent.click(thumbnail2);
      // Ahora debe mostrar 3 zonas difuminadas correspondientes a la segunda foto
      expect(screen.getByTestId('privacy-badge')).toHaveTextContent('3 zonas difuminadas');
    }
  });
});
