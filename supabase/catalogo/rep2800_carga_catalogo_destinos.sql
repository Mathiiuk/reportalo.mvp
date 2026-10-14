-- REP-2800 — Carga del catálogo de destinos aprobado en REP-2806 v1.2 (CABA y Avellaneda)
--
-- Se corre a mano en staging DESPUÉS de la migración 20261014150000_rep2800_resolver_organismo_receptor.sql.
-- Es IDEMPOTENTE: se puede volver a correr (por ejemplo cuando el PO re-verifica los contactos cada sprint).
--   * prestaciones, organismos y canales: se actualizan en el lugar (no se borra nada que otra tabla pueda referenciar);
--   * agency_services: se reescribe solo lo que gestiona este script (filas con prestación o rol general).
--
-- ALCANCE (Sprint 16): solo lo que necesita el routing. Quedan para el Sprint 17, como pidió el PO:
--   vocabulario (service_keywords), vínculos norma<->prestación (fragment_services), las 107 prestaciones completas del
--   SUACI y las leyes 2628 y 5688 en el corpus. Acá van las prestaciones que nombra la matriz v1.2; el resto entra
--   con el mismo script cuando llegue el dataset (se agregan filas a c_prest y c_ruta, nada más).
--
-- NO TOCA los 2 organismos de prueba del seed («...— Comuna 1», «Secretaría de Servicios Públicos — Avellaneda»):
-- no tienen filas en agency_services ni canales aprobados, así que el routing los ignora. Limpiarlos queda a criterio
-- del LT porque hay perfiles y análisis que los referencian.
--
-- NO carga direcciones de prueba (agency_contacts.test_value): cómo se guardan lo define el LT (REP-2801).
-- Fuente de cada dato: columnas url/fecha de c_canal (páginas oficiales verificadas por el PO el 14/10/2026 o antes).

begin;

