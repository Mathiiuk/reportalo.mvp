/**
 * @file Rep3841AsistenciaSinDerivacion.test.jsx
 * @description REP-3841 (defecto O-06): un reporte de Vulnerabilidad social mostraba «va a ser derivado al área de
 * asistencia social» y un recorrido hasta «Notificado al responsable» y «Resuelto», aunque nadie deriva nada: el
 * backend lo deja en INFORMADO. Además el formulario no preguntaba si hay niñas, niños o adolescentes, así que
 * route_report no podía elegir el canal del catálogo (108 / 102 en CABA, Desarrollo Social / Consejo de Niñez en
 * Avellaneda) y caía al canal general. El motor (analizar-reporte) no se toca: queda congelado por la línea base P0.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const { rpcMock, fromCalls, upsertMock, attributeResult } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  fromCalls: [],
  upsertMock: vi.fn(),
  attributeResult: { data: { id: 'attr-prestacion' }, error: null },
}));

vi.mock('../lib/supabaseClient', () => {
  const chain = (table) => {
    const filters = [];
    const builder = {
      select: () => builder,
      eq: (column, value) => {
        filters.push([column, value]);
        return builder;
      },
      maybeSingle: async () => {
        fromCalls.push({ table, filters: [...filters] });
        return table === 'service_attributes' ? attributeResult : { data: null, error: null };
      },
      upsert: async (row, options) => {
        fromCalls.push({ table, row, options });
        return upsertMock(row, options);
      },
    };
    return builder;
  };
  return {
    isSupabaseConfigured: true,
    supabase: { rpc: (...args) => rpcMock(...args), from: (table) => chain(table), channel: undefined },
  };
});

import {
  SOCIAL_ASSISTANCE_OPTIONS,
  describeSocialAssistanceChannel,
  isSocialAssistanceCategory,
  saveSocialAssistancePrestacion,
} from '../services/socialAssistanceService';
import { ReportDetailsStep } from '../components/report/ReportDetailsStep';
import { ReportSuccessScreen } from '../components/report/ReportSuccessScreen';
import { ReportAiAnalysisPanel } from '../components/report/ReportAiAnalysisPanel';
import { buildTimeline } from '../components/report/reportStatus';

// Resultados reales de resolve_report_destination en la base (21/10/2026)
const CALLE_ADULTOS_CABA = {
  jurisdiccion: 'CABA',
  criterio: 'regla_inequivoca',
  accion: 'informar_canal',
  sin_destino_verificado: false,
  organismo_verificado: { id: 'o1', nombre: 'Ministerio de Desarrollo Humano y Hábitat' },
  canal_verificado: { tipo: 'telefono', valor: '108', etiqueta: 'Línea 108 (24 h), opción 1 «avisar por otra persona»' },
  canales_alternativos: [],
};
const CALLE_NINEZ_AVELLANEDA = {
  jurisdiccion: 'AVELLANEDA',
  criterio: 'regla_inequivoca',
  accion: 'informar_canal',
  sin_destino_verificado: false,
  organismo_verificado: { id: 'o2', nombre: 'Consejo de Niñez, Adolescencia y Familia' },
  canal_verificado: { tipo: 'telefono', valor: '115 426-1618', etiqueta: 'Guardia 24 h' },
  canales_alternativos: [{ tipo: 'email', valor: 'ninezadolescenciayflia@mda.gob.ar', etiqueta: 'Consejo de Niñez' }],
};
// Sin la respuesta de niñas/niños (todos los reportes anteriores a este cambio): canal general, sin verificar
const SIN_PRESTACION_CABA = {
  jurisdiccion: 'CABA',
  criterio: 'sin_destino',
  accion: 'ninguna',
  sin_destino_verificado: true,
  organismo_verificado: { id: 'g1', nombre: 'Gobierno de la Ciudad de Buenos Aires' },
  canal_verificado: { tipo: 'web', valor: 'https://bacolaborativa.buenosaires.gob.ar/', etiqueta: 'BA Colaborativa' },
  canales_alternativos: [],
};

const VULNERABILIDAD = { id: 'VULNERABILIDAD_SOCIAL', name: 'Vulnerabilidad social' };
const TRANSITO = { id: 'TRANSITO', name: 'Tránsito' };

beforeEach(() => {
  rpcMock.mockReset();
  upsertMock.mockReset();
  upsertMock.mockResolvedValue({ error: null });
  fromCalls.length = 0;
  attributeResult.data = { id: 'attr-prestacion' };
  attributeResult.error = null;
});

describe('REP-3841 · socialAssistanceService', () => {
  it('reconoce la categoría por id del formulario o por service_code', () => {
    expect(isSocialAssistanceCategory(VULNERABILIDAD)).toBe(true);
    expect(isSocialAssistanceCategory({ service_code: 'VULNERABILIDAD_SOCIAL' })).toBe(true);
    expect(isSocialAssistanceCategory('vulnerabilidad_social')).toBe(true);
    expect(isSocialAssistanceCategory(TRANSITO)).toBe(false);
    expect(isSocialAssistanceCategory(null)).toBe(false);
  });

  it('las opciones son las prestaciones del catálogo', () => {
    expect(SOCIAL_ASSISTANCE_OPTIONS.map((o) => o.key)).toEqual(['situacion_de_calle', 'situacion_de_calle_ninez']);
  });

  it('describe el canal verificado y los alternativos', () => {
    expect(describeSocialAssistanceChannel(CALLE_NINEZ_AVELLANEDA)).toEqual({
      organismo: 'Consejo de Niñez, Adolescencia y Familia',
      canales: [
        { tipo: 'telefono', valor: '115 426-1618', etiqueta: 'Guardia 24 h' },
        { tipo: 'email', valor: 'ninezadolescenciayflia@mda.gob.ar', etiqueta: 'Consejo de Niñez' },
      ],
    });
  });

  it('sin canal verificado (canal general, sin routing o sin canal) no inventa uno', () => {
    expect(describeSocialAssistanceChannel(SIN_PRESTACION_CABA)).toBeNull();
    expect(describeSocialAssistanceChannel(null)).toBeNull();
    expect(describeSocialAssistanceChannel({ ...CALLE_ADULTOS_CABA, canal_verificado: null })).toBeNull();
  });

  it('guarda la prestación en infraction_attribute_responses sin pisar una respuesta previa', async () => {
    const result = await saveSocialAssistancePrestacion({
      reportId: 'r1',
      serviceId: 's-vuln',
      prestacionKey: 'situacion_de_calle_ninez',
    });
    expect(result).toEqual({ success: true });
    expect(fromCalls[0]).toEqual({
      table: 'service_attributes',
      filters: [
        ['service_id', 's-vuln'],
        ['attribute_code', 'prestacion'],
      ],
    });
    expect(fromCalls[1]).toEqual({
      table: 'infraction_attribute_responses',
      row: { report_id: 'r1', attribute_id: 'attr-prestacion', selected_value: 'situacion_de_calle_ninez' },
      options: { onConflict: 'report_id,attribute_id', ignoreDuplicates: true },
    });
  });

  it('no guarda una prestación que no está en el catálogo, y nunca lanza', async () => {
    expect((await saveSocialAssistancePrestacion({ reportId: 'r1', serviceId: 's', prestacionKey: 'otra' })).success).toBe(false);
    expect(fromCalls).toHaveLength(0);

    attributeResult.data = null;
    expect(
      (await saveSocialAssistancePrestacion({ reportId: 'r1', serviceId: 's', prestacionKey: 'situacion_de_calle' })).success
    ).toBe(false);
    expect(upsertMock).not.toHaveBeenCalled();
  });
});

describe('REP-3841 · pregunta del paso 2', () => {
  const montarPaso = (props = {}) => {
    const handlers = { onContinue: vi.fn(), onSelectPrestacion: vi.fn() };
    render(
      <ReportDetailsStep
        categories={[TRANSITO, VULNERABILIDAD]}
        selectedCategory={VULNERABILIDAD}
        description="Hay una persona durmiendo en la vereda con mucho frío."
        onSelectCategory={vi.fn()}
        onChangeDescription={vi.fn()}
        onBack={vi.fn()}
        {...handlers}
        {...props}
      />
    );
    return handlers;
  };

  it('solo aparece con Vulnerabilidad social', () => {
    montarPaso({ selectedCategory: TRANSITO });
    expect(screen.queryByTestId('social-audience')).not.toBeInTheDocument();
  });

  it('sin respuesta no deja continuar y lo explica', () => {
    const { onContinue } = montarPaso();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(onContinue).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/elegí una opción/i);
  });

  it('elegir una opción informa la prestación y con respuesta continúa', () => {
    const { onSelectPrestacion } = montarPaso();
    fireEvent.click(screen.getByRole('radio', { name: 'Hay niñas, niños o adolescentes' }));
    expect(onSelectPrestacion).toHaveBeenCalledWith('situacion_de_calle_ninez');
  });

  it('con la respuesta elegida, continúa', () => {
    const { onContinue } = montarPaso({ prestacionKey: 'situacion_de_calle' });
    expect(screen.getByRole('radio', { name: 'Solo personas adultas' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(onContinue).toHaveBeenCalled();
  });
});

describe('REP-3841 · «Reporte enviado» de Vulnerabilidad social', () => {
  const montarAcuse = (category = VULNERABILIDAD) =>
    render(
      <ReportSuccessScreen
        reportId="11111111-2222-4333-8444-555555555555"
        reportCode="#RP-55555555"
        category={category}
        onViewReport={vi.fn()}
        onReturnToMap={vi.fn()}
      />
    );

  it('no promete una derivación y muestra el canal del catálogo', async () => {
    rpcMock.mockResolvedValue({ data: CALLE_ADULTOS_CABA, error: null });
    montarAcuse();
    expect(screen.getByTestId('success-subtitle')).toHaveTextContent('Reportalo no deriva este caso a ningún organismo');
    expect(screen.queryByText(/en camino al organismo/i)).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('success-destination')).toHaveAttribute('data-kind', 'informar_canal'));
    expect(screen.getByTestId('success-destination-agency')).toHaveTextContent('Ministerio de Desarrollo Humano y Hábitat');
    expect(screen.getByTestId('success-destination-channel')).toHaveTextContent(/^108 · Línea 108/);
  });

  it('el recorrido es Enviado → Informado, sin «Notificado al responsable» ni «Resuelto»', async () => {
    rpcMock.mockResolvedValue({ data: CALLE_ADULTOS_CABA, error: null });
    montarAcuse();
    expect(screen.getByTestId('tracker-step-enviado')).toBeInTheDocument();
    expect(screen.getByTestId('tracker-step-informado')).toBeInTheDocument();
    expect(screen.queryByTestId('tracker-step-notificado')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tracker-step-resuelto')).not.toBeInTheDocument();
    await waitFor(() => expect(rpcMock).toHaveBeenCalled());
  });

  it('sin canal verificado lo dice, y no muestra el canal general como si lo fuera', async () => {
    rpcMock.mockResolvedValue({ data: SIN_PRESTACION_CABA, error: null });
    montarAcuse();
    await waitFor(() => expect(screen.getByTestId('success-destination')).toHaveAttribute('data-kind', 'sin_canal'));
    expect(screen.getByTestId('success-destination')).toHaveTextContent('No tenemos un canal verificado para este caso');
    expect(screen.queryByText('BA Colaborativa')).not.toBeInTheDocument();
  });

  it('las otras categorías siguen igual', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });
    montarAcuse(TRANSITO);
    expect(screen.getByTestId('tracker-step-notificado')).toBeInTheDocument();
    await waitFor(() => expect(rpcMock).toHaveBeenCalled());
  });
});

describe('REP-3841 · panel del detalle', () => {
  const ASISTENCIA = { result_status_code: 'asistencia', report_ai_evidence: [] };

  it('dice que no deriva, muestra el canal y declara que no hay fundamento', () => {
    render(<ReportAiAnalysisPanel analysis={ASISTENCIA} socialChannel={describeSocialAssistanceChannel(CALLE_NINEZ_AVELLANEDA)} />);
    const panel = screen.getByTestId('rag-panel');
    expect(panel).toHaveTextContent('Reportalo no deriva este reporte a ningún organismo');
    expect(panel).not.toHaveTextContent(/va a ser derivado/i);
    expect(screen.getByTestId('rag-panel-channel')).toHaveTextContent('Consejo de Niñez, Adolescencia y Familia');
    expect(screen.getByTestId('rag-panel-channel')).toHaveTextContent('115 426-1618');
    expect(screen.getByTestId('rag-panel-no-foundation')).toBeInTheDocument();
  });

  it('sin canal verificado se abstiene', () => {
    render(<ReportAiAnalysisPanel analysis={ASISTENCIA} socialChannel={null} />);
    expect(screen.getByTestId('rag-panel-no-channel')).toBeInTheDocument();
    expect(screen.queryByTestId('rag-panel-channel')).not.toBeInTheDocument();
  });

  it('el texto guardado por el motor («va a ser derivado») nunca llega a pantalla', () => {
    render(
      <ReportAiAnalysisPanel
        analysis={{ ...ASISTENCIA, citizen_feedback: 'Tu reporte va a ser derivado al área de asistencia social correspondiente.' }}
      />
    );
    expect(screen.getByTestId('rag-panel')).not.toHaveTextContent(/va a ser derivado/i);
  });
});

describe('REP-3841 · historial del detalle', () => {
  it('mientras se analiza: Enviado actual e Informado pendiente', () => {
    const steps = buildTimeline({ currentState: 'EN_ANALISIS', createdAt: '2026-10-21T10:00:00Z', socialAssistance: true });
    expect(steps.map((s) => [s.key, s.done, s.current])).toEqual([
      ['enviado', true, true],
      ['informado', false, false],
    ]);
  });

  it('descartado se agrega al final, como en el recorrido general', () => {
    const steps = buildTimeline({ currentState: 'DESESTIMADO', createdAt: '2026-10-21T10:00:00Z', socialAssistance: true });
    expect(steps.map((s) => s.key)).toEqual(['enviado', 'informado', 'descartado']);
    expect(steps.at(-1)).toMatchObject({ current: true, discarded: true });
  });

  it('las otras categorías conservan los cuatro pasos', () => {
    const steps = buildTimeline({ currentState: 'RECIBIDO', createdAt: '2026-10-21T10:00:00Z' });
    expect(steps.map((s) => s.key)).toEqual(['enviado', 'en_revision', 'notificado', 'resuelto']);
  });
});
