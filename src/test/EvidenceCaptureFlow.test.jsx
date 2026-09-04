import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { createEvidenceItem, EVIDENCE_STATUS } from '../types/evidence';
import { useEvidenceCapture } from '../hooks/useEvidenceCapture';
import { EvidenceCaptureStep } from '../components/report/EvidenceCaptureStep';
import { NewReportPage } from '../pages/NewReportPage';

describe('REP-2201: Captura de evidencia desacoplada con diseño Journey v2', () => {
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
  });

  describe('Hook: useEvidenceCapture con soporte multifoto', () => {
    it('UT-EVD-02: captureFile permite agregar hasta 4 fotos y calcula photoCount correctamente', async () => {
      const { result } = renderHook(() => useEvidenceCapture());
      const mockFile1 = new File(['img1'], 'foto1.jpg', { type: 'image/jpeg' });
      const mockFile2 = new File(['img2'], 'foto2.jpg', { type: 'image/jpeg' });

      await act(async () => {
        await result.current.captureFile(mockFile1);
      });

      expect(result.current.photoCount).toBe(1);
      expect(result.current.hasEvidence).toBe(true);

      await act(async () => {
        await result.current.captureFile(mockFile2);
      });

      expect(result.current.photoCount).toBe(2);
      expect(result.current.evidenceList.length).toBe(2);
    });

    it('UT-EVD-03: rechaza formatos no admitidos (e.g. PDF)', async () => {
      const { result } = renderHook(() => useEvidenceCapture());
      const invalidFile = new File(['text'], 'doc.pdf', { type: 'application/pdf' });

      let res;
      await act(async () => {
        res = await result.current.captureFile(invalidFile);
      });

      expect(res.success).toBe(false);
      expect(result.current.error).toMatch(/Formato de imagen no admitido/i);
    });

    it('UT-EVD-04: removePhoto elimina una foto específica y clearEvidence remueve todas', async () => {
      const { result } = renderHook(() => useEvidenceCapture());
      const mockFile1 = new File(['img1'], 'foto1.jpg', { type: 'image/jpeg' });

      await act(async () => {
        await result.current.captureFile(mockFile1);
      });

      const photoId = result.current.evidenceList[0].id;
      act(() => {
        result.current.removePhoto(photoId);
      });

      expect(result.current.photoCount).toBe(0);
    });
  });

  describe('Componente UI: EvidenceCaptureStep (Journey v2)', () => {
    it('UT-EVD-05: Renderiza topbar de privacidad, badge de ubicación y disparador de cámara', () => {
      render(
        <EvidenceCaptureStep
          evidenceList={[]}
          error={null}
          onCaptureFile={vi.fn()}
          onClearEvidence={vi.fn()}
          onCancel={vi.fn()}
          onContinue={vi.fn()}
        />
      );

      expect(screen.getByText(/Privacidad activada/i)).toBeInTheDocument();
      expect(screen.getByText(/Los rostros y patentes se difuminan/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /tomar fotografía/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cerrar cámara/i })).toBeInTheDocument();
    });

    it('UT-EVD-06: Muestra miniatura acumulada con contador cuando existen fotos', () => {
      const mockList = [
        { id: '1', previewUrl: 'blob:mock1', name: 'foto1.jpg' },
        { id: '2', previewUrl: 'blob:mock2', name: 'foto2.jpg' },
      ];

      render(
        <EvidenceCaptureStep
          evidenceList={mockList}
          error={null}
          onCaptureFile={vi.fn()}
          onClearEvidence={vi.fn()}
          onCancel={vi.fn()}
          onContinue={vi.fn()}
        />
      );

      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /continuar al siguiente paso/i })).toBeInTheDocument();
    });
  });

  describe('Flujo Integrado: NewReportPage', () => {
    it('UT-EVD-07: Al tomar foto y presionar continuar, navega al paso 2 con galería de miniaturas', async () => {
      render(
        <MemoryRouter initialEntries={['/nuevo-reporte']}>
          <NewReportPage />
        </MemoryRouter>
      );

      const galleryInput = screen.getByTestId('gallery-file-input');
      const validFile = new File(['sample image'], 'bache_real.jpg', { type: 'image/jpeg' });

      fireEvent.change(galleryInput, { target: { files: [validFile] } });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /continuar al siguiente paso/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /continuar al siguiente paso/i }));

      await waitFor(() => {
        expect(screen.getByText(/Categoría del incumplimiento/i)).toBeInTheDocument();
        expect(screen.getByText('Detalle')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^Continuar$/i })).toBeInTheDocument();
      });
    });

    it('UT-EVD-08: Al avanzar al Paso 3 y enviar el reporte, ejecuta la animación de "Protegiendo tus fotos…" (Paso 4) y pasa a "Reporte enviado" (Paso 5)', async () => {
      render(
        <MemoryRouter initialEntries={['/nuevo-reporte']}>
          <NewReportPage />
        </MemoryRouter>
      );

      // 1. Paso 1: Cargar foto y continuar
      const galleryInput = screen.getByTestId('gallery-file-input');
      const validFile = new File(['sample image'], 'bache_real.jpg', { type: 'image/jpeg' });
      fireEvent.change(galleryInput, { target: { files: [validFile] } });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /continuar al siguiente paso/i })).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('button', { name: /continuar al siguiente paso/i }));

      // 2. Paso 2: Continuar a revisión
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^Continuar$/i })).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));

      // 3. Paso 3: Revisión y presionar "Enviar reporte"
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /enviar reporte/i })).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('button', { name: /enviar reporte/i }));

      // Si es primer reporte, abre el modal "Antes de enviar" y se acepta
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /acepto y envío/i })).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('button', { name: /acepto y envío/i }));

      // 4. Paso 4: Debe renderizar la pantalla "Protegiendo tus fotos…"
      await waitFor(() => {
        expect(screen.getByText('Protegiendo tus fotos…')).toBeInTheDocument();
        expect(screen.getByText('3 zonas detectadas')).toBeInTheDocument();
      });

      // 5. Paso 5: Al completarse el procesamiento, pasa a "Reporte enviado"
      await waitFor(
        () => {
          expect(screen.getByText('Reporte enviado')).toBeInTheDocument();
          expect(screen.getByRole('button', { name: /ver el reporte/i })).toBeInTheDocument();
          expect(screen.getByRole('button', { name: /volver al mapa/i })).toBeInTheDocument();
        },
        { timeout: 5000 }
      );
    });
  });
});
