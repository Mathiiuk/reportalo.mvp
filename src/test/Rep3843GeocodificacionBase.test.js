/**
 * @file Rep3843GeocodificacionBase.test.js
 * @description REP-3843, opción A de la propuesta técnica (§8, decisión de Matías 29/10): la dirección aproximada se
 * busca desde la base al guardar el reporte, porque Nominatim responde 403 a las Edge Functions y 200 a pg_net.
 * Una cola con un pedido cada 10 segundos (política de uso de Nominatim: como mucho 1 por segundo), sin pisar nunca lo
 * que cargó el vecino. Se verificó en staging con ROLLBACK.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATIONS_DIR = resolve(__dirname, '../../supabase/migrations');
const archivo = readdirSync(MIGRATIONS_DIR).find((f) => f.includes('rep3843_geocodificacion_en_la_base'));
const codigo = (archivo ? readFileSync(resolve(MIGRATIONS_DIR, archivo), 'utf8') : '').replace(/--.*$/gm, '');

const funcion = (nombre) => {
  const desde = codigo.indexOf(`create or replace function public.${nombre}(`);
  return desde === -1 ? '' : codigo.slice(desde, codigo.indexOf('$$;', desde) + 3);
};

describe('REP-3843 · geocodificación en la base (opción A)', () => {
  it('UT-3843-G1: el origen «geocodificada» se suma a la regla de la dirección', () => {
    expect(archivo).toBeTruthy();
    expect(codigo).toMatch(/address_source in \('sugerida', 'corregida', 'geocodificada'\)/);
  });

  it('UT-3843-G2: cola propia con RLS y sin acceso para la app', () => {
    expect(codigo).toMatch(/create table if not exists public\.report_geocoding/i);
    expect(codigo).toMatch(/alter table public\.report_geocoding enable row level security/i);
    expect(codigo).toMatch(/revoke all on public\.report_geocoding from public, anon, authenticated/i);
  });

  it('UT-3843-G3: al guardar un reporte sin calle y con coordenadas, entra a la cola', () => {
    const fn = funcion('enqueue_report_geocoding');
    expect(fn).toMatch(/new\.address_street is null/);
    expect(fn).toMatch(/new\.latitud is not null and new\.longitud is not null/);
    expect(fn).toMatch(/on conflict \(report_id\) do nothing/i);
    expect(codigo).toMatch(/after insert on public\.citizen_reports[\s\S]*enqueue_report_geocoding/i);
  });

  it('UT-3843-G4: la respuesta de Nominatim se convierte igual que en el proxy: calle, altura de puerta y tipo de vía', () => {
    const fn = funcion('parse_nominatim_address');
    expect(fn).toMatch(/'road'/);
    expect(fn).toMatch(/'house_number'/);
    expect(fn).toMatch(/\^\\d\{1,5\}\[A-Za-z\]\?\$/);
    expect(fn).toMatch(/\^\(avenida\|avda\\\.\?\|av\\\.\?\)\(\\s\|\$\)/);
    expect(fn).toMatch(/char_length\(v_street\) > 120/);
  });

  it('UT-3843-G5: un pedido por vuelta, con User-Agent, la misma consulta del proxy y hasta 3 intentos', () => {
    const fn = funcion('dispatch_report_geocoding');
    expect(fn).toMatch(/net\.http_get\(/);
    expect(fn).toMatch(/'User-Agent'/);
    expect(fn).toMatch(/format=jsonv2/);
    expect(fn).toMatch(/zoom=18&addressdetails=1&accept-language=es/);
    expect(fn).toMatch(/limit 1/);
    expect(fn).toMatch(/net\._http_response/);
    expect(fn).toMatch(/attempts >= 3/);
    expect(fn).toMatch(/security definer/i);
  });

  it('UT-3843-G6: nunca pisa lo que cargó el vecino', () => {
    const fn = funcion('dispatch_report_geocoding');
    expect(fn).toMatch(/address_source\s+= 'geocodificada'/);
    expect(fn).toMatch(/and r\.address_street is null/);
  });

  it('UT-3843-G7: una tarea cada 10 segundos y las funciones sin acceso para la app', () => {
    expect(codigo).toMatch(/cron\.schedule\(\s*'report-geocoding-dispatch',\s*'10 seconds'/);
    for (const f of ['dispatch_report_geocoding()', 'parse_nominatim_address(jsonb)', 'enqueue_report_geocoding()']) {
      expect(codigo).toContain(`revoke execute on function public.${f} from public, anon, authenticated`);
    }
  });
});
