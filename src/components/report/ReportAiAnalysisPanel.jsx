import React from 'react';
import { Sparkles, Scale, ShieldQuestion, HeartHandshake, PhoneCall, Clock3, AlertTriangle } from 'lucide-react';

/**
 * Panel de fundamento legal para el ciudadano (REP-2909, bloque 4).
 * UJ v3.3 · M16 / D17 «Fundamento legal» (REP-3791 Bloque 3): acá aterriza el panel que salió
 * del paso de clasificación. Muestra el resultado del RAG (REP-2908) tal cual quedó guardado en
 * report_ai_analysis. Nunca inventa texto: cada estado tiene su propio mensaje transparente, y
 * jamás se muestra el contenido de un fragmento de tipo "sancion" acá (eso es fundamento para el
 * organismo, no para el ciudadano — docs/REP-1009_RAG_de_punta_a_punta.docx §6).
 */

const STATE_CONFIG = {
  fundamentado: {
    icon: Scale,
    tone: 'bg-rep-accent-soft text-rep-accent',
    badge: 'Analizado',
    badgeTone: 'bg-rep-success-soft text-rep-success',
    title: 'Fundamento legal',
  },
  sin_normativa: {
    icon: ShieldQuestion,
    tone: 'bg-rep-track text-rep-ink-label',
    badge: 'Sin normativa',
    badgeTone: 'bg-rep-track text-rep-ink-label',
    title: 'Sin normativa cargada',
    message: 'Todavía no tenemos normativa cargada en nuestra base para este tipo de reclamo. Tu reporte sigue su curso igual.',
  },
  indeterminado: {
    icon: Clock3,
    tone: 'bg-rep-track text-rep-ink-label',
    badge: 'No concluyente',
    badgeTone: 'bg-rep-track text-rep-ink-label',
    title: 'Análisis no concluyente',
    message: 'No pudimos determinar un fundamento con la información disponible. Un funcionario va a revisar tu reporte.',
  },
  fuera_de_alcance: {
    icon: PhoneCall,
    tone: 'bg-rep-warning-soft text-rep-warning-ink',
    badge: 'Fuera de alcance',
    badgeTone: 'bg-rep-warning-soft text-rep-warning-ink',
    title: 'Fuera del alcance de Reportalo',
    message: 'Este tipo de situación no se gestiona por esta plataforma. Si es una emergencia, comunicate al 911.',
  },
  asistencia: {
    icon: HeartHandshake,
    tone: 'bg-rep-success-soft text-rep-success',
    badge: 'Asistencia',
    badgeTone: 'bg-rep-success-soft text-rep-success',
    title: 'Situación de asistencia',
    message: 'Tu reporte va a ser derivado al área de asistencia social correspondiente.',
  },
};

const CARD =
  'flex flex-col gap-3 rounded-2xl border border-rep-border bg-rep-surface p-4 shadow-rep-card desktop:p-5';

const FIELD_LABEL =
  'text-rep-label font-bold text-rep-ink-label desktop:text-rep-label-d desktop:uppercase desktop:tracking-wide desktop:text-rep-ink-muted';

// Cabecera común: título con ícono y etiqueta de estado a la derecha
const PanelHeader = ({ icon: Icon, iconTone, title, badge, badgeTone, pulse = false }) => (
  <div className="flex items-center gap-2.5">
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${iconTone}`}>
      <Icon aria-hidden="true" size={16} strokeWidth={2.25} />
    </span>
    <h3 className="m-0 flex-1 text-rep-body font-extrabold text-rep-ink desktop:text-rep-body-d">{title}</h3>
    {badge && (
      <span className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-rep-pill uppercase tracking-wide ${badgeTone}`}>
        {pulse && <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-current motion-reduce:animate-none" />}
        {badge}
      </span>
    )}
  </div>
);

