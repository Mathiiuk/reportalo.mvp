-- =====================================================================
-- REPORTALO — Seed completo + ajustes de modelo + base del RAG
-- REP-3769 · versión 1.0 · 13/09/2026 · Proyecto RAR-2026
--
-- LEER ANTES: REP-3769_guia_ejecucion_seeds_y_RAG.md (misma carpeta de Drive).
-- Explica qué cambia en la base y QUÉ HAY QUE CAMBIAR EN EL CÓDIGO.
--
-- Nombres del esquema en inglés. Los valores de catálogo (RECIBIDO, TRANSITO,
-- obligacion...) son las semillas obligatorias del PO (REP-3605, REP-2906)
-- y NO se traducen.
--
-- Idempotente: se puede ejecutar más de una vez sin duplicar filas.
-- Cada PARTE es una transacción. Si una parte falla, se detiene ahí.
-- Recomendado: psql -v ON_ERROR_STOP=1 -f REP-3769_seed_y_RAG.sql
-- La PARTE 5B está ACTIVA (decisiones D-T1 y D-T2 del PO, 14/09/2026).
-- Las PARTES 9, 11, 12, 13, 15 y 16 están COMENTADAS a propósito: son mejoras opcionales.
-- Las PARTES 10 y 14 ya no existen: su contenido pasó a partes activas (5B y 7).
-- Cada una se descomenta SOLO con decisión escrita de Matías (y del PO donde
-- la guía lo indica), después de evaluar el impacto en el código (guía §7).
-- =====================================================================


-- =====================================================================
-- PARTE 0 — Chequeos previos (no modifican nada)
-- =====================================================================
do $$
begin
  if current_setting('server_version_num')::int < 150000 then
    raise exception 'Se necesita PostgreSQL 15 o superior (NULLS NOT DISTINCT). Versión actual: %',
      current_setting('server_version');
  end if;
  if not exists (select 1 from pg_extension where extname = 'vector') then
    raise exception 'La extensión vector no está instalada';
  end if;
  perform '[1,2,3]'::vector(3);   -- falla si el tipo vector no se resuelve sin prefijo
  if exists (select 1 from public.services
             where service_code not in ('TRANSITO','INFRAESTRUCTURA','AMBIENTE','COMERCIO_IRREGULAR','VULNERABILIDAD_SOCIAL')) then
    raise notice 'services tiene códigos fuera de la semilla obligatoria: revisar con Matías antes de seguir';
  end if;
  if exists (select 1 from public.report_states
             where code not in ('RECIBIDO','EN_ANALISIS','DERIVADO','RESUELTO','DESESTIMADO')) then
    raise notice 'report_states tiene códigos fuera de la semilla obligatoria (p. ej. borrador): la PARTE 5 va a fallar hasta resolverlo';
  end if;
end $$;


-- =====================================================================
-- PARTE 1 — Ajustes a tablas existentes (M-1, M-2, M-3)
-- =====================================================================
begin;

-- M-1 · 'borrador' no existe en report_states: el valor por defecto pasa a RECIBIDO
alter table public.citizen_reports alter column current_state_code set default 'RECIBIDO';

-- M-2 · la localidad es obligatoria: de ella parten el RLS por jurisdicción y la cascada del RAG
alter table public.citizen_reports alter column locality_id set not null;

-- M-3 · UNIQUE(padre, nombre) en la geografía (Modelo de Datos v3.1 §6)
do $$ begin
  alter table public.states_provinces add constraint states_provinces_country_name_uq unique (country_id, name);
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.subdivisions add constraint subdivisions_province_name_uq unique (state_province_id, name);
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.localities add constraint localities_subdivision_name_uq unique (subdivision_id, name);
exception when duplicate_object or duplicate_table then null; end $$;

commit;


-- =====================================================================
-- PARTE 2 — Seed de catálogos (REP-3605 v1.2, obligatorio)
-- =====================================================================
begin;

-- País
insert into public.countries (name, iso_code)
select 'Argentina', 'AR'
where not exists (select 1 from public.countries where iso_code = 'AR');

-- Provincias (3)
insert into public.states_provinces (country_id, name)
select c.id, v.name
from public.countries c
cross join (values ('Ciudad Autónoma de Buenos Aires'), ('Buenos Aires'), ('Santa Fe')) as v(name)
where c.iso_code = 'AR'
  and not exists (select 1 from public.states_provinces sp where sp.country_id = c.id and sp.name = v.name);

-- Subdivisiones (17)
insert into public.subdivisions (state_province_id, name, type)
select sp.id, v.name, v.type
from (values
  ('Ciudad Autónoma de Buenos Aires','Comuna 1','comuna'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 2','comuna'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 3','comuna'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 4','comuna'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 5','comuna'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 6','comuna'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 7','comuna'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 8','comuna'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 9','comuna'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 10','comuna'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 11','comuna'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 12','comuna'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 13','comuna'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 14','comuna'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 15','comuna'),
  ('Buenos Aires','Avellaneda','partido'),
  ('Santa Fe','Avellaneda','departamento')
) as v(province, name, type)
join public.states_provinces sp on sp.name = v.province
where not exists (select 1 from public.subdivisions s where s.state_province_id = sp.id and s.name = v.name);