-- ----------------------------------------------------------------------------------------------------------------
-- 1. Prestaciones (atributo «prestacion» por categoría) y el grupo de destino al que pertenecen
-- ----------------------------------------------------------------------------------------------------------------
create temporary table c_prest (grupo text, servicio text, clave text, nombre text) on commit drop;
insert into c_prest values
  ('ALUMBRADO',  'INFRAESTRUCTURA', 'luminaria_apagada_noche',  'Reparación de luminaria apagada durante la noche'),
  ('ALUMBRADO',  'INFRAESTRUCTURA', 'luminaria_artefacto_roto', 'Reparación de luminaria por artefacto roto'),
  ('ALUMBRADO',  'INFRAESTRUCTURA', 'luminaria_intermitente',   'Luminaria intermitente'),
  ('ALUMBRADO',  'INFRAESTRUCTURA', 'mayor_iluminacion',        'Mayor iluminación en calle / plaza'),
  ('CALLES',     'INFRAESTRUCTURA', 'bache_calle',              'Reparación de bache en calle'),
  ('CALLES',     'INFRAESTRUCTURA', 'bache_apertura_hundida',   'Reparación de bache - Apertura hundida'),
  ('CALLES',     'INFRAESTRUCTURA', 'calle_rota_empresa',       'Reparación de calle rota por empresa de servicio'),
  ('CALLES',     'INFRAESTRUCTURA', 'nivelacion_pavimento',     'Nivelación por hundimiento del pavimento'),
  ('VEREDAS',    'INFRAESTRUCTURA', 'vereda_reparacion',        'Reparación de vereda'),
  ('VEREDAS',    'INFRAESTRUCTURA', 'vereda_raices',            'Reparación de vereda por raíces de árbol que producen roturas'),
  ('VEREDAS',    'INFRAESTRUCTURA', 'vereda_empresa',           'Reparación de vereda rota por empresa de servicio'),
  ('VEREDAS',    'INFRAESTRUCTURA', 'rampa_accesibilidad',      'Reparación de rampa de accesibilidad'),
  ('PLUVIALES',  'INFRAESTRUCTURA', 'sumidero_destape',         'Destape de sumidero/alcantarilla o boca de registro pluvial'),
  ('PLUVIALES',  'INFRAESTRUCTURA', 'sumidero_roto',            'Reparación de sumidero/alcantarilla o boca de registro pluvial rota'),
  ('PLUVIALES',  'INFRAESTRUCTURA', 'calle_anegada',            'Intervención por calle anegada/inundada'),
  ('SEMAFOROS_SENALES', 'INFRAESTRUCTURA', 'semaforo_reparacion',       'Reparación de semáforo'),
  ('SEMAFOROS_SENALES', 'INFRAESTRUCTURA', 'senal_transito_reparacion', 'Reparación de señal de tránsito'),
  ('TRANSITO_ESTACIONAMIENTO', 'TRANSITO', 'vehiculo_mal_estacionado',    'Vehículo mal estacionado'),
  ('TRANSITO_ESTACIONAMIENTO', 'TRANSITO', 'vehiculo_obstruyendo_garaje', 'Vehículo obstruyendo garaje'),
  ('TRANSITO_ESTACIONAMIENTO', 'TRANSITO', 'vehiculo_abandonado',         'Remoción de vehículo abandonado'),
  ('TRANSITO_ESTACIONAMIENTO', 'TRANSITO', 'reserva_discapacidad',        'Irregularidades con reservas de espacios para estacionamiento de vehículos de personas con discapacidad'),
  ('HIGIENE_RESIDUOS', 'AMBIENTE', 'residuos_fuera_contenedor',  'Recolección de residuos fuera del contenedor'),
  ('HIGIENE_RESIDUOS', 'AMBIENTE', 'contenedor_vaciado',         'Vaciado de contenedor'),
  ('HIGIENE_RESIDUOS', 'AMBIENTE', 'contenedor_lavado',          'Lavado de contenedor'),
  ('HIGIENE_RESIDUOS', 'AMBIENTE', 'contenedor_reparacion',      'Reparación de contenedor'),
  ('HIGIENE_RESIDUOS', 'AMBIENTE', 'barrido_mejora',             'Mejora de barrido'),
  ('HIGIENE_RESIDUOS', 'AMBIENTE', 'terreno_baldio_higienizacion', 'Higienización de terreno baldío o casa abandonada'),
  ('CONTAMINACION', 'AMBIENTE', 'olores_humos_gases',            'Malos olores / humos / gases tóxicos'),
  ('CONTAMINACION', 'AMBIENTE', 'derrame_peligroso',             'Derrame de líquidos peligrosos / industriales'),
  ('CONTAMINACION', 'AMBIENTE', 'residuos_peligrosos_manipulacion', 'Irregularidades en la manipulación de residuos peligrosos'),
  ('ESPACIO_PUBLICO_COMERCIO', 'COMERCIO_IRREGULAR', 'mantero_vendedor_ambulante', 'Ocupación indebida por mantero o vendedor ambulante'),
  ('ESPACIO_PUBLICO_COMERCIO', 'COMERCIO_IRREGULAR', 'ocupacion_area_gastronomica', 'Ocupación indebida de la vereda/calzada por área gastronómica'),
  ('ESPACIO_PUBLICO_COMERCIO', 'COMERCIO_IRREGULAR', 'ocupacion_local_comercial',   'Ocupación indebida de la vereda/calzada por local comercial'),
  ('ESPACIO_PUBLICO_COMERCIO', 'COMERCIO_IRREGULAR', 'irregularidades_ferias',       'Irregularidades en ferias'),
  ('LOCAL_SIN_HABILITACION', 'COMERCIO_IRREGULAR', 'local_sin_habilitacion', 'Establecimiento sin autorización para funcionar'),
  ('SITUACION_DE_CALLE', 'VULNERABILIDAD_SOCIAL', 'situacion_de_calle',       'Persona o familia en situación de calle'),
  ('NINEZ',              'VULNERABILIDAD_SOCIAL', 'situacion_de_calle_ninez', 'Persona o familia en situación de calle con niñas, niños o adolescentes');

