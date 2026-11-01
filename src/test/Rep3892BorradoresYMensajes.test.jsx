/**
 * @file Rep3892BorradoresYMensajes.test.jsx
 * @description REP-3892 (QA REP-3875 de Ivo): O-01 borrador institucional solo para reportes elegibles, O-02 acuse que no
 * promete una entrega y O-03 «Descripción del usuario». El comportamiento de la migración se probó contra la definición
 * vigente de staging (01/11) en Postgres en memoria y se reverifica en staging con supabase/tests/rep3892_*.sql.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const { rpcMock, analisis, pantalla } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  analisis: { actual: null },
  pantalla: { escritorio: false },
}));
vi.mock('../lib/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: {
    rpc: (...args) => rpcMock(...args),
    // El tracker en vivo del acuse consulta el estado: se responde vacío
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
  },
}));
vi.mock('../hooks/useReportAnalysisLive', () => ({
  useReportAnalysisLive: () => ({ analysis: analisis.actual, loading: false, error: null, mode: 'idle' }),
}));
vi.mock('../hooks/useMediaQuery', () => ({ useIsDesktopLayout: () => pantalla.escritorio }));

import { ReportSuccessScreen } from '../components/report/ReportSuccessScreen';

// ---------------------------------------------------------------------------------------------------------------
// O-01 y O-03 · contrato de la migración
// ---------------------------------------------------------------------------------------------------------------
const MIGRATIONS_DIR = resolve(__dirname, '../../supabase/migrations');
const archivo = readdirSync(MIGRATIONS_DIR).find((f) => f.includes('rep3892_borradores_excluidos'));
const migracion = archivo ? readFileSync(resolve(MIGRATIONS_DIR, archivo), 'utf8') : '';
const codigo = migracion.replace(/^\s*--.*$/gm, '');

describe('REP-3892 · migración de prepare_organism_delivery', () => {
  it('UT-3892-M1: parchea la definición vigente en fragmentos exactos y falla entera si no están', () => {
    expect(archivo).toBeTruthy();
    expect(codigo).toMatch(/pg_get_functiondef\('public\.prepare_organism_delivery\(uuid,text,boolean,text\)'::regprocedure\)/);
    expect(codigo).toContain('v_route := public.route_report(p_report_id, p_prestacion_key, p_urgente, p_tipo_via);$s$');
    expect(codigo).toContain('v_estado_inf := case v_status$s$');
    expect(codigo).toMatch(/<> 1[\s\S]*raise exception 'REP-3892: prepare_organism_delivery no tiene los fragmentos esperados/);
  });

  it('UT-3892-M2: O-01 valida en la base antes de rutear, con el mismo acceso que route_report', () => {
    const guardia = codigo.slice(codigo.indexOf('v_route_new'), codigo.indexOf('v_estado_old'));
    // El acceso va primero: a un tercero no se le revela el análisis
    expect(guardia.indexOf("auth.role(), '') = 'service_role'")).toBeLessThan(guardia.indexOf('report_ai_analysis'));
    expect(guardia).toMatch(/v_report\.user_id = v_uid/);
    expect(guardia).toMatch(/public\.profile_attends_report\(v_uid, p_report_id\)/);
    // Último análisis, no cualquiera
    expect(guardia).toMatch(/order by a\.created_at desc\s+limit 1/);
    expect(guardia).toMatch(/v_ultimo = 'fuera_de_alcance'[\s\S]*'excluido_fuera_de_alcance'/);
    // La prestación tiene que ser de la categoría del reporte; la categoría no se toca
    expect(guardia).toMatch(/sa\.service_id = v_report\.service_id/);
    expect(guardia).toContain("'prestacion_incompatible'");
    // La guardia termina antes de llamar a route_report: no se pisa report_routing
    expect(guardia.lastIndexOf('end;')).toBeLessThan(guardia.lastIndexOf('v_route := public.route_report'));
  });

  it('UT-3892-M3: asistencia nunca termina en borrador institucional', () => {
    const asistencia = codigo.slice(codigo.indexOf('v_estado_new'), codigo.indexOf('v_desc_old'));
    expect(asistencia).toMatch(/v_status = 'borrador_generado'[\s\S]*= 'asistencia'[\s\S]*'excluido_asistencia'/);
  });

  it('UT-3892-M4: los rechazos no son borrador ni envío, y no guardan entrega', () => {
    for (const estado of ['excluido_fuera_de_alcance', 'prestacion_incompatible', 'excluido_asistencia']) {
      const rechazo = codigo.slice(codigo.indexOf(`'${estado}'`), codigo.indexOf(`'${estado}'`) + 400);
      expect(rechazo).toMatch(/'es_borrador', false, 'enviado', false/);
      expect(rechazo).toMatch(/'entrega_id', null, 'repetido', false/);
    }
    // No se inventan estados en report_outreach_logs ni se tocan datos
    expect(codigo).not.toMatch(/insert into|update public\.|delete from|truncate|alter table/i);
  });

  it('UT-3892-M5: O-03 cambia solo la etiqueta del borrador, no el prompt del modelo', () => {
    expect(codigo).toContain("v_desc_old   text := $s$'Descripción del vecino: '$s$;");
    expect(codigo).toContain("v_desc_new   text := $s$'Descripción del usuario: '$s$;");
    const prompt = readFileSync(resolve(__dirname, '../../supabase/functions/analizar-imagen-reporte/contract.ts'), 'utf8');
    expect(prompt).toContain('Descripción del vecino');
  });

  it('UT-3892-M6: la verificación en staging cubre C-09 y termina siempre revirtiendo', () => {
    const verificacion = readFileSync(resolve(__dirname, '../../supabase/tests/rep3892_verificacion_borradores.sql'), 'utf8');
    expect(verificacion).toMatch(/371f42e4/);
    expect(verificacion).toMatch(/raise exception 'REP-3892 OK/);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// O-02 · acuse «Reporte enviado»
// ---------------------------------------------------------------------------------------------------------------
const VERIFICADO = {
  jurisdiccion: 'CABA',
  criterio: 'regla_inequivoca',
  sin_destino_verificado: false,
  organismo_verificado: { id: 'o1', nombre: 'Comuna 5', organismo_padre: null },
  canal_verificado: { tipo: 'web', valor: 'https://bacolaborativa.buenosaires.gob.ar/', etiqueta: 'BA Colaborativa' },
};
const SIN_DESTINO = {
  ...VERIFICADO,
  criterio: 'sin_destino',
  sin_destino_verificado: true,
  organismo_verificado: { id: 'g1', nombre: 'Gobierno de la Ciudad de Buenos Aires', organismo_padre: null },
};
const TEXTO_HONESTO = 'Recibimos tu reporte. Lo estamos analizando para identificar el organismo que corresponde.';

const montar = (category = { id: 'transito', name: 'Tránsito' }) =>
  render(
    <ReportSuccessScreen
      reportId="11111111-2222-4333-8444-555555555555"
      reportCode="#RP-371F42E4"
      category={category}
      onViewReport={vi.fn()}
      onReturnToMap={vi.fn()}
    />
  );

describe.each([
  ['teléfono', false],
  ['escritorio', true],
])('REP-3892 · «Reporte enviado» en %s', (_nombre, escritorio) => {
  beforeEach(() => {
    rpcMock.mockReset();
    analisis.actual = null;
    pantalla.escritorio = escritorio;
  });

  it('UT-3892-P1: no promete que la evidencia está en camino', async () => {
    rpcMock.mockResolvedValue({ data: VERIFICADO, error: null });
    montar();
    expect(screen.getByTestId('success-subtitle')).toHaveTextContent(TEXTO_HONESTO);
    expect(screen.queryByText(/en camino/i)).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('success-destination')).toHaveAttribute('data-kind', 'verificado'));
  });

  it('UT-3892-P2 (válido / pendiente): el organismo del catálogo se aclara como no enviado', async () => {
    rpcMock.mockResolvedValue({ data: VERIFICADO, error: null });
    montar();
    await waitFor(() => expect(screen.getByTestId('success-destination-agency')).toHaveTextContent('Comuna 5'));
    expect(screen.getByText('Es el organismo que corresponde. Todavía no le enviamos el reporte.')).toBeInTheDocument();
  });

  it('UT-3892-P3 (fuera de alcance): no muestra organismo ni canal', async () => {
    rpcMock.mockResolvedValue({ data: VERIFICADO, error: null });
    analisis.actual = { result_status_code: 'fuera_de_alcance' };
    montar();
    await waitFor(() => expect(rpcMock).toHaveBeenCalled());
    expect(screen.getByTestId('success-destination')).toHaveAttribute('data-kind', 'sin_derivacion');
    expect(screen.queryByTestId('success-destination-agency')).not.toBeInTheDocument();
    expect(screen.queryByTestId('success-destination-channel')).not.toBeInTheDocument();
    expect(screen.getByText('Reportalo no deriva este reporte a ningún organismo.')).toBeInTheDocument();
  });

  it('UT-3892-P4 (asistencia en una categoría común): tampoco muestra organismo', async () => {
    rpcMock.mockResolvedValue({ data: VERIFICADO, error: null });
    analisis.actual = { result_status_code: 'asistencia' };
    montar();
    await waitFor(() => expect(rpcMock).toHaveBeenCalled());
    expect(screen.getByTestId('success-destination')).toHaveAttribute('data-kind', 'sin_derivacion');
    expect(screen.queryByTestId('success-destination-agency')).not.toBeInTheDocument();
  });

  it('UT-3892-P5 (sin destino): mantiene la salvedad del canal general', async () => {
    rpcMock.mockResolvedValue({ data: SIN_DESTINO, error: null });
    analisis.actual = { result_status_code: 'fundamentado' };
    montar();
    await waitFor(() => expect(screen.getByTestId('success-destination')).toHaveAttribute('data-kind', 'sin_destino'));
    expect(screen.getByText(/Destino sin verificar/)).toBeInTheDocument();
    expect(screen.queryByText(/Todavía no le enviamos/)).not.toBeInTheDocument();
  });
});