-- Localidades (57 = 48 barrios de CABA + 8 de Avellaneda BA + 1 de Santa Fe)
insert into public.localities (subdivision_id, name)
select s.id, v.locality
from (values
  ('Ciudad Autónoma de Buenos Aires','Comuna 1','Retiro'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 1','San Nicolás'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 1','Puerto Madero'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 1','San Telmo'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 1','Monserrat'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 1','Constitución'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 2','Recoleta'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 3','Balvanera'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 3','San Cristóbal'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 4','La Boca'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 4','Barracas'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 4','Parque Patricios'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 4','Nueva Pompeya'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 5','Almagro'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 5','Boedo'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 6','Caballito'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 7','Flores'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 7','Parque Chacabuco'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 8','Villa Soldati'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 8','Villa Riachuelo'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 8','Villa Lugano'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 9','Liniers'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 9','Mataderos'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 9','Parque Avellaneda'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 10','Villa Real'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 10','Monte Castro'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 10','Versalles'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 10','Floresta'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 10','Vélez Sarsfield'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 10','Villa Luro'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 11','Villa General Mitre'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 11','Villa Devoto'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 11','Villa del Parque'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 11','Villa Santa Rita'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 12','Coghlan'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 12','Saavedra'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 12','Villa Urquiza'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 12','Villa Pueyrredón'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 13','Núñez'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 13','Belgrano'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 13','Colegiales'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 14','Palermo'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 15','Chacarita'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 15','Villa Crespo'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 15','La Paternal'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 15','Villa Ortúzar'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 15','Agronomía'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 15','Parque Chas'),
  ('Buenos Aires','Avellaneda','Avellaneda'),
  ('Buenos Aires','Avellaneda','Crucecita'),
  ('Buenos Aires','Avellaneda','Dock Sud'),
  ('Buenos Aires','Avellaneda','Gerli'),
  ('Buenos Aires','Avellaneda','Piñeyro'),
  ('Buenos Aires','Avellaneda','Sarandí'),
  ('Buenos Aires','Avellaneda','Villa Domínico'),
  ('Buenos Aires','Avellaneda','Wilde'),
  ('Santa Fe','Avellaneda','Avellaneda')
) as v(province, subdivision, locality)
join public.states_provinces sp on sp.name = v.province
join public.subdivisions s on s.state_province_id = sp.id and s.name = v.subdivision
where not exists (select 1 from public.localities l where l.subdivision_id = s.id and l.name = v.locality);

-- Organismos (2). El separador es la raya "—", no un guion "-"
insert into public.agencies (name, subdivision_id)
select v.name, s.id
from (values
  ('Dirección General de Fiscalización — Comuna 1','Ciudad Autónoma de Buenos Aires','Comuna 1'),
  ('Secretaría de Servicios Públicos — Avellaneda','Buenos Aires','Avellaneda')
) as v(name, province, subdivision)
join public.states_provinces sp on sp.name = v.province
join public.subdivisions s on s.state_province_id = sp.id and s.name = v.subdivision
on conflict (name) do nothing;

insert into public.agency_subscriptions (agency_id, plan_type, is_active)
select a.id, 'piloto', true
from public.agencies a
where a.name in ('Dirección General de Fiscalización — Comuna 1','Secretaría de Servicios Públicos — Avellaneda')
on conflict (agency_id) do nothing;

insert into public.agency_contacts (agency_id, contact_channel, contact_value, is_primary)
select a.id, 'email', v.email, true
from (values
  ('Dirección General de Fiscalización — Comuna 1','contacto@ag01.reportalo.test'),
  ('Secretaría de Servicios Públicos — Avellaneda','contacto@ag02.reportalo.test')
) as v(agency, email)
join public.agencies a on a.name = v.agency
where not exists (select 1 from public.agency_contacts ac where ac.agency_id = a.id and ac.contact_value = v.email);

-- Categorías (5, incluida VULNERABILIDAD_SOCIAL) y su único atributo
insert into public.services (service_code, service_name, group_name) values
  ('TRANSITO','Tránsito','Vía pública'),
  ('INFRAESTRUCTURA','Infraestructura','Vía pública'),
  ('AMBIENTE','Ambiente','Vía pública'),
  ('COMERCIO_IRREGULAR','Comercio irregular','Vía pública'),
  ('VULNERABILIDAD_SOCIAL','Vulnerabilidad social','Asistencia social')
on conflict (service_code) do nothing;

insert into public.service_attributes (service_id, attribute_code, data_type, required)
select s.id, 'patente', 'string', false
from public.services s
where s.service_code = 'TRANSITO'
  and not exists (select 1 from public.service_attributes sa where sa.service_id = s.id and sa.attribute_code = 'patente');

-- Estados del reporte (5). NO existen 'borrador', 'Vencido' ni 'Pendiente de envío'
insert into public.report_states (code, description) values
  ('RECIBIDO','Recibido'),
  ('EN_ANALISIS','En análisis'),
  ('DERIVADO','Derivado al organismo'),
  ('RESUELTO','Resuelto'),
  ('DESESTIMADO','Desestimado')
on conflict (code) do nothing;

commit;


-- =====================================================================
-- PARTE 3 — Perfiles y términos
-- REQUIERE que los 6 usuarios ya existan en Supabase Auth (guía §3).
-- Si falta alguno, se insertan solo los que existen y se avisa.
-- =====================================================================
do $$ begin
  if (select count(*) from auth.users where email in (
        'ciudadano.demo@reportalo.test','ciudadano.vecino@reportalo.test','ciudadano.consulta@reportalo.test',
        'oficial.caba@reportalo.test','oficial.avellaneda@reportalo.test','admin.reportalo@reportalo.test')) < 6 then
    raise notice 'Faltan usuarios de prueba en Supabase Auth: crearlos y volver a ejecutar las PARTES 3 y 4';
  end if;
end $$;

begin;

insert into public.profiles (id, username, role, agency_id)
select u.id, v.username, v.role, a.id
from (values
  ('ciudadano.demo@reportalo.test','ciudadano.demo','ciudadano',null),
  ('ciudadano.vecino@reportalo.test','ciudadano.vecino','ciudadano',null),
  ('ciudadano.consulta@reportalo.test','ciudadano.consulta','ciudadano',null),
  ('oficial.caba@reportalo.test','oficial.caba','organismo','Dirección General de Fiscalización — Comuna 1'),
  ('oficial.avellaneda@reportalo.test','oficial.avellaneda','organismo','Secretaría de Servicios Públicos — Avellaneda'),
  ('admin.reportalo@reportalo.test','admin.reportalo','admin',null)
) as v(email, username, role, agency_name)
join auth.users u on u.email = v.email
left join public.agencies a on a.name = v.agency_name
on conflict (id) do update
  set username = excluded.username, role = excluded.role, agency_id = excluded.agency_id;

-- ciudadano.consulta queda SIN aceptar a propósito (modo consultivo, REP-3603)
insert into public.terms_consents (user_id, terms_version, accepted_at)
select u.id, '1.0', timestamptz '2026-09-01 12:00:00-03'
from auth.users u
where u.email in ('ciudadano.demo@reportalo.test','ciudadano.vecino@reportalo.test')
  and not exists (select 1 from public.terms_consents t where t.user_id = u.id and t.terms_version = '1.0');

commit;


-- =====================================================================
-- PARTE 4 — Reportes de demostración (perfil "full", REP-3605 §9 y §10)
-- Para el perfil "empty", no ejecutar esta parte.
-- Las imágenes (report_images) NO se cargan acá: ver guía §7.
-- =====================================================================
begin;

insert into public.citizen_reports
  (id, client_side_id, user_id, service_id, locality_id, latitud, longitud, description, current_state_code, created_at, updated_at)
select v.id::uuid, v.csid::uuid, p.id, s.id, l.id, v.lat, v.lng, v.descr, v.state, v.created::timestamptz, v.updated::timestamptz
from (values
  ('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','ciudadano.demo','TRANSITO','Ciudad Autónoma de Buenos Aires','Comuna 1','Retiro',-34.5920,-58.3745,'Vehículo estacionado sobre rampa de acceso peatonal, Av. del Libertador al 400','RECIBIDO','2026-08-29 10:00-03','2026-08-29 10:00-03'),
  ('40000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002','ciudadano.demo','INFRAESTRUCTURA','Ciudad Autónoma de Buenos Aires','Comuna 1','San Nicolás',-34.6045,-58.3800,'Bache profundo sobre calzada con riesgo para motos, Av. Corrientes al 1200','EN_ANALISIS','2026-08-30 10:00-03','2026-08-31 10:00-03'),
  ('40000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000003','ciudadano.vecino','AMBIENTE','Ciudad Autónoma de Buenos Aires','Comuna 1','Puerto Madero',-34.6110,-58.3655,'Acumulación de residuos voluminosos en cantero, Juana Manso al 800','DERIVADO','2026-08-31 11:00-03','2026-09-02 11:00-03'),
  ('40000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000004','ciudadano.vecino','COMERCIO_IRREGULAR','Ciudad Autónoma de Buenos Aires','Comuna 1','Monserrat',-34.6085,-58.3735,'Mercadería sobre la vereda que obstruye el paso peatonal, Av. de Mayo al 900','RESUELTO','2026-09-01 12:00-03','2026-09-05 12:00-03'),
  ('40000000-0000-4000-8000-000000000005','30000000-0000-4000-8000-000000000005','ciudadano.demo','INFRAESTRUCTURA','Ciudad Autónoma de Buenos Aires','Comuna 1','Retiro',-34.5955,-58.3735,'Luminaria apagada en Plaza San Martín — no se constató la falla en la verificación','DESESTIMADO','2026-09-03 13:00-03','2026-09-04 13:00-03'),
  ('40000000-0000-4000-8000-000000000006','30000000-0000-4000-8000-000000000006','ciudadano.vecino','TRANSITO','Buenos Aires','Avellaneda','Avellaneda',-34.6635,-58.3670,'Camión de carga detenido sobre senda peatonal, Av. Mitre al 700','RECIBIDO','2026-09-06 14:00-03','2026-09-06 14:00-03'),
  ('40000000-0000-4000-8000-000000000007','30000000-0000-4000-8000-000000000007','ciudadano.demo','AMBIENTE','Buenos Aires','Avellaneda','Sarandí',-34.6870,-58.3435,'Microbasural en esquina con quema de residuos','EN_ANALISIS','2026-09-07 15:00-03','2026-09-08 15:00-03'),
  ('40000000-0000-4000-8000-000000000008','30000000-0000-4000-8000-000000000008','ciudadano.vecino','VULNERABILIDAD_SOCIAL','Buenos Aires','Avellaneda','Wilde',-34.7050,-58.3175,'Refugio improvisado bajo estructura vial que requiere abordaje asistencial — evidencia sin personas identificables','DERIVADO','2026-09-09 16:00-03','2026-09-11 16:00-03')
) as v(id, csid, username, service_code, province, subdivision, locality, lat, lng, descr, state, created, updated)
join public.profiles p on p.username = v.username
join public.services s on s.service_code = v.service_code
join public.states_provinces sp on sp.name = v.province
join public.subdivisions sd on sd.state_province_id = sp.id and sd.name = v.subdivision
join public.localities l on l.subdivision_id = sd.id and l.name = v.locality
on conflict (client_side_id) do nothing;

-- Historial (18 filas). changed_by: el autor al abrir, el oficial de la jurisdicción en las transiciones
insert into public.report_state_history (report_id, state_code, changed_by, changed_at)
select v.report_id::uuid, v.state, p.id, v.at::timestamptz
from (values
  ('40000000-0000-4000-8000-000000000001','RECIBIDO','ciudadano.demo','2026-08-29 10:00-03'),
  ('40000000-0000-4000-8000-000000000002','RECIBIDO','ciudadano.demo','2026-08-30 10:00-03'),
  ('40000000-0000-4000-8000-000000000002','EN_ANALISIS','oficial.caba','2026-08-31 10:00-03'),
  ('40000000-0000-4000-8000-000000000003','RECIBIDO','ciudadano.vecino','2026-08-31 11:00-03'),
  ('40000000-0000-4000-8000-000000000003','EN_ANALISIS','oficial.caba','2026-09-01 11:00-03'),
  ('40000000-0000-4000-8000-000000000003','DERIVADO','oficial.caba','2026-09-02 11:00-03'),
  ('40000000-0000-4000-8000-000000000004','RECIBIDO','ciudadano.vecino','2026-09-01 12:00-03'),
  ('40000000-0000-4000-8000-000000000004','EN_ANALISIS','oficial.caba','2026-09-02 12:00-03'),
  ('40000000-0000-4000-8000-000000000004','DERIVADO','oficial.caba','2026-09-03 12:00-03'),
  ('40000000-0000-4000-8000-000000000004','RESUELTO','oficial.caba','2026-09-05 12:00-03'),
  ('40000000-0000-4000-8000-000000000005','RECIBIDO','ciudadano.demo','2026-09-03 13:00-03'),
  ('40000000-0000-4000-8000-000000000005','DESESTIMADO','oficial.caba','2026-09-04 13:00-03'),
  ('40000000-0000-4000-8000-000000000006','RECIBIDO','ciudadano.vecino','2026-09-06 14:00-03'),
  ('40000000-0000-4000-8000-000000000007','RECIBIDO','ciudadano.demo','2026-09-07 15:00-03'),
  ('40000000-0000-4000-8000-000000000007','EN_ANALISIS','oficial.avellaneda','2026-09-08 15:00-03'),
  ('40000000-0000-4000-8000-000000000008','RECIBIDO','ciudadano.vecino','2026-09-09 16:00-03'),
  ('40000000-0000-4000-8000-000000000008','EN_ANALISIS','oficial.avellaneda','2026-09-10 16:00-03'),
  ('40000000-0000-4000-8000-000000000008','DERIVADO','oficial.avellaneda','2026-09-11 16:00-03')
) as v(report_id, state, username, at)
join public.profiles p on p.username = v.username
where exists (select 1 from public.citizen_reports r where r.id = v.report_id::uuid)
  and not exists (
    select 1 from public.report_state_history h
    where h.report_id = v.report_id::uuid and h.state_code = v.state);

commit;


-- =====================================================================
-- PARTE 5 — Capa de exportación Open311 GeoReport v2 (M-6, M-7, M-8)
-- Se acopla sin cambiar el sistema: nada se renombra ni se restringe.
-- https://wiki.open311.org/GeoReport_v2/
-- =====================================================================
begin;

-- M-6 · equivalente Open311 de cada estado (el estándar solo admite open | closed)
alter table public.report_states add column if not exists open311_status varchar;
update public.report_states set open311_status = 'open'
 where code in ('RECIBIDO','EN_ANALISIS','DERIVADO') and open311_status is distinct from 'open';
update public.report_states set open311_status = 'closed'
 where code in ('RESUELTO','DESESTIMADO') and open311_status is distinct from 'closed';
alter table public.report_states alter column open311_status set not null;
do $$ begin
  alter table public.report_states add constraint report_states_open311_status_ck check (open311_status in ('open','closed'));
exception when duplicate_object then null; end $$;

-- M-7 · palabras clave (tabla opcional: vacía no cambia nada; una palabra por fila = 1NF)
create table if not exists public.service_keywords (
  service_id uuid not null references public.services(id),
  keyword text not null,
  primary key (service_id, keyword)
);

-- M-8 · campos opcionales de atributos (nulos por defecto, sin restricciones nuevas)
alter table public.service_attributes
  add column if not exists datatype_description text,
  add column if not exists description text,
  add column if not exists sort_order int;

-- Vistas de exportación. security_invoker = true: respetan el RLS de las tablas de base.
-- No exponen al autor del reporte ni ningún dato personal.
create or replace view public.open311_services with (security_invoker = true) as
select s.service_code,
       s.service_name,
       s.description,
       exists (select 1 from public.service_attributes sa where sa.service_id = s.id) as metadata,
       'realtime'::text as type,
       (select string_agg(k.keyword, ', ' order by k.keyword)
          from public.service_keywords k where k.service_id = s.id) as keywords,
       s.group_name as "group"
from public.services s;

create or replace view public.open311_service_attributes with (security_invoker = true) as
select s.service_code,
       true as variable,
       sa.attribute_code as code,
       sa.data_type as datatype,
       sa.required,
       sa.datatype_description,
       row_number() over (partition by sa.service_id order by sa.sort_order nulls last, sa.attribute_code)::int as "order",
       sa.description,
       (select json_agg(json_build_object('key', v.value_key, 'name', v.value_name) order by v.value_key)
          from public.service_attribute_values v where v.attribute_id = sa.id) as "values"
from public.service_attributes sa
join public.services s on s.id = sa.service_id;

create or replace view public.open311_requests with (security_invoker = true) as
select r.id as service_request_id,
       st.open311_status as status,
       (select h.notes from public.report_state_history h
         where h.report_id = r.id order by h.changed_at desc limit 1) as status_notes,
       s.service_name,
       s.service_code,
       r.description,
       (select a.name from public.report_outreach_logs o
          join public.agency_contacts c on c.id = o.contact_id
          join public.agencies a on a.id = c.agency_id
         where o.report_id = r.id order by o.sent_at desc limit 1) as agency_responsible,
       r.created_at as requested_datetime,
       r.updated_at as updated_datetime,
       r.latitud as lat,
       r.longitud as long,
       (select i.image_url from public.report_images i
         where i.report_id = r.id order by i.created_at limit 1) as media_url
from public.citizen_reports r
join public.report_states st on st.code = r.current_state_code
left join public.services s on s.id = r.service_id;

commit;


-- =====================================================================
-- PARTE 5B — Organismos por área, alcance por categoría y traza del reporte
-- Decisión del PO (D-T1, 14/09/2026): se registran SIEMPRE el funcionario y su
-- organismo o área. Cada funcionario tiene usuario propio: del usuario se obtienen
-- el área y el organismo del que depende.
-- Todo es ADITIVO: no cambia el comportamiento actual.
--   · agencies.parent_agency_id           → organismo del que depende un área
--   · agency_services                     → qué categorías atiende un área (sin filas = todas)
--   · profile_services                    → qué categorías atiende un funcionario (sin filas = todas las de su área)
--   · report_event_types + report_events  → hitos que no son cambios de estado (VISTO_POR_ORGANISMO)
--   · report_state_history.actor_agency_id → área de quien cambió el estado, al momento del cambio
--   · citizen_reports.client_created_at    → cuándo se creó en el teléfono (reportes offline)
-- D-T2 (PO, 14/09/2026): el funcionario se registra SIEMPRE (su usuario), pero el INFORME muestra solo
-- organismo y departamento (área). Si el área no depende de otro organismo, solo el organismo.
-- =====================================================================
begin;

-- Jerarquía: un área (p. ej. una dirección de tránsito) depende de un organismo (p. ej. un municipio)
alter table public.agencies add column if not exists parent_agency_id uuid references public.agencies(id);
do $$ begin
  alter table public.agencies add constraint agencies_not_own_parent check (parent_agency_id is null or parent_agency_id <> id);
exception when duplicate_object then null; end $$;

-- Qué categorías atiende cada área. Sin filas = atiende todas (compatible con lo actual)
create table if not exists public.agency_services (
  agency_id uuid not null references public.agencies(id),
  service_id uuid not null references public.services(id),
  primary key (agency_id, service_id)
);

-- Qué categorías atiende cada funcionario dentro de su área. Sin filas = todas las de su área
create table if not exists public.profile_services (
  profile_id uuid not null references public.profiles(id),
  service_id uuid not null references public.services(id),
  primary key (profile_id, service_id)
);

-- ¿El funcionario atiende este reporte? Jurisdicción del área + categorías del área + categorías propias.
-- security definer: se puede usar dentro de políticas RLS sin recursión.
-- Si se aplica la PARTE 12, reemplazar "l.subdivision_id = a.subdivision_id" por public.agency_covers_locality(a.id, l.id).
create or replace function public.profile_attends_report(p_profile_id uuid, p_report_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from profiles p
    join agencies a        on a.id = p.agency_id
    join citizen_reports r on r.id = p_report_id
    join localities l      on l.id = r.locality_id
    where p.id = p_profile_id
      and l.subdivision_id = a.subdivision_id
      and (not exists (select 1 from agency_services x where x.agency_id = a.id)
           or exists (select 1 from agency_services x where x.agency_id = a.id and x.service_id = r.service_id))
      and (not exists (select 1 from profile_services y where y.profile_id = p.id)
           or exists (select 1 from profile_services y where y.profile_id = p.id and y.service_id = r.service_id)));
$$;
revoke execute on function public.profile_attends_report(uuid, uuid) from public, anon;
grant  execute on function public.profile_attends_report(uuid, uuid) to authenticated;

-- Hitos que no son cambios de estado
create table if not exists public.report_event_types (code varchar primary key, description text not null);
insert into public.report_event_types (code, description) values
  ('VISTO_POR_ORGANISMO','Visto por el organismo')
on conflict (code) do nothing;

-- Append-only (sin políticas de UPDATE ni DELETE). Guarda funcionario y área AL MOMENTO del evento
create table if not exists public.report_events (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.citizen_reports(id),
  event_type_code varchar not null references public.report_event_types(code),
  actor_profile_id uuid references public.profiles(id),
  actor_agency_id uuid references public.agencies(id),
  occurred_at timestamptz not null default now(),
  notes text
);
create unique index if not exists report_events_first_view_uq
  on public.report_events (report_id, actor_agency_id)
  where event_type_code = 'VISTO_POR_ORGANISMO';

-- Área de quien cambia el estado, al momento del cambio (la completa el código al registrar la transición)
alter table public.report_state_history add column if not exists actor_agency_id uuid references public.agencies(id);

-- Cuándo se creó el reporte en el teléfono (lo envía la sincronización offline)
alter table public.citizen_reports add column if not exists client_created_at timestamptz;

-- La llama el panel del organismo al abrir un reporte. Toma al funcionario de la sesión y solo
-- registra si ese funcionario atiende el reporte. Una sola vez por área (primera apertura).
create or replace function public.mark_report_viewed(p_report_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into report_events (report_id, event_type_code, actor_profile_id, actor_agency_id)
  select p_report_id, 'VISTO_POR_ORGANISMO', p.id, p.agency_id
  from profiles p
  where p.id = auth.uid()
    and p.agency_id is not null
    and profile_attends_report(p.id, p_report_id)
  on conflict (report_id, actor_agency_id) where event_type_code = 'VISTO_POR_ORGANISMO' do nothing;
$$;
revoke execute on function public.mark_report_viewed(uuid) from public, anon;
grant  execute on function public.mark_report_viewed(uuid) to authenticated;

alter table public.agency_services    enable row level security;
alter table public.profile_services   enable row level security;
alter table public.report_event_types enable row level security;
alter table public.report_events      enable row level security;
do $$
declare t text;
begin
  foreach t in array array['agency_services','report_event_types'] loop
    if not exists (select 1 from pg_policies
                   where schemaname = 'public' and tablename = t and policyname = 'read authenticated') then
      execute format('create policy "read authenticated" on public.%I for select to authenticated using (true)', t);
    end if;
  end loop;
end $$;
-- profile_services y report_events: política de lectura pendiente (Q-8). Hoy solo el servidor los lee.

-- Línea de tiempo del reporte: es la FUENTE DEL INFORME. Respeta el RLS de cada tabla.
-- D-T2: muestra organismo y departamento, NUNCA al funcionario. El funcionario queda registrado en
-- las tablas de base (report_state_history.changed_by, report_events.actor_profile_id) para auditoría.
--   organization_name = organismo del que depende el área (o el área misma, si no depende de otro)
--   department_name   = el área, solo si depende de un organismo; si no, vacío
-- Si se aplica la PARTE 11, reemplazar report_images por citizen_report_media.
create or replace view public.report_timeline with (security_invoker = true) as
select h.report_id, h.changed_at as occurred_at, 'CAMBIO_DE_ESTADO'::text as milestone,
       h.state_code::varchar as state_code,
       coalesce(pa.name, a.name) as organization_name,
       case when a.parent_agency_id is not null then a.name end as department_name
from public.report_state_history h
left join public.profiles p  on p.id = h.changed_by
left join public.agencies a  on a.id = coalesce(h.actor_agency_id, p.agency_id)
left join public.agencies pa on pa.id = a.parent_agency_id
union all
select i.report_id, i.created_at, 'EVIDENCIA_ANONIMIZADA', null::varchar, null::text, null::text
from public.report_images i
union all
select ai.report_id, ai.created_at, 'ANALISIS_JURIDICO', null::varchar, null::text, null::text
from public.report_ai_analysis ai
union all
select o.report_id, o.sent_at, 'ENVIADO_AL_ORGANISMO', null::varchar,
       coalesce(pa.name, a.name), case when a.parent_agency_id is not null then a.name end
from public.report_outreach_logs o
join public.agency_contacts c on c.id = o.contact_id
join public.agencies a on a.id = c.agency_id
left join public.agencies pa on pa.id = a.parent_agency_id
union all
select e.report_id, e.occurred_at, e.event_type_code, null::varchar,
       coalesce(pa.name, a.name), case when a.parent_agency_id is not null then a.name end
from public.report_events e
left join public.agencies a  on a.id = e.actor_agency_id
left join public.agencies pa on pa.id = a.parent_agency_id;

-- Open311: agency_responsible con la misma regla del informe ("Organismo — Departamento", o solo el organismo).
-- Redefine la vista de la PARTE 5 (mismas columnas; ahora que existe parent_agency_id).
create or replace view public.open311_requests with (security_invoker = true) as
select r.id as service_request_id,
       st.open311_status as status,
       (select h.notes from public.report_state_history h
         where h.report_id = r.id order by h.changed_at desc limit 1) as status_notes,
       s.service_name,
       s.service_code,
       r.description,
       (select coalesce(pa.name || ' — ' || a.name, a.name) from public.report_outreach_logs o
          join public.agency_contacts c on c.id = o.contact_id
          join public.agencies a on a.id = c.agency_id
          left join public.agencies pa on pa.id = a.parent_agency_id
         where o.report_id = r.id order by o.sent_at desc limit 1) as agency_responsible,
       r.created_at as requested_datetime,
       r.updated_at as updated_datetime,
       r.latitud as lat,
       r.longitud as long,
       (select i.image_url from public.report_images i
         where i.report_id = r.id order by i.created_at limit 1) as media_url
from public.citizen_reports r
join public.report_states st on st.code = r.current_state_code
left join public.services s on s.id = r.service_id;

commit;


-- =====================================================================
-- PARTE 6 — Módulo RAG: tablas, funciones y RLS (M-4, DER v3.2)
-- Reemplaza a la tabla normativas (que NO se borra acá: ver PARTE 9)
-- =====================================================================
begin;

-- Catálogos
create table if not exists public.source_types       (code varchar primary key, description text not null);
create table if not exists public.document_types     (code varchar primary key, description text not null);
create table if not exists public.foundation_types   (code varchar primary key, description text not null);
create table if not exists public.ai_result_statuses (code varchar primary key, description text not null);

create table if not exists public.embedding_models (
  code varchar primary key,
  provider varchar not null,
  model_name text not null,
  dimensions int not null check (dimensions = 768),
  is_active boolean not null default false,
  retired_at date
);
create unique index if not exists embedding_models_one_active on public.embedding_models (is_active) where is_active;

create table if not exists public.generation_models (
  code varchar primary key,
  provider varchar not null,
  model_name text not null,
  is_active boolean not null default false,
  retired_at date
);
create unique index if not exists generation_models_one_active on public.generation_models (is_active) where is_active;

-- Fuentes: una fila por norma, anclada a exactamente UN nivel (arco exclusivo)
create table if not exists public.knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  source_type_code varchar not null references public.source_types(code),
  document_type_code varchar not null references public.document_types(code),
  document_number text,
  title text not null,
  issuing_authority text not null,
  country_id uuid references public.countries(id),
  state_province_id uuid references public.states_provinces(id),
  subdivision_id uuid references public.subdivisions(id),
  requires_adhesion boolean not null default false,
  source_url text not null,
  snapshot_path text,
  is_current boolean not null default true,
  verified_at timestamptz not null,
  last_amended_by text,
  created_at timestamptz default now(),
  constraint knowledge_sources_one_scope check (num_nonnulls(country_id, state_province_id, subdivision_id) = 1)
);

create table if not exists public.source_adhesions (
  source_id uuid not null references public.knowledge_sources(id),
  adhering_source_id uuid not null references public.knowledge_sources(id),
  scope_note text,
  verified_at timestamptz not null,
  primary key (source_id, adhering_source_id),
  constraint source_adhesions_not_self check (source_id <> adhering_source_id)
);

-- Fragmentos: un artículo o inciso; inmutables y versionados
create table if not exists public.knowledge_fragments (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.knowledge_sources(id),
  hierarchy_path text not null,
  article text,
  subsection text,
  content text not null,
  foundation_type_code varchar references public.foundation_types(code),
  is_current boolean not null default true,
  replaces_fragment_id uuid references public.knowledge_fragments(id),
  fts tsvector generated always as (to_tsvector('spanish', content)) stored,
  created_at timestamptz default now()
);
create unique index if not exists knowledge_fragments_current_uq
  on public.knowledge_fragments (source_id, article, subsection) nulls not distinct
  where is_current;
create index if not exists knowledge_fragments_fts_idx on public.knowledge_fragments using gin (fts);

create table if not exists public.fragment_services (
  fragment_id uuid not null references public.knowledge_fragments(id),
  service_id uuid not null references public.services(id),
  primary key (fragment_id, service_id)
);

-- Vectores: una fila por fragmento y por modelo (probar o migrar de modelo = filas, no columnas)
create table if not exists public.fragment_embeddings (
  fragment_id uuid not null references public.knowledge_fragments(id),
  model_code varchar not null references public.embedding_models(code),
  embedding vector(768) not null,
  created_at timestamptz default now(),
  primary key (fragment_id, model_code)
);

-- Resultado del análisis: columnas nuevas en la tabla existente
alter table public.report_ai_analysis
  add column if not exists result_status_code varchar references public.ai_result_statuses(code),
  add column if not exists suggested_service_id uuid references public.services(id),
  add column if not exists embedding_model_code varchar references public.embedding_models(code),
  add column if not exists generation_model_code varchar references public.generation_models(code),
  add column if not exists prompt_version text,
  add column if not exists input_tokens int,
  add column if not exists output_tokens int,
  add column if not exists latency_ms int;

do $$ begin
  if (select count(*) from public.report_ai_analysis) = 0 then
    alter table public.report_ai_analysis alter column result_status_code set not null;
    alter table public.report_ai_analysis alter column embedding_model_code set not null;
  else
    raise notice 'report_ai_analysis tiene filas: result_status_code y embedding_model_code quedan nullable. Avisar a Matías';
  end if;
end $$;

-- Evidencia: lo que se recuperó y lo que se citó (append-only)
create table if not exists public.report_ai_evidence (
  analysis_id uuid not null references public.report_ai_analysis(id),
  fragment_id uuid not null references public.knowledge_fragments(id),
  rank int not null check (rank >= 1),
  similarity numeric not null,
  was_cited boolean not null default false,
  quoted_text text,
  primary key (analysis_id, fragment_id)
);

-- Cascada jurisdiccional: qué normas aplican en una localidad
-- scope_level: 1 = municipio/comuna · 2 = provincia/CABA · 3 = nación
create or replace function public.eligible_knowledge_sources(p_locality_id uuid)
returns table (source_id uuid, scope_level int)
language sql stable
set search_path = public
as $$
  with geo as (
    select l.subdivision_id, s.state_province_id, sp.country_id
    from localities l
    join subdivisions s on s.id = l.subdivision_id
    join states_provinces sp on sp.id = s.state_province_id
    where l.id = p_locality_id
  )
  select ks.id,
         case when ks.subdivision_id is not null then 1
              when ks.state_province_id is not null then 2
              else 3 end
  from knowledge_sources ks cross join geo
  where ks.is_current
    and (ks.subdivision_id = geo.subdivision_id
      or ks.state_province_id = geo.state_province_id
      or ks.country_id = geo.country_id)
    and (not ks.requires_adhesion or exists (
          select 1
          from source_adhesions a
          join knowledge_sources ad on ad.id = a.adhering_source_id and ad.is_current
          where a.source_id = ks.id
            and (ad.subdivision_id = geo.subdivision_id
              or ad.state_province_id = geo.state_province_id)));
$$;

-- Búsqueda por significado dentro de la cascada. La llama SOLO el servidor (service_role)
create or replace function public.match_knowledge_fragments(
  query_embedding vector(768),
  p_locality_id uuid,
  p_model_code varchar,
  match_count int default 6
)
returns table (fragment_id uuid, source_id uuid, hierarchy_path text, content text, scope_level int, similarity double precision)
language sql stable
set search_path = public, extensions
as $$
  select f.id, f.source_id, f.hierarchy_path, f.content, e.scope_level,
         1 - (fe.embedding <=> query_embedding)
  from eligible_knowledge_sources(p_locality_id) e
  join knowledge_fragments f  on f.source_id = e.source_id and f.is_current
  join fragment_embeddings fe on fe.fragment_id = f.id and fe.model_code = p_model_code
  order by fe.embedding <=> query_embedding
  limit match_count;
$$;
revoke execute on function public.match_knowledge_fragments(vector, uuid, varchar, int) from public, anon, authenticated;
grant  execute on function public.match_knowledge_fragments(vector, uuid, varchar, int) to service_role;

-- RLS activo en todas las tablas nuevas.
-- Lectura para usuarios autenticados en el corpus y catálogos (texto público). Nadie escribe desde el cliente.
do $$
declare t text;
begin
  foreach t in array array['source_types','document_types','foundation_types','ai_result_statuses',
                           'knowledge_sources','source_adhesions','knowledge_fragments','fragment_services',
                           'service_keywords'] loop
    execute format('alter table public.%I enable row level security', t);
    if not exists (select 1 from pg_policies
                   where schemaname = 'public' and tablename = t and policyname = 'read authenticated') then
      execute format('create policy "read authenticated" on public.%I for select to authenticated using (true)', t);
    end if;
  end loop;
  -- Sin políticas: solo el servidor (service_role) las usa. report_ai_evidence: política pendiente (Q-6)
  foreach t in array array['embedding_models','generation_models','fragment_embeddings','report_ai_evidence'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

commit;


-- =====================================================================
-- PARTE 7 — Seed del RAG: catálogos, normas, adhesión y fragmentos
-- Corpus mínimo verificado (REP-2906). Textos LITERALES: no editar.
-- =====================================================================
begin;

insert into public.source_types (code, description) values
  ('corpus_legal','Normativa jurídica'),
  ('informacion','Información no normativa: trámites, guías del organismo')
on conflict (code) do nothing;

insert into public.document_types (code, description) values
  ('constitucion','Constitución'),
  ('ley','Ley'),
  ('decreto_ley','Decreto-Ley')
on conflict (code) do nothing;

insert into public.foundation_types (code, description) values
  ('obligacion','Obligación del Estado o del municipio'),
  ('conducta_prohibida','Conducta prohibida'),
  ('sancion','Sanción (no se muestra al ciudadano)'),
  ('competencia','Competencia de un organismo')
on conflict (code) do nothing;

insert into public.ai_result_statuses (code, description) values
  ('fundamentado','Hay normativa aplicable y citada'),
  ('indeterminado','Error o validación fallida: no se emite fundamento'),
  ('sin_normativa','No hay normativa cargada que sustente el reporte'),
  ('fuera_de_alcance','No corresponde a Reportalo (por ejemplo, un delito: 911)'),
  ('asistencia','Situación de asistencia social, no es una infracción (vulnerabilidad social)')
on conflict (code) do nothing;

-- text-embedding-004 fue apagado por Google el 14/01/2026: se usa gemini-embedding-2 a 768
insert into public.embedding_models (code, provider, model_name, dimensions, is_active) values
  ('gemini-embedding-2@768','google','gemini-embedding-2',768,true)
on conflict (code) do nothing;

insert into public.generation_models (code, provider, model_name, is_active) values
  ('gemini-3.8-flash','google','gemini-3.8-flash',true)
on conflict (code) do nothing;

-- Normas (8). La Ley 24.449 requiere adhesión (su art. 1): PBA adhirió (Ley 13.927), CABA no.
insert into public.knowledge_sources
  (id, source_type_code, document_type_code, document_number, title, issuing_authority,
   country_id, state_province_id, requires_adhesion, source_url, verified_at, last_amended_by)
select v.id::uuid, 'corpus_legal', v.doc_type, v.num, v.title, v.authority,
       case when v.scope = 'AR' then c.id end,
       case when v.scope <> 'AR' then sp.id end,
       v.req_adh, v.url, v.verified::timestamptz, v.amended
from (values
  ('10000000-0000-4000-8000-000000000001','constitucion',null,'Constitución de la Provincia de Buenos Aires','Provincia de Buenos Aires','Buenos Aires',false,'https://www.infoleg.gob.ar/?page_id=173','2026-09-06',null),
  ('10000000-0000-4000-8000-000000000002','decreto_ley','6769/58','Ley Orgánica de las Municipalidades','Provincia de Buenos Aires','Buenos Aires',false,'https://normas.gba.gob.ar/documentos/OVG48SW0.html','2026-09-06',null),
  ('10000000-0000-4000-8000-000000000003','ley','210','Ente Único Regulador de los Servicios Públicos','Legislatura de la Ciudad Autónoma de Buenos Aires','Ciudad Autónoma de Buenos Aires',false,'https://boletinoficial.buenosaires.gob.ar/normativaba/norma/4623','2026-09-07',null),
  ('10000000-0000-4000-8000-000000000004','ley','24.449','Ley de Tránsito','Congreso de la Nación Argentina','AR',true,'https://servicios.infoleg.gob.ar/infolegInternet/anexos/0-4999/818/texact.htm','2026-09-06',null),
  ('10000000-0000-4000-8000-000000000005','ley','2148','Código de Tránsito y Transporte','Legislatura de la Ciudad Autónoma de Buenos Aires','Ciudad Autónoma de Buenos Aires',false,'https://juristeca.jusbaires.gob.ar/compilacion-normativa-juristeca/ley-2148/h-tit-7/','2026-09-06',null),
  ('10000000-0000-4000-8000-000000000006','ley','451','Régimen de Faltas','Legislatura de la Ciudad Autónoma de Buenos Aires','Ciudad Autónoma de Buenos Aires',false,'https://boletinoficial.buenosaires.gob.ar/normativaba/norma/391197','2026-09-07','Ley N° 5905/17'),
  ('10000000-0000-4000-8000-000000000007','decreto_ley','8031/73','Código de Faltas de la Provincia de Buenos Aires','Provincia de Buenos Aires','Buenos Aires',false,'https://normas.gba.gob.ar/documentos/ZBOPDhkV.html','2026-09-06',null),
  ('10000000-0000-4000-8000-000000000008','ley','13.927','Ley 13.927 (Provincia de Buenos Aires)','Legislatura de la Provincia de Buenos Aires','Buenos Aires',false,'https://normas.gba.gob.ar/documentos/0YqDnfd0.html','2026-09-13',null)
) as v(id, doc_type, num, title, authority, scope, req_adh, url, verified, amended)
cross join public.countries c
left join public.states_provinces sp on sp.name = v.scope and sp.country_id = c.id
where c.iso_code = 'AR'
on conflict (id) do nothing;

-- Adhesión: la Provincia de Buenos Aires (Ley 13.927) adhiere a la Ley 24.449
insert into public.source_adhesions (source_id, adhering_source_id, scope_note, verified_at)
values ('10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000008',
        'en cuanto no se opongan a las disposiciones de la presente', '2026-09-13')
on conflict do nothing;

-- Fragmentos (15). Cada línea es copia literal de su fuente. Ley 451: texto consolidado oficial.

-- FR01 · fuente: constitucion_pba_arts_190_192.md
insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',
 'Constitución de la Provincia de Buenos Aires > Artículo 192 > inciso 4','192','4',
$f$Son atribuciones inherentes al régimen municipal, las siguientes:
4. Tener a su cargo el ornato y salubridad, los establecimientos de beneficencia que no estén a cargo de sociedades particulares, asilos de inmigrantes que sostenga la Provincia, las cárceles locales de detenidos y la vialidad pública.$f$,
 'obligacion') on conflict (id) do nothing;

-- FR02 · fuente: LOM_decreto_ley_6769-58_arts_52_59.md
insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002',
 'Decreto-Ley 6769/58 — Ley Orgánica de las Municipalidades > Artículo 52','52',null,
$f$Corresponde al Concejo disponer la prestación de los servicios públicos de barrido, riego, limpieza, alumbrado, provisión de agua, obras sanitarias y desagües pluviales, inspecciones, registro de guías, transporte y todo otro tendiente a satisfacer necesidades colectivas de carácter local, siempre que su ejecución no se encuentre a cargo de la Provincia o de la Nación.
Tratándose de servicios que puedan tener vinculaciones con las leyes y planes provinciales, el Concejo deberá gestionar autorización ante el Poder Ejecutivo o proceder a convenir las coordinaciones necesarias.$f$,
 'obligacion') on conflict (id) do nothing;

