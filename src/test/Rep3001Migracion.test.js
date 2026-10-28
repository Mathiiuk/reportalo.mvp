/**
 * @file Rep3001Migracion.test.js
 * @description REP-3001: contrato de la migración de las acciones del operador. La base es la que decide: tomar es un
 * evento (el estado sigue Derivado), rechazar y resolver pasan por change_report_state con motivo, y el escalado exige
 * a quién. Se verificó en staging con sesiones simuladas y ROLLBACK.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATIONS_DIR = resolve(__dirname, '../../supabase/migrations');
const archivo = readdirSync(MIGRATIONS_DIR).find((f) => f.includes('rep3001_acciones_del_operador'));
const codigo = (archivo ? readFileSync(resolve(MIGRATIONS_DIR, archivo), 'utf8') : '').replace(/--.*$/gm, '');

const funcion = (nombre) => {
  const desde = codigo.indexOf(`create or replace function public.${nombre}(`);
  const alt = desde === -1 ? codigo.indexOf(`create function public.${nombre}(`) : desde;
  return alt === -1 ? '' : codigo.slice(alt, codigo.indexOf('$$;', alt) + 3);
};

describe('REP-3001 · acciones del operador (migración)', () => {
  it('UT-3001-M1: «tomar» es un evento nuevo, sin duplicados por doble clic', () => {
    expect(archivo).toBeTruthy();
    expect(codigo).toMatch(/insert into public\.report_event_types[^;]*'TOMADO_POR_ORGANISMO'/is);
    expect(codigo).toMatch(
      /create unique index if not exists report_events_taken_uq\s+on public\.report_events \(report_id, actor_agency_id\)\s+where event_type_code = 'TOMADO_POR_ORGANISMO'/i
    );
  });

  it('UT-3001-M2: take_report exige la regla de atención, solo toma un Derivado y no cambia el estado', () => {
    const fn = funcion('take_report');
    expect(fn).toMatch(/security definer/i);
    expect(fn).toMatch(/profile_attends_report\(v_uid, p_report_id\)/);
    expect(fn).toMatch(/'sin_permiso'/);
    expect(fn).toMatch(/<> 'DERIVADO'/);
    expect(fn).toMatch(/on conflict[^;]*do nothing/is);
    expect(fn).not.toMatch(/update public\.citizen_reports/i);
  });

  it('UT-3001-M3: el catálogo quita Escalado → En discrepancia y aprueba los otros 5 caminos (Hernán, 24/10)', () => {
    expect(codigo).toMatch(
      /delete from public\.report_state_transitions\s+where from_state_code = 'ESCALADO' and to_state_code = 'EN_DISCREPANCIA'/i
    );
    expect(codigo).toMatch(/update public\.report_state_transitions\s+set approved_by = 'Hernán Gregorini \(PO, REP-3876/i);
    expect(codigo).toMatch(/from_state_code in \('ESCALADO', 'EN_DISCREPANCIA'\)/);
  });

  it('UT-3001-M4: el escalado guarda a quién y change_report_state lo exige al organismo', () => {
    expect(codigo).toMatch(/alter table public\.report_state_history add column if not exists escalated_to text/i);
    const fn = funcion('change_report_state');
    expect(fn).toMatch(/p_escalated_to text default null/i);
    expect(fn).toMatch(/'destino_requerido'/);
    expect(fn).toMatch(/'motivo_requerido'/);
    expect(fn).toMatch(/'transicion_no_definida'/);
    expect(fn).toMatch(/for update/i);
    expect(codigo).toMatch(/drop function if exists public\.change_report_state\(uuid, text, text\)/i);
  });

  it('UT-3001-M5: el operador y el vecino leen la misma etiqueta de estado (§4 y §6)', () => {
    expect(codigo).toMatch(/update public\.report_states set description = 'Derivado' where code = 'DERIVADO'/);
    expect(codigo).toMatch(/update public\.report_states set description = 'Escalado' where code = 'ESCALADO'/);
  });

  it('UT-3001-M6: el detalle suma acciones posibles, «tomado» e historial, con la misma regla de atención', () => {
    const fn = funcion('get_panel_report_detail');
    expect(fn).toMatch(/profile_attends_report\(auth\.uid\(\), p_report_id\)/);
    for (const campo of ["'actions'", "'taken'", "'history'", "'escalated_to'"]) expect(fn).toContain(campo);
    expect(fn).toMatch(/actor_type = 'organismo'/);
    expect(fn).not.toMatch(/user_id|client_side_id/);
  });

  it('UT-3001-M7: índices para leer el historial y los eventos por reporte', () => {
    expect(codigo).toMatch(/on public\.report_state_history \(report_id, changed_at desc\)/i);
    expect(codigo).toMatch(/on public\.report_events \(report_id, occurred_at desc\)/i);
  });

  it('UT-3001-M8: sin acceso para anon', () => {
    expect(codigo).toMatch(/revoke execute on function public\.take_report\(uuid\) from public, anon/i);
    expect(codigo).toMatch(/grant\s+execute on function public\.take_report\(uuid\) to authenticated/i);
    expect(codigo).toMatch(/revoke execute on function public\.change_report_state\(uuid, text, text, text\) from public, anon/i);
    expect(codigo).toMatch(/grant\s+execute on function public\.change_report_state\(uuid, text, text, text\) to authenticated, service_role/i);
  });
});
