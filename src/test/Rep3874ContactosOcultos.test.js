/**
 * @file Rep3874ContactosOcultos.test.js
 * @description REP-3874 (O-01 de la QA REP-3854): la vista public_citizen_reports entregaba la descripción cruda, con
 * correos y teléfonos que el autor escribió por error. La migración agrega redact_contact_info() y la vista pasa a
 * proyectar la descripción redactada. El comportamiento de la función se verificó en staging (función temporal y
 * ROLLBACK, 25/10/2026); acá se fija el contrato de la migración para que nadie lo afloje sin darse cuenta.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATIONS_DIR = resolve(__dirname, '../../supabase/migrations');
const archivo = readdirSync(MIGRATIONS_DIR).find((f) => f.includes('rep3874'));
const sql = archivo ? readFileSync(resolve(MIGRATIONS_DIR, archivo), 'utf8') : '';

// Cuerpo de la vista: desde el create hasta el primer punto y coma
const vista = sql.match(/create or replace view public\.public_citizen_reports[\s\S]*?;/i)?.[0] ?? '';

describe('REP-3874 · contactos ocultos en la descripción pública', () => {
  it('UT-3874-01: existe una migración versionada para REP-3874', () => {
    expect(archivo).toBeTruthy();
  });

  it('UT-3874-02: la función de redacción es inmutable, con search_path fijo, y oculta correos y teléfonos', () => {
    expect(sql).toMatch(/create or replace function public\.redact_contact_info\(p_text text\)/i);
    expect(sql).toMatch(/immutable/i);
    expect(sql).toMatch(/set search_path = pg_catalog/i);
    expect(sql).toContain('[correo oculto]');
    expect(sql).toContain('[teléfono oculto]');
  });

  it('UT-3874-03: no oculta fechas ni coordenadas, y exige 8 a 13 dígitos para tomar algo como teléfono', () => {
    expect(sql).toMatch(/between 8 and 13/);
    expect(sql).toContain("'^\\d{1,3}\\.\\d{4,}$'");
    expect(sql).toContain("'^\\d{1,2}[-/.]\\d{1,2}[-/.]\\d{2,4}$'");
  });

  it('UT-3874-04: la vista entrega la descripción redactada y nunca la cruda', () => {
    expect(vista).toMatch(/public\.redact_contact_info\(r\.description\)\s+as\s+description/i);
    expect(vista).not.toMatch(/^\s*r\.description,\s*$/m);
  });

  it('UT-3874-05: la vista conserva las 9 columnas de REP-3849, en el mismo orden, sin user_id ni client_side_id', () => {
    const columnas = ['r.id', 'r.service_id', 'r.locality_id', 'description', 'r.current_state_code', 'r.latitud', 'r.longitud', 'r.created_at', 'r.updated_at'];
    let desde = 0;
    for (const col of columnas) {
      const pos = vista.indexOf(col, desde);
      expect(pos, `falta o está fuera de orden: ${col}`).toBeGreaterThan(-1);
      desde = pos + col.length;
    }
    expect(vista).not.toMatch(/user_id|client_side_id/);
    expect(vista).toMatch(/security_barrier = true/i);
  });

  it('UT-3874-06: solo usuarios con sesión leen la vista; anon no', () => {
    expect(sql).toMatch(/revoke all on public\.public_citizen_reports from public, anon, authenticated/i);
    expect(sql).toMatch(/grant select on public\.public_citizen_reports to authenticated/i);
    expect(sql).not.toMatch(/grant select on public\.public_citizen_reports to anon/i);
  });

  it('UT-3874-07: no toca el dato original ni las policies de citizen_reports', () => {
    // Solo el código: los comentarios de la migración explican la policy, no la cambian
    const codigo = sql.replace(/--.*$/gm, '');
    expect(codigo).not.toMatch(/update\s+public\.citizen_reports/i);
    expect(codigo).not.toMatch(/policy[^;]*citizen_reports/i);
  });
});