-- FR03 · fuente: LOM_decreto_ley_6769-58_arts_52_59.md
insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002',
 'Decreto-Ley 6769/58 — Ley Orgánica de las Municipalidades > Artículo 59','59',null,
$f$Constituyen obras públicas municipales:
a) Las concernientes a los establecimientos e instituciones municipales.
b) Las de ornato, salubridad, vivienda y urbanismo.
c) Las atinentes a servicios públicos de competencia municipal.
d) Las de infraestructura urbana, en especial las de pavimentación, repavimentación, cercos, veredas, saneamiento, agua corriente, iluminación, electrificación, provisión de gas y redes telefónicas.
Se considerará que las obras de infraestructura cuentan con declaración de utilidad pública, cuando estén incluidas expresamente en planes integrales de desarrollo urbano, aprobados por ordenanza.
Cuando se trate de obras que no estén incluidas en los planes aludidos precedentemente, sólo se podrá proceder a la pertinente declaración de Utilidad pública, mediante ordenanza debidamente fundada.$f$,
 'obligacion') on conflict (id) do nothing;

-- FR04 · fuente: ley_210_caba_ente_regulador.md
insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('20000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000003',
 'Ley 210 (CABA) — Ente Único Regulador de los Servicios Públicos > Artículo 3 (funciones) > inciso j)','3','j',
$f$j) Recibir y tramitar las quejas y reclamos que efectúen los usuarios en sede administrativa tendiente a resolver el conflicto planteado con el prestador.$f$,
 'competencia') on conflict (id) do nothing;

