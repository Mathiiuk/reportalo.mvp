/**
 * @file Rep3798DisclaimerDescripcion.test.jsx
 * @description REP-3798 (pedido de Leo, PM): como cualquier ciudadano puede leer la descripción de un reporte
 * ajeno, el campo de texto libre avisa que no se incluyan datos personales.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReportDetailsStep } from '../components/report/ReportDetailsStep';
import { DEFAULT_REPORT_CATEGORIES } from '../services/categoriesService';

const renderStep = (description = '') =>
  render(
    <ReportDetailsStep
      categories={DEFAULT_REPORT_CATEGORIES}
      selectedCategory={DEFAULT_REPORT_CATEGORIES[0]}
      description={description}
      onSelectCategory={vi.fn()}
      onChangeDescription={vi.fn()}
      onBack={vi.fn()}
      onContinue={vi.fn()}
    />
  );

describe('REP-3798 · aviso de privacidad en la descripción', () => {
  it('UT-DSC-01: avisa que otras personas pueden leerla y qué no incluir', () => {
    renderStep();
    const notice = screen.getByTestId('description-privacy-notice');
    expect(notice).toHaveTextContent(/Otras personas pueden leer tu descripción/i);
    expect(notice).toHaveTextContent(/nombres, teléfonos, documentos, patentes ni direcciones exactas/i);
  });

  it('UT-DSC-02: el aviso está a la vista aunque ya haya texto escrito', () => {
    renderStep('Camión estacionado sobre la rampa de la esquina');
    expect(screen.getByTestId('description-privacy-notice')).toBeInTheDocument();
  });

  it('UT-DSC-03: el campo lo anuncia como ayuda accesible', () => {
    renderStep();
    expect(screen.getByLabelText('Descripción')).toHaveAttribute(
      'aria-describedby',
      expect.stringContaining('report-description-privacy')
    );
  });
});
