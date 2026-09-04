import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { DEFAULT_REPORT_CATEGORIES } from '../services/categoriesService';
import { CURRENT_TERMS_VERSION } from '../services/termsService';

describe('REP-3471: Validación de Scripts SQL y Dataset Seed de Supabase', () => {
  const supabaseDir = path.resolve(__dirname, '../../supabase');
  const schemaPath = path.join(supabaseDir, 'schema.sql');
  const seedPath = path.join(supabaseDir, 'seed.sql');
  const resetPath = path.join(supabaseDir, 'reset.sql');

  it('UT-SEED-01: Los archivos SQL de schema, seed y reset existen y tienen contenido válido', () => {
    expect(fs.existsSync(schemaPath)).toBe(true);
    expect(fs.existsSync(seedPath)).toBe(true);
    expect(fs.existsSync(resetPath)).toBe(true);

    const schemaContent = fs.readFileSync(schemaPath, 'utf8');
    const seedContent = fs.readFileSync(seedPath, 'utf8');
    const resetContent = fs.readFileSync(resetPath, 'utf8');

    expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS public.profiles');
    expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS public.report_categories');
    expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS public.organismos');
    expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS public.terms_consents');
    expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS public.reports');
    expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS public.report_evidences');

    expect(seedContent).toContain('INSERT INTO public.profiles');
    expect(seedContent).toContain('INSERT INTO public.report_categories');
    expect(seedContent).toContain('INSERT INTO public.organismos');
    expect(seedContent).toContain('INSERT INTO public.reports');
    expect(seedContent).toContain('INSERT INTO public.report_evidences');

    expect(resetContent).toContain('TRUNCATE TABLE public.reports CASCADE');
  });

  it('UT-SEED-02: Las categorías del seed coinciden exactamente con DEFAULT_REPORT_CATEGORIES del cliente', () => {
    const seedContent = fs.readFileSync(seedPath, 'utf8');
    DEFAULT_REPORT_CATEGORIES.forEach((category) => {
      expect(seedContent).toContain(category.id);
      expect(seedContent).toContain(category.name);
      expect(seedContent).toContain(category.icon);
      expect(seedContent).toContain(category.color);
    });
  });

  it('UT-SEED-03: Los reportes del seed poseen coordenadas dentro del Bounding Box de CABA y Avellaneda', () => {
    const seedContent = fs.readFileSync(seedPath, 'utf8');
    // Bounding box: Longitud [-58.55, -58.31], Latitud [-34.73, -34.52]
    const lngMin = -58.55;
    const lngMax = -58.31;
    const latMin = -34.73;
    const latMax = -34.52;

    // Extraer coordenadas mediante regex
    const coordRegex = /(-34\.\d+),\s*(-58\.\d+)/g;
    const matches = [...seedContent.matchAll(coordRegex)];

    expect(matches.length).toBeGreaterThanOrEqual(8);

    matches.forEach((match) => {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);

      expect(lat).toBeGreaterThanOrEqual(latMin);
      expect(lat).toBeLessThanOrEqual(latMax);
      expect(lng).toBeGreaterThanOrEqual(lngMin);
      expect(lng).toBeLessThanOrEqual(lngMax);
    });
  });

  it('UT-SEED-04: El dataset contiene reportes para los estados Enviado, En curso y Resuelto', () => {
    const seedContent = fs.readFileSync(seedPath, 'utf8');
    expect(seedContent).toContain("'Enviado'");
    expect(seedContent).toContain("'En curso'");
    expect(seedContent).toContain("'Resuelto'");
  });

  it('UT-SEED-05: El registro de consentimiento del usuario demo utiliza la versión vigente de términos', () => {
    const seedContent = fs.readFileSync(seedPath, 'utf8');
    expect(seedContent).toContain(`'${CURRENT_TERMS_VERSION}'`);
  });

  it('UT-SEED-06: El seed es idempotente y contiene cláusulas ON CONFLICT para todas las inserciones', () => {
    const seedContent = fs.readFileSync(seedPath, 'utf8');
    const conflictMatches = seedContent.match(/ON CONFLICT/g);
    expect(conflictMatches).not.toBeNull();
    expect(conflictMatches.length).toBeGreaterThanOrEqual(5);
  });
});
