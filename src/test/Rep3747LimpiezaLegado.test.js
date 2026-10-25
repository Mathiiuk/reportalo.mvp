/**
 * @file Rep3747LimpiezaLegado.test.js
 * @description Limpieza del código heredado (OK de Hernán, 24/10/2026): el trigger audit_ia todavía guardaba en su
 * definición una clave service_role vieja (V-01, ya deshabilitada), y get_infraction_stats() llamaba a
 * get_auth_user_jurisdiction(), que consulta una columna inexistente. En staging nada depende de ellos (25/10).
 * La migración borra código, no datos.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATIONS_DIR = resolve(__dirname, '../../supabase/migrations');
const archivo = readdirSync(MIGRATIONS_DIR).find((f) => f.includes('rep3747_limpieza_legado'));
const codigo = (archivo ? readFileSync(resolve(MIGRATIONS_DIR, archivo), 'utf8') : '').replace(/--.*$/gm, '');

describe('REP-3747 · limpieza del código heredado', () => {
  it('UT-3747-L1: borra el trigger audit_ia y las dos funciones rotas', () => {
    expect(archivo).toBeTruthy();
    expect(codigo).toMatch(/drop trigger if exists audit_ia on public\.infractions/i);
    expect(codigo).toMatch(/drop function if exists public\.get_infraction_stats\(integer\)/i);
    expect(codigo).toMatch(/drop function if exists public\.get_auth_user_jurisdiction\(\)/i);
  });

  it('UT-3747-L2: no borra tablas ni datos y no usa cascade', () => {
    expect(codigo).not.toMatch(/drop table|delete from|truncate/i);
    expect(codigo).not.toMatch(/cascade/i);
  });
});
