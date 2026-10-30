/**
 * @file Rep3747PerfilesSinEscritura.test.js
 * @description REP-3747 · Seguridad del ingreso de vecino al de organismo (revisión del 30/10). Ser operador depende
 * de `profiles.role` y `profiles.agency_id`, que asigna una persona del equipo. Hoy un vecino no puede cambiarlos solo
 * porque no hay ninguna política de escritura: si mañana se agrega una («el usuario edita su nombre»), cualquiera se
 * podría poner de operador. La app nunca escribe en profiles (lo crea el trigger handle_new_user, SECURITY DEFINER),
 * así que se le quita a anon y authenticated el permiso de escribir.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATIONS_DIR = resolve(__dirname, '../../supabase/migrations');
const archivo = readdirSync(MIGRATIONS_DIR).find((f) => f.includes('rep3747_perfiles_sin_escritura'));
const codigo = (archivo ? readFileSync(resolve(MIGRATIONS_DIR, archivo), 'utf8') : '').replace(/--.*$/gm, '');

// Archivos de la app que hablan con Supabase (sin tests)
const listar = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? (e.name === 'test' ? [] : listar(resolve(dir, e.name))) : /\.(js|jsx)$/.test(e.name) ? [resolve(dir, e.name)] : []
  );

describe('REP-3747 · la app no puede escribir en profiles', () => {
  it('UT-3747-S1: la migración quita a anon y authenticated todo permiso sobre profiles salvo leer', () => {
    expect(archivo).toBeTruthy();
    // TRUNCATE se saltea la RLS: tampoco tiene que quedar
    expect(codigo).toMatch(/revoke insert, update, delete, truncate, references, trigger on public\.profiles from anon, authenticated;/i);
    // La lectura del perfil propio (OperatorRoute) sigue igual
    expect(codigo).not.toMatch(/revoke[^;]*select[^;]*profiles/i);
    expect(codigo).not.toMatch(/create policy/i);
  });

  it('UT-3747-S2: ningún archivo de la app escribe en profiles', () => {
    listar(resolve(__dirname, '..')).forEach((ruta) => {
      const fuente = readFileSync(ruta, 'utf8');
      expect(fuente, ruta).not.toMatch(/from\(['"]profiles['"]\)\s*\.\s*(insert|update|upsert|delete)\(/);
    });
  });
});
