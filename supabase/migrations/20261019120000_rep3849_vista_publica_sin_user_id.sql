-- REP-3849 — O-03 (QA REP-3832, caso C-16): la lectura de reportes ajenos exponía el user_id del autor
--
-- Hallazgo (verificado en la base el 19/10/2026): citizen_reports tenía la policy `lectura_publica` (SELECT, rol
-- public, qual true) y anon/authenticated tenían SELECT sobre todas las columnas. Cualquiera con la anon key (incluso
-- sin sesión) podía pedir `select=user_id` y agrupar todos los reportes de una misma persona. RLS filtra filas, no
-- columnas: el mapa no pedía user_id, pero la API lo entregaba igual si se lo pedían.
--
-- Decisión del PO (Hernán, REP-3832, 16/10/2026): el resumen de un reporte ajeno sigue visible (REP-3798), pero
-- sin identificar al autor.
--
-- Cambios:
--   1. Vista `public_citizen_reports`: el contrato público de un reporte ajeno, con proyección explícita. NO incluye
--      user_id (identifica al autor) ni client_side_id (es la carpeta de sus fotos en Storage). Solo para usuarios con
--      sesión: el mapa y el detalle ya exigen login, nadie anónimo la necesita.
--   2. citizen_reports deja de ser de lectura pública: cada ciudadano lee sus propias filas, y quien atiende el
--      reporte (profile_attends_report) las de su jurisdicción, igual que report_images y report_state_history.
--
-- Por qué la vista NO es security_invoker: tiene que mostrar filas que la policy nueva le oculta al ciudadano
-- (los reportes ajenos). Se ejecuta con los permisos del dueño (postgres) y por eso la proyección de columnas es
-- la frontera de privacidad: agregar una columna acá es publicarla. El linter de Supabase la marca como
-- `security_definer_view`; es intencional.
--
-- Por qué no se revoca el permiso de la columna user_id: las policies de report_images, report_ai_analysis,
-- report_state_history, storage.objects, etc. y la función get_report_legal_foundation (SECURITY INVOKER) comparan
-- `citizen_reports.user_id = auth.uid()` con los permisos de quien consulta. Sin ese permiso el dueño perdería
-- acceso a sus fotos y a su fundamento.
--
-- Lo que sigue igual: «Mis reportes», notificaciones y la recuperación del alta filtran por el propio user_id y ven
-- sus filas; las funciones SECURITY DEFINER (change_report_state, prepare_organism_delivery, route_report, ...) y
-- la service_role no dependen de estas policies. profile_attends_report es SECURITY DEFINER (dueño postgres, que
-- ignora RLS), así que usarla en la policy de citizen_reports no genera recursión.
--
-- Efecto colateral conocido: la vista open311_requests (security_invoker, creada fuera de las migraciones y sin uso
-- en la app) pasa a mostrarle a cada ciudadano solo sus reportes. Y si un client_side_id ya existe en otra cuenta,
-- la recuperación del alta (REP-3810) ya no ve la fila ajena: falla como REPORT_NOT_FOUND en vez de
-- CLIENT_ID_CONFLICT; sigue sin unir el reporte de una cuenta con las fotos de otra.
--
-- ORDEN DE APLICACIÓN: primero publicar el frontend que lee public_citizen_reports, después esta migración. Con la
-- migración aplicada y un frontend viejo, el mapa quedaría vacío (solo verías tus reportes) hasta actualizar la app.

begin;

-- 1) Contrato público de un reporte ajeno
create or replace view public.public_citizen_reports
with (security_barrier = true)
as
select
  r.id,
  r.service_id,
  r.locality_id,
  r.description,
  r.current_state_code,
  r.latitud,
  r.longitud,
  r.created_at,
  r.updated_at
from public.citizen_reports r;

comment on view public.public_citizen_reports is
  'REP-3849: resumen público de reportes (sin user_id ni client_side_id). Agregar una columna acá es publicarla.';

revoke all on public.public_citizen_reports from public, anon, authenticated;
grant select on public.public_citizen_reports to authenticated;

-- 2) citizen_reports: lectura del dueño o de quien atiende el reporte
drop policy if exists "lectura_publica" on public.citizen_reports;
drop policy if exists "read own or attended report" on public.citizen_reports;
create policy "read own or attended report"
  on public.citizen_reports for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.profile_attends_report((select auth.uid()), id)
  );

commit;
