import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { createEvidenceItem, EVIDENCE_STATUS } from '../types/evidence';
import { useEvidenceCapture } from '../hooks/useEvidenceCapture';
import { EvidenceCaptureStep } from '../components/report/EvidenceCaptureStep';
import { NewReportPage } from '../pages/NewReportPage';

describe('REP-2201: Captura de evidencia desacoplada', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    if (typeof URL.createObjectURL !== 'function') {
      URL.createObjectURL = vi.fn(() => 'blob:http://localhost/mock-preview-url');
    }
    if (typeof URL.revokeObjectURL !== 'function') {
      URL.revokeObjectURL = vi.fn();
    }
  });

  describe('Modelo / Factory: createEvidenceItem', () => {
    it('UT-EVD-01: Genera un objeto EvidenceItem con estado CAPTURED_LOCAL y coordenadas GPS', () => {
      const mockFile = new File(['fake image binary'], 'bache.jpg', { type: 'image/jpeg' });
      const mockCoords = { lat: -34.6037, lng: -58.3816, accuracy: 10 };

      const evidence = createEvidenceItem(mockFile, mockCoords);

      expect(evidence.id).toBeDefined();
      expect(evidence.status).toBe(EVIDENCE_STATUS.CAPTURED_LOCAL);
      expect(evidence.name).toBe('bache.jpg');
      expect(evidence.mimeType).toBe('image/jpeg');
      expect(evidence.geolocation).toEqual({
        lat: -34.6037,
        lng: -58.3816,
        accuracy: 10,
      });
      expect(evidence.previewUrl).toBeDefined();
    });

    it('UT-EVD-02: Lanza un error si no se suministra un archivo', () => {
      expect(() => createEvidenceItem(null)).toThrow(
        'Se requiere un archivo de imagen para generar la evidencia.'
      );
    });
  });

  describe('Hook: useEvidenceCapture', () => {
    it('UT-EVD-03: captureFile procesa exitosamente una imagen valida', async () => {
      const { result } = renderHook(() => useEvidenceCapture());
      const mockFile = new File(['dummy content'], 'reporte.png', { type: 'image/png' });

      let res;
      await act(async () => {
        res = await result.current.captureFile(mockFile);
      });

      expect(res.success).toBe(true);
      expect(result.current.hasEvidence).toBe(true);
      expect(result.current.evidence?.mimeType).toBe('image/png');
      expect(result.current.error).toBeNull();
    });

    it('UT-EVD-04: captureFile rechaza formatos no admitidos (e.g. PDF o texto)', async () => {
      const { result } = renderHook(() => useEvidenceCapture());
      const invalidFile = new File(['text content'], 'doc.pdf', { type: 'application/pdf' });

      let res;
      await act(async () => {
        res = await result.current.captureFile(invalidFile);
      });

      expect(res.success).toBe(false);
      expect(result.current.hasEvidence).toBe(false);
      expect(result.current.error).toMatch(/Formato de imagen no admitido/i);
    });

    it('UT-EVD-05: clearEvidence remueve la evidencia y revoca la URL de preview', async () => {
      const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');
      const { result } = renderHook(() => useEvidenceCapture());
      const mockFile = new File(['dummy'], 'foto.webp', { type: 'image/webp' });

      await act(async () => {
        await result.current.captureFile(mockFile);
      });

      expect(result.current.hasEvidence).toBe(true);

      act(() => {
        result.current.clearEvidence();
      });

      expect(result.current.hasEvidence).toBe(false);
      expect(result.current.evidence).toBeNull();
      expect(revokeSpy).toHaveBeenCalled();
    });
  });

  describe('Componente UI: EvidenceCaptureStep', () => {
    it('UT-EVD-06: Renderiza botones de Camara y Galeria cuando no hay evidencia capturada', () => {
      render(
        <EvidenceCaptureStep
          evidence={null}
          error={null}
          onCaptureFile={vi.fn()}
          onClearEvidence={vi.fn()}
        />
      );

      expect(screen.getByText(/Tomar fotografía ahora/i)).toBeInTheDocument();
      expect(screen.getByText(/Subir desde mi galería/i)).toBeInTheDocument();
      expect(screen.getByTestId('camera-file-input')).toBeInTheDocument();
      expect(screen.getByTestId('gallery-file-input')).toBeInTheDocument();
    });

    it('UT-EVD-07: Muestra la vista previa y boton Cambiar cuando existe evidencia capturada', () => {
      const mockEvidence = {
        id: 'evd-1',
        name: 'bache_calle.jpg',
        sizeBytes: 2.5 * 1024 * 1024,
        previewUrl: 'blob:http://localhost/mock-preview',
        status: EVIDENCE_STATUS.CAPTURED_LOCAL,
      };

      render(
        <EvidenceCaptureStep
          evidence={mockEvidence}
          error={null}
          onCaptureFile={vi.fn()}
          onClearEvidence={vi.fn()}
        />
      );

      expect(screen.getByTestId('evidence-preview-img')).toBeInTheDocument();
      expect(screen.getByText('Foto capturada')).toBeInTheDocument();
      expect(screen.getByText('bache_calle.jpg')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /eliminar foto capturada/i })).toBeInTheDocument();
    });

    it('UT-EVD-08: Renderiza mensaje de error visible si error esta presente', () => {
      render(
        <EvidenceCaptureStep
          evidence={null}
          error="La imagen supera el tamaño máximo permitido de 10 MB."
          onCaptureFile={vi.fn()}
          onClearEvidence={vi.fn()}
        />
      );

      expect(screen.getByText(/supera el tamaño máximo/i)).toBeInTheDocument();
    });
  });

  describe('Flujo Integrado: NewReportPage con Captura', () => {
    it('UT-EVD-09: Al capturar foto, habilita el boton Continuar en NewReportPage', async () => {
      render(
        <MemoryRouter initialEntries={['/nuevo-reporte']}>
          <NewReportPage />
        </MemoryRouter>
      );

      const continueBtn = screen.getByRole('button', { name: /continuar/i });
      expect(continueBtn).toBeDisabled();

      // Simular seleccion de archivo a traves del input de galeria
      const galleryInput = screen.getByTestId('gallery-file-input');
      const validFile = new File(['sample image'], 'bache_real.jpg', { type: 'image/jpeg' });

      fireEvent.change(galleryInput, { target: { files: [validFile] } });

      await waitFor(() => {
        expect(screen.getByTestId('evidence-preview-img')).toBeInTheDocument();
        expect(continueBtn).toBeEnabled();
      });
    });
  });
});
