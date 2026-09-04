import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ReportProcessingScreen } from '../components/report/ReportProcessingScreen';
import { ReportSuccessScreen } from '../components/report/ReportSuccessScreen';

describe('REP-2201 / User Journey v3.1: Flujo Post-Envío (Procesamiento y Éxito)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Pantalla 1: ReportProcessingScreen ("Protegiendo tus fotos…")', () => {
    it('UT-PROC-01: Renderiza el visor de escaneo, zonas detectadas y pasos de anonimización', () => {
      const handleComplete = vi.fn();
      render(
        <ReportProcessingScreen
          evidenceList={[{ previewUrl: 'blob:test1' }]}
          categoryName="Tránsito"
          onProcessingComplete={handleComplete}
          durationMs={500}
        />
      );

      expect(screen.getByText('Protegiendo tus fotos…')).toBeInTheDocument();
      expect(
        screen.getByText(/Tarda unos segundos y no tenés que hacer nada más/i)
      ).toBeInTheDocument();
      expect(screen.getByText('3 zonas detectadas')).toBeInTheDocument();
      expect(
        screen.getByText('Fotos subidas de forma cifrada')
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Al terminar, la imagen original se descarta del servidor/i)
      ).toBeInTheDocument();
    });

    it('UT-PROC-02: Llama a onProcessingComplete al finalizar el tiempo estipulado', async () => {
      const handleComplete = vi.fn();
      render(
        <ReportProcessingScreen
          evidenceList={[{ previewUrl: 'blob:test1' }]}
          categoryName="Tránsito"
          onProcessingComplete={handleComplete}
          durationMs={200}
        />
      );

      await waitFor(
        () => {
          expect(handleComplete).toHaveBeenCalledTimes(1);
        },
        { timeout: 1000 }
      );
    });
  });

  describe('Pantalla 2: ReportSuccessScreen ("Reporte enviado")', () => {
    it('UT-SUCC-01: Renderiza el código del reporte, categoría, organismo y línea de tiempo', () => {
      const handleViewReport = vi.fn();
      const handleReturnToMap = vi.fn();
      const handleViewTerms = vi.fn();

      render(
        <ReportSuccessScreen
          reportCode="#RP-2048"
          category={{ name: 'Tránsito', color: '#F78E35', bgLight: '#FFF2E6' }}
          agencyName="Municipio de Avellaneda"
          onViewReport={handleViewReport}
          onReturnToMap={handleReturnToMap}
          onViewTerms={handleViewTerms}
        />
      );

      // Header
      expect(screen.getByText('Reporte enviado')).toBeInTheDocument();
      expect(
        screen.getByText('Tu evidencia ya está en camino al organismo competente.')
      ).toBeInTheDocument();

      // Card 1: ID, Categoría y Organismo
      expect(screen.getByTestId('success-report-code')).toHaveTextContent('#RP-2048');
      expect(screen.getByText('TRÁNSITO')).toBeInTheDocument();
      expect(screen.getByText('Municipio de Avellaneda')).toBeInTheDocument();

      // Card 2: Timeline
      expect(screen.getByText('Enviado')).toBeInTheDocument();
      expect(screen.getByText('En revisión')).toBeInTheDocument();
      expect(screen.getByText('Notificado al responsable')).toBeInTheDocument();
      expect(screen.getByText('Resuelto')).toBeInTheDocument();
      expect(
        screen.getByText(/También puede cerrarse como/i)
      ).toBeInTheDocument();

      // Card 3: Consentimiento
      expect(screen.getByText(/Consentimiento registrado/i)).toBeInTheDocument();
      const termsLink = screen.getByRole('button', { name: /ver constancia/i });
      fireEvent.click(termsLink);
      expect(handleViewTerms).toHaveBeenCalledTimes(1);

      // Botones de acción
      const viewReportBtn = screen.getByRole('button', { name: /ver el reporte/i });
      fireEvent.click(viewReportBtn);
      expect(handleViewReport).toHaveBeenCalledTimes(1);

      const returnMapBtn = screen.getByRole('button', { name: /volver al mapa/i });
      fireEvent.click(returnMapBtn);
      expect(handleReturnToMap).toHaveBeenCalledTimes(1);
    });
  });
});
