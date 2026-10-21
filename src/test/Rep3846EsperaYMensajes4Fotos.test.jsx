/**
 * @file Rep3846EsperaYMensajes4Fotos.test.jsx
 * @description REP-3846 (O-01 de la QA REP-3833): con 4 fotos y buena señal, la espera fija de 45 s vencía siempre
 * (la protección tarda unos 11,3 s por foto) y el ciudadano volvía al mapa con «se enviará cuando recuperes señal».
 *
 * C: la espera es proporcional a la cantidad de fotos, con un techo documentado (propuesta para que la ratifique el PO).
 * E: el mensaje sale del estado real. «Cuando recuperes señal» va solo con conexión perdida; si hay señal y tarda, la
 * pantalla lo avisa sin cortar nada, y si pasa a Pendientes lo dice y abre Pendientes.
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { ReportProcessingScreen } from '../components/report/ReportProcessingScreen';
import {
  getProtectionWait,
  describeQueuedReport,
  QUEUE_REASON,
  MAX_WAIT_CEILING_MS,
} from '../services/sendWaitPolicy';

const fotos = (n) => Array.from({ length: n }, (_, i) => ({ id: `f${i}`, previewUrl: `blob:foto-${i}` }));
const nunca = () => new Promise(() => {});

const setOnline = (value) =>
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => value });

afterEach(() => {
  setOnline(true);
  vi.useRealTimers();
});

describe('REP-3846 C · espera proporcional', () => {
  it('aviso y espera máxima crecen con las fotos', () => {
    expect([1, 2, 3, 4].map((n) => getProtectionWait(n))).toEqual([
      { slowNoticeMs: 30000, maxWaitMs: 50000 },
      { slowNoticeMs: 45000, maxWaitMs: 75000 },
      { slowNoticeMs: 60000, maxWaitMs: 100000 },
      { slowNoticeMs: 75000, maxWaitMs: 120000 },
    ]);
  });

  it('con 4 fotos la espera máxima cubre más del doble de la mediana medida (≈ 49 s) y respeta el techo', () => {
    const { maxWaitMs, slowNoticeMs } = getProtectionWait(4);
    expect(maxWaitMs).toBeGreaterThan(2 * 49000);
    expect(slowNoticeMs).toBeGreaterThan(49000);
    expect(getProtectionWait(10).maxWaitMs).toBe(MAX_WAIT_CEILING_MS);
    expect(getProtectionWait(0)).toEqual(getProtectionWait(1));
  });

  it('con 4 fotos y buena señal no pasa a Pendientes a los 45 s, como antes', async () => {
    vi.useFakeTimers();
    const onSaveForLater = vi.fn();
    render(
      <ReportProcessingScreen
        evidenceList={fotos(4)}
        processFn={nunca}
        durationMs={50}
        onSaveForLater={onSaveForLater}
        onProcessingComplete={vi.fn()}
      />
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(46000);
    });
    expect(onSaveForLater).not.toHaveBeenCalled();
    expect(screen.queryByTestId('processing-slow-notice')).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });
    // 76 s: ya pasó el aviso (75 s), pero todavía no la espera máxima (120 s)
    expect(screen.getByTestId('processing-slow-notice')).toBeInTheDocument();
    expect(onSaveForLater).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(45000);
    });
    expect(onSaveForLater).toHaveBeenCalledWith(QUEUE_REASON.SLOW);
  });
});

describe('REP-3846 E · la pantalla dice lo que pasa', () => {
  it('con varias fotos informa el tiempo esperado y el avance real por foto', async () => {
    let reportar;
    render(
      <ReportProcessingScreen
        evidenceList={fotos(4)}
        processFn={({ onProgress }) => {
          reportar = onProgress;
          return nunca();
        }}
        durationMs={50}
        timeoutMs={0}
        onProcessingComplete={vi.fn()}
      />
    );
    expect(screen.getByTestId('processing-expected-time')).toHaveTextContent('Con 4 fotos tarda unos 45 segundos');
    expect(screen.getByTestId('processing-photo-count')).toHaveTextContent('Protegiendo la foto 1 de 4');
    await waitFor(() => expect(reportar).toBeTypeOf('function'));
    act(() => reportar({ photosDone: 2, photoCount: 4 }));
    expect(screen.getByTestId('processing-photo-count')).toHaveTextContent('Protegiendo la foto 3 de 4');
    act(() => reportar({ photosDone: 4, photoCount: 4 }));
    expect(screen.getByTestId('processing-photo-count')).toHaveTextContent('4 de 4 fotos protegidas');
  });

  it('pasado el tiempo habitual avisa, no corta nada y, si termina, avanza normalmente', async () => {
    let terminar;
    const onSaveForLater = vi.fn();
    const onProcessingComplete = vi.fn();
    render(
      <ReportProcessingScreen
        evidenceList={fotos(4)}
        processFn={() =>
          new Promise((resolve) => {
            terminar = resolve;
          })
        }
        durationMs={50}
        slowNoticeMs={100}
        timeoutMs={5000}
        onSaveForLater={onSaveForLater}
        onProcessingComplete={onProcessingComplete}
      />
    );
    const aviso = await screen.findByTestId('processing-slow-notice');
    expect(aviso).toHaveTextContent('Está tardando más de lo habitual');
    expect(aviso).toHaveTextContent('tu reporte todavía no se envió');
    expect(aviso).not.toHaveTextContent(/señal/i);
    expect(onSaveForLater).not.toHaveBeenCalled();

    act(() => terminar({ success: true, processedEvidences: [{ id: 'e1' }] }));
    await waitFor(() => expect(onProcessingComplete).toHaveBeenCalledTimes(1));
    expect(onSaveForLater).not.toHaveBeenCalled();
    expect(screen.queryByTestId('processing-slow-notice')).not.toBeInTheDocument();
  });

  it('el ciudadano puede dejarlo en Pendientes mientras espera, y la tanda en vuelo se corta', async () => {
    let shouldAbort;
    const onSaveForLater = vi.fn();
    render(
      <ReportProcessingScreen
        evidenceList={fotos(4)}
        processFn={(args) => {
          shouldAbort = args.shouldAbort;
          return nunca();
        }}
        durationMs={50}
        slowNoticeMs={100}
        timeoutMs={5000}
        onSaveForLater={onSaveForLater}
        onProcessingComplete={vi.fn()}
      />
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Dejarlo en Pendientes y salir' }));
    expect(onSaveForLater).toHaveBeenCalledWith(QUEUE_REASON.MANUAL);
    expect(shouldAbort()).toBe(true);
    // La espera máxima ya no vuelve a mandarlo
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(onSaveForLater).toHaveBeenCalledTimes(1);
  });

  it('al vencer la espera máxima con señal, el motivo es «lento», no «sin conexión»', async () => {
    const onSaveForLater = vi.fn();
    render(
      <ReportProcessingScreen
        evidenceList={fotos(1)}
        processFn={nunca}
        durationMs={50}
        timeoutMs={150}
        onSaveForLater={onSaveForLater}
        onProcessingComplete={vi.fn()}
      />
    );
    await waitFor(() => expect(onSaveForLater).toHaveBeenCalledWith(QUEUE_REASON.SLOW));
  });

  it('al vencer la espera máxima sin conexión confirmada, el motivo es «sin conexión»', async () => {
    setOnline(false);
    const onSaveForLater = vi.fn();
    render(
      <ReportProcessingScreen
        evidenceList={fotos(1)}
        processFn={nunca}
        durationMs={50}
        timeoutMs={150}
        onSaveForLater={onSaveForLater}
        onProcessingComplete={vi.fn()}
      />
    );
    await waitFor(() => expect(onSaveForLater).toHaveBeenCalledWith(QUEUE_REASON.OFFLINE));
  });

  it('tras una falla de protección por red con señal, «guardar» pasa el motivo real', async () => {
    const onSaveForLater = vi.fn();
    render(
      <ReportProcessingScreen
        evidenceList={fotos(1)}
        processFn={() => Promise.resolve({ success: false, error: 'Failed to fetch' })}
        durationMs={50}
        timeoutMs={0}
        onSaveForLater={onSaveForLater}
        onProcessingComplete={vi.fn()}
      />
    );
    fireEvent.click(await screen.findByRole('button', { name: /guardar y enviar cuando haya señal/i }));
    expect(onSaveForLater).toHaveBeenCalledWith(QUEUE_REASON.SLOW);
  });
});

describe('REP-3846 E · mensaje al quedar en Pendientes', () => {
  it('sin conexión confirmada: el aviso de siempre y vuelta al mapa', () => {
    expect(describeQueuedReport({ reason: QUEUE_REASON.OFFLINE })).toEqual({
      title: 'Reporte guardado con éxito',
      description: 'Se enviará automáticamente apenas recuperes señal.',
      goTo: '/mapa',
    });
  });

  it.each([QUEUE_REASON.SLOW, QUEUE_REASON.MANUAL])('con señal (%s): dice que quedó pendiente y abre Pendientes', (reason) => {
    const notice = describeQueuedReport({ reason });
    expect(notice).toEqual({
      title: 'Tu reporte quedó pendiente de envío',
      description: 'Podés consultarlo en Pendientes. Lo seguimos intentando solo.',
      goTo: '/pendientes',
    });
    expect(notice.description).not.toMatch(/señal/i);
    expect(notice.title).not.toMatch(/enviado/i);
  });

  it('sin localidad confirmada pide completarla, en los dos casos', () => {
    expect(describeQueuedReport({ reason: QUEUE_REASON.OFFLINE, missingLocation: true }).description).toMatch(/ubicación/);
    expect(describeQueuedReport({ reason: QUEUE_REASON.SLOW, missingLocation: true }).description).toMatch(/ubicación/);
  });
});
