import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EvidenceCaptureStep } from '../components/report/EvidenceCaptureStep';
import { getFriendlyLocationLabel } from '../services/locationService';

describe('REP-2203: Visor de fotos y geolocalización en el Paso 1', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('UT-EVD-08: Al presionar la pila de miniaturas abre el modal con las fotos capturadas', async () => {
    const mockList = [
      { id: '1', previewUrl: 'blob:mock1', name: 'foto1.jpg' },
      { id: '2', previewUrl: 'blob:mock2', name: 'foto2.jpg' },
    ];
    const onRemovePhoto = vi.fn();

    render(
      <EvidenceCaptureStep
        evidenceList={mockList}
        error={null}
        onCaptureFile={vi.fn()}
        onClearEvidence={vi.fn()}
        onRemovePhoto={onRemovePhoto}
        onCancel={vi.fn()}
        onContinue={vi.fn()}
      />
    );

    // Clic en la pila de miniaturas
    const thumbnailStack = screen.getByTestId('evidence-thumbnail-stack');
    fireEvent.click(thumbnailStack);

    // Debe abrir el modal
    expect(screen.getByText('Fotos capturadas (2/4)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /eliminar foto 1/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /eliminar foto 2/i })).toBeInTheDocument();
  });

  it('UT-EVD-09: getFriendlyLocationLabel formatea correctamente coordenadas en CABA y Avellaneda', () => {
    expect(getFriendlyLocationLabel([-58.365, -34.663])).toContain('Avellaneda');
    expect(getFriendlyLocationLabel([-58.381, -34.603])).toContain('CABA');
    expect(getFriendlyLocationLabel(null)).toBe('Ubicación GPS no detectada');
  });
});
