import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EvidenceCaptureStep } from '../components/report/EvidenceCaptureStep';
import { EvidenceUploadDesktop } from '../components/report/EvidenceUploadDesktop';

const baseProps = {
  evidenceList: [],
  geolocation: { lat: -34.663, lng: -58.365 },
  onCaptureFile: vi.fn(),
  onClearEvidence: vi.fn(),
  onRemovePhoto: vi.fn(),
  onCancel: vi.fn(),
  onContinue: vi.fn(),
};

const mockMatchMedia = (matches) => {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
};

describe('REP-3791 Bloque 1-D: carga de evidencia en escritorio (UJ v3.3 · D10)', () => {
  afterEach(() => {
    delete window.matchMedia;
  });

  it('UT-D10-01: en escritorio (≥ 1025 px) el paso 1 muestra la carga de archivos en lugar de la cámara', () => {
    mockMatchMedia(true);
    render(<EvidenceCaptureStep {...baseProps} />);
    expect(screen.getByText('Arrastrá las fotos acá')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /tomar fotografía/i })).not.toBeInTheDocument();
  });

  it('UT-D10-02: en teléfono sigue mostrando la cámara (M09)', () => {
    mockMatchMedia(false);
    render(<EvidenceCaptureStep {...baseProps} />);
    expect(screen.getByRole('button', { name: /tomar fotografía/i })).toBeInTheDocument();
  });

  it('UT-D10-03: varios archivos arrastrados se entregan de a uno a onCaptureFile', () => {
    const onCaptureFile = vi.fn();
    render(<EvidenceUploadDesktop {...baseProps} onCaptureFile={onCaptureFile} />);
    const files = [
      new File(['a'], 'a.jpg', { type: 'image/jpeg' }),
      new File(['b'], 'b.png', { type: 'image/png' }),
    ];
    fireEvent.drop(screen.getByTestId('evidence-dropzone'), { dataTransfer: { files } });
    expect(onCaptureFile).toHaveBeenCalledTimes(2);
    expect(onCaptureFile).toHaveBeenNthCalledWith(1, files[0]);
    expect(onCaptureFile).toHaveBeenNthCalledWith(2, files[1]);
  });

  it('UT-D10-04: sin fotos «Continuar» está deshabilitado; con fotos avanza', () => {
    const onContinue = vi.fn();
    const { rerender } = render(<EvidenceUploadDesktop {...baseProps} onContinue={onContinue} />);
    expect(screen.getByRole('button', { name: /^continuar$/i })).toBeDisabled();

    rerender(
      <EvidenceUploadDesktop
        {...baseProps}
        onContinue={onContinue}
        evidenceList={[{ id: '1', previewUrl: 'blob:1' }]}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /^continuar$/i }));
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(screen.getByText('1 de 4 archivos')).toBeInTheDocument();
  });
});
