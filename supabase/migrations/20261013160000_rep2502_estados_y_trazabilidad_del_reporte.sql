-- REP-2502 — Estados y trazabilidad inicial del reporte (Sprint 16)
--
-- Hasta hoy los cambios de estado se hacían en dos funciones del RAG (enqueue_rag_analysis y persist_rag_analysis) y,
-- por fuera de la app, a mano. Nada impedía una transición absurda, nada guardaba el estado anterior ni qué
-- evento la causó, y un intento no autorizado no dejaba rastro. Esta migración agrega el MECANISMO, sin inventar
-- reglas de negocio:
--
--   1. report_state_history gana previous_state_code, event_code y actor_type (se completan solos en los
--      registros nuevos, vengan de donde vengan, y se rellenan los viejos que se pueden deducir).
--   2. report_state_transitions: la matriz de transiciones PERMITIDAS, como datos. Se siembra SOLO con las tres
--      que el sistema ya hace hoy (decisión de producto de Matías, REP-3798, 30/09/2026). Ninguna transición
--      de un organismo está aprobada todavía: la máquina de estados, los permisos y la definición de «resuelto»
--      las confirma Hernán (REP-2502, H-2). Cuando las confirme, se agregan como filas, sin tocar código.
--   3. report_state_change_rejections: evidencia de cada intento rechazado (quién, qué quiso hacer, por qué).
--   4. change_report_state(): el ÚNICO camino controlado para cambiar un estado. Valida quién es el actor (se deduce
--      de la sesión, no se recibe como parámetro), si la transición está definida y si el motivo es obligatorio;
--      si pasa, actualiza el reporte y el historial en una sola transacción; si no, NO toca el estado y deja la
--      evidencia. Devuelve un jsonb {ok, ...} en lugar de lanzar un error, porque un error desharía la evidencia.
--
-- LO QUE ESTA MIGRACIÓN NO HACE (a propósito)
--   * No cambia enqueue_rag_analysis ni persist_rag_analysis (el cierre automático del RAG sigue igual).
--   * No agrega una fila «RECIBIDO» al historial: la recepción ya queda en citizen_reports.created_at con el
--     estado inicial, y esa fila nueva generaría una notificación «pasó a Enviado» en cada reporte.
--   * No bloquea los UPDATE directos de citizen_reports.current_state_code: hoy solo los hacen las funciones del
--     RAG (SECURITY DEFINER) y nadie más tiene policy de UPDATE.
--   * No decide si «asistencia» debería cerrar el reporte como RESUELTO (hoy lo hace persist_rag_analysis): el ticket
--     pide no comunicar «resuelto» por inferencia del análisis de IA y eso requiere la definición del PO.
--
-- No se aplica sola: se corre a mano en staging (ver docs/REP-2502_Estados_y_trazabilidad.md). Aditiva: sin DROP ni DELETE.

begin;

-- 1) Columnas de trazabilidad en el historial -----------------------------------------------------------------------
alter table public.report_state_history
  add column if not exists previous_state_code varchar references public.report_states (code),
  add column if not exists event_code text,
  add column if not exists actor_type text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'report_state_history_actor_type_check') then
    alter table public.report_state_history
      add constraint report_state_history_actor_type_check
      check (actor_type is null or actor_type in ('sistema', 'organismo'));
  end if;
end $$;

-- 2) Matriz de transiciones permitidas -------------------------------------------------------------------------------
create table if not exists public.report_state_transitions (
  from_state_code varchar not null references public.report_states (code),
  to_state_code   varchar not null references public.report_states (code),
  actor_type      text    not null check (actor_type in ('sistema', 'organismo')),
  event_code      text    not null,
  approved_by     text    not null,
  approved_on     date    not null,
  notes           text,
  primary key (from_state_code, to_state_code, actor_type),
  check (from_state_code <> to_state_code)
);

alter table public.report_state_transitions enable row level security;
revoke all on table public.report_state_transitions from public, anon, authenticated;
grant select on table public.report_state_transitions to authenticated;
grant all on table public.report_state_transitions to service_role;

