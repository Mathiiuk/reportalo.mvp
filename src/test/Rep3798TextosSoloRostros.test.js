/**
 * @file Rep3798TextosSoloRostros.test.js
 * @description REP-3798: el servidor pixela solo rostros (decisión de producto, 30/09/2026), así que los textos
 * que ve el ciudadano no pueden prometer que se difuminan patentes, y los términos suben a la versión 1.4 para
 * que todos acepten el texto nuevo.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  CURRENT_TERMS_VERSION,
  FULL_TERMS_AND_CONDITIONS,
  getTermsUpdateStatus,
  hasAcceptedCurrentTerms,
  TERMS_STORAGE_KEY,
} from '../services/termsService';
import { PIPELINE_STEPS } from '../services/quarantinePipelineService';

const leer = (ruta) => readFileSync(resolve(process.cwd(), ruta), 'utf8');

describe('REP-3798 · términos y textos: solo rostros', () => {
  beforeEach(() => localStorage.clear());

  it('UT-TXT-01: los términos están en la versión 1.4', () => {
    expect(CURRENT_TERMS_VERSION).toBe('1.4');
  });

  it('UT-TXT-02: el §2.2 dice que solo se difuminan rostros y que las patentes pueden verse', () => {
    expect(FULL_TERMS_AND_CONDITIONS).toMatch(/únicamente sobre los rostros/);
    expect(FULL_TERMS_AND_CONDITIONS).toMatch(/patentes de los vehículos[^.]*no se difuminan/);
    expect(FULL_TERMS_AND_CONDITIONS).not.toMatch(/rostros y patentes/);
  });

  it('UT-TXT-03: quien aceptó la 1.3 queda con los términos desactualizados y vuelve a aceptar', () => {
    localStorage.setItem(
      TERMS_STORAGE_KEY,
      JSON.stringify({ userId: 'usr-1', terms_version: '1.3', accepted_at: '2026-09-20T17:05:00' })
    );
    expect(getTermsUpdateStatus('usr-1').isOutdated).toBe(true);
    expect(hasAcceptedCurrentTerms('usr-1')).toBe(false);
  });

  it('UT-TXT-04: ninguna pantalla promete difuminar patentes', () => {
    [
      'src/components/report/ConsentSheet.jsx',
      'src/components/report/EvidenceCaptureStep.jsx',
      'src/components/report/EvidencePreviewScreen.jsx',
      'src/components/report/EvidenceUploadDesktop.jsx',
      'src/components/report/ReportProcessingScreen.jsx',
      'src/pages/OnboardingPage.jsx',
      'src/pages/PermissionsPage.jsx',
      'src/pages/TermsAndPermissionsPage.jsx',
    ].forEach((ruta) => expect(leer(ruta), ruta).not.toMatch(/rostros y (las )?patentes/i));
  });

  it('UT-TXT-05: el pipeline ya no muestra un paso de pixelado de patentes', () => {
    expect(PIPELINE_STEPS.join(' ')).not.toMatch(/patente/i);
  });
});
