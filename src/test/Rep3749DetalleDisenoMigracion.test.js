/**
 * @file Rep3749DetalleDisenoMigracion.test.js
 * @description REP-3749: el detalle suma el tipo de vía y, en el historial, el organismo solo en acciones de un
 * organismo. Misma regla de atención y misma proyección: nunca el operador ni la identidad del vecino.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATIONS_DIR = resolve(__dirname, '../../supabase/migrations');
const archivo = readdirSync(MIGRATIONS_DIR).find((f) => f.includes('rep3749_detalle_diseno'));
const codigo = (archivo ? readFileSync(resolve(MIGRATIONS_DIR, archivo), 'utf8') : '').replace(/--.*$/gm, '');
const fn = codigo.slice(codigo.indexOf('create or replace function public.get_panel_report_detail('), codigo.indexOf('$$;') + 3);

describe('REP-3749 · detalle con el diseño (migración)', () => {
  it('UT-3749-M7: el organismo aparece solo en acciones de un organismo; nunca el operador', () => {
    expect(archivo).toBeTruthy();
    expect(fn).toMatch(/profile_attends_report\(auth\.uid\(\), p_report_id\)/);
    expect(fn).toMatch(/'agency',\s+case when h\.actor_type = 'organismo' then ha\.name end/);
    for (const c of ["'actor_type'", "'address_road_type'", "'actions'", "'taken'"]) expect(fn).toContain(c);
    expect(fn).not.toMatch(/'changed_by'|user_id|client_side_id/);
    expect(fn).toMatch(/public\.redact_contact_info\(r\.description\)/);
  });
});
