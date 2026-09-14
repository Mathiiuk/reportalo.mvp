-- ==============================================================================
-- 02_geo_and_services_seed.sql — Geografía y categorías, copiadas verbatim
-- de la PARTE 2 de docs/REP-3769_seed_y_RAG.sql (fuente de verdad, no editada
-- acá: mismos nombres, mismas filas). Se omiten agencies/agency_subscriptions/
-- agency_contacts/service_attributes/report_states porque el esquema mínimo
-- de 01_minimal_schema.sql no las tiene y el RAG no las necesita para probar
-- la cascada jurisdiccional ni el RPC match_knowledge_fragments.
-- ==============================================================================
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

-- Categorías (5, incluida VULNERABILIDAD_SOCIAL)
insert into public.services (service_code, service_name, group_name) values
  ('TRANSITO','Tránsito','Vía pública'),
  ('INFRAESTRUCTURA','Infraestructura','Vía pública'),
  ('AMBIENTE','Ambiente','Vía pública'),
  ('COMERCIO_IRREGULAR','Comercio irregular','Vía pública'),
  ('VULNERABILIDAD_SOCIAL','Vulnerabilidad social','Asistencia social')
on conflict (service_code) do nothing;

commit;
