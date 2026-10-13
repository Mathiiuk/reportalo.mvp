-- REP-2902 — Fundamento legal preliminar trazable para el reporte que recibirá el organismo (Sprint 16)
--
-- Arma, a partir del análisis RAG ya persistido, el componente de CONTENIDO JURÍDICO del reporte al organismo
-- (lo consume REP-2801 desde el servidor y la app desde un servicio chico). No es un segundo motor de envío ni
-- genera texto nuevo: solo reúne lo que el RAG ya produjo y verifica que sea trazable al corpus.
--
-- Una sola función de solo lectura: get_report_legal_foundation(p_report_id) -> jsonb
--
-- QUÉ DEVUELVE
--   status = 'fundamento_preliminar'     el análisis fue 'fundamentado' Y al menos una cita pasó la verificación
--   status = 'sin_fundamento_verificado' cualquier otro caso: SIN texto jurídico y con el motivo (nunca se rellena)
--   status = 'pendiente'                 todavía no hay análisis para el reporte
--   null                                 quien llama no es el autor, ni quien atiende el reporte, ni el servidor:
--                                        no se revela ni siquiera si existe un análisis
--
-- VERIFICACIÓN DE CADA CITA (solo las que la pasan salen en `citations`)
--   1. fue citada por el análisis (was_cited) y trae texto citado;
--   2. el texto citado es una subcadena literal del fragmento del corpus (no se fabrican citas);
--   3. la fuente es aplicable a la jurisdicción del reporte según eligible_knowledge_sources(locality_id), que es
--      el mismo cascade (municipio -> provincia/CABA -> nación, con adhesiones) que usa la recuperación del RAG.
--      Una fuente que ya no es vigente tampoco pasa: ante la duda no viaja.
--   Las que fallan se cuentan en verification.citations_excluded pero NO viajan.
--
-- SEPARACIÓN «fundamento preliminar» / «decisión administrativa»
--   Todo resultado lleva is_ai_generated = true y un aviso fijo (disclaimer) que dice que es un fundamento
--   preliminar generado con asistencia de IA y NO una decisión administrativa ni una resolución estatal.
--
-- VISIBILIDAD (política del ticket: la respuesta de IA completa es solo para el reportante)
--   * Nunca se devuelve citizen_feedback (el texto redactado para el ciudadano) ni confidence_score.
--   * Solo accede el autor del reporte, quien atiende el reporte (profile_attends_report, la misma regla que las
--     policies de report_ai_analysis) y service_role.
--   * Que algo se ENVÍE al organismo es decisión de REP-2801 y de los permisos que apruebe el PO; esta función
--     solo asegura que lo que se arme no incluya nada de más y que un tercero no lo pueda leer.
--
-- Es SECURITY INVOKER a propósito: las policies de report_ai_analysis / report_ai_evidence siguen aplicando
-- como segunda barrera. No toca ninguna tabla ni policy existente.
-- No se aplica sola: la migración se corre a mano en staging (ver docs/REP-2902_Fundamento_legal_preliminar.md).

begin;

