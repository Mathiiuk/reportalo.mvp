import React from 'react';
import { Scale, ShieldQuestion, HeartHandshake, PhoneCall, Clock3 } from 'lucide-react';

/**
 * Panel de fundamento legal para el ciudadano (REP-2909, bloque 4).
 * Muestra el resultado del RAG (REP-2908) tal cual quedó guardado en
 * report_ai_analysis. Nunca inventa texto: cada estado tiene su propio
 * mensaje transparente, y jamás se muestra el contenido de un fragmento
 * de tipo "sancion" acá (eso es fundamento para el organismo, no para
 * el ciudadano — docs/REP-1009_RAG_de_punta_a_punta.docx §6).
 */

const STATE_CONFIG = {
  fundamentado: {
    icon: Scale,
    color: 'text-[#1E6FCB] bg-[#EEF5FC]',
    title: 'Fundamento legal',
  },
  sin_normativa: {
    icon: ShieldQuestion,
    color: 'text-[#7A8696] bg-[#F1F4F8]',
    title: 'Sin normativa cargada',
    message: 'Todavía no tenemos normativa cargada en nuestra base para este tipo de reclamo. Tu reporte sigue su curso igual.',
  },
  indeterminado: {
    icon: Clock3,
    color: 'text-[#7A8696] bg-[#F1F4F8]',
    title: 'Análisis no concluyente',
    message: 'No pudimos determinar un fundamento con la información disponible. Un funcionario va a revisar tu reporte.',
  },
  fuera_de_alcance: {
    icon: PhoneCall,
    color: 'text-[#E08A00] bg-[#FFF6E9]',
    title: 'Fuera del alcance de Reportalo',
    message: 'Este tipo de situación no se gestiona por esta plataforma. Si es una emergencia, comunicate al 911.',
  },
  asistencia: {
    icon: HeartHandshake,
    color: 'text-[#2E9E6B] bg-[#E3F5EC]',
    title: 'Situación de asistencia',
    message: 'Tu reporte va a ser derivado al área de asistencia social correspondiente.',
  },
};

export const ReportAiAnalysisPanel = ({ analysis, loading = false }) => {
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

  const citedEvidence = (analysis.report_ai_evidence || []).filter(
    (e) => e.was_cited && e.knowledge_fragments?.foundation_type_code !== 'sancion'
  );

  return (
    <div data-testid="rag-panel" data-status={analysis.result_status_code} className="rounded-2xl border border-[#E6ECF3] bg-white p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <span className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${config.color}`}>
          <Icon size={16} />
        </span>
        <h3 className="font-extrabold text-[13.5px] text-[#1B365D] m-0">{config.title}</h3>
      </div>

      {analysis.result_status_code === 'fundamentado' ? (
        <>
          <p className="text-[13px] text-[#475569] leading-[1.55] m-0">{analysis.citizen_feedback}</p>
          {citedEvidence.length > 0 && (
            <div data-testid="rag-panel-citations" className="flex flex-col gap-1.5 pt-2 border-t border-[#EEF1F5]">
              <span className="text-[11px] font-bold text-[#7A8696] uppercase tracking-wider">Normativa aplicable</span>
              {citedEvidence.map((e) => (
                <div key={e.fragment_id} className="text-[12px] text-[#5B6A7A]">
                  {e.knowledge_fragments?.hierarchy_path}
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="text-[13px] text-[#475569] leading-[1.55] m-0">{config.message}</p>
      )}
    </div>
  );
};
