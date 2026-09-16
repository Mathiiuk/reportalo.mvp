-- V-04 (ronda 2 de Hernan): PARTES 3 y 4 de docs/REP-3769_seed_y_RAG.sql --
-- perfiles demo y los 8 reportes de demostracion (perfil "full").
-- Requiere que los 6 usuarios de Auth ya existan (creados por Matias via
-- scripts/rag-local-dev/create-demo-auth-users.mjs, corrido en su propia
-- terminal -- nunca por este agente, que no maneja contrasenas).
-- Idempotente: on conflict do update / do nothing en todo.

do $$ begin
  if (select count(*) from auth.users where email in (
        'ciudadano.demo@reportalo.test','ciudadano.vecino@reportalo.test','ciudadano.consulta@reportalo.test',
        'oficial.caba@reportalo.test','oficial.avellaneda@reportalo.test','admin.reportalo@reportalo.test')) < 6 then
    raise notice 'Faltan usuarios de prueba en Supabase Auth: crearlos y volver a ejecutar esta migracion';
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

insert into public.terms_consents (user_id, terms_version, accepted_at)
select u.id, '1.0', timestamptz '2026-09-01 12:00:00-03'
from auth.users u
where u.email in ('ciudadano.demo@reportalo.test','ciudadano.vecino@reportalo.test')
  and not exists (select 1 from public.terms_consents t where t.user_id = u.id and t.terms_version = '1.0');

commit;

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
