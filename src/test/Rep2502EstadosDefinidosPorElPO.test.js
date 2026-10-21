/**
 * @file Rep2502EstadosDefinidosPorElPO.test.js
 * @description REP-2502 (H-2, respuesta del PO del 15/10/2026): los estados nuevos y la regla «la IA nunca resuelve ni
 * desestima». La lógica de la base se prueba contra un Postgres local (scripts/rep2502/prueba_local_estados_po.sql);
 * acá se fijan las reglas del PO en el contrato de la migración y el comportamiento de la app con los estados nuevos.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildTimeline,
  getStatusConfig,
  isClosedState,
  normalizeReportState,
} from '../components/report/reportStatus';

const sql = readFileSync(
  resolve(__dirname, '../../supabase/migrations/20261015140000_rep2502_estados_definidos_por_el_po.sql'),
  'utf8'
).replace(/\r\n/g, '\n');
const code = sql.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const persist = code.slice(code.indexOf('create or replace function public.persist_rag_analysis'), code.indexOf('with fixed as'));
const inserts = code.slice(code.indexOf('insert into public.report_state_transitions'), code.indexOf('on conflict (from_state_code, to_state_code, actor_type) do nothing;'));

describe('REP-2502 H-2 · estados y transiciones definidos por el PO', () => {
  it('UT-2502B-01: se agregan INFORMADO, ESCALADO y EN_DISCREPANCIA; INFORMADO cuenta como cerrado', () => {
    expect(code).toMatch(/\('INFORMADO', 'Informado', 'closed'\)/);
    expect(code).toMatch(/\('ESCALADO', [^)]*'open'\)/);
    expect(code).toMatch(/\('EN_DISCREPANCIA', [^)]*'open'\)/);
  });

  it('UT-2502B-02: se retiran las transiciones por inferencia de la IA (EN_ANALISIS a RESUELTO y a DESESTIMADO)', () => {
    expect(code).toMatch(/delete from public\.report_state_transitions[\s\S]*actor_type = 'sistema'[\s\S]*from_state_code = 'EN_ANALISIS'[\s\S]*to_state_code in \('RESUELTO', 'DESESTIMADO'\)/);
  });

  it('UT-2502B-03: RESUELTO y DESESTIMADO solo los pone un organismo, y solo desde DERIVADO, ESCALADO o EN_DISCREPANCIA', () => {
    const rows = [...inserts.matchAll(/\('([A-Z_]+)',\s+'([A-Z_]+)',\s+'(sistema|organismo)'/g)].map((m) => ({ from: m[1], to: m[2], actor: m[3] }));
    const toClosing = rows.filter((r) => ['RESUELTO', 'DESESTIMADO'].includes(r.to));
    expect(toClosing.length).toBeGreaterThan(0);
    expect(toClosing.every((r) => r.actor === 'organismo')).toBe(true);
    expect(toClosing.every((r) => ['DERIVADO', 'ESCALADO', 'EN_DISCREPANCIA'].includes(r.from))).toBe(true);
    // de DERIVADO se puede ir directo a RESUELTO o a DESESTIMADO (decisión del PO)
    expect(rows).toContainEqual({ from: 'DERIVADO', to: 'RESUELTO', actor: 'organismo' });
    expect(rows).toContainEqual({ from: 'DERIVADO', to: 'DESESTIMADO', actor: 'organismo' });
  });

  it('UT-2502B-04: el sistema solo pasa a INFORMADO y a DERIVADO (este último, con el envío confirmado)', () => {
    const rows = [...inserts.matchAll(/\('([A-Z_]+)',\s+'([A-Z_]+)',\s+'sistema',\s+'([A-Z_]+)'/g)].map((m) => `${m[1]}>${m[2]}:${m[3]}`);
    expect(rows).toEqual(['EN_ANALISIS>INFORMADO:CIERRE_AUTOMATICO_ASISTENCIA', 'EN_ANALISIS>DERIVADO:ENTREGA_CONFIRMADA']);
  });

  it('UT-2502B-05: lo que el PO definió lleva su firma; lo que no definió queda marcado como propuesta', () => {
    const po = inserts.match(/Hernán Gregorini \(PO, REP-2502 H-2\)/g) ?? [];
    const proposed = inserts.match(/propuesta, pendiente de confirmar por el PO/g) ?? [];
    expect(po.length).toBe(6);
    expect(proposed.length).toBe(6);
    // las salidas de ESCALADO y EN_DISCREPANCIA son las que el PO no definió
    expect(inserts).toMatch(/'ESCALADO', 'RESUELTO'[\s\S]*propuesta, pendiente/);
  });
});

describe('REP-2502 H-2 · el cierre automático del RAG', () => {
  it('UT-2502B-06: la IA nunca asigna RESUELTO ni DESESTIMADO', () => {
    expect(persist).not.toMatch(/'RESUELTO'/);
    expect(persist).not.toMatch(/'DESESTIMADO'/);
  });

  it('UT-2502B-07: «asistencia» y toda vulnerabilidad social pasan a INFORMADO', () => {
    expect(persist).toMatch(/when v_result = 'asistencia' then 'INFORMADO'/);
    expect(persist).toMatch(/s\.service_code = 'VULNERABILIDAD_SOCIAL'\) then 'INFORMADO'/);
  });

  it('UT-2502B-08: solo cierra reportes que siguen EN_ANALISIS y deja el historial', () => {
    expect(persist).toMatch(/and current_state_code = 'EN_ANALISIS'/);
    expect(persist).toMatch(/insert into report_state_history \(report_id, state_code, notes\)/);
  });

  it('UT-2502B-09: conserva el resto del contrato de persist_rag_analysis (firma, idempotencia por reporte, evidencia)', () => {
    expect(persist).toMatch(/persist_rag_analysis\(p_analysis jsonb, p_evidence jsonb\)\s+returns uuid/);
    expect(persist).toMatch(/on conflict \(report_id\) do nothing/);
    expect(persist).toMatch(/insert into report_ai_evidence/);
  });
});

describe('REP-2502 H-2 · datos de prueba existentes', () => {
  it('UT-2502B-10: se corrigen solo los que no tienen actuación de un organismo y cada cambio deja su historial', () => {
    const fixes = code.slice(code.indexOf('with fixed as'));
    expect(fixes.match(/not exists \(select 1 from public\.report_state_history h where h\.report_id = r\.id and h\.actor_type = 'organismo'\)/g)).toHaveLength(2);
    expect(fixes).toMatch(/'CORRECCION_PO_H2'/);
    expect(fixes).toMatch(/current_state_code = 'RESUELTO'/);
    expect(fixes).toMatch(/current_state_code = 'DESESTIMADO'/);
  });

  it('UT-2502B-11: la migración no borra reportes ni historial', () => {
    expect(code).not.toMatch(/delete from public\.(citizen_reports|report_state_history)/);
    expect(code).not.toMatch(/\btruncate\b/i);
  });
});

describe('REP-2502 H-2 · la app muestra los estados nuevos', () => {
  it('UT-2502B-12: INFORMADO, ESCALADO y EN_DISCREPANCIA tienen etiqueta propia (no «Sin estado» ni el código crudo)', () => {
    expect(normalizeReportState('INFORMADO')).toBe('informado');
    expect(getStatusConfig('INFORMADO').label).toBe('Informado');
    expect(getStatusConfig('ESCALADO').label).toBe('Escalado a otro organismo');
    expect(getStatusConfig('EN_DISCREPANCIA').label).toBe('En discrepancia');
  });

  it('UT-2502B-13: INFORMADO es un estado cerrado; ESCALADO y EN_DISCREPANCIA no', () => {
    expect(isClosedState('INFORMADO')).toBe(true);
    expect(isClosedState('ESCALADO')).toBe(false);
    expect(isClosedState('EN_DISCREPANCIA')).toBe(false);
    expect(isClosedState('RESUELTO')).toBe(true);
  });

  it('UT-2502B-14: un reporte INFORMADO no figura como «Resuelto» ni como «Notificado» en su recorrido', () => {
    const steps = buildTimeline({
      currentState: 'INFORMADO',
      createdAt: '2026-10-15T10:00:00Z',
      history: [
        { state_code: 'RECIBIDO', changed_at: '2026-10-15T10:00:00Z' },
        { state_code: 'EN_ANALISIS', changed_at: '2026-10-15T10:01:00Z' },
        { state_code: 'INFORMADO', changed_at: '2026-10-15T10:02:00Z', notes: 'Se informó al vecino el canal que corresponde.' },
      ],
    });
    // REP-3841: el recorrido de asistencia social es Enviado → Informado; ni siquiera muestra los pasos de derivación
    expect(steps.map((s) => s.key)).toEqual(['enviado', 'informado']);
    expect(steps.at(-1)).toMatchObject({ key: 'informado', label: 'Informado', done: true, current: true });
    expect(steps.filter((s) => s.current)).toHaveLength(1);
  });

  it('UT-2502B-15: un reporte ESCALADO muestra el recorrido hasta «Notificado» y el paso extra', () => {
    const steps = buildTimeline({
      currentState: 'ESCALADO',
      createdAt: '2026-10-15T10:00:00Z',
      history: [{ state_code: 'RECIBIDO' }, { state_code: 'EN_ANALISIS' }, { state_code: 'DERIVADO' }, { state_code: 'ESCALADO' }],
    });
    const byKey = Object.fromEntries(steps.map((s) => [s.key, s]));
    expect(byKey.notificado.done).toBe(true);
    expect(byKey.resuelto.done).toBe(false);
    expect(steps.at(-1).key).toBe('escalado');
  });

  it('UT-2502B-16: los estados de siempre se comportan igual (sin regresión)', () => {
    const steps = buildTimeline({ currentState: 'DERIVADO', createdAt: '2026-10-15T10:00:00Z', history: [] });
    expect(steps.map((s) => s.key)).toEqual(['enviado', 'en_revision', 'notificado', 'resuelto']);
    expect(steps.find((s) => s.current).key).toBe('notificado');
    const discarded = buildTimeline({ currentState: 'DESESTIMADO', createdAt: '2026-10-15T10:00:00Z', history: [{ state_code: 'EN_ANALISIS' }] });
    expect(discarded.at(-1)).toMatchObject({ key: 'descartado', discarded: true });
  });
});
