import React from 'react';
import { Scale, ShieldQuestion, HeartHandshake, PhoneCall, Clock3, AlertTriangle } from 'lucide-react';

/**
 * Panel de fundamento legal para el ciudadano (REP-2909, bloque 4).
 * Muestra el resultado del RAG (REP-2908) tal cual quedó guardado en
 * report_ai_analysis. Nunca inventa texto: cada estado tiene su propio
 * mensaje transparente, y jamás se muestra el contenido de un fragmento
 * de tipo "sancion" acá (eso es fundamento para el organismo, no para
 * el ciudadano — docs/REP-1009_RAG_de_punta_a_punta.docx §6).
 *
 * REP-3789: se integra al detalle del reporte y se alinea con el mockup del
 * User Journey v3.2 — bloque "Norma detectada" + "Organismo competente" y
 * distintivo de estado. La trazabilidad exigida por el ticket (id del análisis,
 * modelo y versión de prompt) viaja como atributos `data-*`: queda disponible
 * para QA y Sprint Review sin ensuciar la interfaz del ciudadano.
 */

const STATE_CONFIG = {
  fundamentado: {
    icon: Scale,
    color: 'text-[#1E6FCB] bg-[#EEF5FC]',
    title: 'Fundamento legal',
    badge: { label: 'ANALIZADO', className: 'text-[#2E9E6B] bg-[#E3F5EC]' },
  },
  sin_normativa: {
    icon: ShieldQuestion,
    color: 'text-[#7A8696] bg-[#F1F4F8]',
    title: 'Sin normativa cargada',
    message: 'Todavía no tenemos normativa cargada en nuestra base para este tipo de reclamo. Tu reporte sigue su curso igual.',
    badge: { label: 'SIN NORMATIVA', className: 'text-[#7A8696] bg-[#F1F4F8]' },
  },
  indeterminado: {
    icon: Clock3,
    color: 'text-[#7A8696] bg-[#F1F4F8]',
    title: 'Análisis no concluyente',
    message: 'No pudimos determinar un fundamento con la información disponible. Un funcionario va a revisar tu reporte.',
    badge: { label: 'A REVISAR', className: 'text-[#7A8696] bg-[#F1F4F8]' },
  },
  fuera_de_alcance: {
    icon: PhoneCall,
    color: 'text-[#E08A00] bg-[#FFF6E9]',
    title: 'Fuera del alcance de Reportalo',
    message: 'Este tipo de situación no se gestiona por esta plataforma. Si es una emergencia, comunicate al 911.',
    badge: { label: 'FUERA DE ALCANCE', className: 'text-[#E08A00] bg-[#FFF6E9]' },
  },
  asistencia: {
    icon: HeartHandshake,
    color: 'text-[#2E9E6B] bg-[#E3F5EC]',
    title: 'Situación de asistencia',
    message: 'Tu reporte va a ser derivado al área de asistencia social correspondiente.',
    badge: { label: 'ASISTENCIA', className: 'text-[#2E9E6B] bg-[#E3F5EC]' },
  },
};

export const ReportAiAnalysisPanel = ({ analysis, loading = false, error = null }) => {
  // El error va antes que el estado pendiente a propósito: si la lectura del
  // análisis falló, mostrar "lo estamos analizando" dejaría al ciudadano
  // esperando indefinidamente algo que nunca va a llegar solo.
  if (error && !analysis) {
    return (
      <div
        data-testid="rag-panel-error"
        className="rounded-xl border border-[#F7D2CC] bg-[#FDF3F2] p-4 flex items-start gap-2.5"
      >
        <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[#C0392B] bg-[#FBE4E0]">
          <AlertTriangle size={16} />
        </span>
        <div className="flex flex-col gap-0.5">
          <h3 className="font-extrabold text-[13.5px] text-[#1B365D] m-0">
            No pudimos cargar el fundamento legal
          </h3>
          <p className="text-[12.5px] text-[#56657A] leading-[1.5] m-0">
            Volvé a entrar en un rato. Tu reporte sigue su curso igual.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div data-testid="rag-panel-loading" className="rounded-2xl border border-[#E6ECF3] bg-white p-4 text-[13px] text-[#7A8696]">
        Analizando el fundamento legal de tu reporte…
      </div>
    );
  }

  if (!analysis || !analysis.result_status_code) {
    return (
      <div data-testid="rag-panel-pending" className="rounded-2xl border border-[#E6ECF3] bg-white p-4 text-[13px] text-[#7A8696]">
        Estamos analizando tu reporte. El fundamento legal va a aparecer acá en unos minutos.
      </div>
    );
  }

  const config = STATE_CONFIG[analysis.result_status_code];
  if (!config) {
    return null;
  }

  const Icon = config.icon;
  const isFundamentado = analysis.result_status_code === 'fundamentado';

  const citedEvidence = (analysis.report_ai_evidence || []).filter(
    (e) => e.was_cited && e.knowledge_fragments?.foundation_type_code !== 'sancion'
  );

  // "Organismo competente" del mockup: sale de suggested_agency_id ya resuelto
  // a nombre por el join. Si el análisis no sugirió organismo, la fila no se
  // dibuja — no se completa con un texto genérico.
  const agencyName = analysis.agencies?.name ?? null;

  return (
    <div
      data-testid="rag-panel"
      data-status={analysis.result_status_code}
      data-analysis-id={analysis.id ?? undefined}
      data-generation-model={analysis.generation_model_code ?? undefined}
      data-prompt-version={analysis.prompt_version ?? undefined}
      className={`rounded-xl p-4 flex flex-col gap-3 ${
        isFundamentado
          ? 'bg-[#EEF5FC] border border-[#D4E6F8] border-l-4 border-l-[#1E6FCB]'
          : 'bg-white border border-[#E6ECF3]'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${config.color}`}>
          <Icon size={16} />
        </span>
        <h3 className="font-extrabold text-[13.5px] text-[#1B365D] m-0">{config.title}</h3>
        <span className={`ml-auto font-bold text-[9px] px-2 py-1 rounded-lg tracking-wide ${config.badge.className}`}>
          {config.badge.label}
        </span>
      </div>

      {isFundamentado ? (
        <>
          <p className="text-[13px] text-[#475569] leading-[1.55] m-0">{analysis.citizen_feedback}</p>

          {citedEvidence.length > 0 && (
            <div data-testid="rag-panel-citations" className="flex flex-col gap-1 pt-2.5 border-t border-[#D4E6F8]">
              <span className="font-bold text-[10.5px] text-[#34435A]">Norma detectada</span>
              {citedEvidence.map((e) => (
                <div key={e.fragment_id} className="text-[10.5px] leading-[1.4] text-[#56657A]">
                  {e.knowledge_fragments?.hierarchy_path}
                </div>
              ))}
            </div>
          )}

          {agencyName && (
            <div data-testid="rag-panel-agency" className="flex flex-col gap-1">
              <span className="font-bold text-[10.5px] text-[#34435A]">Organismo competente</span>
              <span className="text-[10.5px] leading-[1.4] text-[#56657A]">{agencyName}</span>
            </div>
          )}
        </>
      ) : (
        <p className="text-[13px] text-[#475569] leading-[1.55] m-0">{config.message}</p>
      )}
    </div>
  );
};
