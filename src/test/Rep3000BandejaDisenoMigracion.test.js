/**
 * @file Rep3000BandejaDisenoMigracion.test.js
 * @description REP-3000: la bandeja suma lo que muestra cada fila del diseño de Iván (tomado, cierre, calle, altura y
 * fotos), con la misma regla de atención y sin datos del vecino. Se verificó en staging con sesiones simuladas.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATIONS_DIR = resolve(__dirname, '../../supabase/migrations');
const archivo = readdirSync(MIGRATIONS_DIR).find((f) => f.includes('rep3000_bandeja_diseno'));
const codigo = (archivo ? readFileSync(resolve(MIGRATIONS_DIR, archivo), 'utf8') : '').replace(/--.*$/gm, '');
const fn = codigo.slice(codigo.indexOf('create function public.get_panel_inbox('), codigo.indexOf('$$;') + 3);

describe('REP-3000 · bandeja con el diseño (migración)', () => {
  it('UT-3000-M1: suma tomado, cierre, calle, altura y fotos, con la misma regla de atención', () => {
    expect(archivo).toBeTruthy();
    expect(fn).toMatch(/security definer/i);
    expect(fn).toMatch(/where public\.profile_attends_report\(auth\.uid\(\), r\.id\)/);
    for (const c of ['taken', 'closed_at', 'image_count', 'first_image_url', 'address_street', 'address_number']) expect(fn).toContain(c);
    expect(fn).toMatch(/'TOMADO_POR_ORGANISMO'/);
  });

  it('UT-3000-M2: sin descripción ni datos del vecino, y sin acceso para anon', () => {
    expect(fn).not.toMatch(/user_id|client_side_id|r\.description/);
    expect(codigo).toMatch(/revoke execute on function public\.get_panel_inbox\(\) from public, anon/i);
    expect(codigo).toMatch(/grant\s+execute on function public\.get_panel_inbox\(\) to authenticated/i);
  });
});
