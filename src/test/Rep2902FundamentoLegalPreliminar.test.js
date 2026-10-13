/**
 * @file Rep2902FundamentoLegalPreliminar.test.js
 * @description REP-2902: fundamento legal preliminar trazable para el reporte al organismo.
 *   - El servicio que lee la función de la base y el armado del bloque de texto jurídico.
 *   - El contrato de la migración (la lógica de la función se prueba contra un Postgres local con
 *     scripts/rep2902/prueba_local_fundamento.sql: acá se fijan las garantías que no deben perderse).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rpc = vi.fn();
vi.mock('../lib/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: { rpc: (...args) => rpc(...args) },
}));

import {
  getReportLegalFoundation,
  hasVerifiedLegalFoundation,
  buildLegalFoundationText,
  LEGAL_FOUNDATION_STATUS,
  LEGAL_FOUNDATION_DISCLAIMER,
} from '../services/legalFoundationService';

const verified = {
  status: 'fundamento_preliminar',
  is_ai_generated: true,
  disclaimer: LEGAL_FOUNDATION_DISCLAIMER,
  jurisdiction: { locality: 'Gerli', subdivision: 'Avellaneda', state_province: 'Buenos Aires' },
  official_foundation: 'La conservación de calles es competencia del municipio.',
  citations: [
    {
      fragment_id: 'f1',
      reference: 'Decreto-Ley 6769/58 — Ley Orgánica de las Municipalidades > Artículo 59',
      quoted_text: 'competencia municipal',
      document_type: 'decreto_ley',
      document_number: '6769/58',
      source_title: 'Ley Orgánica de las Municipalidades',
      issuing_authority: 'Provincia de Buenos Aires',
      source_url: 'https://normas.gba.gob.ar/documentos/OVG48SW0.html',
      verified_at: '2026-09-28T00:00:00+00:00',
    },
  ],
};

const notVerified = {
  status: 'sin_fundamento_verificado',
  is_ai_generated: true,
  disclaimer: LEGAL_FOUNDATION_DISCLAIMER,
  jurisdiction: { locality: 'Flores', subdivision: 'Comuna 7', state_province: 'Ciudad Autónoma de Buenos Aires' },
  official_foundation: null,
  abstention_reason: 'No se halló norma suficiente en el corpus para este reclamo.',
  citations: [],
};

// Con llaves: si el callback devuelve el mock, vitest lo toma como función de limpieza y la ejecuta al terminar
beforeEach(() => {
  rpc.mockReset();
});

describe('REP-2902 · getReportLegalFoundation', () => {
  it('UT-2902-01: llama a la función de la base con el id del reporte y devuelve lo que ella arma', async () => {
    rpc.mockResolvedValue({ data: verified, error: null });
    const result = await getReportLegalFoundation('rep-1');
    expect(rpc).toHaveBeenCalledWith('get_report_legal_foundation', { p_report_id: 'rep-1' });
    expect(result).toEqual({ success: true, data: verified });
  });

  it('UT-2902-02: quien no es autor ni receptor autorizado recibe null (no se revela si hay análisis)', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await getReportLegalFoundation('rep-ajeno')).toEqual({ success: true, data: null });
  });

  it('UT-2902-03: un error de la base se informa sin romper', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'permission denied' } });
    expect(await getReportLegalFoundation('rep-1')).toEqual({ success: false, data: null, error: 'permission denied' });
    rpc.mockImplementation(async () => {
      throw new Error('network');
    });
    expect((await getReportLegalFoundation('rep-1')).success).toBe(false);
  });

  it('UT-2902-04: sin id no consulta nada', async () => {
    expect((await getReportLegalFoundation('')).success).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('REP-2902 · hasVerifiedLegalFoundation', () => {
  it('UT-2902-05: solo es verificado con estado verificado Y al menos una cita', () => {
    expect(hasVerifiedLegalFoundation(verified)).toBe(true);
    expect(hasVerifiedLegalFoundation({ ...verified, citations: [] })).toBe(false);
    expect(hasVerifiedLegalFoundation(notVerified)).toBe(false);
    expect(hasVerifiedLegalFoundation(null)).toBe(false);
  });
});

describe('REP-2902 · buildLegalFoundationText', () => {
  it('UT-2902-06 (escenario 1): con norma verificada incluye referencia legal, fuente y cita textual', () => {
    const text = buildLegalFoundationText(verified);
    expect(text).toMatch(/Artículo 59/);
    expect(text).toMatch(/Decreto-ley 6769\/58 — Ley Orgánica de las Municipalidades \(Provincia de Buenos Aires\)/i);
    expect(text).toMatch(/Fuente: https:\/\/normas\.gba\.gob\.ar\/documentos\/OVG48SW0\.html \(verificada el 2026-09-28\)/);
    expect(text).toMatch(/Cita textual: «competencia municipal»/);
    expect(text).toMatch(/Fundamento técnico: La conservación de calles/);
    expect(text).toMatch(/Jurisdicción del reporte: Gerli, Avellaneda, Buenos Aires/);
  });

  it('UT-2902-07 (escenario 2): sin fundamento verificado lo dice y NO incluye ningún texto jurídico', () => {
    const text = buildLegalFoundationText(notVerified);
    expect(text).toMatch(/Estado: sin fundamento verificado\./);
    expect(text).toMatch(/Motivo: No se halló norma suficiente/);
    expect(text).not.toMatch(/Normas citadas|Cita textual|Fundamento técnico/);
  });

  it('UT-2902-08: aunque la base mandara texto técnico junto con un estado sin verificar, no se presenta', () => {
    const text = buildLegalFoundationText({ ...notVerified, official_foundation: 'texto que no debería viajar', citations: [verified.citations[0]] });
    expect(text).not.toMatch(/texto que no debería viajar/);
    expect(text).not.toMatch(/Cita textual/);
  });

  it('UT-2902-09: siempre separa el fundamento preliminar de una decisión administrativa', () => {
    for (const foundation of [verified, notVerified, { status: 'pendiente', citations: [] }]) {
      const text = buildLegalFoundationText(foundation);
      expect(text).toMatch(/generado con asistencia de IA/);
      expect(text).toMatch(/No es una decisión administrativa ni una resolución estatal/);
    }
  });

  it('UT-2902-10: pendiente se dice como pendiente; null (sin acceso) no genera nada', () => {
    expect(buildLegalFoundationText({ status: 'pendiente', citations: [] })).toMatch(/análisis pendiente/);
    expect(buildLegalFoundationText(null)).toBeNull();
  });

  it('UT-2902-11: el estado verificado sin citas se presenta como no verificado, nunca como fundamento', () => {
    const text = buildLegalFoundationText({ ...verified, citations: [] });
    expect(text).toMatch(/sin fundamento verificado/);
    expect(text).not.toMatch(/Normas citadas/);
  });

  it('UT-2902-12: no filtra el texto privado del ciudadano aunque venga en la respuesta', () => {
    const text = buildLegalFoundationText({ ...verified, citizen_feedback: 'TEXTO PRIVADO', confidence_score: 0.9 });
    expect(text).not.toMatch(/TEXTO PRIVADO/);
    expect(text).not.toMatch(/0\.9|confianza/i);
  });

  it('UT-2902-13: el aviso fijo coincide con el que devuelve la base', () => {
    const migration = readFileSync(resolve(__dirname, '../../supabase/migrations/20261013140000_rep2902_fundamento_legal_preliminar.sql'), 'utf8')
      .replace(/\r\n/g, '\n')
      .replace(/'\s*\n\s*'/g, '');
    expect(migration).toContain(LEGAL_FOUNDATION_DISCLAIMER);
    expect(LEGAL_FOUNDATION_STATUS.VERIFIED).toBe('fundamento_preliminar');
  });
});

describe('REP-2902 · contrato de la migración', () => {
  const sql = readFileSync(resolve(__dirname, '../../supabase/migrations/20261013140000_rep2902_fundamento_legal_preliminar.sql'), 'utf8').replace(/\r\n/g, '\n');
  // Sin comentarios: las garantías se buscan en el código, no en lo que dicen los comentarios
  // ni el texto del COMMENT ON FUNCTION, que describe lo que la función NO devuelve
  const code = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .replace(/comment on function[\s\S]*?;\n/, '');

  it('UT-2902-14: es SECURITY INVOKER y de solo lectura (las policies siguen aplicando)', () => {
    expect(code).toMatch(/security invoker/);
    expect(code).toMatch(/\bstable\b/);
    expect(code).not.toMatch(/security definer/);
    expect(code).not.toMatch(/\b(insert|update|delete|alter table|drop table)\b/i);
  });

  it('UT-2902-15: no se puede ejecutar como anónimo; sí como usuario autenticado y como servidor', () => {
    expect(code).toMatch(/revoke all on function public\.get_report_legal_foundation\(uuid\) from public, anon;/);
    expect(code).toMatch(/grant execute on function public\.get_report_legal_foundation\(uuid\) to authenticated, service_role;/);
  });

  it('UT-2902-16: nunca devuelve el texto del ciudadano ni el puntaje de confianza', () => {
    expect(code).not.toMatch(/citizen_feedback/);
    expect(code).not.toMatch(/confidence_score/);
  });

  it('UT-2902-17: solo accede el autor, quien atiende el reporte y el servidor; a los demás les devuelve null', () => {
    expect(code).toMatch(/auth\.role\(\), ''\) = 'service_role'/);
    expect(code).toMatch(/v_report\.user_id = v_uid/);
    expect(code).toMatch(/profile_attends_report\(v_uid, p_report_id\)/);
    expect(code).toMatch(/if not v_allowed then\s+return null;/);
  });

  it('UT-2902-18: cada cita se verifica: fue citada, es literal del fragmento y aplica a la jurisdicción', () => {
    expect(code).toMatch(/e\.was_cited/);
    expect(code).toMatch(/position\(e\.quoted_text in f\.content\) > 0/);
    expect(code).toMatch(/eligible_knowledge_sources\(v_report\.locality_id\)/);
    expect(code).toMatch(/filter \(where quote_is_literal and in_jurisdiction\)/);
  });

  it('UT-2902-19: el texto técnico solo viaja con fundamento verificado, y sin fundamento no hay citas', () => {
    expect(code).toMatch(/case when v_status = 'fundamento_preliminar' then v_analysis\.official_legal_foundation else null end/);
    expect(code).toMatch(/v_status := 'sin_fundamento_verificado';[\s\S]*v_citations := '\[\]'::jsonb;/);
    expect(code).toMatch(/v_analysis\.result_status_code = 'fundamentado' and v_verified > 0/);
  });

  it('UT-2902-20: toda respuesta se marca como generada con IA y lleva el aviso de que no es una decisión administrativa', () => {
    expect(code).toMatch(/'is_ai_generated', true/);
    expect(code).toMatch(/No es una decisión administrativa ni una resolución estatal/);
  });
});
