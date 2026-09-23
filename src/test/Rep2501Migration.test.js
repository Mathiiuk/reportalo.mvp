import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// REP-2501: la migración fija las reglas que la app no puede garantizar sola. Este test
// evita que alguien las afloje sin darse cuenta (no ejecuta SQL: lee el archivo).
describe('REP-2501: migración de evidencia anonimizada', () => {
  const sql = fs.readFileSync(
    path.resolve(__dirname, '../../supabase/migrations/20260923130000_rep2501_evidencia_anonimizada.sql'),
    'utf8'
  );

  it('UT-MIG-01: report_images solo acepta URLs del bucket de evidencias bajo el client_side_id del reporte', () => {
    expect(sql).toContain('on public.report_images');
    expect(sql).toContain('for insert to authenticated');
    expect(sql).toContain('r.user_id = (select auth.uid())');
    expect(sql).toContain("report-evidences/' || r.client_side_id::text || '/%'");
  });

  it('UT-MIG-02: la cuarentena solo admite subidas a la carpeta del propio usuario', () => {
    expect(sql).toContain("bucket_id = 'evidence-quarantine'");
    expect(sql).toContain('(storage.foldername(name))[1] = (select auth.uid())::text');
  });

  it('UT-MIG-03: la purga corre cada 15 minutos y no la puede invocar un ciudadano', () => {
    expect(sql).toContain("'quarantine-purge'");
    expect(sql).toContain("'*/15 * * * *'");
    expect(sql).toMatch(/revoke execute on function public\.dispatch_quarantine_purge\(\) from public, anon, authenticated/);
  });

  it('UT-MIG-04: los secretos salen de Vault, no del archivo', () => {
    expect(sql).toContain("name = 'quarantine_purge_url'");
    expect(sql).toContain("name = 'rag_service_role_key'");
    expect(sql).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/); // ningún JWT pegado
  });

  it('UT-MIG-05: es repetible (dropea antes de crear)', () => {
    expect(sql).toContain('drop policy if exists "insert own report images"');
    expect(sql).toContain('drop policy if exists "Subida a cuarentena con sesion"');
  });
});