-- Un atributo «prestacion» por categoría (Open311: singlevaluelist), no obligatorio al principio
insert into public.service_attributes (service_id, attribute_code, data_type, required, description)
select s.id, 'prestacion', 'singlevaluelist', false, 'Prestación oficial del reporte (taxonomía SUACI / BA Colaborativa)'
  from public.services s
 where s.service_code in (select distinct servicio from c_prest)
   and not exists (select 1 from public.service_attributes a where a.service_id = s.id and a.attribute_code = 'prestacion');

insert into public.service_attribute_values (attribute_id, value_key, value_name)
select a.id, p.clave, p.nombre
  from c_prest p
  join public.services s on s.service_code = p.servicio
  join public.service_attributes a on a.service_id = s.id and a.attribute_code = 'prestacion'
 where not exists (select 1 from public.service_attribute_values v where v.attribute_id = a.id and v.value_key = p.clave);

update public.service_attribute_values v
   set value_name = p.nombre
  from c_prest p
  join public.services s on s.service_code = p.servicio
  join public.service_attributes a on a.service_id = s.id and a.attribute_code = 'prestacion'
 where v.attribute_id = a.id and v.value_key = p.clave and v.value_name is distinct from p.nombre;

-- ----------------------------------------------------------------------------------------------------------------
-- 2. Organismos. ambito: ciudad = una fila por comuna (opción A del PO) · comuna = la Comuna misma · partido = Avellaneda
-- ----------------------------------------------------------------------------------------------------------------
create temporary table c_org (clave text, nombre text, padre text, ambito text) on commit drop;
insert into c_org values
  -- CABA
  ('gcba',              'Gobierno de la Ciudad de Buenos Aires',                            null,                'ciudad'),
  ('mephu',             'Ministerio de Espacio Público e Higiene Urbana',                   'gcba',              'ciudad'),
  ('min_movilidad',     'Ministerio de Movilidad e Infraestructura',                        'gcba',              'ciudad'),
  ('sec_transito',      'Secretaría de Tránsito',                                           'min_movilidad',     'ciudad'),
  ('dg_cuerpo',         'Dirección General del Cuerpo de Agentes de Tránsito',              'sec_transito',      'ciudad'),
  ('apra',              'Agencia de Protección Ambiental (APRA)',                           'gcba',              'ciudad'),
  ('agc',               'Agencia Gubernamental de Control (AGC)',                           'gcba',              'ciudad'),
  ('desarrollo_humano', 'Ministerio de Desarrollo Humano y Hábitat',                        'gcba',              'ciudad'),
  ('linea_102',         'Línea 102 — Niñez y Adolescencia (GCBA)',                          'gcba',              'ciudad'),
  ('comuna',            null,                                                               null,                'comuna'),
  -- Avellaneda (PBA)
  ('muni_av',           'Municipalidad de Avellaneda',                                      null,                'partido'),
  ('sec_osp',           'Secretaría de Obras y Servicios Públicos',                         'muni_av',           'partido'),
  ('subsec_op',         'Subsecretaría de Obras Públicas',                                  'sec_osp',           'partido'),
  ('dir_alumbrado',     'Dirección de Alumbrado, Sistemas Eléctricos y Vía Pública',        'subsec_op',         'partido'),
  ('subsec_residuos',   'Subsecretaría de Gestión de Residuos',                             'sec_osp',           'partido'),
  ('sec_pca',           'Secretaría de Producción, Comercio y Ambiente',                    'muni_av',           'partido'),
  ('subsec_ambiente',   'Subsecretaría de Ambiente',                                        'sec_pca',           'partido'),
  ('subsec_habil',      'Subsecretaría de Habilitaciones',                                  'sec_pca',           'partido'),
  ('subdir_inspeccion', 'Subdirección de Inspección y Ferias',                              'subsec_habil',      'partido'),
  ('dir_habil',         'Dirección de Habilitaciones',                                      'subsec_habil',      'partido'),
  ('sec_desarrollo',    'Secretaría de Desarrollo Social',                                  'muni_av',           'partido'),
  ('consejo_ninez',     'Consejo de Niñez, Adolescencia y Familia',                         'muni_av',           'partido'),
  ('defensa_civil',     'Defensa Civil de Avellaneda',                                      'muni_av',           'partido');

