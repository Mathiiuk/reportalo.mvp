/**
 * @file ReportTimeline.test.jsx
 * @description Pruebas de la línea de tiempo del reporte (REP-3789, bloque 4):
 * la función pura buildTimeline y su render.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { buildTimeline, TIMELINE_LABELS, getStateMeta, REPORT_STATE_META } from '../services/reportDetailService';
import { ReportTimeline, formatStepDate } from '../components/report/ReportTimeline';

const CREATED_AT = '2026-08-14T14:32:00Z';

describe('REP-3789: buildTimeline', () => {
  it('UT-TL-01: sin historial, marca solo el paso alcanzado según el estado actual', () => {
    const steps = buildTimeline({ history: [], currentStateCode: 'RECIBIDO', createdAt: CREATED_AT });

    expect(steps.map((s) => s.code)).toEqual(['RECIBIDO', 'EN_ANALISIS', 'DERIVADO', 'RESUELTO']);
    expect(steps[0]).toMatchObject({ reached: true, at: CREATED_AT, isCurrent: true });
    expect(steps[1].reached).toBe(false);
    // Un paso no alcanzado nunca lleva fecha: no se inventan marcas temporales.
    expect(steps[1].at).toBeNull();
  });

  it('UT-TL-02: marca como alcanzados todos los pasos previos al estado actual', () => {
    const steps = buildTimeline({ history: [], currentStateCode: 'DERIVADO', createdAt: CREATED_AT });
    const reached = steps.filter((s) => s.reached).map((s) => s.code);
    expect(reached).toEqual(['RECIBIDO', 'EN_ANALISIS', 'DERIVADO']);
  });

  it('UT-TL-03: usa la fecha y la nota reales del historial cuando existen', () => {
    const steps = buildTimeline({
      history: [
        { state_code: 'RECIBIDO', changed_at: '2026-08-14T14:32:00Z', notes: null },
        { state_code: 'EN_ANALISIS', changed_at: '2026-08-15T09:10:00Z', notes: 'Derivado a inspección de tránsito' },
      ],
      currentStateCode: 'EN_ANALISIS',
      createdAt: CREATED_AT,
    });

    expect(steps[1]).toMatchObject({
      at: '2026-08-15T09:10:00Z',
      notes: 'Derivado a inspección de tránsito',
      reached: true,
    });
  });

  it('UT-TL-04: un reporte desestimado usa el recorrido alternativo, no el feliz', () => {
    const steps = buildTimeline({ history: [], currentStateCode: 'DESESTIMADO', createdAt: CREATED_AT });

    expect(steps.map((s) => s.code)).toEqual(['RECIBIDO', 'EN_ANALISIS', 'DESESTIMADO']);
    expect(steps.some((s) => s.code === 'RESUELTO')).toBe(false);
  });

  it('UT-TL-05: ante registros repetidos del mismo estado conserva el más reciente', () => {
    const steps = buildTimeline({
      history: [
        { state_code: 'EN_ANALISIS', changed_at: '2026-08-15T09:10:00Z', notes: 'primera' },
        { state_code: 'EN_ANALISIS', changed_at: '2026-08-17T10:00:00Z', notes: 'reapertura' },
      ],
      currentStateCode: 'EN_ANALISIS',
      createdAt: CREATED_AT,
    });

    expect(steps[1].notes).toBe('reapertura');
  });

  it('UT-TL-06: no rompe con un estado desconocido ni con historial ausente', () => {
    const steps = buildTimeline({ currentStateCode: 'ESTADO_FUTURO' });
    expect(steps).toHaveLength(4);
    expect(steps.every((s) => s.reached === false)).toBe(true);
  });
});

describe('REP-3789: ReportTimeline', () => {
  it('UT-TL-07: formatStepDate respeta el formato del mockup y tolera valores inválidos', () => {
    expect(formatStepDate(null)).toBeNull();
    expect(formatStepDate('no-es-fecha')).toBeNull();
    expect(formatStepDate('2026-08-14T14:32:00')).toBe('14/08 · 14:32');
  });

  it('UT-TL-08: renderiza las etiquetas aprobadas del User Journey', () => {
    const steps = buildTimeline({ history: [], currentStateCode: 'EN_ANALISIS', createdAt: CREATED_AT });
    render(<ReportTimeline steps={steps} />);

    expect(screen.getByText(TIMELINE_LABELS.RECIBIDO)).toBeInTheDocument();
    expect(screen.getByText(TIMELINE_LABELS.EN_ANALISIS)).toBeInTheDocument();
    expect(screen.getByText(TIMELINE_LABELS.DERIVADO)).toBeInTheDocument();
  });

  it('UT-TL-09: no renderiza nada si no hay pasos', () => {
    const { container } = render(<ReportTimeline steps={[]} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('REP-3789: REPORT_STATE_META como fuente única de verdad', () => {
  it('UT-ST-01: cubre exactamente los códigos de public.report_states', () => {
    expect(Object.keys(REPORT_STATE_META).sort()).toEqual(
      ['DERIVADO', 'DESESTIMADO', 'EN_ANALISIS', 'RECIBIDO', 'RESUELTO'].sort()
    );
  });

  it('UT-ST-02: DESESTIMADO y RESUELTO cierran el reporte; el resto sigue en curso', () => {
    // Regresión: el listado mapeaba 'DESCARTADO', código inexistente, y por eso
    // un reporte desestimado aparecia como "En curso".
    expect(getStateMeta('DESESTIMADO').isClosed).toBe(true);
    expect(getStateMeta('RESUELTO').isClosed).toBe(true);
    expect(getStateMeta('RECIBIDO').isClosed).toBe(false);
    expect(getStateMeta('EN_ANALISIS').isClosed).toBe(false);
    expect(getStateMeta('DERIVADO').isClosed).toBe(false);
  });

  it('UT-ST-03: un código desconocido nunca se asume cerrado', () => {
    expect(getStateMeta('DESCARTADO').isClosed).toBe(false);
    expect(getStateMeta(undefined).isClosed).toBe(false);
  });
});
