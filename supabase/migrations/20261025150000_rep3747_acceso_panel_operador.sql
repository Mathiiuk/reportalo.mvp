-- REP-3747 — Acceso al panel como operador de un organismo de prueba (Sprint 18)
--
-- Fuente funcional: reglas del panel v1.0 (REP-3876) §2, §3 y §7; Hernán D9 (24/10/2026); PM (25/10/2026).
--
-- Estado previo (verificado en staging el 25/10/2026):
--   * Los 2 operadores demo del seed v04 están vinculados a filas de PRUEBA con nombres que parecen reales
--     («Dirección General de Fiscalización — Comuna 1», «Secretaría de Servicios Públicos — Avellaneda»). El catálogo
--     REP-2800 las excluye a propósito; agencies no tenía cómo marcarlas como prueba.
--   * profile_attends_report existía en staging pero solo estaba escrita en docs/REP-3769_seed_y_RAG.sql (PARTE 5B):
--     no había migración. Comparaba por subdivisión, así que el operador de CABA veía solo la Comuna 1, contra la
--     regla §2 («jurisdicción: Ciudad de Buenos Aires»). Los 3 borradores existentes están en las Comunas 3 y 6.
--   * La policy «read own or attended report» de citizen_reports le entregaba la fila entera a quien atiende el
--     reporte, con la descripción CRUDA (AC-05 de REP-3874).
--
-- Cambios:
--   1. agencies: is_test (marca de prueba en la base, §2), code (clave interna) y jurisdiction_level (alcance:
--      'subdivision' o 'state_province').
--   2. Las 2 filas de prueba pasan a «Reportalo CABA (organismo de prueba)» / reportalo_caba, con alcance de provincia,
--      y «Reportalo Avellaneda (organismo de prueba)» / reportalo_avellaneda, con alcance de subdivisión. Se ubican
--      por el nombre del seed v04, sin ids generados. El catálogo real (REP-2806/2801) no se toca.
--   3. profile_attends_report queda versionada, con el alcance de cada organismo. El resto de la regla
--      (prestaciones del organismo y del perfil) no cambia. La elegibilidad de la bandeja (borrador, sin INFORMADO)
--      es REP-3000.
--   4. citizen_reports se lee solo por el dueño. Para que el operador no pierda nada de lo que atiende:
--      * las fotos (bucket report-evidences) se leen por can_read_report_folder(), SECURITY DEFINER, que chequea
--        dueño o atención (la policy anterior consultaba citizen_reports con los permisos de quien pregunta);
--      * get_report_legal_foundation pasa a SECURITY DEFINER: ya controla el acceso (v_allowed = servidor, autor o
--        quien atiende) y leía citizen_reports con los permisos de quien pregunta.
--      El resto de las policies (report_images, report_state_history, report_events, report_routing, análisis) usan
--      profile_attends_report directo para quien atiende y no dependen de este cambio.
--
-- Las cuentas de los operadores se vinculan aparte, con el runbook docs/runbooks/REP-3747_vincular_operadores.md:
-- los mails reales no se versionan.
--
-- ROLLBACK:
--   * policy de citizen_reports: volver a «read own or attended report» (migración 20261019122131);
--   * policy de storage: volver a la versión de 20261001131603_rep3798_fotos_privadas;
--     `drop function public.can_read_report_folder(text);`
--   * `alter function public.get_report_legal_foundation(uuid) security invoker;`
--   * profile_attends_report: versión de docs/REP-3769_seed_y_RAG.sql PARTE 5B;
--   * nombres originales de las 2 filas; `alter table public.agencies drop column is_test, drop column code,
--     drop column jurisdiction_level;`
--
-- No se aplica sola: la migración se corre a mano en staging.

begin;

-- 1) Marca de prueba, clave interna y alcance de jurisdicción ---------------------------------------------------
alter table public.agencies
  add column if not exists is_test            boolean not null default false,
  add column if not exists code               text,
  add column if not exists jurisdiction_level text not null default 'subdivision';

alter table public.agencies drop constraint if exists agencies_jurisdiction_level_check;
alter table public.agencies add constraint agencies_jurisdiction_level_check
  check (jurisdiction_level in ('subdivision', 'state_province'));

create unique index if not exists agencies_code_uq on public.agencies (code) where code is not null;

comment on column public.agencies.is_test is
  'REP-3747: organismo de prueba (reglas v1.0 §2). Queda fuera de métricas y se da de baja antes de producción.';
comment on column public.agencies.code is 'REP-3747: clave interna estable (p. ej. reportalo_caba).';
comment on column public.agencies.jurisdiction_level is
  'REP-3747: alcance del organismo para profile_attends_report: su subdivisión o toda su provincia.';

-- 2) Los 2 organismos de prueba del seed v04 --------------------------------------------------------------------
update public.agencies
   set name = 'Reportalo CABA (organismo de prueba)',
       code = 'reportalo_caba',
       is_test = true,
       jurisdiction_level = 'state_province'          -- regla §2: toda la Ciudad
 where name = 'Dirección General de Fiscalización — Comuna 1';

update public.agencies
   set name = 'Reportalo Avellaneda (organismo de prueba)',
       code = 'reportalo_avellaneda',
       is_test = true,
       jurisdiction_level = 'subdivision'             -- el partido de Avellaneda
 where name = 'Secretaría de Servicios Públicos — Avellaneda';

-- 3) Quién atiende qué reporte, versionado y con el alcance del organismo ----------------------------------------
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
      -- Prestaciones del organismo y del perfil: sin filas, atiende todas
      and (not exists (select 1 from agency_services x where x.agency_id = a.id)
           or exists (select 1 from agency_services x where x.agency_id = a.id and x.service_id = r.service_id))
      and (not exists (select 1 from profile_services y where y.profile_id = p.id)
           or exists (select 1 from profile_services y where y.profile_id = p.id and y.service_id = r.service_id)));
$$;

revoke execute on function public.profile_attends_report(uuid, uuid) from public, anon;
grant  execute on function public.profile_attends_report(uuid, uuid) to authenticated;

-- 4a) Fotos del reporte: dueño o quien atiende, sin pasar por la RLS de citizen_reports ---------------------------
create or replace function public.can_read_report_folder(p_folder text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from citizen_reports r
    where r.client_side_id::text = p_folder                 -- la carpeta de Storage es el client_side_id
      and (r.user_id = auth.uid() or public.profile_attends_report(auth.uid(), r.id))
  );
$$;

revoke execute on function public.can_read_report_folder(text) from public, anon;
grant  execute on function public.can_read_report_folder(text) to authenticated;

drop policy if exists "Lectura de evidencias propias o atendidas" on storage.objects;
create policy "Lectura de evidencias propias o atendidas"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'report-evidences'
    and public.can_read_report_folder((storage.foldername(name))[1])
  );

-- 4b) Fundamento: su propio control de acceso (servidor, autor o quien atiende) pasa a ser la frontera ----------
alter function public.get_report_legal_foundation(uuid) security definer;

-- 4c) citizen_reports: solo el dueño. Quien atiende lee por el panel (descripción redactada, REP-3874/3749) -------
drop policy if exists "read own or attended report" on public.citizen_reports;
drop policy if exists "read own report" on public.citizen_reports;
create policy "read own report"
  on public.citizen_reports for select
  to authenticated
  using (user_id = (select auth.uid()));

commit;
