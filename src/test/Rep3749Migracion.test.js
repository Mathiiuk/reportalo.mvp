/**
 * @file Rep3749Migracion.test.js
 * @description REP-3749: contrato de la migración del detalle para el operador. La RPC es la frontera de privacidad:
 * filtra por la regla de atención, redacta la descripción y no proyecta identidad. Se verificó en staging con
 * sesiones simuladas y ROLLBACK.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATIONS_DIR = resolve(__dirname, '../../supabase/migrations');
const archivo = readdirSync(MIGRATIONS_DIR).find((f) => f.includes('rep3749_detalle_reporte_operador'));
const codigo = (archivo ? readFileSync(resolve(MIGRATIONS_DIR, archivo), 'utf8') : '').replace(/--.*$/gm, '');

const funcion = (nombre) => {
  const desde = codigo.indexOf(`create or replace function public.${nombre}`);
  const alt = desde === -1 ? codigo.indexOf(`create function public.${nombre}`) : desde;
  return alt === -1 ? '' : codigo.slice(alt, codigo.indexOf('$$;', alt) + 3);
};

describe('REP-3749 · detalle del reporte para el operador (migración)', () => {
  it('UT-3749-M1: número de caso correlativo, único y generado por la base', () => {
    expect(archivo).toBeTruthy();
    expect(codigo).toMatch(/add column if not exists case_number\s+bigint generated always as identity/i);
    expect(codigo).toMatch(/unique \(case_number\)|create unique index[^;]*case_number/i);
  });

  it('UT-3749-M2: la bandeja suma el número de caso, con la misma regla de atención', () => {
    const fn = funcion('get_panel_inbox');
    expect(fn).toMatch(/case_number/);
    expect(fn).toMatch(/profile_attends_report\(auth\.uid\(\), r\.id\)/);
    expect(fn).toMatch(/security definer/i);
  });

  it('UT-3749-M3: el detalle es DEFINER, solo para quien atiende el reporte, y null para el resto', () => {
    const fn = funcion('get_panel_report_detail');
    expect(fn).toMatch(/security definer/i);
    expect(fn).toMatch(/profile_attends_report\(auth\.uid\(\), p_report_id\)/);
    expect(fn).toMatch(/return null/i);
  });

  it('UT-3749-M4: la descripción sale redactada y nunca sale la identidad del vecino', () => {
    const fn = funcion('get_panel_report_detail');
    expect(fn).toMatch(/public\.redact_contact_info\(r\.description\)/);
    expect(fn).not.toMatch(/'description',\s*r\.description/);
    expect(fn).not.toMatch(/user_id|client_side_id/);
  });

  it('UT-3749-M5: suma calle, altura, coordenadas, fotos y el tipo de cada cita del fundamento', () => {
    const fn = funcion('get_panel_report_detail');
    for (const campo of ["'address_street'", "'address_number'", "'latitud'", "'longitud'", "'images'", "'foundation_type'"]) {
      expect(fn).toContain(campo);
    }
    expect(fn).toMatch(/get_report_legal_foundation\(p_report_id\)/);
  });

  it('UT-3749-M6: sin acceso para anon', () => {
    expect(codigo).toMatch(/revoke execute on function public\.get_panel_report_detail\(uuid\) from public, anon/i);
    expect(codigo).toMatch(/grant\s+execute on function public\.get_panel_report_detail\(uuid\) to authenticated/i);
    expect(codigo).toMatch(/revoke execute on function public\.get_panel_inbox\(\) from public, anon/i);
  });
});
