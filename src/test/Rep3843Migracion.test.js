/**
 * @file Rep3843Migracion.test.js
 * @description REP-3843: contrato de la migración de dirección aproximada. La altura nunca entra en la vista pública
 * (REP-3876 §8), route_report usa el tipo de vía guardado (R-4) y el borrador institucional suma la dirección o su
 * ausencia. Comportamiento verificado en staging con ROLLBACK y sesiones simuladas.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATIONS_DIR = resolve(__dirname, '../../supabase/migrations');
const archivo = readdirSync(MIGRATIONS_DIR).find((f) => f.includes('rep3843_direccion_aproximada'));
const codigo = (archivo ? readFileSync(resolve(MIGRATIONS_DIR, archivo), 'utf8') : '').replace(/--.*$/gm, '');
const vista = codigo.match(/create or replace view public\.public_citizen_reports[\s\S]*?;/i)?.[0] ?? '';

describe('REP-3843 · dirección aproximada (migración)', () => {
  it('UT-3843-M1: columnas de dirección con valores controlados', () => {
    expect(archivo).toBeTruthy();
    for (const col of ['address_street', 'address_number', 'address_road_type', 'address_source']) {
      expect(codigo).toMatch(new RegExp(`add column if not exists ${col}\\s+text`, 'i'));
    }
    expect(codigo).toMatch(/address_road_type in \('avenida', 'secundaria'\)/);
    expect(codigo).toMatch(/address_source in \('sugerida', 'corregida'\)/);
    expect(codigo).toContain("'^\\d{1,5}[A-Za-z]?$'");
  });

  it('UT-3843-M2: la vista pública suma la calle, nunca la altura, y conserva la redacción de REP-3874', () => {
    expect(vista).toMatch(/r\.address_street/);
    expect(vista).not.toMatch(/address_number/);
    expect(vista).toMatch(/public\.redact_contact_info\(r\.description\) as description/i);
    expect(vista).not.toMatch(/user_id|client_side_id/);
    expect(codigo).toMatch(/grant select on public\.public_citizen_reports to authenticated/i);
  });

  it('UT-3843-M3: route_report usa el tipo de vía guardado cuando no le pasan uno (R-4)', () => {
    const fn = codigo.slice(codigo.indexOf('create or replace function public.route_report'));
    expect(fn).toMatch(/v_via\s+text/);
    expect(fn).toMatch(/coalesce\(nullif\(lower\(btrim\(coalesce\(p_tipo_via, ''\)\)\), ''\), v_report\.address_road_type\)/);
    expect(fn).toMatch(/resolve_report_destination\(v_report\.locality_id, v_prest, coalesce\(p_urgente, false\), v_via\)/);
  });

  it('UT-3843-M4: el borrador suma la dirección o «Dirección no disponible», parcheando la definición vigente', () => {
    expect(codigo).toMatch(/pg_get_functiondef\('public\.prepare_organism_delivery\(uuid,text,boolean,text\)'::regprocedure\)/);
    expect(codigo).toContain("'direccion'");
    expect(codigo).toContain('Dirección aproximada: ');
    expect(codigo).toContain('Dirección no disponible');
    // Si algún fragmento no aparece exactamente una vez, la migración falla en vez de aplicar a medias
    expect(codigo).toMatch(/raise exception/i);
  });

  it('UT-3843-M5: no reescribe datos de reportes', () => {
    expect(codigo).not.toMatch(/update public\.citizen_reports|delete from|truncate/i);
  });
});