export const ReportAiAnalysisPanel = ({ analysis, loading = false, error = null }) => {
  // REP-3789: el error va antes que el estado pendiente a proposito. Si la lectura
  // del analisis fallo, mostrar «lo estamos analizando» dejaria al ciudadano
  // esperando indefinidamente algo que nunca va a llegar solo.
  // Se conserva de REP-3789 y se restila con los tokens del UJ v3.3.
  if (error && !analysis) {
    return (
      <section data-testid="rag-panel-error" role="alert" className={CARD}>
        <PanelHeader
          icon={AlertTriangle}
          iconTone="bg-rep-danger-soft text-rep-danger"
          title="No pudimos cargar el fundamento legal"
        />
        <p className="m-0 text-rep-body text-rep-ink-body desktop:text-rep-body-d">
          Volvé a entrar en un rato. Tu reporte sigue su curso igual.
        </p>
      </section>
    );
  }

  // «Analizando»: mientras el fundamento no llegó (UJ v3.3 · M16)
  if (loading || !analysis || !analysis.result_status_code) {
    return (
      <section
        data-testid={loading ? 'rag-panel-loading' : 'rag-panel-pending'}
        aria-live="polite"
        aria-busy="true"
        className={CARD}
      >
        <PanelHeader
          icon={Sparkles}
          iconTone="bg-rep-accent-soft text-rep-accent"
          title="Fundamento legal"
          badge="Analizando"
          badgeTone="bg-rep-accent-soft text-rep-accent"
          pulse
        />
        <p className="m-0 text-rep-body text-rep-ink-body desktop:text-rep-body-d">
          {loading
            ? 'Analizando el fundamento legal de tu reporte…'
            : 'Estamos analizando tu reporte. El fundamento legal va a aparecer acá en unos minutos.'}
        </p>
      </section>
    );
  }

  const config = STATE_CONFIG[analysis.result_status_code];
  if (!config) {
    return null;
  }

  const isGrounded = analysis.result_status_code === 'fundamentado';
  const agencyName = analysis.agencies?.name || null;
  const citedEvidence = (analysis.report_ai_evidence || []).filter(
    (e) => e.was_cited && e.knowledge_fragments?.foundation_type_code !== 'sancion'
  );

  // REP-3789 CA-09: la trazabilidad del analisis mostrado (id, modelo y version de
  // prompt) viaja como atributos data-*, disponible para QA y Sprint Review sin
  // ensuciar la interfaz del ciudadano.
  return (
    <section
      data-testid="rag-panel"
      data-status={analysis.result_status_code}
      data-analysis-id={analysis.id ?? undefined}
      data-generation-model={analysis.generation_model_code ?? undefined}
      data-prompt-version={analysis.prompt_version ?? undefined}
      aria-label={config.title}
      className={`${CARD} ${
        isGrounded
          ? 'border-rep-accent-border border-l-[3px] border-l-rep-accent bg-rep-accent-soft desktop:border-l desktop:border-l-rep-border desktop:border-rep-border desktop:bg-rep-surface'
          : ''
      }`}
    >
      <PanelHeader
        icon={isGrounded ? Sparkles : config.icon}
        iconTone={config.tone}
        title={config.title}
        badge={config.badge}
        badgeTone={config.badgeTone}
      />

      {isGrounded ? (
        <>
          {analysis.citizen_feedback && (
            <p className="m-0 text-rep-body text-rep-ink-body desktop:text-rep-body-d">{analysis.citizen_feedback}</p>
          )}

          {(citedEvidence.length > 0 || agencyName) && (
            <div className="grid gap-3 desktop:grid-cols-2 desktop:gap-6">
              {citedEvidence.length > 0 && (
                <div data-testid="rag-panel-citations" className="flex flex-col gap-1">
                  <span className={FIELD_LABEL}>Norma detectada</span>
                  {citedEvidence.map((e) => (
                    <span key={e.fragment_id} className="text-rep-body font-semibold text-rep-ink desktop:text-rep-body-d">
                      {e.knowledge_fragments?.hierarchy_path}
                    </span>
                  ))}
                </div>
              )}
              {agencyName && (
                <div data-testid="rag-panel-agency" className="flex flex-col gap-1">
                  <span className={FIELD_LABEL}>Organismo competente</span>
                  <span className="text-rep-body font-semibold text-rep-ink desktop:text-rep-body-d">{agencyName}</span>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <p className="m-0 text-rep-body text-rep-ink-body desktop:text-rep-body-d">{config.message}</p>
      )}
    </section>
  );
};

export default ReportAiAnalysisPanel;
