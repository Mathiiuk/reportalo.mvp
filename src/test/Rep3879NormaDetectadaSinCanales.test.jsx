/**
 * @file Rep3879NormaDetectadaSinCanales.test.jsx
 * @description REP-3879 (prueba de P1 en staging, Hernán 02/11): en #RP-D183716E apareció el CAV de Avellaneda bajo
 * «Norma detectada». Es una ficha de información del corpus (source_type_code = 'informacion'), no una norma: se
 * muestra aparte y no cuenta como fuente del fundamento.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ReportAiAnalysisPanel } from '../components/report/ReportAiAnalysisPanel';

// Las tres citas de #RP-D183716E, con las rutas y tipos reales de staging
const CAV = 'Municipalidad de Avellaneda > Centro de Atención al Vecino (CAV)';
const LOM_52 = 'Decreto-Ley 6769/58 — Ley Orgánica de las Municipalidades > Artículo 52';
const ORD_132 = 'Ordenanza Fiscal 31321 (Avellaneda) — Ejercicio 2026 > Artículo 132 (Tasa por Servicios Generales)';

const cited = (id, path, sourceType, foundationType = 'competencia') => ({
  fragment_id: id,
  was_cited: true,
  quoted_text: 'texto',
  knowledge_fragments: {
    hierarchy_path: path,
    foundation_type_code: foundationType,
    knowledge_sources: { issuing_authority: 'Autoridad', source_type_code: sourceType },
  },
});

const renderFundamentado = (evidence) =>
  render(
    <ReportAiAnalysisPanel
      analysis={{ result_status_code: 'fundamentado', citizen_feedback: 'Explicación.', report_ai_evidence: evidence }}
    />
  );

describe('REP-3879 · «Norma detectada» solo muestra normas', () => {
  it('UT-ND-01: #RP-D183716E: el CAV va en «Información oficial» y las dos normas en «Norma detectada»', () => {
    renderFundamentado([cited('CAV', CAV, 'informacion'), cited('L52', LOM_52, 'corpus_legal'), cited('O132', ORD_132, 'corpus_legal')]);
    const normas = screen.getByTestId('rag-panel-citations');
    expect(within(normas).getByText(LOM_52)).toBeInTheDocument();
    expect(within(normas).getByText(ORD_132)).toBeInTheDocument();
    expect(within(normas).queryByText(CAV)).not.toBeInTheDocument();
    const informacion = screen.getByTestId('rag-panel-information');
    expect(within(informacion).getByText('Información oficial')).toBeInTheDocument();
    expect(within(informacion).getByText(CAV)).toBeInTheDocument();
    expect(screen.queryByTestId('rag-panel-no-source')).not.toBeInTheDocument();
  });

  it('UT-ND-02: si solo se citó información, no hay «Norma detectada» y se declara que falta la fuente', () => {
    renderFundamentado([cited('CAV', CAV, 'informacion')]);
    expect(screen.queryByTestId('rag-panel-citations')).not.toBeInTheDocument();
    expect(screen.getByTestId('rag-panel-information')).toHaveTextContent(CAV);
    expect(screen.getByTestId('rag-panel-no-source')).toHaveTextContent(/no lo tomes como fundamento verificado/i);
  });

  it('UT-ND-03: sin información citada, no aparece el bloque «Información oficial»', () => {
    renderFundamentado([cited('L52', LOM_52, 'corpus_legal')]);
    expect(screen.getByTestId('rag-panel-citations')).toHaveTextContent(LOM_52);
    expect(screen.queryByTestId('rag-panel-information')).not.toBeInTheDocument();
  });

  it('UT-ND-04: una cita sin tipo de fuente (datos viejos) sigue contando como norma', () => {
    const sinTipo = { ...cited('L52', LOM_52, undefined) };
    delete sinTipo.knowledge_fragments.knowledge_sources.source_type_code;
    renderFundamentado([sinTipo]);
    expect(screen.getByTestId('rag-panel-citations')).toHaveTextContent(LOM_52);
  });

  it('UT-ND-05: la consulta del análisis trae el tipo de fuente', () => {
    const servicio = readFileSync(resolve(__dirname, '../services/reportAiAnalysisService.js'), 'utf8');
    expect(servicio).toMatch(/knowledge_sources \([^)]*source_type_code[^)]*\)/);
  });
});