-- FR05 · fuente: ley_210_caba_ente_regulador.md
insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('20000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000003',
 'Ley 210 (CABA) — Ente Único Regulador de los Servicios Públicos > Artículo 2 (servicios comprendidos) > inciso b)','2','b',
$f$b) Alumbrado público y señalamiento luminoso$f$,
 'competencia') on conflict (id) do nothing;

-- FR06 · fuente: ley_210_caba_ente_regulador.md
insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('20000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000003',
 'Ley 210 (CABA) — Ente Único Regulador de los Servicios Públicos > Artículo 2 (servicios comprendidos) > inciso c)','2','c',
$f$c) Higiene urbana, incluida la disposición final$f$,
 'competencia') on conflict (id) do nothing;

-- FR07 · fuente: ley_24449_arts_48_49.md
insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('20000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000004',
 'Ley 24.449 — Ley de Tránsito > Artículo 48 (prohibiciones) > inciso i)','48','i',
$f$Está prohibido en la vía pública:
i) La detención irregular sobre la calzada, el estacionamiento sobre la banquina y la detención en ella sin ocurrir emergencia;$f$,
 'conducta_prohibida') on conflict (id) do nothing;

-- FR08 · fuente: ley_24449_arts_48_49.md
insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('20000000-0000-4000-8000-000000000008','10000000-0000-4000-8000-000000000004',
 'Ley 24.449 — Ley de Tránsito > Artículo 48 (prohibiciones) > inciso t)','48','t',
$f$Está prohibido en la vía pública:
t) Estorbar u obstaculizar de cualquier forma la calzada o la banquina y hacer construcciones, instalarse o realizar venta de productos en zona alguna del camino;$f$,
 'conducta_prohibida') on conflict (id) do nothing;

