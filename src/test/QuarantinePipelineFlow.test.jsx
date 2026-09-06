/**
 * @file QuarantinePipelineFlow.test.jsx
 * @description Pruebas de integración del flujo de UI de procesamiento de fotos y cuarentena (REP-2404).
 * Valida la experiencia del usuario, sincronización de la barra de progreso y manejo fail-safe en pantalla.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReportProcessingScreen } from '../components/report/ReportProcessingScreen';

describe('REP-2404: Flujo de UI de Cuarentena y Privacidad (ReportProcessingScreen)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('UT-QPF-01: Muestra el visor de escaneo, indicador de zonas y pasos de anonimización en flujo normal', async () => {
    const handleComplete = vi.fn();
    render(
      <ReportProcessingScreen
        evidenceList={[{ previewUrl: 'blob:test1' }]}
        categoryName="Alumbrado"
        clientSideId="rep-flow-1"
        onProcessingComplete={handleComplete}
        durationMs={200}
      />
    );

    // Verificamos textos descriptivos
    expect(screen.getByText('Protegiendo tus fotos…')).toBeInTheDocument();
    expect(
      screen.getByText(/Tarda unos segundos y no tenés que hacer nada más/i)
    ).toBeInTheDocument();
    expect(screen.getByText('Fotos subidas de forma cifrada')).toBeInTheDocument();
    expect(
      screen.getByText(/Al terminar, la imagen original se descarta del servidor/i)
    ).toBeInTheDocument();

    // Esperamos la finalización exitosa
    await waitFor(
      () => {
        expect(handleComplete).toHaveBeenCalledTimes(1);
      },
      { timeout: 1000 }
    );
  });

  it('UT-QPF-02: Activa vista fail-safe cuando el pipeline de cuarentena detecta un error', async () => {
    const handleComplete = vi.fn();
    const handleBack = vi.fn();

    // Inyectamos una función que simula un fallo crítico en la Edge Function
    const mockProcessFail = vi.fn().mockResolvedValue({
      success: false,
      error: 'La imagen contiene un formato ilegible o sospechoso.',
      failSafeTriggered: true,
    });

    render(
      <ReportProcessingScreen
        evidenceList={[{ previewUrl: 'blob:fail-image' }]}
        categoryName="Tránsito"
        clientSideId="rep-flow-fail"
        onProcessingComplete={handleComplete}
        onErrorBack={handleBack}
        processFn={mockProcessFail}
        durationMs={150}
      />
    );

    // Esperamos que se active la vista fail-safe
    await waitFor(
      () => {
        expect(screen.getByTestId('quarantine-fail-safe-view')).toBeInTheDocument();
      },
      { timeout: 1000 }
    );

    // No debió llamarse al callback de finalización
    expect(handleComplete).not.toHaveBeenCalled();

    // Textos informativos de privacidad y seguridad para el vecino
    expect(screen.getByText('No pudimos proteger tu foto')).toBeInTheDocument();
    expect(
      screen.getByText(/la imagen original fue descartada automáticamente de nuestros servidores/i)
    ).toBeInTheDocument();
    expect(screen.getByTestId('fail-safe-badge-indicator')).toBeInTheDocument();

    // Botón para volver a sacar la foto
    const backBtn = screen.getByRole('button', { name: /Volver a sacar la foto/i });
    fireEvent.click(backBtn);
    expect(handleBack).toHaveBeenCalledTimes(1);
  });

  it('UT-QPF-03: Permite reintentar el procesamiento tras un error fail-safe', async () => {
    const handleComplete = vi.fn();
    let callCount = 0;

    // Falla en el primer intento y tiene éxito en el segundo
    const mockProcessFlaky = vi.fn().mockImplementation(async () => {
      callCount += 1;
      if (callCount === 1) {
        return {
          success: false,
          error: 'Error transitorio de red.',
          failSafeTriggered: true,
        };
      }
      return {
        success: true,
        processedEvidences: [{ id: 'ev-1', sanitizedUrl: 'blob:clean' }],
      };
    });

    render(
      <ReportProcessingScreen
        evidenceList={[{ previewUrl: 'blob:flaky' }]}
        categoryName="Baches"
        clientSideId="rep-flow-retry"
        onProcessingComplete={handleComplete}
        processFn={mockProcessFlaky}
        durationMs={150}
      />
    );

    // Esperamos la vista fail-safe del primer intento
    await waitFor(() => {
      expect(screen.getByTestId('quarantine-fail-safe-view')).toBeInTheDocument();
    });

    // Clic en "Reintentar protección"
    const retryBtn = screen.getByRole('button', { name: /Reintentar protección/i });
    fireEvent.click(retryBtn);

    // Esperamos que se resuelva exitosamente en el segundo intento
    await waitFor(
      () => {
        expect(handleComplete).toHaveBeenCalledTimes(1);
      },
      { timeout: 1000 }
    );

    expect(callCount).toBe(2);
  });
});