-- Qué subdivisión le toca a cada organismo (clave de organismo x subdivisión)
create temporary table c_ag (org text, subdivision_id uuid, nombre text, agency_id uuid) on commit drop;
insert into c_ag (org, subdivision_id, nombre)
select o.clave, sd.id, case when o.ambito = 'comuna' then sd.name else o.nombre end
  from c_org o
  join public.subdivisions sd on (
         (o.ambito in ('ciudad', 'comuna')
            and sd.state_province_id = (select id from public.states_provinces where name = 'Ciudad Autónoma de Buenos Aires'))
      or (o.ambito = 'partido'
            and sd.name = 'Avellaneda'
            and sd.state_province_id = (select id from public.states_provinces where name = 'Buenos Aires')));

insert into public.agencies (name, subdivision_id)
select c.nombre, c.subdivision_id from c_ag c
 where not exists (select 1 from public.agencies a where a.name = c.nombre and a.subdivision_id = c.subdivision_id);

update c_ag c set agency_id = a.id
  from public.agencies a where a.name = c.nombre and a.subdivision_id = c.subdivision_id;

-- Organismo padre (dentro de la misma subdivisión)
update public.agencies a set parent_agency_id = pc.agency_id
  from c_ag c
  join c_org o  on o.clave = c.org and o.padre is not null
  join c_ag pc  on pc.org = o.padre and pc.subdivision_id = c.subdivision_id
 where a.id = c.agency_id and a.parent_agency_id is distinct from pc.agency_id;

-- ----------------------------------------------------------------------------------------------------------------
-- 3. Canales (con fuente oficial y fecha). Todos aprobados por el PO en REP-2806 v1.2 (incluidos los Gmail de Avellaneda)
-- ----------------------------------------------------------------------------------------------------------------
create temporary table c_canal (
  org text, tipo text, valor text, etiqueta text, principal boolean, guardia boolean, url text, fecha date
) on commit drop;