-- FR09 · fuente: ley_24449_arts_48_49.md
insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('20000000-0000-4000-8000-000000000009','10000000-0000-4000-8000-000000000004',
 'Ley 24.449 — Ley de Tránsito > Artículo 49 (estacionamiento) > inciso b) > 1','49','b.1',
$f$En zona urbana deben observarse las reglas siguientes:
b) No se debe estacionar ni autorizarse el mismo:
1. En todo lugar donde se pueda afectar la seguridad, visibilidad o fluidez del tránsito o se oculte la señalización;$f$,
 'conducta_prohibida') on conflict (id) do nothing;

-- FR10 · fuente: ley_24449_arts_48_49.md
insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('20000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000004',
 'Ley 24.449 — Ley de Tránsito > Artículo 49 (estacionamiento) > inciso b) > 3','49','b.3',
$f$En zona urbana deben observarse las reglas siguientes:
b) No se debe estacionar ni autorizarse el mismo:
3. Sobre la senda para peatones o bicicletas, aceras, rieles, sobre la calzada, y en los diez metros anteriores y posteriores a la parada del transporte de pasajeros.$f$,
 'conducta_prohibida') on conflict (id) do nothing;

-- FR11 · fuente: ley_2148_caba_arts_7.1.8_7.1.9.md
insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('20000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000005',
 'Ley 2148 (CABA) — Código de Tránsito y Transporte > Título VII > Artículo 7.1.8 (prohibiciones especiales)','7.1.8',null,
$f$En doble fila, excepto como detención previa a la maniobra de estacionamiento.$f$,
 'conducta_prohibida') on conflict (id) do nothing;

