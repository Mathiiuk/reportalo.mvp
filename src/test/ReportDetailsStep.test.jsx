import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReportDetailsStep } from '../components/report/ReportDetailsStep';
import { DEFAULT_REPORT_CATEGORIES } from '../services/categoriesService';

describe('REP-2200: ReportDetailsStep (Paso 2 del Journey v2)', () => {
  const mockCategories = DEFAULT_REPORT_CATEGORIES;

  it('UT-DT-01: Renderiza el stepper de 3 pasos (Foto con check verde, Detalle activo en azul, Enviar en gris)', () => {
    render(
      <ReportDetailsStep
        categories={mockCategories}
        selectedCategory={mockCategories[0]}
        description=""
        onSelectCategory={vi.fn()}
        onChangeDescription={vi.fn()}
        onBack={vi.fn()}
        onContinue={vi.fn()}
      />
    );

    expect(screen.getByText('Foto')).toBeInTheDocument();
    expect(screen.getByText('Detalle')).toBeInTheDocument();
    expect(screen.getByText('Enviar')).toBeInTheDocument();
  });

  it('UT-DT-02: Renderiza la grilla de categorías con iconos y nombres correspondientes', () => {
    render(
      <ReportDetailsStep
        categories={mockCategories}
        selectedCategory={mockCategories[0]}
        description=""
        onSelectCategory={vi.fn()}
        onChangeDescription={vi.fn()}
        onBack={vi.fn()}
        onContinue={vi.fn()}
      />
    );

    expect(screen.getByText('Infraestructura vial')).toBeInTheDocument();
    expect(screen.getByText('Infracción de tránsito')).toBeInTheDocument();
    expect(screen.getByText('Medio ambiente')).toBeInTheDocument();
    expect(screen.getByText('Comercio irregular')).toBeInTheDocument();
  });

  it('UT-DT-03: Muestra el banner explicativo con ejemplos de la categoría seleccionada', () => {
    render(
      <ReportDetailsStep
        categories={mockCategories}
        selectedCategory={mockCategories[3]} // Comercio irregular
        description=""
        onSelectCategory={vi.fn()}
        onChangeDescription={vi.fn()}
        onBack={vi.fn()}
        onContinue={vi.fn()}
      />
    );

    expect(screen.getByText(/venta ambulante en la vereda/i)).toBeInTheDocument();
  });

  it('UT-DT-04: Permite escribir en el campo de descripción y accionar el botón Continuar', () => {
    const onContinueMock = vi.fn();
    const onChangeDescMock = vi.fn();

    render(
      <ReportDetailsStep
        categories={mockCategories}
        selectedCategory={mockCategories[1]}
        description="Camión bloqueando rampa"
        onSelectCategory={vi.fn()}
        onChangeDescription={onChangeDescMock}
        onBack={vi.fn()}
        onContinue={onContinueMock}
      />
    );

    const textarea = screen.getByPlaceholderText(/Describí brevemente lo que observás/i);
    fireEvent.change(textarea, { target: { value: 'Nuevo texto de descripción' } });
    expect(onChangeDescMock).toHaveBeenCalledWith('Nuevo texto de descripción');

    const continueBtn = screen.getByRole('button', { name: /Continuar/i });
    fireEvent.click(continueBtn);
    expect(onContinueMock).toHaveBeenCalledTimes(1);
  });
});
