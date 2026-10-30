/**
 * @file Rep3001EtiquetasIgualesAlPanel.test.js
 * @description REP-3001 · Reglas del panel §4: «cada estado se lee igual desde la app del vecino y desde el panel».
 * El vecino veía «Enviado» y «En revisión» y el operador «Recibido» y «En análisis» (diseño v2 de Iván, D49 a D52).
 * Ahora las dos pantallas usan las mismas etiquetas, también en el envío, el onboarding y la ayuda.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getStatusConfig } from '../components/report/reportStatus';
import { STATE_LABEL } from '../components/panel/panelFormat';

const leer = (ruta) => readFileSync(resolve(__dirname, '..', ruta), 'utf8');

describe('REP-3001 · mismas etiquetas de estado en el panel y en la app del vecino', () => {
  it('UT-3001-E1: cada código de la base se lee igual en las dos pantallas', () => {
    ['RECIBIDO', 'EN_ANALISIS', 'DERIVADO', 'ESCALADO', 'EN_DISCREPANCIA', 'RESUELTO', 'DESESTIMADO', 'INFORMADO'].forEach((code) =>
      expect(getStatusConfig(code).label).toBe(STATE_LABEL[code])
    );
    expect(getStatusConfig('RECIBIDO').label).toBe('Recibido');
    expect(getStatusConfig('EN_ANALISIS').label).toBe('En análisis');
    // La lista usa la píldora corta: tampoco puede decir otra cosa que el panel («Notificado» quedó del UJ v3.3)
    expect(leer('components/report/StatusPill.jsx')).toMatch(/const SHORT_LABELS = \{\};/);
  });

  it('UT-3001-E2: el acuse de envío, el onboarding y la ayuda no usan las etiquetas viejas', () => {
    ['components/report/ReportSuccessScreen.jsx', 'pages/OnboardingPage.jsx', 'content/faqContent.js'].forEach((archivo) => {
      const codigo = leer(archivo).replace(/\/\/.*$|\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}/gm, '');
      expect(codigo, archivo).not.toMatch(/\bEnviado\b|En revisión|Notificado/);
    });
    expect(leer('components/report/ReportSuccessScreen.jsx')).toMatch(/label: 'Recibido'/);
    expect(leer('content/faqContent.js')).toMatch(/Recibido, En análisis, Derivado/);
  });
});
