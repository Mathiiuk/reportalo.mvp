import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { DEFAULT_REPORT_CATEGORIES } from '../services/categoriesService';

describe('REP-3471: Validación de Scripts SQL y Dataset Seed de Supabase', () => {
  const supabaseDir = path.resolve(__dirname, '../../supabase');
  const seedPath = path.join(supabaseDir, 'seed.sql');
  const resetPath = path.join(supabaseDir, 'reset.sql');

  it('UT-SEED-01: Los archivos SQL de seed y reset existen y tienen contenido válido', () => {
    expect(fs.existsSync(seedPath)).toBe(true);
    expect(fs.existsSync(resetPath)).toBe(true);

    const seedContent = fs.readFileSync(seedPath, 'utf8');
    const resetContent = fs.readFileSync(resetPath, 'utf8');

    expect(seedContent).toContain('INSERT INTO public.countries');
    expect(seedContent).toContain('INSERT INTO public.states_provinces');
    expect(seedContent).toContain('INSERT INTO public.subdivisions');
    expect(seedContent).toContain('INSERT INTO public.localities');
    expect(seedContent).toContain('INSERT INTO public.report_states');
    expect(seedContent).toContain('INSERT INTO public.services');
    expect(seedContent).toContain('INSERT INTO public.agencies');
    expect(seedContent).toContain('INSERT INTO public.profiles');
    expect(seedContent).toContain('INSERT INTO public.citizen_reports');
    expect(seedContent).toContain('INSERT INTO public.report_images');

    expect(resetContent).toContain('TRUNCATE TABLE public.citizen_reports CASCADE');
  });

  it('UT-SEED-02: Las categorías del seed coinciden con los service_code de DEFAULT_REPORT_CATEGORIES del cliente', () => {
    const seedContent = fs.readFileSync(seedPath, 'utf8');
    DEFAULT_REPORT_CATEGORIES.forEach((category) => {
      expect(seedContent).toContain(category.id);
      expect(seedContent).toContain(category.name);
    });
  });

  it('UT-SEED-03: Los reportes del seed poseen coordenadas dentro del Bounding Box de CABA y Avellaneda', () => {
    const seedContent = fs.readFileSync(seedPath, 'utf8');
    // Bounding box: Longitud [-58.55, -58.31], Latitud [-34.73, -34.52]
    const lngMin = -58.55;
    const lngMax = -58.31;
    const latMin = -34.73;
    const latMax = -34.52;

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

  it('UT-SEED-04: El dataset contiene reportes para los estados en_curso, enviado y resuelto', () => {
    const seedContent = fs.readFileSync(seedPath, 'utf8');
    expect(seedContent).toContain("'enviado'");
    expect(seedContent).toContain("'en_curso'");
    expect(seedContent).toContain("'resuelto'");
  });

  it('UT-SEED-05: El seed es idempotente y contiene cláusulas ON CONFLICT para todas las tablas', () => {
    const seedContent = fs.readFileSync(seedPath, 'utf8');
    const conflictMatches = seedContent.match(/ON CONFLICT/g);
    expect(conflictMatches).not.toBeNull();
    expect(conflictMatches.length).toBeGreaterThanOrEqual(9);
  });
});