insert into c_canal values
  -- CABA · BA Colaborativa es el canal de todos los organismos que reciben reclamos del vecino
  ('gcba',          'web', 'https://bacolaborativa.buenosaires.gob.ar/', 'BA Colaborativa', true,  false, 'https://bacolaborativa.buenosaires.gob.ar/', date '2026-10-13'),
  ('gcba',          'telefono', '147', 'Línea 147 (informativa, no reemplaza el formulario)', false, false, 'https://buenosaires.gob.ar/inicio/telefonos', date '2026-09-29'),
  ('mephu',         'web', 'https://bacolaborativa.buenosaires.gob.ar/', 'BA Colaborativa', true,  false, 'https://bacolaborativa.buenosaires.gob.ar/', date '2026-10-13'),
  ('mephu',         'telefono', '103', 'Emergencias 103 (24 h)', true, true, 'https://buenosaires.gob.ar/inicio/telefonos', date '2026-09-29'),
  ('comuna',        'web', 'https://bacolaborativa.buenosaires.gob.ar/', 'BA Colaborativa', true,  false, 'https://bacolaborativa.buenosaires.gob.ar/', date '2026-10-13'),
  ('sec_transito',  'web', 'https://bacolaborativa.buenosaires.gob.ar/', 'BA Colaborativa', true,  false, 'https://buenosaires.gob.ar/perfil_institucional/secretaria-de-transito', date '2026-10-14'),
  ('dg_cuerpo',     'web', 'https://bacolaborativa.buenosaires.gob.ar/', 'BA Colaborativa', true,  false, 'https://bacolaborativa.buenosaires.gob.ar/', date '2026-10-13'),
  ('apra',          'web', 'https://bacolaborativa.buenosaires.gob.ar/', 'BA Colaborativa', true,  false, 'https://bacolaborativa.buenosaires.gob.ar/', date '2026-10-13'),
  ('apra',          'telefono', '103', 'Emergencias 103 (24 h)', true, true, 'https://buenosaires.gob.ar/inicio/telefonos', date '2026-09-29'),
  ('agc',           'web', 'https://bacolaborativa.buenosaires.gob.ar/', 'BA Colaborativa', true,  false, 'https://buenosaires.gob.ar/gcaba_historico/justicia/agencia-gubernamental-de-control/denuncias', date '2026-09-28'),
  ('agc',           'telefono', '147', 'Línea 147', false, false, 'https://buenosaires.gob.ar/gcaba_historico/justicia/agencia-gubernamental-de-control/denuncias', date '2026-09-28'),
  ('desarrollo_humano', 'telefono', '108', 'Línea 108 (24 h), opción 1 «avisar por otra persona»', true, false, 'https://buenosaires.gob.ar/gcaba_historico/desarrollohumanoyhabitat/emergencia-social', date '2026-10-14'),
  ('linea_102',     'telefono', '102', 'Línea 102 (24 h)', true, false, 'https://buenosaires.gob.ar/inicio/telefonos', date '2026-09-29'),
  -- Avellaneda · CAV: canal general del municipio (se repite como alternativa en cada área)
  ('muni_av',          'web',      'http://reclamosweb.mda.gob.ar/', 'CAV (reclamos web)', true,  false, 'https://tramitesweb.mda.gob.ar/index.php/pasos/3516', date '2026-09-28'),
  ('muni_av',          'telefono', '0800-122-6323',                  'CAV',                false, false, 'https://tramitesweb.mda.gob.ar/index.php/pasos/3516', date '2026-09-28'),
  ('dir_alumbrado',    'web',      'http://reclamosweb.mda.gob.ar/', 'CAV (reclamos web)', true,  false, 'https://tramitesweb.mda.gob.ar/index.php/pasos/3516', date '2026-09-28'),
  ('dir_alumbrado',    'telefono', '0800-122-6323',                  'CAV',                false, false, 'https://tramitesweb.mda.gob.ar/index.php/pasos/3516', date '2026-09-28'),
  ('dir_alumbrado',    'telefono', '4207-9802', 'Consultas al área (Crisólogo Larralde 5813, Wilde; lunes a viernes de 8 a 14)', false, false, 'https://tramitesweb.mda.gob.ar/index.php/pasos/3786', date '2026-10-14'),
  ('dir_alumbrado',    'email',    'sospavellaneda@gmail.com', 'Correo de la Secretaría de Obras y Servicios Públicos', false, false, 'https://www.mda.gob.ar/gobierno/secretaria-de-obras-y-servicios-publicos/', date '2026-10-14'),
  ('subsec_op',        'web',      'http://reclamosweb.mda.gob.ar/', 'CAV (reclamos web)', true,  false, 'https://tramitesweb.mda.gob.ar/index.php/pasos/3516', date '2026-09-28'),
  ('subsec_op',        'telefono', '0800-122-6323',                  'CAV',                false, false, 'https://tramitesweb.mda.gob.ar/index.php/pasos/3516', date '2026-09-28'),
  ('subsec_op',        'email',    'sospavellaneda@gmail.com', 'Correo de la Secretaría de Obras y Servicios Públicos', false, false, 'https://www.mda.gob.ar/gobierno/secretaria-de-obras-y-servicios-publicos/subsecretaria-de-obras-publicas/', date '2026-10-14'),
  ('subsec_residuos',  'web',      'http://reclamosweb.mda.gob.ar/', 'CAV (reclamos web)', true,  false, 'https://tramitesweb.mda.gob.ar/index.php/pasos/3516', date '2026-09-28'),
  ('subsec_residuos',  'telefono', '0800-122-6323',                  'CAV',                false, false, 'https://tramitesweb.mda.gob.ar/index.php/pasos/3516', date '2026-09-28'),
  ('subsec_residuos',  'email',    'sospavellaneda@gmail.com', 'Correo de la Secretaría de Obras y Servicios Públicos', false, false, 'https://www.mda.gob.ar/gobierno/secretaria-de-obras-y-servicios-publicos/subsecretaria-de-gestion-de-residuos/', date '2026-10-14'),
  ('subsec_ambiente',  'email',    'ambiente.mda@gmail.com', 'Subsecretaría de Ambiente', true,  false, 'https://www.mda.gob.ar/gobierno/secretaria-de-produccion-comercio-y-ambiente/subsecretaria-de-ambiente/', date '2026-10-14'),
  ('subsec_ambiente',  'telefono', '5227-7770', 'Subsecretaría de Ambiente', false, false, 'https://www.mda.gob.ar/gobierno/secretaria-de-produccion-comercio-y-ambiente/subsecretaria-de-ambiente/', date '2026-10-14'),
  ('subsec_ambiente',  'telefono', '5227-7781', 'Subsecretaría de Ambiente', false, false, 'https://www.mda.gob.ar/gobierno/secretaria-de-produccion-comercio-y-ambiente/subsecretaria-de-ambiente/', date '2026-10-14'),
  ('subsec_ambiente',  'web',      'http://reclamosweb.mda.gob.ar/', 'CAV (alternativa)', false, false, 'https://tramitesweb.mda.gob.ar/index.php/pasos/3516', date '2026-09-28'),
  ('subdir_inspeccion','email',    'inspeccionavellaneda15@gmail.com', 'Inspección', true,  false, 'https://www.mda.gob.ar/gobierno/secretaria-de-produccion-comercio-y-ambiente/subsecretaria-de-habilitaciones/', date '2026-10-14'),
  ('subdir_inspeccion','email',    'feriasavellaneda@gmail.com', 'Ferias', false, false, 'https://www.mda.gob.ar/gobierno/secretaria-de-produccion-comercio-y-ambiente/subsecretaria-de-habilitaciones/', date '2026-10-14'),
  ('subdir_inspeccion','telefono', '6089-8331', 'Inspección y Ferias', false, false, 'https://www.mda.gob.ar/gobierno/secretaria-de-produccion-comercio-y-ambiente/subsecretaria-de-habilitaciones/', date '2026-10-14'),
  ('subdir_inspeccion','telefono', '6089-8332', 'Inspección y Ferias', false, false, 'https://www.mda.gob.ar/gobierno/secretaria-de-produccion-comercio-y-ambiente/subsecretaria-de-habilitaciones/', date '2026-10-14'),
  ('subdir_inspeccion','telefono', '6089-8387', 'Inspección y Ferias', false, false, 'https://www.mda.gob.ar/gobierno/secretaria-de-produccion-comercio-y-ambiente/subsecretaria-de-habilitaciones/', date '2026-10-14'),
  ('subdir_inspeccion','web',      'http://reclamosweb.mda.gob.ar/', 'CAV (alternativa)', false, false, 'https://tramitesweb.mda.gob.ar/index.php/pasos/3516', date '2026-09-28'),
  ('dir_habil',        'email',    'direccionhabilitacionesmda@gmail.com', 'Dirección de Habilitaciones', true,  false, 'https://www.mda.gob.ar/gobierno/secretaria-de-produccion-comercio-y-ambiente/subsecretaria-de-habilitaciones/', date '2026-10-14'),
  ('dir_habil',        'whatsapp', '11 3891-7358', 'Dirección de Habilitaciones', false, false, 'https://www.mda.gob.ar/gobierno/secretaria-de-produccion-comercio-y-ambiente/subsecretaria-de-habilitaciones/', date '2026-10-14'),
  ('dir_habil',        'web',      'http://reclamosweb.mda.gob.ar/', 'CAV (alternativa)', false, false, 'https://tramitesweb.mda.gob.ar/index.php/pasos/3516', date '2026-09-28'),
  ('sec_desarrollo',   'email',    'desarrollosocial@mda.gob.ar', 'Secretaría de Desarrollo Social', true,  false, 'https://www.mda.gob.ar/gobierno/observatorio-social-de-politicas-publicas/secretaria-de-desarrollo-social/', date '2026-10-14'),
  ('sec_desarrollo',   'telefono', '6089-8315', 'Secretaría de Desarrollo Social', false, false, 'https://www.mda.gob.ar/gobierno/observatorio-social-de-politicas-publicas/secretaria-de-desarrollo-social/', date '2026-10-14'),
  ('sec_desarrollo',   'web',      'http://reclamosweb.mda.gob.ar/', 'CAV (fuera de horario)', false, false, 'https://tramitesweb.mda.gob.ar/index.php/pasos/3516', date '2026-09-28'),
  ('consejo_ninez',    'telefono', '115 426-1618', 'Guardia 24 h', true,  false, 'https://www.mda.gob.ar/gobierno/observatorio-social-de-politicas-publicas/consejo-de-ninez-adolescencia-y-familia/', date '2026-09-28'),
  ('consejo_ninez',    'email',    'ninezadolescenciayflia@mda.gob.ar', 'Consejo de Niñez', false, false, 'https://www.mda.gob.ar/gobierno/observatorio-social-de-politicas-publicas/consejo-de-ninez-adolescencia-y-familia/', date '2026-09-28'),
  ('consejo_ninez',    'telefono', '4201-5053', 'Consejo de Niñez', false, false, 'https://www.mda.gob.ar/gobierno/observatorio-social-de-politicas-publicas/consejo-de-ninez-adolescencia-y-familia/', date '2026-09-28'),
  ('consejo_ninez',    'telefono', '4201-1303', 'Consejo de Niñez', false, false, 'https://www.mda.gob.ar/gobierno/observatorio-social-de-politicas-publicas/consejo-de-ninez-adolescencia-y-familia/', date '2026-09-28'),
  ('consejo_ninez',    'telefono', '4201-4822', 'Consejo de Niñez', false, false, 'https://www.mda.gob.ar/gobierno/observatorio-social-de-politicas-publicas/consejo-de-ninez-adolescencia-y-familia/', date '2026-09-28'),
  ('defensa_civil',    'telefono', '103', 'Defensa Civil / Emergencia Vial (24 h)', true,  true, 'https://www.mda.gob.ar/servicios/telefonos-utiles/', date '2026-10-14'),
  ('defensa_civil',    'telefono', '0800-333-3218', 'Defensa Civil (24 h)', false, true, 'https://www.mda.gob.ar/servicios/telefonos-utiles/', date '2026-10-14');

