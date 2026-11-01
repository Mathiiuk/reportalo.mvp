/**
 * @file Rep3000BandejaMigracion.test.js
 * @description REP-3000: bandeja del organismo de prueba. Fija el contrato de la migración: elegibilidad en la regla
 * de atención (reglas v1.0 §3), entrega interna a DERIVADO (D-03 / Hernán D7) disparada al guardar el análisis RAG
 * sin poder romperlo, y la RPC de la bandeja sin datos privados. El comportamiento se verificó en staging con sesiones
 * simuladas y ROLLBACK.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATIONS_DIR = resolve(__dirname, '../../supabase/migrations');
const archivo = readdirSync(MIGRATIONS_DIR).find((f) => f.includes('rep3000_bandeja_organismo_prueba'));
const codigo = (archivo ? readFileSync(resolve(MIGRATIONS_DIR, archivo), 'utf8') : '').replace(/--.*$/gm, '');

// Cuerpo de una función: desde su create hasta el `$$;` que la cierra
const funcion = (nombre) => {
  const desde = codigo.indexOf(`create or replace function public.${nombre}`);
  return desde === -1 ? '' : codigo.slice(desde, codigo.indexOf('$$;', desde) + 3);
};

const ESTADOS_PANEL = ["'DERIVADO'", "'ESCALADO'", "'EN_DISCREPANCIA'", "'RESUELTO'", "'DESESTIMADO'"];

describe('REP-3000 · bandeja del organismo de prueba (migración)', () => {
  it('UT-3000-01: existe la migración versionada', () => {
    expect(archivo).toBeTruthy();
  });

  it('UT-3000-02: la regla de atención exige borrador generado y un estado del circuito del panel (§3)', () => {
    const fn = funcion('profile_attends_report');
    expect(fn).toMatch(/security definer/i);
    expect(fn).toMatch(/delivery_status = 'borrador_generado'/);
    for (const estado of ESTADOS_PANEL) expect(fn).toContain(estado);
    expect(fn).not.toContain("'INFORMADO'");
    expect(fn).not.toContain("'EN_ANALISIS'");
    // Conserva el alcance de REP-3747
    expect(fn).toMatch(/jurisdiction_level = 'state_province'/);
  });

  it('UT-3000-03: la entrega interna excluye fuera de alcance y asistencia, exige borrador y organismo de prueba', () => {
    const fn = funcion('deliver_report_to_test_inbox');
    expect(fn).toMatch(/security definer/i);
    expect(fn).toMatch(/'EN_ANALISIS'/);
    expect(fn).toMatch(/'fuera_de_alcance'/);
    expect(fn).toMatch(/'asistencia'/);
    expect(fn).toMatch(/prepare_organism_delivery\(p_report_id, p_prestacion_key\)/);
    expect(fn).toMatch(/'borrador_generado'/);
    expect(fn).toMatch(/is_test/);
    expect(fn).toMatch(/change_report_state\(\s*p_report_id, 'DERIVADO'/);
    expect(fn).toContain('Ningún municipio real recibió el reporte');
  });

  it('UT-3000-04: la entrega solo la ejecuta el servidor (ni anon ni usuarios)', () => {
    expect(codigo).toMatch(/revoke execute on function public\.deliver_report_to_test_inbox\(uuid, text\) from public, anon, authenticated/i);
    expect(codigo).toMatch(/grant\s+execute on function public\.deliver_report_to_test_inbox\(uuid, text\) to service_role/i);
  });

  it('UT-3000-05: se dispara al guardar el análisis, diferido y sin poder romper la persistencia del RAG', () => {
    expect(codigo).toMatch(/create constraint trigger \w+\s+after insert or update on public\.report_ai_analysis\s+deferrable initially deferred\s+for each row/i);
    const fn = funcion('trg_deliver_report_to_test_inbox');
    expect(fn).toMatch(/exception when others then/i);
    expect(fn).toMatch(/return null/i);
  });

  it('UT-3000-06: la transición EN_ANALISIS → DERIVADO pasa al texto D7 aprobado por Hernán', () => {
    expect(codigo).toMatch(/update public\.report_state_transitions[\s\S]*?from_state_code = 'EN_ANALISIS'[\s\S]*?to_state_code = 'DERIVADO'/i);
    expect(codigo).toContain('entrega interna efectiva al operador de prueba');
  });

  it('UT-3000-07: get_panel_inbox es DEFINER, filtra por la regla de atención y no devuelve datos privados', () => {
    const fn = funcion('get_panel_inbox');
    expect(fn).toMatch(/security definer/i);
    expect(fn).toMatch(/profile_attends_report\(auth\.uid\(\), r\.id\)/);
    // Ni la descripción del vecino, ni su identidad, ni la carpeta o las fotos (st.description es la etiqueta del estado)
    expect(fn).not.toMatch(/r\.description|user_id|client_side_id|report_images/i);
    expect(codigo).toMatch(/revoke execute on function public\.get_panel_inbox\(\) from public, anon/i);
    expect(codigo).toMatch(/grant\s+execute on function public\.get_panel_inbox\(\) to authenticated/i);
  });

  it('UT-3000-08: no reescribe estados ni entregas históricas', () => {
    expect(codigo).not.toMatch(/update public\.citizen_reports/i);
    expect(codigo).not.toMatch(/delete from|truncate/i);
  });
});
