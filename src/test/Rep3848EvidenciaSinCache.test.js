/**
 * @file Rep3848EvidenciaSinCache.test.js
 * @description REP-3848 (O-02 de la QA REP-3832): la foto privada que bajó el dueño no puede quedar en la caché HTTP
 * del navegador para que otra cuenta la reciba. Toda subida a los buckets privados de evidencia fija
 * `cacheControl: '0, private, no-store'` (supabase-js lo convierte en `max-age=0, private, no-store`) y una migración
 * reescribe el Cache-Control de los objetos ya subidos.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PRIVATE_EVIDENCE_CACHE_CONTROL } from '../services/quarantinePipelineService';

const leer = (ruta) => readFileSync(resolve(__dirname, '../..', ruta), 'utf8');
// Solo el código, sin comentarios
const sinComentarios = (src) =>
  src
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*\*|--)/.test(line))
    .join('\n');

describe('REP-3848 · evidencia privada sin caché HTTP', () => {
  it('UT-3848-01: el valor deja el encabezado completo una vez que supabase-js le antepone max-age=', () => {
    expect(`max-age=${PRIVATE_EVIDENCE_CACHE_CONTROL}`).toBe('max-age=0, private, no-store');
  });

  it('UT-3848-02: la subida a la cuarentena (foto original) usa el valor sin caché', () => {
    const code = sinComentarios(leer('src/services/quarantinePipelineService.js'));
    const upload = code.slice(code.indexOf('.from(BUCKET_QUARANTINE)'), code.indexOf('if (!error)'));
    expect(upload).toMatch(/cacheControl: PRIVATE_EVIDENCE_CACHE_CONTROL/);
  });

  it('UT-3848-03: la subida de la evidencia protegida desde el frontend usa el valor sin caché', () => {
    const code = sinComentarios(leer('src/services/reportSubmissionService.js'));
    expect(code).toMatch(/\.upload\(storagePath, blob, \{[^}]*cacheControl: PRIVATE_EVIDENCE_CACHE_CONTROL[^}]*\}\)/);
  });

  it('UT-3848-04: la Edge Function quarantine-anonymize sube con el mismo valor', () => {
    const code = sinComentarios(leer('supabase/functions/quarantine-anonymize/index.ts'));
    expect(code).toContain(`const PRIVATE_EVIDENCE_CACHE_CONTROL = '${PRIVATE_EVIDENCE_CACHE_CONTROL}';`);
    const upload = code.slice(code.indexOf('.upload(finalFileName'), code.indexOf('if (uploadError)'));
    expect(upload).toMatch(/cacheControl: PRIVATE_EVIDENCE_CACHE_CONTROL/);
  });

  it('UT-3848-05: la migración reescribe el Cache-Control de los objetos ya subidos en los dos buckets privados', () => {
    const code = sinComentarios(leer('supabase/migrations/20261019130000_rep3848_evidencias_sin_cache_http.sql'));
    expect(code).toMatch(/update storage\.objects/);
    expect(code).toContain(`'"max-age=${PRIVATE_EVIDENCE_CACHE_CONTROL}"'::jsonb`);
    expect(code).toMatch(/bucket_id in \('report-evidences', 'evidence-quarantine'\)/);
    // No toca los archivos ni las policies
    expect(code).not.toMatch(/delete from|drop policy|create policy|public = true/i);
  });

  it('UT-3848-06: el Service Worker no guarda respuestas de Storage en tiempo de ejecución', () => {
    const sw = sinComentarios(leer('src/sw.js'));
    expect(sw).not.toMatch(/registerRoute\([^)]*(supabase|storage)/i);
    expect(sw).not.toMatch(/caches\.open|cache\.put/);
  });
});
