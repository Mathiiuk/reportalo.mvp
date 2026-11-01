/**
 * @file Rep3843ColaReportesAnteriores.test.js
 * @description REP-3843: los reportes guardados antes de la geocodificación en la base (29/10) quedaron sin calle y
 * fuera de la cola, y el panel los muestra como «Dirección no disponible». Entran a la misma cola, sin pisar nunca lo
 * que cargó el vecino, y al mismo ritmo (un pedido cada 10 segundos). Primero los más nuevos.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATIONS_DIR = resolve(__dirname, '../../supabase/migrations');
const archivo = readdirSync(MIGRATIONS_DIR).find((f) => f.includes('rep3843_cola_reportes_anteriores'));
const codigo = (archivo ? readFileSync(resolve(MIGRATIONS_DIR, archivo), 'utf8') : '').replace(/--.*$/gm, '');

describe('REP-3843 · reportes anteriores a la cola de geocodificación', () => {
  it('UT-3843-C1: suma a la cola solo los reportes sin calle y con coordenadas, sin duplicar', () => {
    expect(archivo).toBeTruthy();
    expect(codigo).toMatch(/insert into public\.report_geocoding \(report_id, created_at\)/);
    expect(codigo).toMatch(/where r\.address_street is null\s+and r\.latitud is not null\s+and r\.longitud is not null/);
    expect(codigo).toMatch(/on conflict \(report_id\) do nothing/);
  });

  it('UT-3843-C2: un reporte nuevo no espera detrás de estos; entre ellos, los más nuevos primero', () => {
    expect(codigo).toContain("now() + interval '1 day' + q.orden * interval '1 millisecond'");
    expect(codigo).toMatch(/row_number\(\) over \(order by r\.created_at desc\)/);
  });

  it('UT-3843-C3: no toca los reportes ni el ritmo de la cola', () => {
    expect(codigo).not.toMatch(/update public\.citizen_reports|cron\.(schedule|alter_job)/i);
  });
});
