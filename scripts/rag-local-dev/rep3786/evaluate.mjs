// REP-3786 · Rúbrica de evaluación de cada corrida (pre-registrada: se commitea ANTES de correr).
// Reglas de docs/REP-3764_casos_esperados.md y del protocolo .agents/workflow/specs/REP-3786.md §4.

const LOM = 'Ley Orgánica de las Municipalidades';
const CONST_PBA = 'Constitución de la Provincia de Buenos Aires';

// role: 'decide' entra en la regla R1; 'info' se mide pero no decide.
// allowed: subcadenas de hierarchy_path de las citas admitidas. anyCiteIsWrong: cualquier cita es incorrecta.
export const RULES = {
  A: { role: 'decide', ok: ['fundamentado'], needCite: true, allowed: [`${LOM} > Artículo 52`, `${LOM} > Artículo 59`, `${CONST_PBA} > Artículo 192`] },
  B: { role: 'decide', ok: ['fundamentado'], needCite: true, allowed: ['Ley 2148 (CABA)', 'Ley 451 (CABA)'] },
  C: { role: 'decide', ok: ['fundamentado'], needCite: true, allowed: ['Ley 24.449'] },
  'D-Av': { role: 'decide', ok: ['fundamentado'], needCite: true, allowed: [`${LOM} > Artículo 52`, `${LOM} > Artículo 59`] },
  'D-CABA': { role: 'decide', ok: ['fundamentado', 'asistencia'], needCite: false, allowed: ['Ley 210 (CABA)'] },
  E: { role: 'decide', ok: ['fundamentado'], needCite: true, allowed: ['Ley 24.449 — Ley de Tránsito > Artículo 48'] },
  F: { role: 'decide', ok: ['sin_normativa'], needCite: false, allowed: [], anyCiteIsWrong: true },
  'E-sin-categoria': { role: 'info', ok: ['fundamentado'], needCite: true, allowed: ['Ley 24.449'] },
  Prueba1: { role: 'info', ok: ['sin_normativa', 'indeterminado'], needCite: false, allowed: [], anyCiteIsWrong: true },
  Prueba2: { role: 'info', ok: ['sin_normativa', 'indeterminado'], needCite: false, allowed: [], anyCiteIsWrong: true },
};

/**
 * @param {string} caseName
 * @param {{ estado: string, citedPaths: string[], technicalFailure: string|null }} run
 * technicalFailure: null | 'truncado' | 'json_invalido' | 'error_api' | 'validacion' (una cita no literal que el validador bloqueó)
 */
export const evaluateRun = (caseName, run) => {
  const rule = RULES[caseName];
  if (!rule) throw new Error(`Caso sin regla: ${caseName}`);
  const cited = run.citedPaths ?? [];

  const stateOk = rule.ok.includes(run.estado);
  const wrongCitation = rule.anyCiteIsWrong
    ? cited.length > 0
    : cited.some((p) => !rule.allowed.some((a) => p.includes(a)));
  const citeOk = !rule.needCite || cited.length > 0;
  // Un fallo técnico nunca cuenta como acierto, aunque el estado «indeterminado» sea el esperado
  const technicalOk = run.technicalFailure === null;

  return {
    role: rule.role,
    correct: stateOk && !wrongCitation && citeOk && technicalOk,
    wrongCitation,
    // Falso positivo: se declara fundamentado donde lo correcto era abstenerse
    falsePositive: run.estado === 'fundamentado' && !rule.ok.includes('fundamentado'),
    // Caso positivo que pasa a abstención: lo correcto era fundamentar y se abstuvo
    lostToAbstention:
      rule.ok.includes('fundamentado') && ['sin_normativa', 'indeterminado'].includes(run.estado) && technicalOk,
    technicalFailure: run.technicalFailure,
  };
};

// Concisión (solo para las configuraciones «+»)
export const countWords = (text) => (text ? text.trim().split(/\s+/).filter(Boolean).length : 0);
export const countSentences = (text) => (text ? (text.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [text]).length : 0);