-- FR12 · fuente: ley_2148_caba_arts_7.1.8_7.1.9.md
insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('20000000-0000-4000-8000-000000000012','10000000-0000-4000-8000-000000000005',
 'Ley 2148 (CABA) — Código de Tránsito y Transporte > Título VII > Artículo 7.1.9 (prohibiciones generales)','7.1.9',null,
$f$Frente a los vados o rampas para personas con discapacidad.$f$,
 'conducta_prohibida') on conflict (id) do nothing;

-- FR13 · fuente: ley_451_texto.txt
insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('20000000-0000-4000-8000-000000000013','10000000-0000-4000-8000-000000000006',
 'Ley 451 (CABA) — Régimen de Faltas > Artículo 6.1.52 (estacionamiento o detención prohibida)','6.1.52',null,
$f$El/la conductor/a, titular o responsable de un automotor de uso particular, motovehículo, acoplado o semiacoplado que estacione o se detenga en un lugar prohibido o en forma antirreglamentaria, es sancionado/a con multa de cien (100) unidades fijas. El/la conductor/a, titular o responsable de transporte de pasajeros y/o de carga que estacione en un lugar prohibido o en forma antirreglamentaria, es sancionado/a con multa de cien (100) unidades fijas. Cuando el estacionamiento se realice en lugares reservados para servicios de emergencia, o paradas de transporte de pasajeros, entradas de vehículos, ciclovías, carriles exclusivos, corredores de Metrobus y zonas de Microcentro y Macrocentro, la multa se elevará al doble. Cuando el estacionamiento se realice en lugares reservados para vehículos de personas con discapacidad o rampas para discapacitados es sancionado/a con multa de trescientas (300) unidades fijas.$f$,
 'sancion') on conflict (id) do nothing;

-- FR14 · fuente: ley_451_texto.txt
insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('20000000-0000-4000-8000-000000000014','10000000-0000-4000-8000-000000000006',
 'Ley 451 (CABA) — Régimen de Faltas > Artículo 6.1.37 (obstrucción de vía)','6.1.37',null,
$f$El/la conductor/a de un vehículo que cause la obstrucción de la vía transversal, ciclovías, veredas o estacionamientos reservados, es sancionado/a con multa de setenta (70) unidades fijas. Cuando la obstrucción se produzca, carriles exclusivos y/o preferenciales, METROBUS y Premetro, la multa se elevará al doble. Cuando la obstrucción se produzca en rampas para discapacitados o en lugares reservados para vehículos de personas con discapacidad es sancionado/a con multa de trescientas (300) unidades fijas.$f$,
 'sancion') on conflict (id) do nothing;

