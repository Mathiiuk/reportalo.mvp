/**
 * @file Rep3798AcuseEnRevision.test.jsx
 * @description REP-3798: al enviar un reporte, el acuse pasa solo de «Enviado» a «En revisión»
 * (la IA empieza a revisarlo para dar una devolución).
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

// Se captura lo que el acuse le pasa al hook, para simular que la base cambió el estado
let liveParams = null;
vi.mock('../hooks/useReportStateLive', () => ({
  useReportStateLive: (params) => {
    liveParams = params;
  },
}));

import { ReportSuccessScreen } from '../components/report/ReportSuccessScreen';

const step = (key) => screen.getByTestId(`tracker-step-${key}`);

describe('REP-3798 · el acuse de envío avanza a En revisión', () => {
  beforeEach(() => {
    liveParams = null;
  });

  it('UT-REV-01: recién enviado, solo «Enviado» está completo', () => {
    render(<ReportSuccessScreen reportId="r1" reportCode="#RP-0001" />);
    expect(step('enviado')).toHaveAttribute('data-done', 'true');
    expect(step('en_revision')).toHaveAttribute('data-done', 'false');
    expect(step('enviado')).toHaveAttribute('aria-current', 'step');
  });

  it('UT-REV-02: escucha el estado del reporte recién creado, con un sondeo más rápido que el detalle', () => {
    render(<ReportSuccessScreen reportId="r1" reportCode="#RP-0001" />);
    expect(liveParams).toMatchObject({ reportId: 'r1', stateCode: 'RECIBIDO', isOwner: true, intervalMs: 5000 });
  });

  it('UT-REV-03: cuando la base pasa el reporte a En revisión, el tracker avanza solo', async () => {
    render(<ReportSuccessScreen reportId="r1" reportCode="#RP-0001" />);
    await act(async () => {
      liveParams.onUpdate({ stateCode: 'EN_ANALISIS', history: null });
    });
    expect(step('enviado')).toHaveAttribute('data-done', 'true');
    expect(step('en_revision')).toHaveAttribute('data-done', 'true');
    expect(step('en_revision')).toHaveAttribute('aria-current', 'step');
    expect(step('enviado')).not.toHaveAttribute('aria-current');
    // Lo que todavía no ocurrió sigue pendiente: no se promete una notificación que no existe
    expect(step('notificado')).toHaveAttribute('data-done', 'false');
    expect(step('resuelto')).toHaveAttribute('data-done', 'false');
  });

  it('UT-REV-04: sin id de reporte (envío sin conexión, por ejemplo) no escucha nada y queda en Enviado', () => {
    render(<ReportSuccessScreen reportCode="#RP-0001" />);
    expect(liveParams.reportId).toBeNull();
    expect(step('en_revision')).toHaveAttribute('data-done', 'false');
  });

  it('UT-REV-05: un estado de cierre alternativo (Descartado) no rompe el tracker', async () => {
    render(<ReportSuccessScreen reportId="r1" reportCode="#RP-0001" />);
    await act(async () => {
      liveParams.onUpdate({ stateCode: 'DESESTIMADO', history: null });
    });
    expect(step('enviado')).toHaveAttribute('data-done', 'true');
    expect(step('resuelto')).toHaveAttribute('data-done', 'false');
  });
});
