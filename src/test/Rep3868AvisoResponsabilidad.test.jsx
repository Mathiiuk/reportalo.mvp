import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReportReviewStep } from '../components/report/ReportReviewStep';
import { DEFAULT_REPORT_CATEGORIES } from '../services/categoriesService';

// REP-3868 · aviso de responsabilidad y congruencia en «Revisá antes de enviar» (handoff REP-3867 de Ivo).
// El texto es el que aprobó Hernán en REP-3867 (comentario del 01/11).
const TEXTO_AVISO =
  'Al enviar, confirmás que el reporte es real y que las fotos corresponden a lo que describís. Sos responsable de lo que enviás: el contenido indebido se da de baja. Condiciones de uso';

// Reporte completo: fotos, categoría, descripción y localidad confirmada
const renderPaso = (props = {}) => {
  const handlers = {
    onSubmitReport: vi.fn(),
    onAcceptTermsAndSubmit: vi.fn(),
    onOpenTerms: vi.fn(),
    onOpenAdjustLocation: vi.fn(),
  };
  render(
    <ReportReviewStep
      evidenceList={[{ id: '1', previewUrl: 'blob:foto1' }]}
      selectedCategory={DEFAULT_REPORT_CATEGORIES[1]}
      description="Camión de gran porte circulando por calle residencial"
      geolocation={{ lat: -34.663, lng: -58.365 }}
      address="Av. Mitre 1240, Avellaneda"
      hasConfirmedLocality
      hasAcceptedTerms={false}
      onBack={vi.fn()}
      {...handlers}
      {...props}
    />
  );
  return handlers;
};

describe('REP-3868 · aviso de responsabilidad antes de enviar', () => {
  it('UT-AV-01: muestra el texto aprobado con el enlace «Condiciones de uso»', () => {
    renderPaso();
    const aviso = screen.getByTestId('envio-aviso');
    // Se compara el texto exacto (espacios normalizados): no se puede cambiar sin una nueva aprobación del PO
    expect(aviso.textContent.replace(/\s+/g, ' ').trim()).toBe(TEXTO_AVISO);
    expect(screen.getByRole('button', { name: 'Condiciones de uso' })).toBeInTheDocument();
  });

  it.each([
    ['sin aceptación vigente', false],
    ['con aceptación vigente', true],
  ])('UT-AV-02: el aviso aparece %s (D-02: en todos los reportes)', (_caso, hasAcceptedTerms) => {
    renderPaso({ hasAcceptedTerms });
    expect(screen.getByTestId('envio-aviso')).toBeInTheDocument();
  });

  it('UT-AV-03: también aparece sin conexión, con el botón de guardar', () => {
    renderPaso({ isOnline: false });
    expect(screen.getByTestId('envio-aviso')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar reporte sin conexión' })).toBeInTheDocument();
  });

  it('UT-AV-04: reemplaza la línea «Antes de enviar te vamos a pedir aceptar los términos»', () => {
    renderPaso({ hasAcceptedTerms: false });
    expect(screen.queryByText(/te vamos a pedir aceptar/i)).not.toBeInTheDocument();
    // Un solo enlace a las condiciones en la pantalla
    expect(screen.queryByRole('button', { name: 'términos' })).not.toBeInTheDocument();
  });

  it('UT-AV-05: «Condiciones de uso» abre las condiciones sin enviar el reporte', () => {
    const { onOpenTerms, onSubmitReport, onAcceptTermsAndSubmit } = renderPaso();
    fireEvent.click(screen.getByRole('button', { name: 'Condiciones de uso' }));
    expect(onOpenTerms).toHaveBeenCalledTimes(1);
    expect(onSubmitReport).not.toHaveBeenCalled();
    expect(onAcceptTermsAndSubmit).not.toHaveBeenCalled();
  });

  it('UT-AV-06: no bloquea el envío de quien ya aceptó: sin casilla ni ventana', () => {
    const { onSubmitReport } = renderPaso({ hasAcceptedTerms: true });
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar reporte' }));
    expect(onSubmitReport).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('UT-AV-07: la hoja de aceptación sigue igual para quien no aceptó la versión vigente', () => {
    const { onSubmitReport } = renderPaso({ hasAcceptedTerms: false });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar reporte' }));
    expect(onSubmitReport).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('UT-AV-08: el lector de pantalla lee el aviso al enfocar el botón', () => {
    renderPaso();
    const boton = screen.getByRole('button', { name: 'Enviar reporte' });
    expect(boton).toHaveAttribute('aria-describedby', 'envio-aviso');
    expect(boton).toHaveAccessibleDescription(/confirmás que el reporte es real/);
  });

  it('UT-AV-09: si falta algo, el botón describe el aviso y lo que falta', () => {
    renderPaso({ description: '' });
    const boton = screen.getByRole('button', { name: 'Enviar reporte' });
    expect(boton.getAttribute('aria-describedby').split(' ')).toEqual(['envio-aviso', 'submit-missing']);
  });

  it('UT-AV-10: no interrumpe: sin role="alert" ni aria-live', () => {
    renderPaso();
    const aviso = screen.getByTestId('envio-aviso');
    expect(aviso).not.toHaveAttribute('role');
    expect(aviso).not.toHaveAttribute('aria-live');
  });

  it('UT-AV-11: el enlace va antes que el botón en el orden de foco', () => {
    renderPaso();
    const enlace = screen.getByRole('button', { name: 'Condiciones de uso' });
    const boton = screen.getByRole('button', { name: 'Enviar reporte' });
    // DOCUMENT_POSITION_FOLLOWING: el botón está después del enlace en el documento
    expect(enlace.compareDocumentPosition(boton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('UT-AV-12: no promete moderación automática, anonimato, rostros ni patentes', () => {
    renderPaso();
    const texto = screen.getByTestId('envio-aviso').textContent;
    expect(texto).not.toMatch(/moder|revis|anónim|rostro|patente|a tu nombre/i);
  });

  it('UT-AV-13: teléfono arriba del botón y escritorio a su izquierda, con 440 px de ancho máximo', () => {
    // jsdom no aplica Tailwind: se controla el contrato de clases del handoff; la medida real se ve en el navegador
    renderPaso();
    const clases = screen.getByTestId('envio-aviso').className.split(' ');
    expect(clases).toEqual(
      expect.arrayContaining([
        'mb-2.5',
        'text-center',
        'text-[12.5px]',
        'leading-[1.45]',
        'font-medium',
        'text-rep-ink-body',
        'desktop:order-1',
        'desktop:max-w-[440px]',
        'desktop:text-right',
        'desktop:mb-0',
      ])
    );
  });
});
