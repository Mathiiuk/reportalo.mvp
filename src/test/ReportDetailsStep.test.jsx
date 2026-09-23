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

    // Nombres del catalogo real de public.services, verificados contra la base el
    // 22/09/2026. Antes este test esperaba «Infraestructura vial», «Infracción de
    // tránsito» y «Medio ambiente», que no existen: el respaldo offline decia una
    // cosa y la lista que llega de la base, otra (H-03).
    expect(screen.getByText('Infraestructura')).toBeInTheDocument();
    expect(screen.getByText('Tránsito')).toBeInTheDocument();
    expect(screen.getByText('Ambiente')).toBeInTheDocument();
    expect(screen.getByText('Comercio irregular')).toBeInTheDocument();
    // H-04: produccion tiene cinco categorias, no cuatro.
    expect(screen.getByText('Vulnerabilidad social')).toBeInTheDocument();
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

// REP-2203: descripción breve — campo identificado, límite, validación y conservación
describe('REP-2203: descripción del reporte en el Paso 2', () => {
  const categories = DEFAULT_REPORT_CATEGORIES;
  const renderStep = (description, overrides = {}) => {
    const props = {
      categories,
      selectedCategory: categories[0],
      description,
      onSelectCategory: vi.fn(),
      onChangeDescription: vi.fn(),
      onBack: vi.fn(),
      onContinue: vi.fn(),
      ...overrides,
    };
    render(<ReportDetailsStep {...props} />);
    return props;
  };

  it('UT-DESC-08: el campo está identificado con su etiqueta y limita la longitud a 280', () => {
    renderStep('');
    const field = screen.getByLabelText(/Descripción/i);
    expect(field).toHaveAttribute('maxlength', '280');
  });

  it('UT-DESC-09: informa el límite con un contador de caracteres', () => {
    renderStep('Camión bloqueando rampa');
    expect(screen.getByTestId('description-counter')).toHaveTextContent('23/280');
    expect(screen.getByText(/entre 10 y 280 caracteres/i)).toBeInTheDocument();
  });

  it('UT-DESC-10: vacía, no deja continuar y muestra una indicación comprensible', () => {
    const { onContinue } = renderStep('');
    fireEvent.click(screen.getByRole('button', { name: /Continuar/i }));

    expect(onContinue).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/Escribí una descripción/i);
    expect(screen.getByLabelText(/Descripción/i)).toHaveAttribute('aria-invalid', 'true');
  });

  it('UT-DESC-11: con menos de 10 caracteres no deja continuar e indica el mínimo', () => {
    const { onContinue } = renderStep('bache');
    fireEvent.click(screen.getByRole('button', { name: /Continuar/i }));

    expect(onContinue).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/al menos 10/i);
  });

  it('UT-DESC-12: con una descripción válida continúa y no muestra errores', () => {
    const { onContinue } = renderStep('Camión bloqueando la rampa');
    fireEvent.click(screen.getByRole('button', { name: /Continuar/i }));

    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('UT-DESC-13: el texto ingresado se conserva al volver a montar el paso con el mismo valor', () => {
    const texto = 'Derrame de aceite en la esquina';
    const { unmount } = render(
      <ReportDetailsStep
        categories={categories}
        selectedCategory={categories[0]}
        description={texto}
        onSelectCategory={vi.fn()}
        onChangeDescription={vi.fn()}
        onBack={vi.fn()}
        onContinue={vi.fn()}
      />
    );
    unmount();
    renderStep(texto);
    expect(screen.getByLabelText(/Descripción/i)).toHaveValue(texto);
  });
});