-- FR15 · fuente: codigo_faltas_decreto_ley_8031-73_indice.md
-- Distractor deliberado (REP-2906): sin categoría ni tipo de fundamento, como cualquier norma no vinculada
insert into public.knowledge_fragments (id, source_id, hierarchy_path, article, subsection, content, foundation_type_code) values
('20000000-0000-4000-8000-000000000015','10000000-0000-4000-8000-000000000007',
 'Decreto-Ley 8031/73 — Código de Faltas de la Provincia de Buenos Aires > Índice',null,null,
$f$TÍTULO I — Del Régimen Contravencional (validez, penas, imputabilidad, reincidencia, extinción)
TÍTULO II — De las Faltas:
Cap. I: Contra la Seguridad de las Personas
Cap. II: Contra el Patrimonio
Cap. III: Contra la Moralidad Pública y las Buenas Costumbres
Cap. IV: Contra la Tranquilidad y el Orden Público
Cap. V: Contra la Autoridad
Cap. VI: Contra el Ejercicio Regular del Deporte (derogado)
Cap. VII: Contra la Fe Pública
Cap. VIII: Contra los Festejos del Carnaval
Cap. IX: De las Expresiones Utilizadas en este Título
Cap. X: Represión de los Juegos de Azar (derogado por Ley 13.470)
TÍTULO III — Órgano de la Justicia de Faltas y del Procedimiento$f$,
 null) on conflict (id) do nothing;

-- Categoría de cada fragmento (15 filas; FR15 no lleva ninguna).
-- LOM art. 52 (FR02) también en AMBIENTE: "barrido, riego, limpieza" cubre basurales y acumulación
-- de residuos (decisión del PO, 14/09/2026).
insert into public.fragment_services (fragment_id, service_id)
select v.fid::uuid, s.id
from (values
  ('20000000-0000-4000-8000-000000000001','INFRAESTRUCTURA'),
  ('20000000-0000-4000-8000-000000000002','INFRAESTRUCTURA'),
  ('20000000-0000-4000-8000-000000000002','AMBIENTE'),
  ('20000000-0000-4000-8000-000000000003','INFRAESTRUCTURA'),
  ('20000000-0000-4000-8000-000000000004','INFRAESTRUCTURA'),
  ('20000000-0000-4000-8000-000000000005','INFRAESTRUCTURA'),
  ('20000000-0000-4000-8000-000000000006','AMBIENTE'),
  ('20000000-0000-4000-8000-000000000007','TRANSITO'),
  ('20000000-0000-4000-8000-000000000008','TRANSITO'),
  ('20000000-0000-4000-8000-000000000009','TRANSITO'),
  ('20000000-0000-4000-8000-000000000010','TRANSITO'),
  ('20000000-0000-4000-8000-000000000011','TRANSITO'),
  ('20000000-0000-4000-8000-000000000012','TRANSITO'),
  ('20000000-0000-4000-8000-000000000013','TRANSITO'),
  ('20000000-0000-4000-8000-000000000014','TRANSITO')
) as v(fid, code)
join public.services s on s.service_code = v.code
on conflict do nothing;

commit;


-- =====================================================================
-- PARTE 8 — Verificación (solo lectura). Todo tiene que dar OK.
-- fragment_embeddings da 0 hasta correr el script de vectores (guía §5).
-- =====================================================================
select name, expected, actual,
       case when expected = actual then 'OK' else 'REVISAR' end as result
from (values
  ('countries', 1, (select count(*) from public.countries)),
  ('states_provinces', 3, (select count(*) from public.states_provinces)),
  ('subdivisions', 17, (select count(*) from public.subdivisions)),
  ('localities', 57, (select count(*) from public.localities)),
  ('agencies', 2, (select count(*) from public.agencies)),
  ('agency_subscriptions', 2, (select count(*) from public.agency_subscriptions)),
  ('agency_contacts', 2, (select count(*) from public.agency_contacts)),
  ('services', 5, (select count(*) from public.services)),
  ('service_attributes', 1, (select count(*) from public.service_attributes)),
  ('report_states', 5, (select count(*) from public.report_states)),
  ('report_states open', 3, (select count(*) from public.report_states where open311_status = 'open')),
  ('profiles', 6, (select count(*) from public.profiles)),
  ('terms_consents', 2, (select count(*) from public.terms_consents)),
  ('citizen_reports (perfil full)', 8, (select count(*) from public.citizen_reports)),
  ('report_state_history (perfil full)', 18, (select count(*) from public.report_state_history)),
  ('source_types', 2, (select count(*) from public.source_types)),
  ('document_types', 3, (select count(*) from public.document_types)),
  ('foundation_types', 4, (select count(*) from public.foundation_types)),
  ('ai_result_statuses', 5, (select count(*) from public.ai_result_statuses)),
  ('embedding_models activos', 1, (select count(*) from public.embedding_models where is_active)),
  ('generation_models activos', 1, (select count(*) from public.generation_models where is_active)),
  ('knowledge_sources', 8, (select count(*) from public.knowledge_sources)),
  ('source_adhesions', 1, (select count(*) from public.source_adhesions)),
  ('knowledge_fragments', 15, (select count(*) from public.knowledge_fragments)),
  ('fragment_services', 15, (select count(*) from public.fragment_services)),
  ('report_event_types', 1, (select count(*) from public.report_event_types)),
  ('agency_services (sin filas = atienden todas)', 0, (select count(*) from public.agency_services)),
  ('fragment_embeddings (después del script)', 15, (select count(*) from public.fragment_embeddings))
) as t(name, expected, actual);

-- Cascada (no necesita IA). Esperado:
--   Piñeyro (BA): Constitución PBA, LOM, Código de Faltas, Ley 13.927 (nivel 2) + Ley de Tránsito 24.449 (nivel 3)
--   Retiro (CABA): Ley 210, Ley 2148, Ley 451 (nivel 2). NUNCA la 24.449
--   Avellaneda (Santa Fe): ninguna
select sp.name as province, s.name as subdivision, l.name as locality, ks.title, e.scope_level
from public.localities l
join public.subdivisions s on s.id = l.subdivision_id
join public.states_provinces sp on sp.id = s.state_province_id
cross join lateral public.eligible_knowledge_sources(l.id) e
join public.knowledge_sources ks on ks.id = e.source_id
where (sp.name, s.name, l.name) in (
  ('Buenos Aires','Avellaneda','Piñeyro'),
  ('Ciudad Autónoma de Buenos Aires','Comuna 1','Retiro'),
  ('Santa Fe','Avellaneda','Avellaneda'))
order by 1, 2, 3, e.scope_level, ks.title;


-- =====================================================================
-- PARTE 9 — COMENTADA. Retiro de la tabla normativas (M-5)
-- Ejecutar SOLO cuando el código ya no use normativas ni match_normativas
-- (guía §2, cambio C-6) y con el OK escrito de Matías.
-- Sus filas no se migran: el texto no es literal (informe REP-2907 §5.2).
-- =====================================================================
-- select proname, pg_get_function_identity_arguments(oid) from pg_proc where proname = 'match_normativas';
-- drop function public.match_normativas(<firma que devolvió la consulta anterior>);
-- drop table public.normativas;


-- =====================================================================
-- PARTE 10 — ya no existe: la traza del reporte pasó a la PARTE 5B (activa),
-- por decisión del PO (D-T1, 14/09/2026).
-- =====================================================================


-- =====================================================================
-- PARTE 11 — COMENTADA. Evidencia anonimizada normalizada (REP-3443)
-- citizen_report_media + media_types reemplazan a report_images.
-- Decide: Matías (Líder Técnico). Condición: confirmar que el guardado de la
-- evidencia es SÍNCRONO (observación O-06). Si es asíncrono, NO aplicar así:
-- hace falta una columna de estado. Impacto en código: guía §7.1.
-- =====================================================================
-- begin;
-- create table if not exists public.media_types (code varchar primary key, description text not null);
-- insert into public.media_types (code, description) values
--   ('foto','Fotografía anonimizada')
-- on conflict (code) do nothing;
-- create table if not exists public.citizen_report_media (
--   id uuid primary key default gen_random_uuid(),
--   report_id uuid not null references public.citizen_reports(id),
--   media_type varchar not null default 'foto' references public.media_types(code),
--   anonymized_url text not null,     -- única versión que se guarda: el original nunca pasa por acá
--   mime_type text,
--   created_at timestamptz default now()
-- );
-- -- Copia lo que haya en report_images (report_images NO se borra en esta parte)
-- insert into public.citizen_report_media (id, report_id, media_type, anonymized_url, created_at)
-- select i.id, i.report_id, 'foto', i.image_url, i.created_at
-- from public.report_images i
-- on conflict (id) do nothing;
-- alter table public.media_types enable row level security;
-- alter table public.citizen_report_media enable row level security;
-- create policy "read authenticated" on public.media_types for select to authenticated using (true);
-- -- La evidencia la ve quien puede ver el reporte: decide el RLS de citizen_reports.
-- -- Escritura: solo el servidor (función de cuarentena con service_role); sin política de INSERT para clientes.
-- create policy "read if report visible" on public.citizen_report_media for select to authenticated
--   using (exists (select 1 from public.citizen_reports r where r.id = citizen_report_media.report_id));
-- -- Vista Open311: media_url pasa a leer de citizen_report_media
-- create or replace view public.open311_requests with (security_invoker = true) as
-- select r.id as service_request_id,
--        st.open311_status as status,
--        (select h.notes from public.report_state_history h
--          where h.report_id = r.id order by h.changed_at desc limit 1) as status_notes,
--        s.service_name,
--        s.service_code,
--        r.description,
--        (select coalesce(pa.name || ' — ' || a.name, a.name) from public.report_outreach_logs o
--           join public.agency_contacts c on c.id = o.contact_id
--           join public.agencies a on a.id = c.agency_id
--           left join public.agencies pa on pa.id = a.parent_agency_id
--          where o.report_id = r.id order by o.sent_at desc limit 1) as agency_responsible,
--        r.created_at as requested_datetime,
--        r.updated_at as updated_datetime,
--        r.latitud as lat,
--        r.longitud as long,
--        (select m.anonymized_url from public.citizen_report_media m
--          where m.report_id = r.id order by m.created_at limit 1) as media_url
-- from public.citizen_reports r
-- join public.report_states st on st.code = r.current_state_code
-- left join public.services s on s.id = r.service_id;
-- commit;
-- -- Cuando ningún código use report_images, con OK escrito de Matías:
-- -- drop table public.report_images;


