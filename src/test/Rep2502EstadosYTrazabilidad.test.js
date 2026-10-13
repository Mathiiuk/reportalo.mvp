/**
 * @file Rep2502EstadosYTrazabilidad.test.js
 * @description REP-2502: contrato de la migración de estados y trazabilidad del reporte. La lógica se prueba contra un
 * Postgres local con scripts/rep2502/prueba_local_estados.sql (50 aserciones); acá se fijan las garantías que no
 * deben perderse y las reglas que NO se pueden inventar sin el PO.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sql = readFileSync(
  resolve(__dirname, '../../supabase/migrations/20261013160000_rep2502_estados_y_trazabilidad_del_reporte.sql'),
  'utf8'
).replace(/\r\n/g, '\n');
const code = sql.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const fn = code.slice(code.indexOf('create or replace function public.change_report_state'), code.indexOf('revoke all on function public.change_report_state'));

describe('REP-2502 · la migración es aditiva y no toca el RAG', () => {
  it('UT-2502-01: sin DROP de tablas ni DELETE/TRUNCATE de datos', () => {
    expect(code).not.toMatch(/\bdrop table\b/i);
    expect(code).not.toMatch(/\bdelete from\b/i);
    expect(code).not.toMatch(/\btruncate\b/i);
    expect(code).not.toMatch(/\balter table [^;]*\bdrop column\b/i);
  });

  it('UT-2502-02: no redefine enqueue_rag_analysis ni persist_rag_analysis (el cierre automático del RAG sigue igual)', () => {
    expect(code).not.toMatch(/function public\.enqueue_rag_analysis/);
    expect(code).not.toMatch(/function public\.persist_rag_analysis/);
  });

  it('UT-2502-03: no agrega una fila «RECIBIDO» al historial (generaría una notificación por cada reporte nuevo)', () => {
    expect(code).not.toMatch(/insert into public\.report_state_history[^;]*'RECIBIDO'/);
  });
});

describe('REP-2502 · no se inventan reglas de negocio', () => {
  const seed = code.slice(code.indexOf('insert into public.report_state_transitions'), code.indexOf('on conflict (from_state_code, to_state_code, actor_type) do nothing;'));

  it('UT-2502-04: la matriz se siembra solo con las 3 transiciones que el sistema ya hace', () => {
    const rows = seed.match(/\('[A-Z_]+',\s+'[A-Z_]+',\s+'(sistema|organismo)'/g) ?? [];
    expect(rows).toHaveLength(3);
    expect(seed).toMatch(/'RECIBIDO',\s+'EN_ANALISIS',\s+'sistema'/);
    expect(seed).toMatch(/'EN_ANALISIS', 'DESESTIMADO', 'sistema'/);
    expect(seed).toMatch(/'EN_ANALISIS', 'RESUELTO',\s+'sistema'/);
  });

  it('UT-2502-05: ninguna transición de un organismo está aprobada (la máquina de estados la confirma el PO)', () => {
    expect(seed).not.toMatch(/'organismo'/);
  });

  it('UT-2502-06: deja marcado que «resuelto» por asistencia está pendiente de revisión del PO', () => {
    expect(seed).toMatch(/PENDIENTE de revisión del PO/);
  });
});

describe('REP-2502 · change_report_state', () => {
  it('UT-2502-07: el actor se deduce de la sesión; no hay parámetro para elegirlo', () => {
    expect(fn).toMatch(/create or replace function public\.change_report_state\(p_report_id uuid, p_to_state text, p_reason text default null\)/);
    expect(fn).not.toMatch(/p_actor/);
    expect(fn).toMatch(/auth\.role\(\), ''\) = 'service_role'/);
    expect(fn).toMatch(/profile_attends_report\(v_uid, p_report_id\)/);
  });

  it('UT-2502-08: solo el sistema y un organismo que atiende el reporte pueden cambiar el estado; la autora, no', () => {
    expect(fn).toMatch(/if v_actor not in \('sistema', 'organismo'\) then\s+v_code := 'sin_permiso';/);
    expect(fn).toMatch(/v_report\.user_id = v_uid then\s+v_actor := 'ciudadano'/);
  });

  it('UT-2502-09: rechaza con evidencia y SIN lanzar una excepción (que desharía la evidencia)', () => {
    expect(fn).not.toMatch(/raise exception/i);
    expect(fn).toMatch(/insert into public\.report_state_change_rejections/);
    expect(fn).toMatch(/jsonb_build_object\('ok', false/);
  });

  it('UT-2502-10: valida estado inexistente, mismo estado, transición no definida y motivo obligatorio del organismo', () => {
    for (const reason of ['estado_inexistente', 'mismo_estado', 'transicion_no_definida', 'motivo_requerido', 'reporte_inexistente']) {
      expect(fn).toContain(`'${reason}'`);
    }
    expect(fn).toMatch(/v_actor = 'organismo' and v_reason is null/);
  });

  it('UT-2502-11: bloquea el reporte y cambia estado e historial en la misma transacción, con estado anterior y evento', () => {
    expect(fn).toMatch(/for update/);
    expect(fn).toMatch(/update public\.citizen_reports\s+set current_state_code = p_to_state/);
    expect(fn).toMatch(/previous_state_code, changed_by, actor_agency_id, actor_type, event_code, notes, changed_at/);
  });

  it('UT-2502-12: no se ejecuta como anónimo; sí como autenticado y como servidor', () => {
    expect(code).toMatch(/revoke all on function public\.change_report_state\(uuid, text, text\) from public, anon;/);
    expect(code).toMatch(/grant execute on function public\.change_report_state\(uuid, text, text\) to authenticated, service_role;/);
  });
});

describe('REP-2502 · evidencia y permisos de las tablas nuevas', () => {
  it('UT-2502-13: los intentos rechazados no los lee ni el ciudadano ni quien atiende (solo servidor)', () => {
    expect(code).toMatch(/alter table public\.report_state_change_rejections enable row level security;/);
    expect(code).toMatch(/revoke all on table public\.report_state_change_rejections from public, anon, authenticated;/);
    expect(code).not.toMatch(/create policy[^;]*report_state_change_rejections/);
  });

  it('UT-2502-14: la matriz se puede leer pero no modificar desde la app', () => {
    expect(code).toMatch(/grant select on table public\.report_state_transitions to authenticated;/);
    expect(code).not.toMatch(/grant (insert|update|delete|all)[^;]*report_state_transitions to authenticated/);
  });

  it('UT-2502-15: el historial se completa solo en los registros nuevos y se rellenan los viejos deducibles', () => {
    expect(code).toMatch(/create trigger trg_report_state_history_fill\s+before insert on public\.report_state_history/);
    expect(code).toMatch(/lag\(h\.state_code\) over \(partition by h\.report_id order by h\.changed_at, h\.id\)/);
  });
});