-- Alta o actualización en el lugar (no hay clave única: se identifica por organismo + tipo + valor)
insert into public.agency_contacts (agency_id, contact_channel, contact_value, is_primary)
select g.agency_id, k.tipo, k.valor, k.principal
  from c_canal k join c_ag g on g.org = k.org
 where not exists (select 1 from public.agency_contacts x
                    where x.agency_id = g.agency_id and x.contact_channel = k.tipo and x.contact_value = k.valor);

update public.agency_contacts x
   set label = k.etiqueta, source_url = k.url, verified_at = k.fecha, is_primary = k.principal,
       is_emergency = k.guardia, is_approved = true
  from c_canal k join c_ag g on g.org = k.org
 where x.agency_id = g.agency_id and x.contact_channel = k.tipo and x.contact_value = k.valor;

-- ----------------------------------------------------------------------------------------------------------------
-- 4. Quién recibe qué. rol: principal | urgencia | general. via: secundaria | avenida (solo CABA, Ley 1777 art. 10 inc. a)
--    Se escribe por grupo (todas sus prestaciones) o por prestación puntual (clave).
-- ----------------------------------------------------------------------------------------------------------------
create temporary table c_ruta (grupo text, clave text, org text, rol text, via text, detalle text) on commit drop;
insert into c_ruta values
  -- CABA
  ('ALUMBRADO',        null, 'mephu',        'principal', null,        'Alumbrado'),
  ('CALLES',           null, 'comuna',       'principal', 'secundaria','Calles'),
  ('CALLES',           null, 'mephu',        'principal', 'avenida',   'Calles'),
  ('VEREDAS',          null, 'comuna',       'principal', 'secundaria','Veredas'),
  ('VEREDAS',          null, 'mephu',        'principal', 'avenida',   'Veredas'),
  ('PLUVIALES',        null, 'mephu',        'principal', null,        'Pluviales'),
  ('PLUVIALES',        null, 'mephu',        'urgencia',  null,        null),
  ('SEMAFOROS_SENALES',null, 'sec_transito', 'principal', null,        'Tránsito y Transporte'),
  ('TRANSITO_ESTACIONAMIENTO', null, 'dg_cuerpo', 'principal', null,   'Denuncia vial'),
  ('HIGIENE_RESIDUOS', null, 'mephu',        'principal', null,        'Limpieza y Reciclado'),
  ('CONTAMINACION',    null, 'apra',         'principal', null,        'Protección Ambiental'),
  (null, 'derrame_peligroso', 'apra',        'urgencia',  null,        null),
  ('ESPACIO_PUBLICO_COMERCIO', null, 'mephu', 'principal', null,       'Ordenamiento del Espacio Público'),
  ('LOCAL_SIN_HABILITACION',   null, 'agc',   'principal', null,       'Fiscalización Actividades Comerciales'),
  ('SITUACION_DE_CALLE', null, 'desarrollo_humano', 'principal', null, null),
  ('NINEZ',            null, 'linea_102',    'principal', null,        null),
  -- Avellaneda
  ('ALUMBRADO',        null, 'dir_alumbrado',   'principal', null, null),
  ('SEMAFOROS_SENALES',null, 'dir_alumbrado',   'principal', null, null),
  ('CALLES',           null, 'subsec_op',       'principal', null, null),
  ('VEREDAS',          null, 'subsec_op',       'principal', null, null),
  ('PLUVIALES',        null, 'subsec_op',       'principal', null, null),
  ('CALLES',           null, 'defensa_civil',   'urgencia',  null, null),
  ('VEREDAS',          null, 'defensa_civil',   'urgencia',  null, null),
  ('PLUVIALES',        null, 'defensa_civil',   'urgencia',  null, null),
  ('TRANSITO_ESTACIONAMIENTO', null, 'muni_av', 'principal', null, null),
  ('HIGIENE_RESIDUOS', null, 'subsec_residuos', 'principal', null, null),
  ('CONTAMINACION',    null, 'subsec_ambiente', 'principal', null, null),
  ('ESPACIO_PUBLICO_COMERCIO', null, 'subdir_inspeccion', 'principal', null, null),
  ('LOCAL_SIN_HABILITACION',   null, 'dir_habil',        'principal', null, null),
  ('SITUACION_DE_CALLE', null, 'sec_desarrollo', 'principal', null, null),
  ('NINEZ',            null, 'consejo_ninez',   'principal', null, null);

