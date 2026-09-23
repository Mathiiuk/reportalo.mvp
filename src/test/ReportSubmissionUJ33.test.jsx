import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConsentSheet } from '../components/report/ConsentSheet';
import { ReportSuccessScreen } from '../components/report/ReportSuccessScreen';
import { CURRENT_TERMS_VERSION } from '../services/termsService';

describe('REP-3791 Bloque 2 · Revisión, consentimiento y envío (UJ v3.3)', () => {
  it('UT-B2-01: la hoja de consentimiento muestra la versión vigente de los términos, no una fija', () => {
    render(<ConsentSheet open onAccept={vi.fn()} onDismiss={vi.fn()} onOpenTerms={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: /antes de enviar/i })).toBeInTheDocument();
    expect(screen.getByText(`Leer términos y privacidad · v${CURRENT_TERMS_VERSION}`)).toBeInTheDocument();
  });

  it('UT-B2-02: Escape y «Ahora no» cierran la hoja sin aceptar', () => {
    const onDismiss = vi.fn();
    const onAccept = vi.fn();
    render(<ConsentSheet open onAccept={onAccept} onDismiss={onDismiss} onOpenTerms={vi.fn()} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: /ahora no/i }));
    expect(onDismiss).toHaveBeenCalledTimes(2);
    expect(onAccept).not.toHaveBeenCalled();
  });

  it('UT-B2-03: el acuse muestra la constancia de consentimiento solo si el envío originó la aceptación', () => {
    const { rerender } = render(<ReportSuccessScreen reportCode="#RP-0001" onViewReport={vi.fn()} onReturnToMap={vi.fn()} onViewTerms={vi.fn()} />);
    expect(screen.queryByText(/Consentimiento registrado/i)).not.toBeInTheDocument();

    const onViewTerms = vi.fn();
    rerender(
      <ReportSuccessScreen
        reportCode="#RP-0001"
        consentVersion="1.3"
        consentAcceptedAt="2026-09-21T14:32:00.000Z"
        onViewReport={vi.fn()}
        onReturnToMap={vi.fn()}
        onViewTerms={onViewTerms}
      />
    );
    expect(screen.getByText(/Consentimiento registrado · v1\.3/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /ver constancia/i }));
    expect(onViewTerms).toHaveBeenCalledTimes(1);
  });

  it('UT-B2-04: el tracker tiene los cuatro estados reales y el cierre alternativo «Descartado»', () => {
    render(<ReportSuccessScreen onViewReport={vi.fn()} onReturnToMap={vi.fn()} />);
    ['Enviado', 'En revisión', 'Notificado al responsable', 'Resuelto'].forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
    expect(screen.getByText('Descartado')).toBeInTheDocument();
  });
});
