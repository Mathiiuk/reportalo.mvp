/**
 * @file ReportAiAnalysisPanel.test.jsx
 * @description Pruebas del panel de fundamento legal para el ciudadano (REP-2909, bloque 4).
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReportAiAnalysisPanel, SHOW_SANCTION_REFERENCE } from '../components/report/ReportAiAnalysisPanel';

const baseEvidence = [
  {
    fragment_id: 'FRAG-A',
    was_cited: true,
    quoted_text: 'texto citado',
    knowledge_fragments: { hierarchy_path: 'Ley X > Artículo 1', foundation_type_code: 'obligacion' },
  },
  {
    fragment_id: 'FRAG-B',
    was_cited: true,
    quoted_text: 'multa de 100 unidades',
    knowledge_fragments: { hierarchy_path: 'Ley Y > Artículo 2', foundation_type_code: 'sancion' },
  },
  {
    fragment_id: 'FRAG-C',
    was_cited: false,
    quoted_text: null,
    knowledge_fragments: { hierarchy_path: 'Ley Z > Artículo 3', foundation_type_code: 'obligacion' },
  },
];

describe('REP-2909: ReportAiAnalysisPanel', () => {
  it('muestra estado de carga', () => {
    render(<ReportAiAnalysisPanel loading />);
    expect(screen.getByTestId('rag-panel-loading')).toBeInTheDocument();
  });

  it('muestra estado pendiente cuando todavía no hay análisis', () => {
    render(<ReportAiAnalysisPanel analysis={null} />);
    expect(screen.getByTestId('rag-panel-pending')).toBeInTheDocument();
  });

  it('estado fundamentado: muestra el fundamento y las citas, con la referencia de sanciones (sin contenido) y sin no citadas', () => {
    render(
      <ReportAiAnalysisPanel
        analysis={{
          result_status_code: 'fundamentado',
          citizen_feedback: 'No está permitido estacionar sobre la rampa.',
          report_ai_evidence: baseEvidence,
        }}
      />
    );

    expect(screen.getByText('No está permitido estacionar sobre la rampa.')).toBeInTheDocument();
    // FRAG-A: obligación, citada -> visible
    expect(screen.getByText('Ley X > Artículo 1')).toBeInTheDocument();
    // FRAG-B: sanción citada -> se muestra solo la referencia (REP-3796), nunca su contenido
    expect(screen.getByText('Ley Y > Artículo 2')).toBeInTheDocument();
    expect(screen.queryByText(/multa de 100/)).not.toBeInTheDocument();
    // FRAG-C: no citada -> no se muestra
    expect(screen.queryByText('Ley Z > Artículo 3')).not.toBeInTheDocument();
  });

  it.each([
    ['sin_normativa', /normativa cargada/i],
    ['indeterminado', /no concluyente/i],
    ['fuera_de_alcance', /911/],
    ['asistencia', /asistencia social/i],
  ])('estado %s: muestra un mensaje transparente, nunca un texto inventado', (status, expectedText) => {
    render(<ReportAiAnalysisPanel analysis={{ result_status_code: status, report_ai_evidence: [] }} />);
    const panel = screen.getByTestId('rag-panel');
    expect(panel).toHaveAttribute('data-status', status);
    expect(panel.textContent).toMatch(expectedText);
  });

  it('REP-3789: informa el fallo de lectura en vez de simular que sigue procesando', () => {
    render(<ReportAiAnalysisPanel analysis={null} error="network error" />);
    expect(screen.getByTestId('rag-panel-error')).toBeInTheDocument();
    expect(screen.queryByTestId('rag-panel-pending')).not.toBeInTheDocument();
  });

  it('REP-3789: si ya hay análisis, un error posterior no tapa el resultado', () => {
    // El polling puede fallar despues de haber traido el analisis: lo ya
    // obtenido no debe desaparecer de la pantalla.
    render(
      <ReportAiAnalysisPanel
        analysis={{ result_status_code: 'fundamentado', citizen_feedback: 'Vigente.', report_ai_evidence: [] }}
        error="network error"
      />
    );
    expect(screen.getByTestId('rag-panel')).toBeInTheDocument();
    expect(screen.getByText('Vigente.')).toBeInTheDocument();
  });

  it('no rompe si result_status_code no es un valor reconocido', () => {
    const { container } = render(<ReportAiAnalysisPanel analysis={{ result_status_code: 'valor_futuro_desconocido' }} />);
    expect(container.firstChild).toBeNull();
  });

  describe('REP-3796: visibilidad de la fuente normativa', () => {
    const fund = (evidence) => (
      <ReportAiAnalysisPanel
        analysis={{ result_status_code: 'fundamentado', citizen_feedback: 'Explicación.', report_ai_evidence: evidence }}
      />
    );
    const cited = (id, path, type, authority) => ({
      fragment_id: id,
      was_cited: true,
      quoted_text: 'multa de 100 unidades',
      knowledge_fragments: {
        hierarchy_path: path,
        foundation_type_code: type,
        knowledge_sources: authority ? { issuing_authority: authority } : null,
      },
    });

    it('prohibición: muestra ley, artículo y jurisdicción, sin aviso de falta de fuente', () => {
      render(fund([cited('P', 'Ley 2148 > Art. 7.1.8', 'prohibicion', 'Legislatura de la Ciudad Autónoma de Buenos Aires')]));
      expect(screen.getByText('Ley 2148 > Art. 7.1.8')).toBeInTheDocument();
      expect(screen.getByTestId('rag-panel-jurisdiction')).toHaveTextContent(/Ciudad Autónoma/);
      expect(screen.queryByTestId('rag-panel-no-source')).not.toBeInTheDocument();
    });

    it('solo sanción: muestra ley, artículo y jurisdicción, sin contenido ni montos y sin aviso de falta de fuente', () => {
      render(fund([cited('S', 'Ley 451 > Art. 6.1.52', 'sancion', 'Legislatura de la Ciudad Autónoma de Buenos Aires')]));
      expect(SHOW_SANCTION_REFERENCE).toBe(true);
      expect(screen.getByText('Ley 451 > Art. 6.1.52')).toBeInTheDocument();
      expect(screen.getByTestId('rag-panel-jurisdiction')).toBeInTheDocument();
      expect(screen.queryByText(/multa de 100/)).not.toBeInTheDocument();
      expect(screen.queryByTestId('rag-panel-no-source')).not.toBeInTheDocument();
    });

    it('fundamentado sin ningún fragmento citado: declara la limitación en vez de inventar una fuente', () => {
      render(fund([]));
      expect(screen.getByTestId('rag-panel-no-source')).toHaveTextContent(/no lo tomes como fundamento verificado/i);
    });

    it('prohibición + sanción: muestra ambas referencias y no marca limitación', () => {
      render(fund([cited('P', 'Ley 24.449 > Art. 48', 'prohibicion'), cited('S', 'Ley 24.449 > Art. 77', 'sancion')]));
      expect(screen.getByText('Ley 24.449 > Art. 48')).toBeInTheDocument();
      expect(screen.getByText('Ley 24.449 > Art. 77')).toBeInTheDocument();
      expect(screen.queryByTestId('rag-panel-no-source')).not.toBeInTheDocument();
    });

    it('ausencia de normativa: mensaje propio, sin la nota de fundamento sin fuente', () => {
      render(<ReportAiAnalysisPanel analysis={{ result_status_code: 'sin_normativa', report_ai_evidence: [] }} />);
      expect(screen.queryByTestId('rag-panel-no-source')).not.toBeInTheDocument();
    });
  });
});
