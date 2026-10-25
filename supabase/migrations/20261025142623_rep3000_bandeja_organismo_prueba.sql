-- REP-3000 — Bandeja del organismo de prueba (Sprint 18)
--
-- Fuente funcional: reglas del panel v1.0 (REP-3876) §3, §4 y §10 (D-03); Hernán D7 (24/10/2026): «entrega interna
-- efectiva al operador de prueba»; PM (25/10/2026): sin migración masiva de históricos, QA con reportes nuevos.
--
-- Estado previo (verificado en staging el 25/10/2026):
--   * profile_attends_report solo miraba jurisdicción: un operador podía ver 13 reportes INFORMADO (vulnerabilidad
--     social), contra §3.
--   * Nada generaba el borrador: prepare_organism_delivery (REP-2801) no la llama la app, ninguna Edge Function, ni
--     cron, ni trigger. Las 6 entregas existentes son del 16/10 y se crearon a mano.
--   * Generando el borrador para los últimos 60 reportes de CABA y Avellaneda (ROLLBACK): 60/60 «pendiente_sin_canal»
--     («No se identificó la prestación»: la app no le pregunta la prestación al vecino). Con prestación
--     (vehiculo_mal_estacionado) sale «borrador_generado» en las dos jurisdicciones.
--   * La transición EN_ANALISIS → DERIVADO decía «solo cuando se envíe DE VERDAD», en contra de D-03/D7.
--
-- Cambios:
--   1. profile_attends_report exige, además de la jurisdicción (REP-3747), una entrega «borrador_generado» y un estado
--      del circuito del panel (DERIVADO, ESCALADO, EN_DISCREPANCIA, RESUELTO, DESESTIMADO). Como alimenta todas las
--      RLS de quien atiende, nunca entran INFORMADO, fuera de alcance ni reportes sin destino.
--   2. deliver_report_to_test_inbox(report, prestación): genera el borrador (prepare_organism_delivery) y, si salió
--      «borrador_generado», el análisis no es fuera_de_alcance ni asistencia y un organismo de prueba cubre la
--      jurisdicción, pasa el reporte a DERIVADO como «sistema», con el motivo de entrega interna. Solo service_role.
--   3. Se dispara al guardar el análisis RAG: constraint trigger diferido (corre al final de la transacción de
--      persist_rag_analysis, cuando el estado ya quedó definido) y protegido: si la entrega falla, el análisis se
--      guarda igual.
--   4. Texto D7 en la transición EN_ANALISIS → DERIVADO.
--   5. get_panel_inbox(): la bandeja del operador con sesión. Sin descripción, user_id ni fotos.
--
-- Fuera de alcance: los reportes reales sin prestación (hoy, todos) no entran, por la regla §3. Previsto en el riesgo
-- S-6 de la viabilidad del PO y resuelto por el PM (25/10): QA con reportes nuevos + casos de prueba
-- (docs/runbooks/REP-3000_datos_de_prueba_bandeja.md). No se tocan estados ni entregas históricas.
--
-- ROLLBACK:
--   `drop trigger trg_report_ai_analysis_deliver on public.report_ai_analysis;`
--   `drop function public.trg_deliver_report_to_test_inbox(); drop function public.deliver_report_to_test_inbox(uuid, text);`
--   `drop function public.get_panel_inbox();`
--   profile_attends_report: versión de 20261025134919_rep3747_acceso_panel_operador.sql
--   transición: notes y approved_by anteriores (20261015140000_rep2502_estados_definidos_por_el_po.sql)
--
-- No se aplica sola: la migración se corre a mano en staging.
--
-- APLICADA en la base Reportalo el 25/10/2026, con aprobación de Matías. Versión registrada 20261025142623; el archivo
-- se renombró para coincidir. Verificado con sesiones simuladas (17/17): INFORMADO visibles para operadores 13 → 0;
-- entrega con prestación → DERIVADO con motivo de entrega interna (CABA y Avellaneda); fuera de alcance e INFORMADO
-- excluidos; el trigger genera la entrega sin tocar el análisis; cada operador ve solo su bandeja y el ciudadano nada;
-- authenticated no ejecuta la entrega y anon no ejecuta la bandeja.

begin;

-- 1) Quién atiende qué reporte: jurisdicción (REP-3747) + elegibilidad de la bandeja (§3) --------------------------
create or replace function public.profile_attends_report(p_profile_id uuid, p_report_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from profiles p
    join agencies a         on a.id = p.agency_id
    join subdivisions sa    on sa.id = a.subdivision_id     -- dónde está el organismo
    join citizen_reports r  on r.id = p_report_id
    join localities l       on l.id = r.locality_id
    join subdivisions sr    on sr.id = l.subdivision_id     -- dónde está el reporte
    where p.id = p_profile_id
      -- Alcance: toda la provincia del organismo, o solo su subdivisión
      and case when a.jurisdiction_level = 'state_province'
               then sr.state_province_id = sa.state_province_id
               else l.subdivision_id = a.subdivision_id
          end
      -- Elegibilidad (§3): solo reportes del circuito del panel, nunca INFORMADO ni EN_ANALISIS
      and r.current_state_code in ('DERIVADO', 'ESCALADO', 'EN_DISCREPANCIA', 'RESUELTO', 'DESESTIMADO')
      -- ...y con el borrador institucional generado (REP-2801)
      and exists (select 1 from report_outreach_logs o
                   where o.report_id = r.id and o.delivery_status = 'borrador_generado')
      -- Prestaciones del organismo y del perfil: sin filas, atiende todas
      and (not exists (select 1 from agency_services x where x.agency_id = a.id)
           or exists (select 1 from agency_services x where x.agency_id = a.id and x.service_id = r.service_id))
      and (not exists (select 1 from profile_services y where y.profile_id = p.id)
           or exists (select 1 from profile_services y where y.profile_id = p.id and y.service_id = r.service_id)));