-- =====================================================================
-- PARTE 12 — COMENTADA. Organismos con jurisdicción en cualquier nivel
-- Resuelve: organismo nacional para VULNERABILIDAD_SOCIAL (Ministerio de
-- Capital Humano) y organismos que cubren varias comunas (observación O-6).
-- Mismo patrón de "arco exclusivo" que knowledge_sources.
-- Decide: PO + Matías, antes del routing del Sprint 15. Impacto: guía §7.2.
-- =====================================================================
-- begin;
-- create table if not exists public.agency_jurisdictions (
--   id uuid primary key default gen_random_uuid(),
--   agency_id uuid not null references public.agencies(id),
--   country_id uuid references public.countries(id),
--   state_province_id uuid references public.states_provinces(id),
--   subdivision_id uuid references public.subdivisions(id),
--   constraint agency_jurisdictions_one_scope check (num_nonnulls(country_id, state_province_id, subdivision_id) = 1)
-- );
-- create unique index if not exists agency_jurisdictions_uq
--   on public.agency_jurisdictions (agency_id, country_id, state_province_id, subdivision_id) nulls not distinct;
-- -- Copia la jurisdicción actual de cada organismo
-- insert into public.agency_jurisdictions (agency_id, subdivision_id)
-- select a.id, a.subdivision_id
-- from public.agencies a
-- where a.subdivision_id is not null
--   and not exists (select 1 from public.agency_jurisdictions j where j.agency_id = a.id and j.subdivision_id = a.subdivision_id);
-- -- ¿El organismo cubre la localidad? Misma cascada que el RAG: municipio/comuna → provincia/CABA → nación
-- create or replace function public.agency_covers_locality(p_agency_id uuid, p_locality_id uuid)
-- returns boolean
-- language sql stable
-- set search_path = public
-- as $$
--   select exists (
--     select 1
--     from localities l
--     join subdivisions s      on s.id = l.subdivision_id
--     join states_provinces sp on sp.id = s.state_province_id
--     join agency_jurisdictions j on j.agency_id = p_agency_id
--     where l.id = p_locality_id
--       and (j.subdivision_id = s.id or j.state_province_id = sp.id or j.country_id = sp.country_id));
-- $$;
-- -- Un organismo nacional no tiene subdivisión: la columna pasa a admitir nulo (transición)
-- alter table public.agencies alter column subdivision_id drop not null;
-- -- Seed: organismo destino de VULNERABILIDAD_SOCIAL (REP-3605 §8). Sin contacto: lo define el PO
-- insert into public.agencies (name) values ('Ministerio de Capital Humano') on conflict (name) do nothing;
-- insert into public.agency_jurisdictions (agency_id, country_id)
-- select a.id, c.id
-- from public.agencies a cross join public.countries c
-- where a.name = 'Ministerio de Capital Humano' and c.iso_code = 'AR'
--   and not exists (select 1 from public.agency_jurisdictions j where j.agency_id = a.id and j.country_id = c.id);
-- alter table public.agency_jurisdictions enable row level security;
-- create policy "read authenticated" on public.agency_jurisdictions for select to authenticated using (true);
-- commit;
-- -- Cuando el RLS y el código usen agency_jurisdictions, con OK escrito de Matías y del PO:
-- -- alter table public.agencies drop column subdivision_id;
-- -- Al aplicar esta parte, en profile_attends_report (PARTE 5B) reemplazar
-- --   "l.subdivision_id = a.subdivision_id"  por  "public.agency_covers_locality(a.id, l.id)"


-- =====================================================================
-- PARTE 13 — COMENTADA. Política de lectura de report_ai_evidence (Q-3)
-- La evidencia de un análisis la ve quien puede ver ese análisis: la subconsulta
-- se evalúa con el RLS del usuario, así que no se duplica ningún criterio.
-- Decide: Matías. Impacto: guía §7.4.
-- =====================================================================
-- create policy "read if analysis visible" on public.report_ai_evidence for select to authenticated
--   using (exists (select 1 from public.report_ai_analysis ai where ai.id = report_ai_evidence.analysis_id));


-- =====================================================================
-- PARTE 14 — ya no existe: el LOM art. 52 en AMBIENTE pasó a la PARTE 7 (activa),
-- por decisión del PO (14/09/2026).
-- =====================================================================


-- =====================================================================
-- PARTE 15 — COMENTADA. Imágenes de los reportes de demostración (9 filas)
-- SOLO si el bucket seed-assets tiene los 9 archivos. Nunca generar ni descargar
-- imágenes. Ruta según REP-3605: seed-assets/<archivo>. Si el código necesita la
-- URL pública completa, Matías define el prefijo (Q-5). Si se aplicó la PARTE 11,
-- usar la variante de citizen_report_media (al final de esta parte).
-- =====================================================================
-- insert into public.report_images (report_id, image_url)
-- select v.report_id::uuid, 'seed-assets/' || v.file
-- from (values
--   ('40000000-0000-4000-8000-000000000001','TRANSITO_01.jpg'),
--   ('40000000-0000-4000-8000-000000000002','INFRAESTRUCTURA_01.jpg'),
--   ('40000000-0000-4000-8000-000000000002','INFRAESTRUCTURA_02.jpg'),
--   ('40000000-0000-4000-8000-000000000003','AMBIENTE_01.jpg'),
--   ('40000000-0000-4000-8000-000000000004','COMERCIO_IRREGULAR_01.jpg'),
--   ('40000000-0000-4000-8000-000000000005','INFRAESTRUCTURA_03.jpg'),
--   ('40000000-0000-4000-8000-000000000006','TRANSITO_02.jpg'),
--   ('40000000-0000-4000-8000-000000000007','AMBIENTE_02.jpg'),
--   ('40000000-0000-4000-8000-000000000008','VULNERABILIDAD_SOCIAL_01.jpg')
-- ) as v(report_id, file)
-- where exists (select 1 from public.citizen_reports r where r.id = v.report_id::uuid)
--   and not exists (select 1 from public.report_images i
--                   where i.report_id = v.report_id::uuid and i.image_url = 'seed-assets/' || v.file);
-- -- Variante con la PARTE 11 aplicada: mismo SELECT, pero
-- --   insert into public.citizen_report_media (report_id, media_type, anonymized_url, mime_type)
-- --   select v.report_id::uuid, 'foto', 'seed-assets/' || v.file, 'image/jpeg' ...
-- --   con el "not exists" sobre citizen_report_media.anonymized_url



-- =====================================================================
-- PARTE 16 — COMENTADA. Aplicar la granularidad por área y categoría al RLS del oficial
-- Hoy el oficial ve los reportes de la subdivisión de su organismo (REP-2507).
-- Con esta parte ve SOLO los reportes que atiende: jurisdicción de su área +
-- categorías de su área + categorías propias (función profile_attends_report, PARTE 5B).
-- Decide: Matías, después de revisar la política SELECT vigente de citizen_reports.
-- No se inventa la política: se reemplaza SOLO la condición del oficial. Impacto: guía §7.
-- =====================================================================
-- -- 1) Ver la política vigente del rol organismo:
-- -- select policyname, cmd, roles, qual from pg_policies where schemaname = 'public' and tablename = 'citizen_reports';
-- -- 2) En la condición del oficial, reemplazar el control de jurisdicción por:
-- --      public.profile_attends_report((select auth.uid()), citizen_reports.id)
-- -- Ejemplo, si la política del oficial es una política propia:
-- -- create policy "officials see attended reports" on public.citizen_reports for select to authenticated
-- --   using (public.profile_attends_report((select auth.uid()), id));
-- -- 3) Aplicar el mismo criterio a report_state_history, report_ai_analysis y report_events,
-- --    que hoy siguen la visibilidad del reporte.
--
-- -- Cómo cargar un área (valores entre <> a completar con datos reales del municipio; NO ejecutar tal cual):
-- -- insert into public.agencies (name, subdivision_id, parent_agency_id)
-- --   values ('<Nombre del área>', '<subdivision_id>', '<id del organismo del que depende>');
-- -- insert into public.agency_services (agency_id, service_id)
-- --   select '<id del área>', id from public.services where service_code = 'TRANSITO';
-- -- -- Solo si un funcionario atiende MENOS categorías que su área:
-- -- insert into public.profile_services (profile_id, service_id)
-- --   select '<id del funcionario>', id from public.services where service_code = 'TRANSITO';
