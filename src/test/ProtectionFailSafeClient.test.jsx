/**
 * @file ProtectionFailSafeClient.test.jsx
 * @description REP-3793 · Bloque 4 del lado del cliente. Si el servidor no pudo proteger la
 * foto (Vision caído, sin clave, foto ilegible), la app lo explica sin jerga, ofrece Reintentar
 * o Cambiar foto y no deja avanzar; un pendiente offline queda en la cola y no se envía.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ReportProcessingScreen } from '../components/report/ReportProcessingScreen';
import { describeProtectionFailure, readFunctionFailure } from '../services/quarantinePipelineService';

describe('REP-3793 Bloque 4: motivo del fail-safe en el cliente', () => {
  it('UT-FSC-01: lee el cuerpo de la respuesta de error de la Edge Function', async () => {
    const error = { context: new Response(JSON.stringify({ reason: 'vision_timeout', failSafeTriggered: true }), { status: 503 }) };
    expect(await readFunctionFailure(error)).toMatchObject({ reason: 'vision_timeout' });
    // Sin cuerpo legible no rompe
    expect(await readFunctionFailure({ context: new Response('no es json') })).toBeNull();
    expect(await readFunctionFailure(null)).toBeNull();
  });

  it('UT-FSC-02: una falla del servicio no sugiere cambiar la foto; una foto ilegible sí', () => {
    expect(describeProtectionFailure('vision_timeout')).toMatchObject({ photoTips: false });
    expect(describeProtectionFailure('vision_not_configured').detail).toMatch(/no respondió/);
    expect(describeProtectionFailure('image_unreadable')).toMatchObject({ photoTips: true });
    expect(describeProtectionFailure(undefined).detail).toBeTruthy();
  });

  describe('Integración con la Edge Function mockeada', () => {
    const loadService = async (invoke) => {
      vi.resetModules();
      vi.doMock('../lib/supabaseClient', () => ({
        isSupabaseConfigured: true,
        supabase: {
          auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'user-fsc' } } } }) },
          storage: {
            from: vi.fn(() => ({
              upload: vi.fn().mockResolvedValue({ data: { path: 'user-fsc/temp.jpg' }, error: null }),
              remove: vi.fn().mockResolvedValue({ data: {}, error: null }),
            })),
          },
          functions: { invoke },
        },
      }));
      return import('../services/quarantinePipelineService');
    };

    afterEach(() => {
      vi.doUnmock('../lib/supabaseClient');
      vi.resetModules();
    });

    it('UT-FSC-03: un 503 con reason del servidor llega al cliente como fail-safe con ese motivo', async () => {
      const invoke = vi.fn().mockResolvedValue({
        data: null,
        error: {
          message: 'Edge Function returned a non-2xx status code',
          context: new Response(JSON.stringify({ success: false, failSafeTriggered: true, reason: 'vision_http_error', error: 'No pudimos proteger tu foto.' }), { status: 503 }),
        },
      });
      const service = await loadService(invoke);

      const result = await service.processAllEvidencesThroughQuarantine({
        evidenceList: [{ id: 'e1', file: new File(['x'], 'f.jpg', { type: 'image/jpeg' }) }],
        clientSideId: '5f1c6f2e-7a53-4d43-9c1e-2b1f7a9d0c11',
      });

      expect(result).toMatchObject({ success: false, failSafeTriggered: true, reason: 'vision_http_error' });
      expect(result.processedEvidences).toBeUndefined();
    });
  });
});

describe('REP-3793 Bloque 4: pantalla «No pudimos proteger tu foto»', () => {
  const renderWith = (result) => {
    const onComplete = vi.fn();
    const onBack = vi.fn();
    render(
      <ReportProcessingScreen
        evidenceList={[{ previewUrl: 'blob:foto' }]}
        clientSideId="rep-fsc"
        onProcessingComplete={onComplete}
        onErrorBack={onBack}
        processFn={vi.fn().mockResolvedValue(result)}
        durationMs={50}
      />
    );
    return { onComplete, onBack };
  };

  it('UT-FSC-04: Vision caído → mensaje del servicio, Reintentar y Cambiar foto, y no avanza', async () => {
    const { onComplete } = renderWith({ success: false, failSafeTriggered: true, reason: 'vision_timeout', error: 'x' });

    await waitFor(() => expect(screen.getByTestId('quarantine-fail-safe-view')).toBeInTheDocument());
    expect(screen.getByText('No pudimos proteger tu foto')).toBeInTheDocument();
    expect(screen.getByTestId('fail-safe-reason')).toHaveTextContent(/no respondió/);
    // Sin consejos de luz/enfoque: la foto no era el problema
    expect(screen.queryByText(/Buscá más luz/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reintentar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cambiar foto/i })).toBeInTheDocument();
    // El reporte no avanza con la foto sin proteger
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('UT-FSC-05: foto ilegible → sugiere otra foto y nunca muestra el detalle técnico', async () => {
    renderWith({ success: false, failSafeTriggered: true, reason: 'image_unreadable', error: 'JPEG corrupto: segmento cortado.' });

    await waitFor(() => expect(screen.getByTestId('quarantine-fail-safe-view')).toBeInTheDocument());
    expect(screen.getByText(/Buscá más luz/)).toBeInTheDocument();
    expect(screen.queryByText(/segmento cortado/)).not.toBeInTheDocument();
  });

  it('UT-FSC-06: mientras procesa no muestra un conteo de zonas inventado', () => {
    renderWith({ success: true, processedEvidences: [] });
    expect(screen.queryByText(/zonas detectadas/)).not.toBeInTheDocument();
    expect(screen.getByText('Buscando rostros y patentes')).toBeInTheDocument();
  });
});
