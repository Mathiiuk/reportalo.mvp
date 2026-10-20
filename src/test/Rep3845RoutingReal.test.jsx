/**
 * @file Rep3845RoutingReal.test.jsx
 * @description REP-3845 (BUG-P1 de la QA REP-2809/2810): «Reporte enviado» mostraba un organismo calculado en el
 * navegador por el nombre de la localidad («avellaneda» → Municipio de Avellaneda; si no, Gobierno de la Ciudad) y
 * nunca ejecutaba route_report, así que no quedaba traza en report_routing. Ahora el destino sale de route_report
 * (catálogo aprobado REP-2806) y la pantalla nunca muestra un organismo supuesto.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// `red.caida` simula una caída de red: el cliente lanza. Se hace fuera de vi.fn porque Vitest marca como fallido el
// test cuando un vi.fn lanza o rechaza, aunque el servicio atrape el error.
const { rpcMock, red } = vi.hoisted(() => ({ rpcMock: vi.fn(), red: { caida: false } }));
vi.mock('../lib/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: {
    rpc: (...args) => {
      if (red.caida) throw new Error('Failed to fetch');
      return rpcMock(...args);
    },
    // El tracker en vivo del acuse consulta el estado: se responde vacío
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
    channel: undefined,
  },
}));

import { routeReport, describeRoutingDestination } from '../services/reportRoutingService';
import { ReportSuccessScreen } from '../components/report/ReportSuccessScreen';

// Resultados reales de route_report en staging (report_routing, 15/10/2026)
const VERIFICADO_CABA = {
  jurisdiccion: 'CABA',
  criterio: 'regla_inequivoca',
  sin_destino_verificado: false,
  organismo_verificado: { id: 'a1', nombre: 'Dirección General del Cuerpo de Agentes de Tránsito', organismo_padre: 'Secretaría de Tránsito' },
  canal_verificado: { tipo: 'web', valor: 'https://bacolaborativa.buenosaires.gob.ar/', etiqueta: 'BA Colaborativa › Denuncia vial' },
};
const SIN_DESTINO_CABA = {
  jurisdiccion: 'CABA',
  criterio: 'sin_destino',
  sin_destino_verificado: true,
  organismo_verificado: { id: 'g1', nombre: 'Gobierno de la Ciudad de Buenos Aires', organismo_padre: null },
  canal_verificado: { tipo: 'web', valor: 'https://bacolaborativa.buenosaires.gob.ar/', etiqueta: 'BA Colaborativa' },
  motivo: 'No se identificó la prestación: se propone el organismo y el canal generales de la jurisdicción.',
};
const FUERA_DEL_PILOTO = {
  jurisdiccion: 'FUERA_DEL_PILOTO',
  criterio: 'sin_destino',
  sin_destino_verificado: true,
  organismo_verificado: null,
  canal_verificado: null,
  motivo: 'El reporte está fuera del piloto (CABA y Avellaneda).',
};
const NO_RESUELTO = {
  jurisdiccion: 'CABA',
  criterio: 'no_resuelto',
  sin_destino_verificado: false,
  organismo_verificado: null,
  canal_verificado: null,
  motivo: 'Hay más de un organismo posible y no hay una regla aprobada que desempate.',
};

const REPORT_ID = '11111111-2222-4333-8444-555555555555';
const montar = (props = {}) =>
  render(
    <ReportSuccessScreen
      reportId={REPORT_ID}
      reportCode="#RP-1177DA62"
      category={{ id: 'transito', name: 'Tránsito' }}
      onViewReport={vi.fn()}
      onReturnToMap={vi.fn()}
      {...props}
    />
  );

describe('REP-3845 · routeReport', () => {
  beforeEach(() => rpcMock.mockReset());

  it('UT-3845-01: llama a route_report con el id del reporte y devuelve el resultado', async () => {
    rpcMock.mockResolvedValue({ data: VERIFICADO_CABA, error: null });
    const result = await routeReport(REPORT_ID);
    expect(rpcMock).toHaveBeenCalledWith('route_report', { p_report_id: REPORT_ID });
    expect(result).toEqual({ success: true, routing: VERIFICADO_CABA });
  });

  it('UT-3845-02: un error o una excepción no lanzan: devuelven routing null', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'permission denied' } });
    expect(await routeReport(REPORT_ID)).toMatchObject({ success: false, routing: null });
    red.caida = true;
    expect(await routeReport(REPORT_ID)).toMatchObject({ success: false, routing: null, error: 'Failed to fetch' });
    red.caida = false;
    expect(await routeReport(null)).toMatchObject({ success: false, routing: null });
  });
});

describe('REP-3845 · describeRoutingDestination', () => {
  it('UT-3845-03 (E1): con regla del catálogo muestra organismo y canal verificados', () => {
    expect(describeRoutingDestination(VERIFICADO_CABA)).toEqual({
      kind: 'verificado',
      organismo: 'Dirección General del Cuerpo de Agentes de Tránsito',
      organismoPadre: 'Secretaría de Tránsito',
      canal: 'BA Colaborativa › Denuncia vial',
    });
  });

  it('UT-3845-04 (E2): sin prestación es el canal general, marcado como sin destino verificado', () => {
    expect(describeRoutingDestination(SIN_DESTINO_CABA)).toMatchObject({
      kind: 'sin_destino',
      organismo: 'Gobierno de la Ciudad de Buenos Aires',
      canal: 'BA Colaborativa',
    });
    expect(describeRoutingDestination({ ...SIN_DESTINO_CABA, organismo_verificado: null, canal_verificado: null }))
      .toMatchObject({ kind: 'sin_destino', organismo: null });
  });

  it('UT-3845-05 (E3): fuera del piloto no se presenta ningún organismo', () => {
    const destino = describeRoutingDestination(FUERA_DEL_PILOTO);
    expect(destino.kind).toBe('fuera_del_piloto');
    expect(destino.organismo).toBeUndefined();
  });

  it('UT-3845-06: si ninguna regla desempata no se elige organismo; sin respuesta tampoco', () => {
    expect(describeRoutingDestination(NO_RESUELTO).kind).toBe('no_resuelto');
    expect(describeRoutingDestination(null)).toEqual({ kind: 'no_disponible' });
  });
});

describe('REP-3845 · pantalla «Reporte enviado»', () => {
  beforeEach(() => rpcMock.mockReset());

  it('UT-3845-07 (E1): pide el destino al montarse y muestra el organismo y el canal del catálogo', async () => {
    rpcMock.mockResolvedValue({ data: VERIFICADO_CABA, error: null });
    montar();

    expect(screen.getByTestId('success-destination')).toHaveAttribute('data-kind', 'consultando');
    expect(screen.queryByTestId('success-destination-agency')).not.toBeInTheDocument();

    await waitFor(() => expect(screen.getByTestId('success-destination')).toHaveAttribute('data-kind', 'verificado'));
    expect(screen.getByTestId('success-destination-agency')).toHaveTextContent('Dirección General del Cuerpo de Agentes de Tránsito');
    expect(screen.getByTestId('success-destination-channel')).toHaveTextContent('BA Colaborativa › Denuncia vial');
    expect(rpcMock).toHaveBeenCalledWith('route_report', { p_report_id: REPORT_ID });
  });

  it('UT-3845-08 (E2): sin destino verificado muestra el canal general con la salvedad visible', async () => {
    rpcMock.mockResolvedValue({ data: SIN_DESTINO_CABA, error: null });
    montar();

    await waitFor(() => expect(screen.getByTestId('success-destination')).toHaveAttribute('data-kind', 'sin_destino'));
    expect(screen.getByTestId('success-destination-agency')).toHaveTextContent('Gobierno de la Ciudad de Buenos Aires');
    expect(screen.getByText(/Destino sin verificar/)).toBeInTheDocument();
  });

  it('UT-3845-09 (E3): fuera del piloto informa la cobertura y no muestra ningún organismo', async () => {
    rpcMock.mockResolvedValue({ data: FUERA_DEL_PILOTO, error: null });
    montar();

    await waitFor(() => expect(screen.getByTestId('success-destination')).toHaveAttribute('data-kind', 'fuera_del_piloto'));
    expect(screen.queryByTestId('success-destination-agency')).not.toBeInTheDocument();
    expect(screen.getByText(/cubre CABA y Avellaneda/)).toBeInTheDocument();
  });

  it('UT-3845-10: si route_report falla, o no hay reporte, no se muestra un organismo supuesto', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'timeout' } });
    const { unmount } = montar();
    await waitFor(() => expect(screen.getByTestId('success-destination')).toHaveAttribute('data-kind', 'no_disponible'));
    expect(screen.queryByTestId('success-destination-agency')).not.toBeInTheDocument();
    unmount();

    rpcMock.mockClear();
    montar({ reportId: null });
    expect(screen.getByTestId('success-destination')).toHaveAttribute('data-kind', 'no_disponible');
    expect(rpcMock).not.toHaveBeenCalled();
    expect(screen.queryByText('Municipio de Avellaneda')).not.toBeInTheDocument();
    expect(screen.queryByText('Gobierno de la Ciudad de Buenos Aires')).not.toBeInTheDocument();
  });
});

describe('REP-3845 · sin organismo hardcodeado en el código', () => {
  const sinComentarios = (ruta) =>
    readFileSync(resolve(__dirname, '..', ruta), 'utf8')
      .split('\n')
      .filter((l) => !/^\s*(\/\/|\*|\/\*\*)/.test(l))
      .join('\n');

  it('UT-3845-11 (E4): ni NewReportPage ni la pantalla de éxito deciden el organismo por la localidad', () => {
    const page = sinComentarios('pages/NewReportPage.jsx');
    const success = sinComentarios('components/report/ReportSuccessScreen.jsx');
    expect(page).not.toMatch(/determinedAgency/);
    expect(page).not.toMatch(/agencyName=/);
    for (const code of [page, success]) {
      expect(code).not.toMatch(/'Municipio de Avellaneda'|'Gobierno de la Ciudad de Buenos Aires'/);
    }
  });
});
