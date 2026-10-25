-- REP-3874 — O-01 (QA REP-3854): la descripción de un reporte ajeno mostraba correos y teléfonos del autor
--
-- Hallazgo (verificado en staging el 25/10/2026): la vista public_citizen_reports (REP-3849) proyectaba
-- r.description tal cual. Un ciudadano con sesión podía leer, por mapa, detalle o REST (`select=description`), un correo
-- o un teléfono que otro vecino escribió por error. REP-3849 sacó el user_id pero dejó afuera el texto libre.
--
-- Cambios:
--   1. redact_contact_info(text): reemplaza correos por «[correo oculto]» y teléfonos por «[teléfono oculto]».
--      Determinista e inmutable. Un número cuenta como teléfono si tiene entre 8 y 13 dígitos y no tiene forma de
--      coordenada (-34.603722) ni de fecha (25-10-2026). Un DNI con puntos también se oculta: es un dato personal.
--      No toca leyes, artículos, alturas ni ordenanzas (menos de 8 dígitos seguidos).
--   2. public_citizen_reports proyecta la descripción redactada, con las mismas 9 columnas y en el mismo orden.
--      Aplica a todos los reportes, viejos y nuevos, sin editar citizen_reports.description: el autor sigue leyendo su
--      original desde citizen_reports («Mis reportes» y su detalle), por su policy de dueño.
--
-- Verificación previa en staging (función temporal + ROLLBACK, 25/10/2026): 16 casos OK, incluidos falsos positivos
-- (Ley 24.449 art. 48, Av. Rivadavia 4500, Ordenanza 27235, 25-10-2026, -34.603722, -58.381592, Decreto-Ley
-- 8031/73). Sobre los 481 reportes, solo cambian 2 descripciones (1 con correo y 2 con teléfono).
--
-- Fuera de alcance: enlaces y lenguaje ofensivo (REP-3869). La lectura directa de citizen_reports por quien atiende
-- el reporte (policy «read own or attended report») todavía entrega el original: se cierra en REP-3747, antes de
-- habilitar las cuentas de operador. Hoy ningún operador puede iniciar sesión.
--
-- ROLLBACK: volver a crear la vista con `r.description,` (migración 20261019122131) y
-- `drop function public.redact_contact_info(text);`.
--
-- No se aplica sola: la migración se corre a mano en staging.

begin;

-- 1) Redacción de contactos ------------------------------------------------------------------------------------
create or replace function public.redact_contact_info(p_text text)
returns text
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  v_out  text := p_text;   -- texto que se va redactando
  v_cand text;             -- candidato a teléfono encontrado en el texto
begin
  -- Sin texto no hay nada que ocultar
  if p_text is null or p_text = '' then
    return p_text;
  end if;

  -- Correos: usuario@dominio.tld, con subdominios (ana@mail.gba.gob.ar)
  v_out := regexp_replace(v_out, '[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}', '[correo oculto]', 'g');

  -- Teléfonos: secuencias de dígitos con espacios, guiones, puntos o paréntesis (+54 9 11 4567-8901, (011) 4567-8901)
  for v_cand in select (regexp_matches(v_out, '\+?\(?\d[\d\s().-]{6,}\d', 'g'))[1] loop
    if length(regexp_replace(v_cand, '\D', '', 'g')) between 8 and 13   -- largo de un teléfono argentino
       and v_cand !~ '^\d{1,3}\.\d{4,}$'                                -- no es una coordenada (34.603722)
       and v_cand !~ '^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$' then           -- no es una fecha (25-10-2026)
      v_out := replace(v_out, v_cand, '[teléfono oculto]');
    end if;
  end loop;

  return v_out;
end;
$$;

comment on function public.redact_contact_info(text) is
  'REP-3874: oculta correos y teléfonos en texto libre. La usan las lecturas de terceros y de operadores.';

-- 2) Contrato público de un reporte ajeno, con la descripción redactada ---------------------------------------------
create or replace view public.public_citizen_reports
with (security_barrier = true)
as
select
  r.id,
  r.service_id,
  r.locality_id,
  public.redact_contact_info(r.description) as description,
  r.current_state_code,
  r.latitud,
  r.longitud,
  r.created_at,
  r.updated_at
from public.citizen_reports r;

comment on view public.public_citizen_reports is
  'REP-3849 + REP-3874: resumen público de reportes, sin user_id ni client_side_id y con la descripción sin correos ni teléfonos. Agregar una columna acá es publicarla.';

-- Los permisos se reafirman igual que en REP-3849: solo usuarios con sesión
revoke all on public.public_citizen_reports from public, anon, authenticated;
grant select on public.public_citizen_reports to authenticated;

commit;
