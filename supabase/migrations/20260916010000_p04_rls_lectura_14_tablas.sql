-- P-04 (REP-2908-VERIF ronda 4): permisos de lectura para las tablas que
-- necesitan REP-2500 (selector de localidad) y la linea de tiempo del reporte.
--
-- Clasificacion de Hernan (docs/REP-2908-VERIF_ronda4_hernan.md, seccion P-04).
-- Ajustado contra el estado real de Supabase verificado el 16/09:
--   - states_provinces YA tiene politica de lectura publica
--     (20260916000654_fix_states_provinces_missing_rls_policy), no se toca aca.
--   - profile_attends_report(p_profile_id, p_report_id) ya existe.
--   - La app no lee "profiles" desde el navegador hoy (0 referencias en src/),
--     asi que esta politica es aditiva, no cambia comportamiento existente.
--   - citizen_reports.user_id es el nombre real de columna.
begin;

-- 1) Catalogos y organismos: lectura para usuarios con sesion.
--    (countries, service_attributes, service_attribute_values, agencies;
--    states_provinces queda afuera porque ya tiene "lectura_publica").
do $$
declare t text;
begin
  foreach t in array array['countries','service_attributes',
                           'service_attribute_values','agencies'] loop
    if not exists (select 1 from pg_policies
                   where schemaname = 'public' and tablename = t and policyname = 'read authenticated') then
      execute format('create policy "read authenticated" on public.%I for select to authenticated using (true)', t);
    end if;
  end loop;
end $$;

-- 2) Historia y eventos del reporte: dueno o funcionario que lo atiende.
do $$
declare t text;
begin
  foreach t in array array['report_state_history','report_events'] loop
    if not exists (select 1 from pg_policies
                   where schemaname = 'public' and tablename = t and policyname = 'read own or attended') then
      execute format($p$
        create policy "read own or attended" on public.%I for select to authenticated
        using (
          exists (select 1 from public.citizen_reports r
                  where r.id = report_id and r.user_id = (select auth.uid()))
          or public.profile_attends_report((select auth.uid()), report_id)
        )$p$, t);
    end if;
  end loop;
end $$;

-- 3) Perfil propio.
do $$
begin
  if not exists (select 1 from pg_policies
                 where schemaname = 'public' and tablename = 'profiles' and policyname = 'read own profile') then
    create policy "read own profile" on public.profiles for select to authenticated
      using (id = (select auth.uid()));
  end if;
end $$;

-- 4) Respuestas del formulario: ciudadano dueno o funcionario que atiende.
do $$
begin
  if not exists (select 1 from pg_policies
                 where schemaname = 'public' and tablename = 'infraction_attribute_responses' and policyname = 'read own or attended') then
    create policy "read own or attended" on public.infraction_attribute_responses for select to authenticated
      using (
        exists (select 1 from public.citizen_reports r
                where r.id = report_id and r.user_id = (select auth.uid()))
        or public.profile_attends_report((select auth.uid()), report_id)
      );
  end if;

  if not exists (select 1 from pg_policies
                 where schemaname = 'public' and tablename = 'infraction_attribute_responses' and policyname = 'insert own') then
    create policy "insert own" on public.infraction_attribute_responses for insert to authenticated
      with check (
        exists (select 1 from public.citizen_reports r
                where r.id = report_id and r.user_id = (select auth.uid()))
      );
  end if;
end $$;

commit;