drop policy if exists "read transitions" on public.report_state_transitions;
create policy "read transitions" on public.report_state_transitions for select to authenticated using (true);

-- Solo lo que el sistema ya hace hoy
insert into public.report_state_transitions (from_state_code, to_state_code, actor_type, event_code, approved_by, approved_on, notes)
values
  ('RECIBIDO',    'EN_ANALISIS', 'sistema', 'ANALISIS_AUTOMATICO',
   'Matías Krepchuk (decisión de producto, REP-3798)', date '2026-09-30',
   'Al enviar, la IA empieza a revisar el reporte (enqueue_rag_analysis).'),
  ('EN_ANALISIS', 'DESESTIMADO', 'sistema', 'CIERRE_AUTOMATICO_FUERA_DE_ALCANCE',
   'Matías Krepchuk (decisión de producto, REP-3798)', date '2026-09-30',
   'El análisis concluye «fuera de alcance» (persist_rag_analysis).'),
  ('EN_ANALISIS', 'RESUELTO',    'sistema', 'CIERRE_AUTOMATICO_ASISTENCIA',
   'Matías Krepchuk (decisión de producto, REP-3798)', date '2026-09-30',
   'El análisis concluye «asistencia». PENDIENTE de revisión del PO: no comunicar «resuelto» por inferencia de la IA.')
on conflict (from_state_code, to_state_code, actor_type) do nothing;

-- 3) Evidencia de los intentos rechazados ---------------------------------------------------------------------------
create table if not exists public.report_state_change_rejections (
  id                  uuid primary key default gen_random_uuid(),
  report_id           uuid not null references public.citizen_reports (id),
  attempted_state     text,
  current_state_code  varchar,
  actor_type          text not null,
  actor_profile_id    uuid,
  reason_code         text not null,
  detail              text,
  attempted_at        timestamptz not null default now()
);

create index if not exists report_state_change_rejections_report_idx
  on public.report_state_change_rejections (report_id, attempted_at desc);

-- Sin policies para authenticated: ni el ciudadano ni quien atiende ven los intentos rechazados. Solo servidor.
alter table public.report_state_change_rejections enable row level security;
revoke all on table public.report_state_change_rejections from public, anon, authenticated;
grant all on table public.report_state_change_rejections to service_role;

-- 4) El historial se completa solo, venga de donde venga el registro --------------------------------------------------
create or replace function public.report_state_history_fill()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.previous_state_code is null then
    select h.state_code into new.previous_state_code
      from public.report_state_history h
     where h.report_id = new.report_id
     order by h.changed_at desc, h.id desc
     limit 1;
  end if;

  if new.actor_type is null then
    new.actor_type := case when new.changed_by is null and new.actor_agency_id is null then 'sistema' else 'organismo' end;
  end if;

  if new.event_code is null and new.previous_state_code is not null then
    select t.event_code into new.event_code
      from public.report_state_transitions t
     where t.from_state_code = new.previous_state_code
       and t.to_state_code = new.state_code
       and t.actor_type = new.actor_type;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_report_state_history_fill on public.report_state_history;
create trigger trg_report_state_history_fill
  before insert on public.report_state_history
  for each row execute function public.report_state_history_fill();

