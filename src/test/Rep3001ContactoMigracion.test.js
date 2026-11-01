/**
 * @file Rep3001ContactoMigracion.test.js
 * @description REP-3001: contacto opcional del destino del escalado, con columna propia (decisión 3A). Mismas
 * validaciones que antes; el detalle lo muestra en el historial.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATIONS_DIR = resolve(__dirname, '../../supabase/migrations');
const archivo = readdirSync(MIGRATIONS_DIR).find((f) => f.includes('rep3001_contacto_escalado'));
const codigo = (archivo ? readFileSync(resolve(MIGRATIONS_DIR, archivo), 'utf8') : '').replace(/--.*$/gm, '');
const funcion = (nombre) => {
  const desde = codigo.indexOf(`create or replace function public.${nombre}(`);
  return desde === -1 ? '' : codigo.slice(desde, codigo.indexOf('$$;', desde) + 3);
};

describe('REP-3001 · contacto del escalado (migración)', () => {
  it('UT-3001-M9: columna propia y change_report_state con contacto opcional, solo en ESCALADO', () => {
    expect(archivo).toBeTruthy();
    expect(codigo).toMatch(/alter table public\.report_state_history add column if not exists escalated_contact text/i);
    const fn = funcion('change_report_state');
    expect(fn).toMatch(/p_escalated_contact text default null/i);
    expect(fn).toMatch(/case when p_to_state = 'ESCALADO' then v_contact end/);
    for (const c of ["'sin_permiso'", "'motivo_requerido'", "'destino_requerido'", "'transicion_no_definida'"]) expect(fn).toContain(c);
    expect(codigo).toMatch(/drop function if exists public\.change_report_state\(uuid, text, text, text\)/i);
  });

  it('UT-3001-M10: el detalle muestra el contacto; sin acceso para anon', () => {
    expect(funcion('get_panel_report_detail')).toContain("'escalated_contact'");
    expect(codigo).toMatch(/revoke execute on function public\.change_report_state\(uuid, text, text, text, text\) from public, anon/i);
    expect(codigo).toMatch(/grant\s+execute on function public\.change_report_state\(uuid, text, text, text, text\) to authenticated, service_role/i);
  });
});