-- Se reescribe SOLO lo que gestiona este script: filas con prestación y las de rol general de sus organismos
delete from public.agency_services s
 using c_ag g
 where s.agency_id = g.agency_id and (s.attribute_value_id is not null or s.route_role = 'general');

insert into public.agency_services (agency_id, service_id, attribute_value_id, route_role, road_scope, channel_detail)
select distinct g.agency_id, sv.id, av.id, r.rol, r.via, r.detalle
  from c_ruta r
  join c_prest p on (r.grupo is not null and p.grupo = r.grupo) or (r.clave is not null and p.clave = r.clave)
  join c_ag g on g.org = r.org
  join public.services sv on sv.service_code = p.servicio
  join public.service_attributes sa on sa.service_id = sv.id and sa.attribute_code = 'prestacion'
  join public.service_attribute_values av on av.attribute_id = sa.id and av.value_key = p.clave;

-- Organismo y canal GENERAL de cada jurisdicción (R-2): se enlaza a las 5 categorías porque service_id es obligatorio
insert into public.agency_services (agency_id, service_id, attribute_value_id, route_role)
select g.agency_id, sv.id, null, 'general'
  from c_ag g
  cross join public.services sv
 where g.org in ('gcba', 'muni_av')
   and sv.service_code in ('AMBIENTE', 'COMERCIO_IRREGULAR', 'INFRAESTRUCTURA', 'TRANSITO', 'VULNERABILIDAD_SOCIAL');

commit;
