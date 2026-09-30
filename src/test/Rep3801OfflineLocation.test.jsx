/**
 * @file Rep3801OfflineLocation.test.jsx
 * @description REP-3801: sin conexión, el paso de ubicación no puede dejar al ciudadano sin salida.
 * Causa: «Guardar reporte sin conexión» exigía la localidad confirmada, pero el selector de
 * localidades no carga sin red si nunca se guardó la lista en el teléfono. El botón quedaba bloqueado
 * pidiendo algo que no se podía completar.
 * Ahora sin conexión se guarda el borrador sin localidad (se completa en Pendientes, H-35) y el envío
 * definitivo la sigue exigiendo.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReportReviewStep } from '../components/report/ReportReviewStep';
import { getSubmissionReadiness } from '../services/reportReadiness';
import { getDraftProblems } from '../services/pendingSyncService';
import { DEFAULT_REPORT_CATEGORIES } from '../services/categoriesService';

const evidence = [{ id: '1', previewUrl: 'blob:mock1', name: 'foto1.jpg' }];
const category = DEFAULT_REPORT_CATEGORIES[0];
const completoSinLocalidad = {
  evidenceList: evidence,
  selectedCategory: category,
  description: 'Bache profundo en la esquina',
  hasConfirmedLocality: false,
};

const renderStep = (overrides = {}) => {
  const props = {
    ...completoSinLocalidad,
    geolocation: null,
    address: 'Av. Mitre 1240, Avellaneda',
    hasAcceptedTerms: true,
    isOnline: false,
    onBack: vi.fn(),
    onSubmitReport: vi.fn(),
    onAcceptTermsAndSubmit: vi.fn(),
    onOpenTerms: vi.fn(),
    onOpenAdjustLocation: vi.fn(),
    ...overrides,
  };
  render(<ReportReviewStep {...props} />);
  return props;
};

describe('REP-3801 · ubicación sin conexión', () => {
  it('UT-3801-01: la disponibilidad para enviar no exige localidad si requireLocation es false', () => {
    const result = getSubmissionReadiness({ ...completoSinLocalidad, requireLocation: false });
    expect(result.ready).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it('UT-3801-02: con conexión (por defecto) sigue exigiendo la localidad', () => {
    const result = getSubmissionReadiness(completoSinLocalidad);
    expect(result.missing.map((item) => item.key)).toEqual(['location']);
  });

  it('UT-3801-03: sin conexión y sin localidad se puede guardar el borrador, sin abrir el ajuste de ubicación', () => {
    const { onSubmitReport, onOpenAdjustLocation } = renderStep();
    const button = screen.getByRole('button', { name: /Guardar reporte sin conexión/i });

    expect(button).not.toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(button);
    expect(onSubmitReport).toHaveBeenCalledTimes(1);
    expect(onOpenAdjustLocation).not.toHaveBeenCalled();
  });

  it('UT-3801-04: avisa que la ubicación se completa en Pendientes y no lista «Confirmá la ubicación» como faltante', () => {
    renderStep();
    expect(screen.getByTestId('offline-location-pending')).toHaveTextContent(/Pendientes/i);
    expect(screen.queryByTestId('submit-missing')).not.toBeInTheDocument();
  });

  it('UT-3801-05: sin conexión y con localidad confirmada no muestra el aviso', () => {
    renderStep({ hasConfirmedLocality: true });
    expect(screen.queryByTestId('offline-location-pending')).not.toBeInTheDocument();
  });

  it('UT-3801-06: con conexión sin localidad no cambia nada: abre el ajuste y no envía', () => {
    const { onSubmitReport, onOpenAdjustLocation } = renderStep({ isOnline: true });
    fireEvent.click(screen.getByRole('button', { name: /Enviar reporte/i }));
    expect(onOpenAdjustLocation).toHaveBeenCalledTimes(1);
    expect(onSubmitReport).not.toHaveBeenCalled();
    expect(screen.queryByTestId('offline-location-pending')).not.toBeInTheDocument();
  });

  it('UT-3801-07: el envío definitivo sigue exigiendo la localidad: un borrador sin ella queda trabado, no se envía', () => {
    const draft = {
      description: 'Bache profundo en la esquina',
      selectedCategory: category,
      customLocation: null,
      evidenceList: [{ blob: new Blob(['x']) }],
    };
    expect(getDraftProblems(draft).map((problem) => problem.code)).toEqual(['LOCATION']);
  });
});