$$;

revoke execute on function public.profile_attends_report(uuid, uuid) from public, anon;
grant  execute on function public.profile_attends_report(uuid, uuid) to authenticated;

-- 2) Entrega interna al operador de prueba (D-03 / D7) ------------------------------------------------------------
create or replace function public.deliver_report_to_test_inbox(p_report_id uuid, p_prestacion_key text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state     text;     -- estado actual del reporte
  v_resultado text;     -- resultado del último análisis RAG
  v_borrador  jsonb;    -- respuesta de prepare_organism_delivery
  v_organismo text;     -- organismo de prueba que cubre la jurisdicción
  v_cambio    jsonb;    -- respuesta de change_report_state
begin
  select r.current_state_code into v_state from citizen_reports r where r.id = p_report_id;
  if v_state is distinct from 'EN_ANALISIS' then
    return 'no_en_analisis';
  end if;

  -- Fuera de alcance (delitos) queda En análisis hasta que lo revise una persona; asistencia va a Informado (§3)
  select a.result_status_code into v_resultado
    from report_ai_analysis a where a.report_id = p_report_id
   order by a.created_at desc limit 1;
  if v_resultado in ('fuera_de_alcance', 'asistencia') then
    return 'excluido_' || v_resultado;
  end if;

  -- El borrador lo arma REP-2801 con el catálogo real; nunca se envía
  v_borrador := public.prepare_organism_delivery(p_report_id, p_prestacion_key);
  if coalesce(v_borrador ->> 'estado', '') <> 'borrador_generado' then
    return coalesce(v_borrador ->> 'estado', 'sin_borrador');
  end if;

  -- Un organismo de prueba tiene que cubrir la jurisdicción del reporte (Lanús no tiene)
  select a.name into v_organismo
    from citizen_reports r
    join localities l      on l.id = r.locality_id
    join subdivisions sr   on sr.id = l.subdivision_id
    join agencies a        on a.is_test
    join subdivisions sa   on sa.id = a.subdivision_id
   where r.id = p_report_id
     and case when a.jurisdiction_level = 'state_province'
              then sr.state_province_id = sa.state_province_id
              else l.subdivision_id = a.subdivision_id
         end
   order by a.name
   limit 1;
  if v_organismo is null then
    return 'sin_organismo_de_prueba';
  end if;

  v_cambio := public.change_report_state(
    p_report_id, 'DERIVADO',
    'Entrega interna al operador de prueba de ' || v_organismo || '. Ningún municipio real recibió el reporte.');
  if coalesce((v_cambio ->> 'ok')::boolean, false) then
    return 'delivered';
  end if;
  return 'rechazado_' || coalesce(v_cambio ->> 'code', 'desconocido');
end;
$$;

revoke execute on function public.deliver_report_to_test_inbox(uuid, text) from public, anon, authenticated;
grant  execute on function public.deliver_report_to_test_inbox(uuid, text) to service_role;

-- 3) Disparo al guardar el análisis RAG: diferido y sin poder romper la persistencia -------------------------------
create or replace function public.trg_deliver_report_to_test_inbox()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    perform public.deliver_report_to_test_inbox(new.report_id, null);
  exception when others then
    -- La entrega es accesoria: el análisis ya guardado no se pierde por ella
    raise warning 'REP-3000: entrega interna fallida para % (%)', new.report_id, sqlerrm;
  end;
  return null;
end;
$$;

revoke execute on function public.trg_deliver_report_to_test_inbox() from public, anon, authenticated;

drop trigger if exists trg_report_ai_analysis_deliver on public.report_ai_analysis;
-- Insert (primer análisis) o update (reanálisis: report_ai_analysis tiene un análisis por reporte). La entrega es
-- idempotente: el borrador repite su clave y un reporte que ya no está EN_ANALISIS no se toca.
create constraint trigger trg_report_ai_analysis_deliver
  after insert or update on public.report_ai_analysis
  deferrable initially deferred
  for each row
  execute function public.trg_deliver_report_to_test_inbox();

-- 4) Texto D7 de la transición (Hernán, 24/10) ---------------------------------------------------------------------
update public.report_state_transitions
   set notes = 'Entrada a la bandeja del organismo de prueba: entrega interna efectiva al operador de prueba (D-03 / D7). '
               || 'El correo al organismo real sigue como borrador (REP-2801); ningún municipio real recibe nada.',
       approved_by = 'Hernán Gregorini (PO, REP-3876 D-03 / D7)',
       approved_on = date '2026-10-24'
 where from_state_code = 'EN_ANALISIS'
   and to_state_code = 'DERIVADO'
   and actor_type = 'sistema';

-- 5) Bandeja del operador con sesión -----------------------------------------------------------------------------
create or replace function public.get_panel_inbox()
returns table (
  report_id   uuid,
  report_code text,
  category    text,
  created_at  timestamptz,
  zone        text,
  state_code  text,
  state_label text
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id,
         '#RP-' || upper(substr(r.id::text, 1, 8)),  -- mismo código que el borrador (REP-2801)
         s.service_name,
         r.created_at,
         l.name,
         r.current_state_code,
         st.description
    from citizen_reports r
    left join services s       on s.id = r.service_id
    left join localities l     on l.id = r.locality_id
    left join report_states st on st.code = r.current_state_code
   where public.profile_attends_report(auth.uid(), r.id)
   order by r.created_at desc;
$$;

revoke execute on function public.get_panel_inbox() from public, anon;
grant  execute on function public.get_panel_inbox() to authenticated;

commit;