-- 5) El único camino controlado para cambiar un estado -------------------------------------------------------------
create or replace function public.change_report_state(p_report_id uuid, p_to_state text, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_is_service boolean := coalesce(auth.role(), '') = 'service_role';
  v_report     public.citizen_reports%rowtype;
  v_actor      text;
  v_agency     uuid;
  v_trans      public.report_state_transitions%rowtype;
  v_reason     text := nullif(btrim(coalesce(p_reason, '')), '');
  v_at         timestamptz := clock_timestamp();
  v_code       text;
  v_detail     text;
begin
  -- Se bloquea el reporte para que dos cambios simultáneos no se pisen
  select * into v_report from public.citizen_reports where id = p_report_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'reporte_inexistente',
                              'detail', 'El reporte no existe.');
  end if;

  -- Quién es el actor: se deduce de la sesión, nunca de un parámetro
  if v_is_service then
    v_actor := 'sistema';
  elsif v_uid is not null and public.profile_attends_report(v_uid, p_report_id) then
    v_actor := 'organismo';
    select p.agency_id into v_agency from public.profiles p where p.id = v_uid;
  elsif v_uid is not null and v_report.user_id = v_uid then
    v_actor := 'ciudadano';
  else
    v_actor := 'desconocido';
  end if;

  if v_actor not in ('sistema', 'organismo') then
    v_code := 'sin_permiso';
    v_detail := 'Quien intenta el cambio no es el sistema ni un organismo que atienda este reporte.';
  elsif not exists (select 1 from public.report_states s where s.code = p_to_state) then
    v_code := 'estado_inexistente';
    v_detail := 'El estado «' || coalesce(p_to_state, 'NULL') || '» no existe.';
  elsif p_to_state = v_report.current_state_code then
    v_code := 'mismo_estado';
    v_detail := 'El reporte ya está en ese estado.';
  else
    select * into v_trans
      from public.report_state_transitions t
     where t.from_state_code = v_report.current_state_code
       and t.to_state_code = p_to_state
       and t.actor_type = v_actor;
    if not found then
      v_code := 'transicion_no_definida';
      v_detail := 'No hay una transición aprobada de «' || v_report.current_state_code || '» a «' || p_to_state
                  || '» para ' || v_actor || '.';
    elsif v_actor = 'organismo' and v_reason is null then
      v_code := 'motivo_requerido';
      v_detail := 'Un cambio de estado de un organismo debe indicar el motivo.';
    end if;
  end if;

  -- Rechazo: el estado NO cambia y queda la evidencia (por eso no se lanza una excepción: la desharía)
  if v_code is not null then
    insert into public.report_state_change_rejections
      (report_id, attempted_state, current_state_code, actor_type, actor_profile_id, reason_code, detail)
    values (p_report_id, p_to_state, v_report.current_state_code, v_actor, v_uid, v_code, v_detail);

    return jsonb_build_object('ok', false, 'code', v_code, 'detail', v_detail,
                              'current_state', v_report.current_state_code);
  end if;

  -- Cambio autorizado: estado e historial juntos o ninguno
  update public.citizen_reports
     set current_state_code = p_to_state,
         updated_at = now()
   where id = p_report_id;

  insert into public.report_state_history
    (report_id, state_code, previous_state_code, changed_by, actor_agency_id, actor_type, event_code, notes, changed_at)
  values
    (p_report_id, p_to_state, v_report.current_state_code,
     case when v_actor = 'organismo' then v_uid end, v_agency, v_actor, v_trans.event_code, v_reason, v_at);

  return jsonb_build_object('ok', true, 'previous_state', v_report.current_state_code, 'state', p_to_state,
                            'event', v_trans.event_code, 'actor_type', v_actor, 'changed_at', v_at);
end;
$$;

revoke all on function public.change_report_state(uuid, text, text) from public, anon;
grant execute on function public.change_report_state(uuid, text, text) to authenticated, service_role;

comment on function public.change_report_state(uuid, text, text) is
  'REP-2502. Único camino controlado para cambiar el estado de un reporte: valida actor y transición, '
  'guarda estado anterior, evento y motivo, y deja evidencia de lo rechazado sin alterar el estado.';

-- 6) Relleno de lo que ya estaba en el historial (solo lo deducible, solo donde falta) --------------------------------
with ordered as (
  select h.id,
         lag(h.state_code) over (partition by h.report_id order by h.changed_at, h.id) as prev
    from public.report_state_history h
)
update public.report_state_history h
   set previous_state_code = o.prev
  from ordered o
 where o.id = h.id
   and h.previous_state_code is null
   and o.prev is not null;

update public.report_state_history
   set actor_type = case when changed_by is null and actor_agency_id is null then 'sistema' else 'organismo' end
 where actor_type is null;

update public.report_state_history h
   set event_code = t.event_code
  from public.report_state_transitions t
 where h.event_code is null
   and t.from_state_code = h.previous_state_code
   and t.to_state_code = h.state_code
   and t.actor_type = h.actor_type;

commit;