create or replace function public.get_report_legal_foundation(p_report_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  c_disclaimer constant text :=
    'Fundamento preliminar generado con asistencia de inteligencia artificial a partir del corpus normativo '
    'verificado del proyecto. No es una decisión administrativa ni una resolución estatal: la decisión '
    'corresponde exclusivamente al organismo competente.';

  v_uid          uuid := auth.uid();
  v_report       public.citizen_reports%rowtype;
  v_analysis     public.report_ai_analysis%rowtype;
  v_allowed      boolean;
  v_jurisdiction jsonb;
  v_citations    jsonb;
  v_total        integer;
  v_verified     integer;
  v_status       text;
  v_reason       text;
begin
  select * into v_report from public.citizen_reports where id = p_report_id;
  if not found then
    return null;
  end if;

  -- Quién puede ver el fundamento: el autor, quien atiende el reporte y el servidor
  v_allowed := coalesce(auth.role(), '') = 'service_role'
            or (v_uid is not null and v_report.user_id = v_uid)
            or (v_uid is not null and public.profile_attends_report(v_uid, p_report_id));
  if not v_allowed then
    return null;
  end if;

  -- Jurisdicción efectiva del reporte (la que usó la recuperación)
  select jsonb_build_object('locality', l.name, 'subdivision', sd.name, 'state_province', sp.name)
    into v_jurisdiction
    from public.localities l
    join public.subdivisions sd on sd.id = l.subdivision_id
    join public.states_provinces sp on sp.id = sd.state_province_id
   where l.id = v_report.locality_id;

  select * into v_analysis
    from public.report_ai_analysis
   where report_id = p_report_id
   order by created_at desc
   limit 1;

  if not found then
    return jsonb_build_object(
      'schema_version', 1,
      'report_id', p_report_id,
      'status', 'pendiente',
      'is_ai_generated', true,
      'disclaimer', c_disclaimer,
      'jurisdiction', v_jurisdiction,
      'citations', '[]'::jsonb
    );
  end if;

  -- Citas verificadas, en el orden de relevancia con que las recuperó el RAG
  with ev as (
    select e.rank,
           e.quoted_text,
           f.id            as fragment_id,
           f.hierarchy_path,
           f.article,
           f.subsection,
           f.is_current    as fragment_is_current,
           s.document_type_code,
           s.document_number,
           s.title         as source_title,
           s.issuing_authority,
           s.source_url,
           s.verified_at,
           s.last_amended_by,
           (e.quoted_text is not null
              and btrim(e.quoted_text) <> ''
              and position(e.quoted_text in f.content) > 0)                        as quote_is_literal,
           (s.id in (select k.source_id
                       from public.eligible_knowledge_sources(v_report.locality_id) k)) as in_jurisdiction
      from public.report_ai_evidence e
      join public.knowledge_fragments f on f.id = e.fragment_id
      join public.knowledge_sources s   on s.id = f.source_id
     where e.analysis_id = v_analysis.id
       and e.was_cited
  )
  select count(*)::integer,
         count(*) filter (where quote_is_literal and in_jurisdiction)::integer,
         coalesce(
           jsonb_agg(
             jsonb_build_object(
               'fragment_id',         fragment_id,
               'reference',           hierarchy_path,
               'article',             article,
               'subsection',          subsection,
               'quoted_text',         quoted_text,
               'document_type',       document_type_code,
               'document_number',     document_number,
               'source_title',        source_title,
               'issuing_authority',   issuing_authority,
               'source_url',          source_url,
               'verified_at',         verified_at,
               'last_amended_by',     last_amended_by,
               'fragment_is_current', fragment_is_current
             )
             order by rank
           ) filter (where quote_is_literal and in_jurisdiction),
           '[]'::jsonb)
    into v_total, v_verified, v_citations
    from ev;

  if v_analysis.result_status_code = 'fundamentado' and v_verified > 0 then
    v_status := 'fundamento_preliminar';
  else
    v_status := 'sin_fundamento_verificado';
    v_reason := case
      when v_analysis.result_status_code = 'fundamentado' then
        'El análisis indicó un fundamento, pero ninguna cita pudo verificarse contra el corpus para la jurisdicción del reporte.'
      when v_analysis.result_status_code = 'sin_normativa' then
        'No se halló norma suficiente en el corpus para este reclamo.'
      when v_analysis.result_status_code = 'indeterminado' then
        'El análisis no pudo determinar un fundamento normativo verificable.'
      when v_analysis.result_status_code = 'fuera_de_alcance' then
        'El reclamo está fuera del alcance del análisis normativo.'
      when v_analysis.result_status_code = 'asistencia' then
        'El reclamo corresponde a asistencia social: no hay una norma que citar como fundamento.'
      else
        'No hay un fundamento normativo verificado para este reclamo.'
    end;
    v_citations := '[]'::jsonb;
  end if;

  return jsonb_build_object(
    'schema_version', 1,
    'report_id', p_report_id,
    'analysis_id', v_analysis.id,
    'status', v_status,
    'is_ai_generated', true,
    'disclaimer', c_disclaimer,
    'generated_at', v_analysis.created_at,
    'prompt_version', v_analysis.prompt_version,
    'generation_model_code', v_analysis.generation_model_code,
    'jurisdiction', v_jurisdiction,
    -- El texto técnico solo viaja si hay fundamento verificado; nunca el texto del ciudadano
    'official_foundation',
      case when v_status = 'fundamento_preliminar' then v_analysis.official_legal_foundation else null end,
    'abstention_reason', v_reason,
    'citations', v_citations,
    'verification', jsonb_build_object(
      'citations_cited',    v_total,
      'citations_verified', v_verified,
      'citations_excluded', v_total - v_verified
    )
  );
end;
$$;

revoke all on function public.get_report_legal_foundation(uuid) from public, anon;
grant execute on function public.get_report_legal_foundation(uuid) to authenticated, service_role;

comment on function public.get_report_legal_foundation(uuid) is
  'REP-2902. Fundamento legal preliminar trazable de un reporte (solo autor, quien lo atiende y service_role). '
  'No incluye citizen_feedback ni confidence_score. Solo cita lo verificable contra el corpus y la jurisdicción.';

commit;
