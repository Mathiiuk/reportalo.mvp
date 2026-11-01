/**
 * @file Rep3747AccesoPanel.test.js
 * @description REP-3747: acceso al panel como operador de un organismo de prueba. Fija el contrato de la migración:
 * organismos marcados como prueba (reglas v1.0 §2, Hernán D9), regla de atención versionada con el alcance de la regla
 * (CABA = toda la Ciudad), y la descripción cruda cerrada para el operador (AC-05 de REP-3874) sin que pierda fotos
 * ni fundamento. El comportamiento se verificó en staging con sesiones simuladas y ROLLBACK.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATIONS_DIR = resolve(__dirname, '../../supabase/migrations');
const archivo = readdirSync(MIGRATIONS_DIR).find((f) => f.includes('rep3747_acceso_panel_operador'));
const sql = archivo ? readFileSync(resolve(MIGRATIONS_DIR, archivo), 'utf8') : '';
// Solo el código: los comentarios explican, no cambian nada
const codigo = sql.replace(/--.*$/gm, '');

// Cuerpo de una sentencia que empieza con `inicio`, hasta el `$$;` o `;` que la cierra
const bloque = (inicio, fin = '$$;') => {
  const desde = codigo.indexOf(inicio);
  return desde === -1 ? '' : codigo.slice(desde, codigo.indexOf(fin, desde) + fin.length);
};

describe('REP-3747 · acceso al panel del operador (migración)', () => {
  it('UT-3747-01: existe la migración versionada', () => {
    expect(archivo).toBeTruthy();
  });

  it('UT-3747-02: agencies gana marca de prueba, clave interna y alcance de jurisdicción', () => {
    expect(codigo).toMatch(/add column if not exists is_test\s+boolean not null default false/i);
    expect(codigo).toMatch(/add column if not exists code\s+text/i);
    expect(codigo).toMatch(/add column if not exists jurisdiction_level\s+text not null default 'subdivision'/i);
    expect(codigo).toMatch(/jurisdiction_level in \('subdivision', 'state_province'\)/i);
  });

  it('UT-3747-03: renombra las dos filas de prueba con su clave y alcance (regla §2)', () => {
    expect(codigo).toContain("'Reportalo CABA (organismo de prueba)'");
    expect(codigo).toContain("'reportalo_caba'");
    expect(codigo).toContain("'Reportalo Avellaneda (organismo de prueba)'");
    expect(codigo).toContain("'reportalo_avellaneda'");
    // CABA atiende toda la Ciudad; Avellaneda, su subdivisión
    expect(codigo).toMatch(/'reportalo_caba'[\s\S]{0,200}'state_province'/);
    // Se ubican por el nombre del seed v04, sin ids generados
    expect(codigo).toContain("'Dirección General de Fiscalización — Comuna 1'");
    expect(codigo).toContain("'Secretaría de Servicios Públicos — Avellaneda'");
    expect(codigo).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });

  it('UT-3747-04: profile_attends_report queda versionada, SECURITY DEFINER, y compara por provincia o subdivisión', () => {
    const fn = bloque('create or replace function public.profile_attends_report');
    expect(fn).toMatch(/security definer/i);
    expect(fn).toMatch(/set search_path = public/i);
    expect(fn).toMatch(/jurisdiction_level = 'state_province'/);
    expect(fn).toMatch(/state_province_id/);
    expect(fn).toMatch(/l\.subdivision_id = a\.subdivision_id/);
    expect(codigo).toMatch(/revoke execute on function public\.profile_attends_report\(uuid, uuid\) from public, anon/i);
  });

  it('UT-3747-05: citizen_reports se lee solo por el dueño (el operador ya no recibe la descripción cruda)', () => {
    const policy = bloque('create policy "read own report"', ';');
    expect(policy).toMatch(/on public\.citizen_reports for select/i);
    expect(policy).toMatch(/user_id = \(select auth\.uid\(\)\)/i);
    expect(policy).not.toMatch(/profile_attends_report/);
    expect(codigo).toMatch(/drop policy if exists "read own or attended report" on public\.citizen_reports/i);
  });

  it('UT-3747-06: las fotos se leen por una función DEFINER (dueño o quien atiende), sin anon', () => {
    const fn = bloque('create or replace function public.can_read_report_folder');
    expect(fn).toMatch(/security definer/i);
    expect(fn).toMatch(/r\.user_id = auth\.uid\(\)/);
    expect(fn).toMatch(/profile_attends_report\(auth\.uid\(\), r\.id\)/);
    expect(codigo).toMatch(/revoke execute on function public\.can_read_report_folder\(text\) from public, anon/i);
    const policy = bloque('create policy "Lectura de evidencias propias o atendidas"', ';');
    expect(policy).toMatch(/bucket_id = 'report-evidences'/);
    expect(policy).toMatch(/public\.can_read_report_folder\(\(storage\.foldername\(name\)\)\[1\]\)/);
  });

  it('UT-3747-07: el fundamento pasa a SECURITY DEFINER (su control de acceso ya cubre dueño, atención y servidor)', () => {
    expect(codigo).toMatch(/alter function public\.get_report_legal_foundation\(uuid\) security definer/i);
  });
});
