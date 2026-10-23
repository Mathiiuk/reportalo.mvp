-- REP-3863 · P4 · PROPUESTA de migración (NO APLICAR todavía)
-- GENERADA por scripts/rep3863/generar_carga_p4.mjs desde el dataset del PO: no editar a mano, regenerar.
-- Catálogo de fragmentos usado: catalogo_fragmentos_2026-10-20.csv (REP-3859), SHA-256 3602a43446c4544e7cb6b32b8d9298e99fd238497d348fbac837fd1ad7ae6cb7.
-- Pares (fragmento, categoría) de staging: scripts/rep3863/dataset/pares_fragment_services_2026-10-23.json (169).
--
-- Está fuera de supabase/migrations a propósito. Orden al aplicar (REP-3864 pide "antes" y "después" de cada paso):
--   1. aviso a QA (foto "antes");  2. loader de REP-2800 con las 70 filas de REP-3863_c_prest_nuevas.sql;
--   3. esta migración;  4. segunda corrida de las dos (idempotencia);  5. M1 sobre P0-v1.0 (mismo top 8).
-- No cambia match_knowledge_fragments, RLS ni agency_services.
-- fragment_services y service_keywords NO están en ninguna publicación de Realtime (verificado el 23/10/2026),
-- así que quitarles la PK no afecta replicación (MIG-04).

begin;

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Esquema (idempotente). PK reales (23/10/2026): fragment_services_pkey (fragment_id, service_id) y
--    service_keywords_pkey (service_id, keyword).
-- ---------------------------------------------------------------------------------------------------------------
alter table public.service_keywords
  add column if not exists attribute_value_id uuid references public.service_attribute_values(id),
  add column if not exists origin text;
alter table public.service_keywords drop constraint if exists service_keywords_origin_check;
alter table public.service_keywords add constraint service_keywords_origin_check
  check (origin is null or origin in ('suaci', 'norma', 'pruebas_s15', 'po'));
alter table public.service_keywords drop constraint if exists service_keywords_pkey;
create unique index if not exists service_keywords_uq
  on public.service_keywords (service_id, lower(keyword),
                              coalesce(attribute_value_id, '00000000-0000-0000-0000-000000000000'::uuid));

alter table public.fragment_services
  add column if not exists attribute_value_id uuid references public.service_attribute_values(id),
  add column if not exists tipo_fundamento text;
alter table public.fragment_services drop constraint if exists fragment_services_pkey;
create unique index if not exists fragment_services_uq
  on public.fragment_services (fragment_id, service_id,
                               coalesce(attribute_value_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index if not exists fragment_services_attribute_value_idx on public.fragment_services (attribute_value_id);

-- ---------------------------------------------------------------------------------------------------------------
-- 2. MIG-01: upsert_knowledge_fragment ya no borra los vínculos de P4.
--    Antes: "delete from fragment_services where fragment_id = …" en CADA llamada, aunque el texto no cambie, y al
--    versionar los vínculos quedaban en la versión no vigente. Ahora reescribe solo las filas de categoría
--    (attribute_value_id is null) y, si versiona, copia los vínculos de P4 a la versión nueva SOLO para las
--    categorías que el fragmento sigue teniendo: nunca crea un par (fragmento, categoría) nuevo.
--    Firma, permisos y resultado iguales a 20260920210000_rep3774.
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.upsert_knowledge_fragment(
  p_source_id            uuid,
  p_hierarchy_path       text,
  p_article              text,
  p_subsection           text,
  p_content              text,
  p_foundation_type_code varchar,
  p_service_codes        text[] default '{}'
)
returns table (fragment_id uuid, action text)
language plpgsql
set search_path = public
as $fn$
declare
  v_current_id      uuid;
  v_current_content text;
  v_new_id          uuid;
  v_action          text;
begin
  select f.id, f.content into v_current_id, v_current_content
  from knowledge_fragments f
  where f.source_id  = p_source_id
    and f.article    is not distinct from p_article
    and f.subsection is not distinct from p_subsection
    and f.is_current;

  if v_current_id is not null and v_current_content = p_content then
    v_new_id := v_current_id;
    v_action := 'unchanged';
    update knowledge_fragments f
       set hierarchy_path       = p_hierarchy_path,
           foundation_type_code = coalesce(p_foundation_type_code, f.foundation_type_code)
     where f.id = v_current_id;
  else
    if v_current_id is not null then
      update knowledge_fragments set is_current = false where id = v_current_id;
      v_action := 'versioned';
    else
      v_action := 'created';
    end if;

    insert into knowledge_fragments
      (source_id, hierarchy_path, article, subsection, content,
       foundation_type_code, is_current, replaces_fragment_id)
    values
      (p_source_id, p_hierarchy_path, p_article, p_subsection, p_content,
       p_foundation_type_code, true, v_current_id)
    returning id into v_new_id;
  end if;

  -- Categorías del fragmento: se reescriben siempre, pero SOLO las filas sin prestación (REP-3863 MIG-01)
  delete from fragment_services fs where fs.fragment_id = v_new_id and fs.attribute_value_id is null;
  insert into fragment_services (fragment_id, service_id)
  select v_new_id, s.id
  from unnest(coalesce(p_service_codes, '{}')) as code
  join services s on s.service_code = code
  on conflict do nothing;

  -- Vínculos por prestación (P4): si el fragmento cambió de versión, pasan a la vigente, solo en categorías que
  -- siguen asignadas. Las de categorías quitadas quedan en la versión vieja (no vigente) y no se buscan.
  if v_action = 'versioned' then
    insert into fragment_services (fragment_id, service_id, attribute_value_id, tipo_fundamento)
    select v_new_id, old.service_id, old.attribute_value_id, old.tipo_fundamento
      from fragment_services old
     where old.fragment_id = v_current_id
       and old.attribute_value_id is not null
       and exists (select 1 from fragment_services cat
                    where cat.fragment_id = v_new_id and cat.service_id = old.service_id and cat.attribute_value_id is null)
    on conflict do nothing;
  end if;

  return query select v_new_id, v_action;
end;
$fn$;
revoke execute on function public.upsert_knowledge_fragment(uuid, text, text, text, text, varchar, text[]) from public, anon, authenticated;
grant  execute on function public.upsert_knowledge_fragment(uuid, text, text, text, text, varchar, text[]) to service_role;

-- Huella de la búsqueda ANTES de cargar: los pares distintos (fragmento, categoría)
create temporary table p4_pares_antes on commit drop as
  select distinct fragment_id, service_id from public.fragment_services;

-- ---------------------------------------------------------------------------------------------------------------
-- 3. MIG-02: prestación ↔ grupo de destino (107). Resuelve las 3 equivalencias de nombre (§3 del informe):
--    el nombre del dataset apunta a la clave que ya tiene la base. Las 70 nuevas las crea antes el loader de REP-2800.
--    Generado: 34 por nombre · 3 por equivalencia · 70 nuevas.
-- ---------------------------------------------------------------------------------------------------------------
create temporary table p4_prestacion_grupo (servicio text, grupo text, value_key text, nombre_oficial text, como text) on commit drop;
insert into p4_prestacion_grupo values
  ('AMBIENTE', 'CONTAMINACION', 'olores_humos_gases', 'Malos Olores / Humos / Gases Tóxicos', 'nombre'),
  ('AMBIENTE', 'CONTAMINACION', 'uso_indebido_del_agua_para_limpiar_las_veredas', 'Uso indebido del agua para limpiar las veredas', 'nueva'),
  ('AMBIENTE', 'CONTAMINACION', 'derrame_peligroso', 'Derrame de líquidos peligrosos / industriales', 'nombre'),
  ('AMBIENTE', 'CONTAMINACION', 'trascendencia_de_calor_desde_instalaciones_fijas_comerciales', 'Trascendencia de calor desde instalaciones fijas comerciales / industriales hacia inmuebles linderos', 'nueva'),
  ('AMBIENTE', 'CONTAMINACION', 'residuos_peligrosos_manipulacion', 'Irregularidades en la manipulación de residuos peligrosos', 'nombre'),
  ('AMBIENTE', 'CONTAMINACION', 'irregularidades_en_el_mantenimiento_de_tanques_de_agua', 'Irregularidades en el mantenimiento de tanques de agua', 'nueva'),
  ('AMBIENTE', 'CONTAMINACION', 'emanaciones_humo_negro_producidos_por_colectivos', 'Emanaciones / humo negro producidos por colectivos', 'nueva'),
  ('AMBIENTE', 'CONTAMINACION', 'radiaciones_no_ionizantes_y_antenas_de_telefonia_celular', 'Radiaciones no ionizantes y antenas de telefonía celular', 'nueva'),
  ('AMBIENTE', 'CONTAMINACION', 'irregularidades_vinculadas_al_uso_del_combustible', 'Irregularidades vinculadas al uso del combustible', 'nueva'),
  ('AMBIENTE', 'CONTAMINACION', 'irregularidades_en_la_calidad_de_agua_de_natatorios', 'Irregularidades en la calidad de agua de natatorios', 'nueva'),
  ('AMBIENTE', 'CONTAMINACION', 'irregularidades_en_establecimientos_de_tintorerias_lavaderos', 'Irregularidades en establecimientos de tintorerías / lavaderos industriales', 'nueva'),
  ('AMBIENTE', 'CONTAMINACION', 'irregularidades_vinculadas_al_regimen_de_aceites_vegetales_u', 'Irregularidades vinculadas al régimen de aceites vegetales usados', 'nueva'),
  ('AMBIENTE', 'CONTAMINACION', 'uso_indebido_del_plastico_bolsas_y_sorbetes_plasticos_de_un', 'Uso indebido del plástico (bolsas y sorbetes plásticos de un solo uso)', 'nueva'),
  ('AMBIENTE', 'CONTAMINACION', 'uso_de_aparatos_que_puedan_contener_pcb', 'Uso de aparatos que puedan contener PCB', 'nueva'),
  ('AMBIENTE', 'HIGIENE_RESIDUOS', 'contenedor_reparacion', 'Reparación de contenedor', 'nombre'),
  ('AMBIENTE', 'HIGIENE_RESIDUOS', 'reubicacion_de_contenedor', 'Reubicación de contenedor', 'nueva'),
  ('AMBIENTE', 'HIGIENE_RESIDUOS', 'residuos_fuera_contenedor', 'Recolección de residuos fuera del contenedor', 'nombre'),
  ('AMBIENTE', 'HIGIENE_RESIDUOS', 'barrido_mejora', 'Mejora de barrido', 'nombre'),
  ('AMBIENTE', 'HIGIENE_RESIDUOS', 'reparacion_de_cesto_papelero', 'Reparación de cesto papelero', 'nueva'),
  ('AMBIENTE', 'HIGIENE_RESIDUOS', 'desratizar_desinsectar_y_desinfectar_en_via_publica', 'Desratizar, desinsectar y desinfectar en vía pública', 'nueva'),
  ('AMBIENTE', 'HIGIENE_RESIDUOS', 'contenedor_vaciado', 'Vaciado de contenedor', 'nombre'),
  ('AMBIENTE', 'HIGIENE_RESIDUOS', 'contenedor_lavado', 'Lavado de contenedor', 'nombre'),
  ('AMBIENTE', 'HIGIENE_RESIDUOS', 'reposicion_de_contenedor', 'Reposición de contenedor', 'nueva'),
  ('AMBIENTE', 'HIGIENE_RESIDUOS', 'reposicion_de_cesto_papelero', 'Reposición de cesto papelero', 'nueva'),
  ('AMBIENTE', 'HIGIENE_RESIDUOS', 'lavado_de_cesto_papelero', 'Lavado de cesto papelero', 'nueva'),
  ('AMBIENTE', 'HIGIENE_RESIDUOS', 'limpieza_higienizacion_de_espacios_publicos_por_asentamiento', 'Limpieza/Higienización de Espacios Públicos por Asentamientos Precarios', 'nueva'),
  ('AMBIENTE', 'HIGIENE_RESIDUOS', 'vaciado_de_cesto_papelero', 'Vaciado de cesto papelero', 'nueva'),
  ('AMBIENTE', 'HIGIENE_RESIDUOS', 'reubicacion_de_cesto_papelero', 'Reubicación de cesto papelero', 'nueva'),
  ('AMBIENTE', 'HIGIENE_RESIDUOS', 'irregularidades_en_la_disposicion_de_residuos_de_establecimi', 'Irregularidades en la disposición de residuos de establecimientos', 'nueva'),
  ('AMBIENTE', 'HIGIENE_RESIDUOS', 'retiro_de_afiches_y_o_pasacalles', 'Retiro de Afiches y/o pasacalles', 'nueva'),
  ('AMBIENTE', 'HIGIENE_RESIDUOS', 'retiro_de_animales_muertos_en_via_publica', 'Retiro de animales muertos en vía pública', 'nueva'),
  ('AMBIENTE', 'HIGIENE_RESIDUOS', 'vereda_sucia_por_mascotas', 'Vereda sucia por mascotas', 'nueva'),
  ('AMBIENTE', 'HIGIENE_RESIDUOS', 'limpieza_de_calzada_en_tuneles_y_viaductos', 'Limpieza de calzada en túneles y víaductos', 'nueva'),
  ('AMBIENTE', 'HIGIENE_RESIDUOS', 'acopio_de_recuperadores_urbanos_en_espacio_publico', 'Acopio de recuperadores urbanos en espacio público', 'nueva'),
  ('AMBIENTE', 'HIGIENE_RESIDUOS', 'remocion_de_volquete_abandonado_o_mal_dispuesto', 'Remoción de volquete abandonado o mal dispuesto', 'nueva'),
  ('AMBIENTE', 'HIGIENE_RESIDUOS', 'terreno_baldio_higienizacion', 'Higienización, desratización, saneamiento de terreno baldío o casa abandonada', 'equivalencia'),
  ('AMBIENTE', 'HIGIENE_RESIDUOS', 'falta_de_recoleccion_de_residuos_secos_en_generador_especial', 'Falta de recolección de residuos secos en generador especial', 'nueva'),
  ('AMBIENTE', 'HIGIENE_RESIDUOS', 'punto_verde_cerrado_en_horario_de_atencion', 'Punto Verde cerrado en horario de atención', 'nueva'),
  ('AMBIENTE', 'HIGIENE_RESIDUOS', 'irregularidades_en_la_separacion_de_residuos_en_origen', 'Irregularidades en la separación de residuos en origen', 'nueva'),
  ('AMBIENTE', 'HIGIENE_RESIDUOS', 'camion_de_recoleccion_que_incumple_normas_de_transito', 'Camión de recolección que incumple normas de tránsito', 'nueva'),
  ('AMBIENTE', 'HIGIENE_RESIDUOS', 'residuos_acumulados_o_diseminados_fuera_de_punto_verde', 'Residuos acumulados o diseminados fuera de Punto Verde', 'nueva'),
  ('AMBIENTE', 'HIGIENE_RESIDUOS', 'higienizacion_desratizacion_saneamiento_de_casa_abandonada', 'Higienización, desratización, saneamiento de casa abandonada', 'nueva'),
  ('AMBIENTE', 'HIGIENE_RESIDUOS', 'personal_de_empresa_de_recoleccion_con_conductas_indebidas', 'Personal de empresa de recolección con conductas indebidas', 'nueva'),
  ('AMBIENTE', 'HIGIENE_RESIDUOS', 'camion_de_recoleccion_que_despide_malos_olores_liquidos', 'Camión de recolección que despide malos olores / líquidos', 'nueva'),
  ('AMBIENTE', 'HIGIENE_RESIDUOS', 'personal_de_empresa_de_recoleccion_realiza_pedido_de_dadivas', 'Personal de empresa de recolección realiza pedido de dádivas', 'nueva'),
  ('AMBIENTE', 'HIGIENE_RESIDUOS', 'camion_recuperador_que_interrumpe_el_transito', 'Camión recuperador que interrumpe el tránsito', 'nueva'),
  ('COMERCIO_IRREGULAR', 'ESPACIO_PUBLICO_COMERCIO', 'ocupacion_area_gastronomica', 'Ocupación indebida de la vereda/calzada por área gastronómica', 'nombre'),
  ('COMERCIO_IRREGULAR', 'ESPACIO_PUBLICO_COMERCIO', 'ocupacion_local_comercial', 'Ocupación indebida de la vereda/calzada por local comercial', 'nombre'),
  ('COMERCIO_IRREGULAR', 'ESPACIO_PUBLICO_COMERCIO', 'mantero_vendedor_ambulante', 'Ocupación indebida por mantero o vendedor ambulante', 'nombre'),
  ('COMERCIO_IRREGULAR', 'ESPACIO_PUBLICO_COMERCIO', 'irregularidades_ferias', 'Irregularidades en ferias', 'nombre'),
  ('COMERCIO_IRREGULAR', 'LOCAL_SIN_HABILITACION', 'local_sin_habilitacion', 'Establecimiento sin autorización para funcionar sin venta o elaboración de alimentos', 'equivalencia'),
  ('INFRAESTRUCTURA', 'ALUMBRADO', 'luminaria_apagada_noche', 'Reparación de luminaria apagada durante la noche', 'nombre'),
  ('INFRAESTRUCTURA', 'ALUMBRADO', 'mayor_iluminacion', 'Mayor iluminación en calle / plaza', 'nombre'),
  ('INFRAESTRUCTURA', 'ALUMBRADO', 'luminaria_artefacto_roto', 'Reparación de luminaria por artefacto roto', 'nombre'),
  ('INFRAESTRUCTURA', 'ALUMBRADO', 'reparacion_de_tapa_faltante_deteriorada_en_columna_de_alumbr', 'Reparación de tapa faltante / deteriorada en columna de alumbrado', 'nueva'),
  ('INFRAESTRUCTURA', 'ALUMBRADO', 'luminaria_intermitente', 'Luminaria intermitente', 'nombre'),
  ('INFRAESTRUCTURA', 'ALUMBRADO', 'reparacion_de_luminaria_encendida_durante_el_dia', 'Reparación de luminaria encendida durante el día', 'nueva'),
  ('INFRAESTRUCTURA', 'ALUMBRADO', 'reparacion_de_toma_de_energia_de_alumbrado_publico', 'Reparación de toma de energía de alumbrado público', 'nueva'),
  ('INFRAESTRUCTURA', 'ALUMBRADO', 'limpieza_de_artefacto_de_alumbrado', 'Limpieza de artefacto de alumbrado', 'nueva'),
  ('INFRAESTRUCTURA', 'CALLES', 'columna_poste_cable_en_mal_estado_abandonado_o_cortado', 'Columna/poste/cable en mal estado, abandonado o cortado', 'nueva'),
  ('INFRAESTRUCTURA', 'CALLES', 'bache_calle', 'Reparación de bache en calle', 'nombre'),
  ('INFRAESTRUCTURA', 'CALLES', 'bache_apertura_hundida', 'Reparación de bache - Apertura hundida', 'nombre'),
  ('INFRAESTRUCTURA', 'CALLES', 'reparacion_de_cuneta', 'Reparación de cuneta', 'nueva'),
  ('INFRAESTRUCTURA', 'CALLES', 'reparacion_construccion_de_cordon', 'Reparación / construcción de cordón', 'nueva'),
  ('INFRAESTRUCTURA', 'CALLES', 'repintado_reparacion_de_marca_vial_en_calle_o_cordon', 'Repintado / reparación de marca vial en calle o cordón', 'nueva'),
  ('INFRAESTRUCTURA', 'CALLES', 'nivelacion_de_tapa_de_empresa_de_servicio_publico_en_calle', 'Nivelación de tapa de empresa de servicio público en calle', 'nueva'),
  ('INFRAESTRUCTURA', 'CALLES', 'reparacion_de_bache_socavamiento', 'Reparación de bache - Socavamiento', 'nueva'),
  ('INFRAESTRUCTURA', 'CALLES', 'calle_rota_empresa', 'Reparación de calle rota por empresa de servicio', 'nombre'),
  ('INFRAESTRUCTURA', 'CALLES', 'ajuste_de_chapa_metalica_por_ruidos_molestos_en_calle', 'Ajuste de chapa metálica por ruidos molestos en calle', 'nueva'),
  ('INFRAESTRUCTURA', 'CALLES', 'nivelacion_pavimento', 'Nivelación por hundimiento del pavimento', 'nombre'),
  ('INFRAESTRUCTURA', 'CALLES', 'repavimentacion_de_calle', 'Repavimentación de calle', 'nueva'),
  ('INFRAESTRUCTURA', 'CALLES', 'reparacion_de_bache_granito_hundido', 'Reparación de bache - Granito hundido', 'nueva'),
  ('INFRAESTRUCTURA', 'CALLES', 'reparacion_de_calle_de_adoquines_o_granito', 'Reparación de calle de adoquines o granito', 'nueva'),
  ('INFRAESTRUCTURA', 'CALLES', 'reparacion_de_bache_en_ciclovia', 'Reparación de bache en ciclovía', 'nueva'),
  ('INFRAESTRUCTURA', 'CALLES', 'reparacion_de_tapa_de_empresa_de_servicios_publicos_contorno', 'Reparación de tapa de empresa de servicios públicos - Contorno', 'nueva'),
  ('INFRAESTRUCTURA', 'CALLES', 'problemas_con_obras_de_bacheo', 'Problemas con obras de bacheo', 'nueva'),
  ('INFRAESTRUCTURA', 'CALLES', 'asfaltado_de_calle_con_adoquines', 'Asfaltado de calle con adoquines', 'nueva'),
  ('INFRAESTRUCTURA', 'CALLES', 'reposicion_de_tapa_de_empresa_de_servicio_publico_en_calle', 'Reposición de tapa de empresa de servicio público en calle', 'nueva'),
  ('INFRAESTRUCTURA', 'CALLES', 'reparacion_de_lomo_de_burro', 'Reparación de lomo de burro', 'nueva'),
  ('INFRAESTRUCTURA', 'CALLES', 'reparacion_de_darsena_para_ascenso_descenso_de_colectivos', 'Reparación de dársena para ascenso/descenso de colectivos', 'nueva'),
  ('INFRAESTRUCTURA', 'CALLES', 'reparacion_de_elementos_en_tuneles_puentes', 'Reparación de elementos en túneles / puentes', 'nueva'),
  ('INFRAESTRUCTURA', 'CALLES', 'instalacion_de_elementos_viales_en_calle', 'Instalación de elementos viales en calle', 'nueva'),
  ('INFRAESTRUCTURA', 'PLUVIALES', 'sumidero_destape', 'Destape de sumidero/alcantarilla o boca de registro pluvial', 'nombre'),
  ('INFRAESTRUCTURA', 'PLUVIALES', 'reparacion_de_sumidero_alcantarilla_o_boca_de_registro_pluvi', 'Reparación de sumidero/alcantarilla o boca de registro pluvial faltante', 'nueva'),
  ('INFRAESTRUCTURA', 'PLUVIALES', 'sumidero_roto', 'Reparación de sumidero/alcantarilla o boca de registro pluvial rota', 'nombre'),
  ('INFRAESTRUCTURA', 'PLUVIALES', 'destape_de_sumideros', 'Destape de sumideros', 'nueva'),
  ('INFRAESTRUCTURA', 'PLUVIALES', 'calle_anegada', 'Intervención por calle anegada/inundada', 'nombre'),
  ('INFRAESTRUCTURA', 'PLUVIALES', 'construccion_de_sumidero_alcantarilla_o_boca_de_registro_plu', 'Construcción de sumidero/alcantarilla o boca de registro pluvial', 'nueva'),
  ('INFRAESTRUCTURA', 'SEMAFOROS_SENALES', 'semaforo_reparacion', 'Reparación de semáforo', 'nombre'),
  ('INFRAESTRUCTURA', 'SEMAFOROS_SENALES', 'senal_transito_reparacion', 'Reparación de señal de tránsito', 'nombre'),
  ('INFRAESTRUCTURA', 'VEREDAS', 'vereda_reparacion', 'Reparación de vereda', 'nombre'),
  ('INFRAESTRUCTURA', 'VEREDAS', 'vereda_raices', 'Reparación de vereda por raíces de árbol que producen roturas', 'nombre'),
  ('INFRAESTRUCTURA', 'VEREDAS', 'nivelacion_de_tapa_de_empresa_de_servicio_publico_en_vereda', 'Nivelación de tapa de empresa de servicio público en vereda', 'nueva'),
  ('INFRAESTRUCTURA', 'VEREDAS', 'vereda_empresa', 'Reparación de vereda rota por empresa de servicio', 'nombre'),
  ('INFRAESTRUCTURA', 'VEREDAS', 'rampa_accesibilidad', 'Reparación de rampa de accesibilidad', 'nombre'),
  ('INFRAESTRUCTURA', 'VEREDAS', 'obstruccion_de_calle_o_vereda_por_elementos_fijos_o_moviles', 'Obstrucción de calle o vereda por elementos fijos o móviles', 'nueva'),
  ('INFRAESTRUCTURA', 'VEREDAS', 'restos_de_obra_en_vereda_que_impiden_el_paso', 'Restos de obra en vereda que impiden el paso', 'nueva'),
  ('INFRAESTRUCTURA', 'VEREDAS', 'reposicion_de_tapa_de_empresa_de_servicio_publico_en_vereda', 'Reposición de tapa de empresa de servicio público en vereda', 'nueva'),
  ('INFRAESTRUCTURA', 'VEREDAS', 'reparacion_de_vereda_por_obra_mal_terminada', 'Reparación de vereda por obra mal terminada', 'nueva'),
  ('INFRAESTRUCTURA', 'VEREDAS', 'construccion_de_rampa_de_accesibilidad', 'Construcción de rampa de accesibilidad', 'nueva'),
  ('INFRAESTRUCTURA', 'VEREDAS', 'vereda_rota_por_alumbrado_publico', 'Vereda rota por alumbrado público', 'nueva'),
  ('TRANSITO', 'TRANSITO_ESTACIONAMIENTO', 'vehiculo_mal_estacionado', 'Vehículo mal estacionado', 'nombre'),
  ('TRANSITO', 'TRANSITO_ESTACIONAMIENTO', 'vehiculo_abandonado', 'Remoción de vehículo abandonado', 'nombre'),
  ('TRANSITO', 'TRANSITO_ESTACIONAMIENTO', 'reserva_discapacidad', 'Irregularidades con reservas de espacios para estacionamiento de vehículos de personas con discapacidad', 'nombre'),
  ('TRANSITO', 'TRANSITO_ESTACIONAMIENTO', 'vehiculo_obstruyendo_garaje', 'Vehículo obstruyendo garaje', 'nombre'),
  ('VULNERABILIDAD_SOCIAL', 'NINEZ', 'situacion_de_calle_ninez', 'Niñas, niños o adolescentes en situación de calle o riesgo', 'equivalencia'),
  ('VULNERABILIDAD_SOCIAL', 'SITUACION_DE_CALLE', 'situacion_de_calle', 'Persona o familia en situación de calle', 'nombre');

-- ---------------------------------------------------------------------------------------------------------------
-- 4. Vínculos norma ↔ prestación: 57 (fragmento, categoría, grupo), todos sobre pares que YA existen.
--    Excepciones (no van a la base): sin_articulo 5 · articulo_no_cargado 3 · fuera_del_corpus 2 · par_nuevo_P5 2. Ver docs/rag/REP-3863_auditoria_y_diseno_P4.md.
-- ---------------------------------------------------------------------------------------------------------------
create temporary table p4_vinculo (fragment_id uuid, categoria text, grupo text, tipo_fundamento text, norma text) on commit drop;
insert into p4_vinculo values
  ('80000000-0000-4000-8000-000000000007', 'INFRAESTRUCTURA', 'ALUMBRADO', 'competencia', 'Ley 6684 art. 26 inc. 8'),
  ('80000000-0000-4000-8000-000000000005', 'INFRAESTRUCTURA', 'CALLES', 'competencia', 'Ley 1777 art. 10 inc. a)'),
  ('80000000-0000-4000-8000-000000000007', 'INFRAESTRUCTURA', 'CALLES', 'competencia', 'Ley 6684 art. 26 inc. 1'),
  ('80000000-0000-4000-8000-000000000005', 'INFRAESTRUCTURA', 'VEREDAS', 'competencia', 'Ley 1777 art. 10 inc. a)'),
  ('40000000-0000-4000-8000-000000000001', 'INFRAESTRUCTURA', 'VEREDAS', 'obligacion', 'Ley 5902 art. 5'),
  ('40000000-0000-4000-8000-000000000003', 'INFRAESTRUCTURA', 'VEREDAS', 'obligacion', 'Ley 5902 art. 7'),
  ('40000000-0000-4000-8000-000000000004', 'INFRAESTRUCTURA', 'VEREDAS', 'competencia', 'Ley 5902 art. 8'),
  ('80000000-0000-4000-8000-000000000007', 'INFRAESTRUCTURA', 'PLUVIALES', 'competencia', 'Ley 6684 art. 26 inc. 15'),
  ('60000000-0000-4000-8000-000000000033', 'TRANSITO', 'TRANSITO_ESTACIONAMIENTO', 'conducta', 'Ley 2148 art. 7.1.8'),
  ('60000000-0000-4000-8000-000000000034', 'TRANSITO', 'TRANSITO_ESTACIONAMIENTO', 'conducta', 'Ley 2148 art. 7.1.8'),
  ('60000000-0000-4000-8000-000000000035', 'TRANSITO', 'TRANSITO_ESTACIONAMIENTO', 'conducta', 'Ley 2148 art. 7.1.8'),
  ('60000000-0000-4000-8000-000000000036', 'TRANSITO', 'TRANSITO_ESTACIONAMIENTO', 'conducta', 'Ley 2148 art. 7.1.9'),
  ('60000000-0000-4000-8000-000000000037', 'TRANSITO', 'TRANSITO_ESTACIONAMIENTO', 'conducta', 'Ley 2148 art. 7.1.9'),
  ('60000000-0000-4000-8000-000000000038', 'TRANSITO', 'TRANSITO_ESTACIONAMIENTO', 'conducta', 'Ley 2148 art. 7.1.9'),
  ('20000000-0000-4000-8000-000000000013', 'TRANSITO', 'TRANSITO_ESTACIONAMIENTO', 'conducta', 'Ley 451 art. 6.1.52'),
  ('20000000-0000-4000-8000-000000000014', 'TRANSITO', 'TRANSITO_ESTACIONAMIENTO', 'conducta', 'Ley 451 art. 6.1.37'),
  ('40000000-0000-4000-8000-000000000048', 'TRANSITO', 'TRANSITO_ESTACIONAMIENTO', 'conducta', 'Ley 451 art. 6.1.54'),
  ('60000000-0000-4000-8000-000000000025', 'TRANSITO', 'TRANSITO_ESTACIONAMIENTO', 'conducta', 'Ley 451 art. 1.3.31'),
  ('40000000-0000-4000-8000-000000000009', 'AMBIENTE', 'HIGIENE_RESIDUOS', 'conducta', 'Ley 1854 art. 36'),
  ('40000000-0000-4000-8000-000000000041', 'AMBIENTE', 'HIGIENE_RESIDUOS', 'conducta', 'Ley 451 art. 1.3.13'),
  ('80000000-0000-4000-8000-000000000007', 'COMERCIO_IRREGULAR', 'ESPACIO_PUBLICO_COMERCIO', 'competencia', 'Ley 6684 art. 26 inc. 14'),
  ('60000000-0000-4000-8000-000000000021', 'COMERCIO_IRREGULAR', 'ESPACIO_PUBLICO_COMERCIO', 'conducta', 'Ley 1166 Secc. 11.1.2'),
  ('40000000-0000-4000-8000-000000000047', 'COMERCIO_IRREGULAR', 'ESPACIO_PUBLICO_COMERCIO', 'conducta', 'Ley 451 art. 4.1.2'),
  ('40000000-0000-4000-8000-000000000012', 'COMERCIO_IRREGULAR', 'LOCAL_SIN_HABILITACION', 'competencia', 'Ley 6101 art. 6'),
  ('40000000-0000-4000-8000-000000000013', 'COMERCIO_IRREGULAR', 'LOCAL_SIN_HABILITACION', 'obligacion', 'Ley 6101 art. 8'),
  ('40000000-0000-4000-8000-000000000046', 'COMERCIO_IRREGULAR', 'LOCAL_SIN_HABILITACION', 'conducta', 'Ley 451 art. 4.1.1'),
  ('40000000-0000-4000-8000-000000000017', 'VULNERABILIDAD_SOCIAL', 'SITUACION_DE_CALLE', 'obligacion', 'Ley 3706 arts. 6 y 7'),
  ('40000000-0000-4000-8000-000000000018', 'VULNERABILIDAD_SOCIAL', 'SITUACION_DE_CALLE', 'obligacion', 'Ley 3706 arts. 6 y 7'),
  ('40000000-0000-4000-8000-000000000017', 'VULNERABILIDAD_SOCIAL', 'NINEZ', 'obligacion', 'Ley 3706 arts. 6 y 7'),
  ('40000000-0000-4000-8000-000000000018', 'VULNERABILIDAD_SOCIAL', 'NINEZ', 'obligacion', 'Ley 3706 arts. 6 y 7'),
  ('20000000-0000-4000-8000-000000000002', 'INFRAESTRUCTURA', 'ALUMBRADO', 'competencia', 'LOM (DL 6769/58) art. 52'),
  ('80000000-0000-4000-8000-000000000001', 'INFRAESTRUCTURA', 'ALUMBRADO', 'competencia', 'Ordenanza Fiscal 31321 art. 132'),
  ('40000000-0000-4000-8000-000000000050', 'INFRAESTRUCTURA', 'SEMAFOROS_SENALES', 'competencia', 'LOM (DL 6769/58) art. 27 inc. 2'),
  ('20000000-0000-4000-8000-000000000001', 'INFRAESTRUCTURA', 'CALLES', 'competencia', 'Constitución PBA art. 192 inc. 4'),
  ('40000000-0000-4000-8000-000000000050', 'INFRAESTRUCTURA', 'CALLES', 'competencia', 'LOM (DL 6769/58) art. 27 inc. 2'),
  ('20000000-0000-4000-8000-000000000003', 'INFRAESTRUCTURA', 'CALLES', 'competencia', 'LOM (DL 6769/58) art. 59'),
  ('20000000-0000-4000-8000-000000000003', 'INFRAESTRUCTURA', 'VEREDAS', 'competencia', 'LOM (DL 6769/58) art. 59'),
  ('20000000-0000-4000-8000-000000000002', 'INFRAESTRUCTURA', 'PLUVIALES', 'competencia', 'LOM (DL 6769/58) art. 52'),
  ('20000000-0000-4000-8000-000000000003', 'INFRAESTRUCTURA', 'PLUVIALES', 'competencia', 'LOM (DL 6769/58) art. 59'),
  ('40000000-0000-4000-8000-000000000055', 'TRANSITO', 'TRANSITO_ESTACIONAMIENTO', 'competencia', 'Ley 13.927 art. 2'),
  ('20000000-0000-4000-8000-000000000007', 'TRANSITO', 'TRANSITO_ESTACIONAMIENTO', 'conducta', 'Ley 24.449 art. 48'),
  ('20000000-0000-4000-8000-000000000016', 'TRANSITO', 'TRANSITO_ESTACIONAMIENTO', 'conducta', 'Ley 24.449 art. 48'),
  ('b6717f77-c30e-4cca-985a-6346d741fe38', 'TRANSITO', 'TRANSITO_ESTACIONAMIENTO', 'conducta', 'Ley 24.449 art. 48'),
  ('20000000-0000-4000-8000-000000000009', 'TRANSITO', 'TRANSITO_ESTACIONAMIENTO', 'conducta', 'Ley 24.449 art. 49'),
  ('60000000-0000-4000-8000-000000000029', 'TRANSITO', 'TRANSITO_ESTACIONAMIENTO', 'conducta', 'Ley 24.449 art. 49'),
  ('60000000-0000-4000-8000-000000000040', 'TRANSITO', 'TRANSITO_ESTACIONAMIENTO', 'conducta', 'Ley 24.449 art. 49'),
  ('40000000-0000-4000-8000-000000000024', 'AMBIENTE', 'HIGIENE_RESIDUOS', 'obligacion', 'Ley 13.592 art. 9'),
  ('60000000-0000-4000-8000-000000000002', 'AMBIENTE', 'HIGIENE_RESIDUOS', 'conducta', 'DL 8751/77 art. 4 bis'),
  ('60000000-0000-4000-8000-000000000002', 'AMBIENTE', 'CONTAMINACION', 'conducta', 'DL 8751/77 art. 4 bis'),
  ('80000000-0000-4000-8000-000000000003', 'COMERCIO_IRREGULAR', 'ESPACIO_PUBLICO_COMERCIO', 'obligacion', 'Ordenanza Fiscal 31321 art. 233'),
  ('80000000-0000-4000-8000-000000000002', 'COMERCIO_IRREGULAR', 'ESPACIO_PUBLICO_COMERCIO', 'obligacion', 'Ordenanza Fiscal 31321 art. 231'),
  ('80000000-0000-4000-8000-000000000004', 'COMERCIO_IRREGULAR', 'ESPACIO_PUBLICO_COMERCIO', 'sancion', 'Ordenanza Fiscal 31321 art. 235'),
  ('40000000-0000-4000-8000-000000000049', 'COMERCIO_IRREGULAR', 'ESPACIO_PUBLICO_COMERCIO', 'competencia', 'LOM (DL 6769/58) art. 27 incs. 1 y 6'),
  ('40000000-0000-4000-8000-000000000051', 'COMERCIO_IRREGULAR', 'ESPACIO_PUBLICO_COMERCIO', 'competencia', 'LOM (DL 6769/58) art. 27 incs. 1 y 6'),
  ('40000000-0000-4000-8000-000000000049', 'COMERCIO_IRREGULAR', 'LOCAL_SIN_HABILITACION', 'competencia', 'LOM (DL 6769/58) art. 27 incs. 1 y 6'),
  ('40000000-0000-4000-8000-000000000051', 'COMERCIO_IRREGULAR', 'LOCAL_SIN_HABILITACION', 'competencia', 'LOM (DL 6769/58) art. 27 incs. 1 y 6'),
  ('60000000-0000-4000-8000-000000000002', 'COMERCIO_IRREGULAR', 'LOCAL_SIN_HABILITACION', 'conducta', 'DL 8751/77 art. 4 bis');

-- ---------------------------------------------------------------------------------------------------------------
-- 5. Vocabulario: 176 términos
-- ---------------------------------------------------------------------------------------------------------------
create temporary table p4_termino (termino text, servicio text, value_key text, origen text) on commit drop;
insert into p4_termino values
  ('Malos Olores / Humos / Gases Tóxicos', 'AMBIENTE', 'olores_humos_gases', 'suaci'),
  ('Uso indebido del agua para limpiar las veredas', 'AMBIENTE', 'uso_indebido_del_agua_para_limpiar_las_veredas', 'suaci'),
  ('Derrame de líquidos peligrosos / industriales', 'AMBIENTE', 'derrame_peligroso', 'suaci'),
  ('Trascendencia de calor desde instalaciones fijas comerciales / industriales hacia inmuebles linderos', 'AMBIENTE', 'trascendencia_de_calor_desde_instalaciones_fijas_comerciales', 'suaci'),
  ('Irregularidades en la manipulación de residuos peligrosos', 'AMBIENTE', 'residuos_peligrosos_manipulacion', 'suaci'),
  ('Irregularidades en el mantenimiento de tanques de agua', 'AMBIENTE', 'irregularidades_en_el_mantenimiento_de_tanques_de_agua', 'suaci'),
  ('Emanaciones / humo negro producidos por colectivos', 'AMBIENTE', 'emanaciones_humo_negro_producidos_por_colectivos', 'suaci'),
  ('Radiaciones no ionizantes y antenas de telefonía celular', 'AMBIENTE', 'radiaciones_no_ionizantes_y_antenas_de_telefonia_celular', 'suaci'),
  ('Irregularidades vinculadas al uso del combustible', 'AMBIENTE', 'irregularidades_vinculadas_al_uso_del_combustible', 'suaci'),
  ('Irregularidades en la calidad de agua de natatorios', 'AMBIENTE', 'irregularidades_en_la_calidad_de_agua_de_natatorios', 'suaci'),
  ('Irregularidades en establecimientos de tintorerías / lavaderos industriales', 'AMBIENTE', 'irregularidades_en_establecimientos_de_tintorerias_lavaderos', 'suaci'),
  ('Irregularidades vinculadas al régimen de aceites vegetales usados', 'AMBIENTE', 'irregularidades_vinculadas_al_regimen_de_aceites_vegetales_u', 'suaci'),
  ('Uso indebido del plástico (bolsas y sorbetes plásticos de un solo uso)', 'AMBIENTE', 'uso_indebido_del_plastico_bolsas_y_sorbetes_plasticos_de_un', 'suaci'),
  ('Uso de aparatos que puedan contener PCB', 'AMBIENTE', 'uso_de_aparatos_que_puedan_contener_pcb', 'suaci'),
  ('Reparación de contenedor', 'AMBIENTE', 'contenedor_reparacion', 'suaci'),
  ('Reubicación de contenedor', 'AMBIENTE', 'reubicacion_de_contenedor', 'suaci'),
  ('Recolección de residuos fuera del contenedor', 'AMBIENTE', 'residuos_fuera_contenedor', 'suaci'),
  ('Mejora de barrido', 'AMBIENTE', 'barrido_mejora', 'suaci'),
  ('Reparación de cesto papelero', 'AMBIENTE', 'reparacion_de_cesto_papelero', 'suaci'),
  ('Desratizar, desinsectar y desinfectar en vía pública', 'AMBIENTE', 'desratizar_desinsectar_y_desinfectar_en_via_publica', 'suaci'),
  ('Vaciado de contenedor', 'AMBIENTE', 'contenedor_vaciado', 'suaci'),
  ('Lavado de contenedor', 'AMBIENTE', 'contenedor_lavado', 'suaci'),
  ('Reposición de contenedor', 'AMBIENTE', 'reposicion_de_contenedor', 'suaci'),
  ('Reposición de cesto papelero', 'AMBIENTE', 'reposicion_de_cesto_papelero', 'suaci'),
  ('Lavado de cesto papelero', 'AMBIENTE', 'lavado_de_cesto_papelero', 'suaci'),
  ('Limpieza/Higienización de Espacios Públicos por Asentamientos Precarios', 'AMBIENTE', 'limpieza_higienizacion_de_espacios_publicos_por_asentamiento', 'suaci'),
  ('Vaciado de cesto papelero', 'AMBIENTE', 'vaciado_de_cesto_papelero', 'suaci'),
  ('Reubicación de cesto papelero', 'AMBIENTE', 'reubicacion_de_cesto_papelero', 'suaci'),
  ('Irregularidades en la disposición de residuos de establecimientos', 'AMBIENTE', 'irregularidades_en_la_disposicion_de_residuos_de_establecimi', 'suaci'),
  ('Retiro de Afiches y/o pasacalles', 'AMBIENTE', 'retiro_de_afiches_y_o_pasacalles', 'suaci'),
  ('Retiro de animales muertos en vía pública', 'AMBIENTE', 'retiro_de_animales_muertos_en_via_publica', 'suaci'),
  ('Vereda sucia por mascotas', 'AMBIENTE', 'vereda_sucia_por_mascotas', 'suaci'),
  ('Limpieza de calzada en túneles y víaductos', 'AMBIENTE', 'limpieza_de_calzada_en_tuneles_y_viaductos', 'suaci'),
  ('Acopio de recuperadores urbanos en espacio público', 'AMBIENTE', 'acopio_de_recuperadores_urbanos_en_espacio_publico', 'suaci'),
  ('Remoción de volquete abandonado o mal dispuesto', 'AMBIENTE', 'remocion_de_volquete_abandonado_o_mal_dispuesto', 'suaci'),
  ('Higienización, desratización, saneamiento de terreno baldío o casa abandonada', 'AMBIENTE', 'terreno_baldio_higienizacion', 'suaci'),
  ('Falta de recolección de residuos secos en generador especial', 'AMBIENTE', 'falta_de_recoleccion_de_residuos_secos_en_generador_especial', 'suaci'),
  ('Punto Verde cerrado en horario de atención', 'AMBIENTE', 'punto_verde_cerrado_en_horario_de_atencion', 'suaci'),
  ('Irregularidades en la separación de residuos en origen', 'AMBIENTE', 'irregularidades_en_la_separacion_de_residuos_en_origen', 'suaci'),
  ('Camión de recolección que incumple normas de tránsito', 'AMBIENTE', 'camion_de_recoleccion_que_incumple_normas_de_transito', 'suaci'),
  ('Residuos acumulados o diseminados fuera de Punto Verde', 'AMBIENTE', 'residuos_acumulados_o_diseminados_fuera_de_punto_verde', 'suaci'),
  ('Higienización, desratización, saneamiento de casa abandonada', 'AMBIENTE', 'higienizacion_desratizacion_saneamiento_de_casa_abandonada', 'suaci'),
  ('Personal de empresa de recolección con conductas indebidas', 'AMBIENTE', 'personal_de_empresa_de_recoleccion_con_conductas_indebidas', 'suaci'),
  ('Camión de recolección que despide malos olores / líquidos', 'AMBIENTE', 'camion_de_recoleccion_que_despide_malos_olores_liquidos', 'suaci'),
  ('Personal de empresa de recolección realiza pedido de dádivas', 'AMBIENTE', 'personal_de_empresa_de_recoleccion_realiza_pedido_de_dadivas', 'suaci'),
  ('Camión recuperador que interrumpe el tránsito', 'AMBIENTE', 'camion_recuperador_que_interrumpe_el_transito', 'suaci'),
  ('Ocupación indebida de la vereda/calzada por área gastronómica', 'COMERCIO_IRREGULAR', 'ocupacion_area_gastronomica', 'suaci'),
  ('Ocupación indebida de la vereda/calzada por local comercial', 'COMERCIO_IRREGULAR', 'ocupacion_local_comercial', 'suaci'),
  ('Ocupación indebida por mantero o vendedor ambulante', 'COMERCIO_IRREGULAR', 'mantero_vendedor_ambulante', 'suaci'),
  ('Irregularidades en ferias', 'COMERCIO_IRREGULAR', 'irregularidades_ferias', 'suaci'),
  ('Establecimiento sin autorización para funcionar sin venta o elaboración de alimentos', 'COMERCIO_IRREGULAR', 'local_sin_habilitacion', 'suaci'),
  ('Reparación de luminaria apagada durante la noche', 'INFRAESTRUCTURA', 'luminaria_apagada_noche', 'suaci'),
  ('Mayor iluminación en calle / plaza', 'INFRAESTRUCTURA', 'mayor_iluminacion', 'suaci'),
  ('Reparación de luminaria por artefacto roto', 'INFRAESTRUCTURA', 'luminaria_artefacto_roto', 'suaci'),
  ('Reparación de tapa faltante / deteriorada en columna de alumbrado', 'INFRAESTRUCTURA', 'reparacion_de_tapa_faltante_deteriorada_en_columna_de_alumbr', 'suaci'),
  ('Luminaria intermitente', 'INFRAESTRUCTURA', 'luminaria_intermitente', 'suaci'),
  ('Reparación de luminaria encendida durante el día', 'INFRAESTRUCTURA', 'reparacion_de_luminaria_encendida_durante_el_dia', 'suaci'),
  ('Reparación de toma de energía de alumbrado público', 'INFRAESTRUCTURA', 'reparacion_de_toma_de_energia_de_alumbrado_publico', 'suaci'),
  ('Limpieza de artefacto de alumbrado', 'INFRAESTRUCTURA', 'limpieza_de_artefacto_de_alumbrado', 'suaci'),
  ('Columna/poste/cable en mal estado, abandonado o cortado', 'INFRAESTRUCTURA', 'columna_poste_cable_en_mal_estado_abandonado_o_cortado', 'suaci'),
  ('Reparación de bache en calle', 'INFRAESTRUCTURA', 'bache_calle', 'suaci'),
  ('Reparación de bache - Apertura hundida', 'INFRAESTRUCTURA', 'bache_apertura_hundida', 'suaci'),
  ('Reparación de cuneta', 'INFRAESTRUCTURA', 'reparacion_de_cuneta', 'suaci'),
  ('Reparación / construcción de cordón', 'INFRAESTRUCTURA', 'reparacion_construccion_de_cordon', 'suaci'),
  ('Repintado / reparación de marca vial en calle o cordón', 'INFRAESTRUCTURA', 'repintado_reparacion_de_marca_vial_en_calle_o_cordon', 'suaci'),
  ('Nivelación de tapa de empresa de servicio público en calle', 'INFRAESTRUCTURA', 'nivelacion_de_tapa_de_empresa_de_servicio_publico_en_calle', 'suaci'),
  ('Reparación de bache - Socavamiento', 'INFRAESTRUCTURA', 'reparacion_de_bache_socavamiento', 'suaci'),
  ('Reparación de calle rota por empresa de servicio', 'INFRAESTRUCTURA', 'calle_rota_empresa', 'suaci'),
  ('Ajuste de chapa metálica por ruidos molestos en calle', 'INFRAESTRUCTURA', 'ajuste_de_chapa_metalica_por_ruidos_molestos_en_calle', 'suaci'),
  ('Nivelación por hundimiento del pavimento', 'INFRAESTRUCTURA', 'nivelacion_pavimento', 'suaci'),
  ('Repavimentación de calle', 'INFRAESTRUCTURA', 'repavimentacion_de_calle', 'suaci'),
  ('Reparación de bache - Granito hundido', 'INFRAESTRUCTURA', 'reparacion_de_bache_granito_hundido', 'suaci'),
  ('Reparación de calle de adoquines o granito', 'INFRAESTRUCTURA', 'reparacion_de_calle_de_adoquines_o_granito', 'suaci'),
  ('Reparación de bache en ciclovía', 'INFRAESTRUCTURA', 'reparacion_de_bache_en_ciclovia', 'suaci'),
  ('Reparación de tapa de empresa de servicios públicos - Contorno', 'INFRAESTRUCTURA', 'reparacion_de_tapa_de_empresa_de_servicios_publicos_contorno', 'suaci'),
  ('Problemas con obras de bacheo', 'INFRAESTRUCTURA', 'problemas_con_obras_de_bacheo', 'suaci'),
  ('Asfaltado de calle con adoquines', 'INFRAESTRUCTURA', 'asfaltado_de_calle_con_adoquines', 'suaci'),
  ('Reposición de tapa de empresa de servicio público en calle', 'INFRAESTRUCTURA', 'reposicion_de_tapa_de_empresa_de_servicio_publico_en_calle', 'suaci'),
  ('Reparación de lomo de burro', 'INFRAESTRUCTURA', 'reparacion_de_lomo_de_burro', 'suaci'),
  ('Reparación de dársena para ascenso/descenso de colectivos', 'INFRAESTRUCTURA', 'reparacion_de_darsena_para_ascenso_descenso_de_colectivos', 'suaci'),
  ('Reparación de elementos en túneles / puentes', 'INFRAESTRUCTURA', 'reparacion_de_elementos_en_tuneles_puentes', 'suaci'),
  ('Instalación de elementos viales en calle', 'INFRAESTRUCTURA', 'instalacion_de_elementos_viales_en_calle', 'suaci'),
  ('Destape de sumidero/alcantarilla o boca de registro pluvial', 'INFRAESTRUCTURA', 'sumidero_destape', 'suaci'),
  ('Reparación de sumidero/alcantarilla o boca de registro pluvial faltante', 'INFRAESTRUCTURA', 'reparacion_de_sumidero_alcantarilla_o_boca_de_registro_pluvi', 'suaci'),
  ('Reparación de sumidero/alcantarilla o boca de registro pluvial rota', 'INFRAESTRUCTURA', 'sumidero_roto', 'suaci'),
  ('Destape de sumideros', 'INFRAESTRUCTURA', 'destape_de_sumideros', 'suaci'),
  ('Intervención por calle anegada/inundada', 'INFRAESTRUCTURA', 'calle_anegada', 'suaci'),
  ('Construcción de sumidero/alcantarilla o boca de registro pluvial', 'INFRAESTRUCTURA', 'construccion_de_sumidero_alcantarilla_o_boca_de_registro_plu', 'suaci'),
  ('Reparación de semáforo', 'INFRAESTRUCTURA', 'semaforo_reparacion', 'suaci'),
  ('Reparación de señal de tránsito', 'INFRAESTRUCTURA', 'senal_transito_reparacion', 'suaci'),
  ('Reparación de vereda', 'INFRAESTRUCTURA', 'vereda_reparacion', 'suaci'),
  ('Reparación de vereda por raíces de árbol que producen roturas', 'INFRAESTRUCTURA', 'vereda_raices', 'suaci'),
  ('Nivelación de tapa de empresa de servicio público en vereda', 'INFRAESTRUCTURA', 'nivelacion_de_tapa_de_empresa_de_servicio_publico_en_vereda', 'suaci'),
  ('Reparación de vereda rota por empresa de servicio', 'INFRAESTRUCTURA', 'vereda_empresa', 'suaci'),
  ('Reparación de rampa de accesibilidad', 'INFRAESTRUCTURA', 'rampa_accesibilidad', 'suaci'),
  ('Obstrucción de calle o vereda por elementos fijos o móviles', 'INFRAESTRUCTURA', 'obstruccion_de_calle_o_vereda_por_elementos_fijos_o_moviles', 'suaci'),
  ('Restos de obra en vereda que impiden el paso', 'INFRAESTRUCTURA', 'restos_de_obra_en_vereda_que_impiden_el_paso', 'suaci'),
  ('Reposición de tapa de empresa de servicio público en vereda', 'INFRAESTRUCTURA', 'reposicion_de_tapa_de_empresa_de_servicio_publico_en_vereda', 'suaci'),
  ('Reparación de vereda por obra mal terminada', 'INFRAESTRUCTURA', 'reparacion_de_vereda_por_obra_mal_terminada', 'suaci'),
  ('Construcción de rampa de accesibilidad', 'INFRAESTRUCTURA', 'construccion_de_rampa_de_accesibilidad', 'suaci'),
  ('Vereda rota por alumbrado público', 'INFRAESTRUCTURA', 'vereda_rota_por_alumbrado_publico', 'suaci'),
  ('Vehículo mal estacionado', 'TRANSITO', 'vehiculo_mal_estacionado', 'suaci'),
  ('Remoción de vehículo abandonado', 'TRANSITO', 'vehiculo_abandonado', 'suaci'),
  ('Irregularidades con reservas de espacios para estacionamiento de vehículos de personas con discapacidad', 'TRANSITO', 'reserva_discapacidad', 'suaci'),
  ('Vehículo obstruyendo garaje', 'TRANSITO', 'vehiculo_obstruyendo_garaje', 'suaci'),
  ('alumbrado público', 'INFRAESTRUCTURA', 'luminaria_apagada_noche', 'norma'),
  ('calzada', 'INFRAESTRUCTURA', 'bache_calle', 'norma'),
  ('mantenimiento urbano de las vías secundarias', 'INFRAESTRUCTURA', 'bache_calle', 'norma'),
  ('vía pública', 'INFRAESTRUCTURA', 'bache_calle', 'norma'),
  ('red pluvial', 'INFRAESTRUCTURA', 'sumidero_destape', 'norma'),
  ('desagües pluviales', 'INFRAESTRUCTURA', 'sumidero_destape', 'norma'),
  ('higiene urbana', 'AMBIENTE', 'residuos_fuera_contenedor', 'norma'),
  ('basura a cielo abierto', 'AMBIENTE', 'residuos_fuera_contenedor', 'norma'),
  ('basurales a cielo abierto', 'AMBIENTE', 'residuos_fuera_contenedor', 'norma'),
  ('vehículo abandonado', 'TRANSITO', 'vehiculo_abandonado', 'norma'),
  ('estacionar sobre la senda para peatones o aceras', 'TRANSITO', 'vehiculo_mal_estacionado', 'norma'),
  ('doble fila', 'TRANSITO', 'vehiculo_mal_estacionado', 'norma'),
  ('rampas para personas con discapacidad', 'TRANSITO', 'vehiculo_mal_estacionado', 'norma'),
  ('venta en el espacio público sin permiso de uso', 'COMERCIO_IRREGULAR', 'mantero_vendedor_ambulante', 'norma'),
  ('ocupación de la acera con puestos', 'COMERCIO_IRREGULAR', 'mantero_vendedor_ambulante', 'norma'),
  ('actividades económicas sin autorización', 'COMERCIO_IRREGULAR', 'local_sin_habilitacion', 'norma'),
  ('deterioro de la vereda por raíces de árboles', 'INFRAESTRUCTURA', 'vereda_raices', 'norma'),
  ('situación de calle', 'VULNERABILIDAD_SOCIAL', 'situacion_de_calle', 'norma'),
  ('bache profundo en la calzada', 'INFRAESTRUCTURA', 'bache_calle', 'pruebas_s15'),
  ('la vereda está toda rota y levantada', 'INFRAESTRUCTURA', 'vereda_reparacion', 'pruebas_s15'),
  ('vereda rota y levantada por las raíces de un árbol', 'INFRAESTRUCTURA', 'vereda_raices', 'pruebas_s15'),
  ('no anda la luminaria de la calle', 'INFRAESTRUCTURA', 'luminaria_apagada_noche', 'pruebas_s15'),
  ('queda todo oscuro de noche', 'INFRAESTRUCTURA', 'luminaria_apagada_noche', 'pruebas_s15'),
  ('el semáforo está fuera de servicio', 'INFRAESTRUCTURA', 'semaforo_reparacion', 'pruebas_s15'),
  ('boca de tormenta rota, el agua no drena', 'INFRAESTRUCTURA', 'sumidero_roto', 'pruebas_s15'),
  ('auto mal estacionado', 'TRANSITO', 'vehiculo_mal_estacionado', 'pruebas_s15'),
  ('auto arriba de la rampa', 'TRANSITO', 'vehiculo_mal_estacionado', 'pruebas_s15'),
  ('camioneta arriba de la senda peatonal', 'TRANSITO', 'vehiculo_mal_estacionado', 'pruebas_s15'),
  ('autos en doble fila', 'TRANSITO', 'vehiculo_mal_estacionado', 'pruebas_s15'),
  ('camión tapando la salida del garage', 'TRANSITO', 'vehiculo_obstruyendo_garaje', 'pruebas_s15'),
  ('auto tirado en la calle, destrozado y sin patente', 'TRANSITO', 'vehiculo_abandonado', 'pruebas_s15'),
  ('el contenedor de la esquina está desbordado', 'AMBIENTE', 'contenedor_vaciado', 'pruebas_s15'),
  ('microbasural en el terreno baldío', 'AMBIENTE', 'terreno_baldio_higienizacion', 'pruebas_s15'),
  ('basura acumulada en la esquina', 'AMBIENTE', 'residuos_fuera_contenedor', 'pruebas_s15'),
  ('están quemando residuos a cielo abierto', 'AMBIENTE', 'olores_humos_gases', 'pruebas_s15'),
  ('venta ambulante sin habilitación ocupando la vereda', 'COMERCIO_IRREGULAR', 'mantero_vendedor_ambulante', 'pruebas_s15'),
  ('venden en la calle', 'COMERCIO_IRREGULAR', 'mantero_vendedor_ambulante', 'pruebas_s15'),
  ('mercadería sobre la vereda que obstruye el paso', 'COMERCIO_IRREGULAR', 'ocupacion_local_comercial', 'pruebas_s15'),
  ('familia durmiendo en la vereda', 'VULNERABILIDAD_SOCIAL', 'situacion_de_calle', 'pruebas_s15'),
  ('refugio improvisado bajo la autopista', 'VULNERABILIDAD_SOCIAL', 'situacion_de_calle', 'pruebas_s15'),
  ('pozo', 'INFRAESTRUCTURA', 'bache_calle', 'po'),
  ('cráter', 'INFRAESTRUCTURA', 'bache_calle', 'po'),
  ('boquete', 'INFRAESTRUCTURA', 'bache_calle', 'po'),
  ('calle rota', 'INFRAESTRUCTURA', 'bache_calle', 'po'),
  ('calle hundida', 'INFRAESTRUCTURA', 'nivelacion_pavimento', 'po'),
  ('baldosas levantadas', 'INFRAESTRUCTURA', 'vereda_reparacion', 'po'),
  ('vereda hundida', 'INFRAESTRUCTURA', 'vereda_reparacion', 'po'),
  ('farol', 'INFRAESTRUCTURA', 'luminaria_apagada_noche', 'po'),
  ('poste de luz', 'INFRAESTRUCTURA', 'luminaria_apagada_noche', 'po'),
  ('luz quemada', 'INFRAESTRUCTURA', 'luminaria_apagada_noche', 'po'),
  ('está todo a oscuras', 'INFRAESTRUCTURA', 'luminaria_apagada_noche', 'po'),
  ('luz que titila', 'INFRAESTRUCTURA', 'luminaria_intermitente', 'po'),
  ('alcantarilla tapada', 'INFRAESTRUCTURA', 'sumidero_destape', 'po'),
  ('se inunda la calle', 'INFRAESTRUCTURA', 'calle_anegada', 'po'),
  ('semáforo apagado', 'INFRAESTRUCTURA', 'semaforo_reparacion', 'po'),
  ('semáforo roto', 'INFRAESTRUCTURA', 'semaforo_reparacion', 'po'),
  ('auto en la vereda', 'TRANSITO', 'vehiculo_mal_estacionado', 'po'),
  ('auto en la rampa', 'TRANSITO', 'vehiculo_mal_estacionado', 'po'),
  ('me taparon el garage', 'TRANSITO', 'vehiculo_obstruyendo_garaje', 'po'),
  ('chatarra', 'TRANSITO', 'vehiculo_abandonado', 'po'),
  ('basural', 'AMBIENTE', 'residuos_fuera_contenedor', 'po'),
  ('mugre', 'AMBIENTE', 'barrido_mejora', 'po'),
  ('contenedor lleno', 'AMBIENTE', 'contenedor_vaciado', 'po'),
  ('olor a podrido', 'AMBIENTE', 'olores_humos_gases', 'po'),
  ('humo de una fábrica', 'AMBIENTE', 'olores_humos_gases', 'po'),
  ('mantero', 'COMERCIO_IRREGULAR', 'mantero_vendedor_ambulante', 'po'),
  ('puestito en la vereda', 'COMERCIO_IRREGULAR', 'mantero_vendedor_ambulante', 'po'),
  ('mesas en la vereda', 'COMERCIO_IRREGULAR', 'ocupacion_area_gastronomica', 'po'),
  ('local trucho', 'COMERCIO_IRREGULAR', 'local_sin_habilitacion', 'po'),
  ('gente durmiendo en la calle', 'VULNERABILIDAD_SOCIAL', 'situacion_de_calle', 'po'),
  ('chicos en la calle', 'VULNERABILIDAD_SOCIAL', 'situacion_de_calle_ninez', 'po');

-- ---------------------------------------------------------------------------------------------------------------
-- 6. MIG-03: antes de cargar, todo tiene que resolver. Si algo no da, se aborta (nada se descarta en silencio).
-- ---------------------------------------------------------------------------------------------------------------
do $chk$
declare n int;
begin
  select count(*) into n from p4_prestacion_grupo pg
    join public.services s on s.service_code = pg.servicio
    join public.service_attributes sa on sa.service_id = s.id and sa.attribute_code = 'prestacion'
    join public.service_attribute_values av on av.attribute_id = sa.id and av.value_key = pg.value_key;
  if n <> 107 then raise exception 'P4: se esperaban 107 prestaciones en la base y resuelven %. ¿Corrió el loader de REP-2800 con las 70 nuevas?', n; end if;
  select count(*) into n from p4_termino t join p4_prestacion_grupo pg on pg.value_key = t.value_key;
  if n <> 176 then raise exception 'P4: se esperaban 176 términos con prestación y resuelven %', n; end if;
  select count(*) into n from p4_vinculo v
    join public.services s on s.service_code = v.categoria
    join p4_pares_antes p on p.fragment_id = v.fragment_id and p.service_id = s.id;
  if n <> 57 then raise exception 'P4: se esperaban 57 vínculos sobre pares existentes y hay % (¿cambió fragment_services?)', n; end if;
end $chk$;

-- ---------------------------------------------------------------------------------------------------------------
-- 7. Carga
-- ---------------------------------------------------------------------------------------------------------------
insert into public.fragment_services (fragment_id, service_id, attribute_value_id, tipo_fundamento)
select v.fragment_id, s.id, av.id, v.tipo_fundamento
  from p4_vinculo v
  join public.services s on s.service_code = v.categoria
  join p4_prestacion_grupo pg on pg.grupo = v.grupo and pg.servicio = v.categoria
  join public.service_attributes sa on sa.service_id = s.id and sa.attribute_code = 'prestacion'
  join public.service_attribute_values av on av.attribute_id = sa.id and av.value_key = pg.value_key
on conflict do nothing;

insert into public.service_keywords (service_id, keyword, attribute_value_id, origin)
select s.id, t.termino, av.id, t.origen
  from p4_termino t
  join public.services s on s.service_code = t.servicio
  join public.service_attributes sa on sa.service_id = s.id and sa.attribute_code = 'prestacion'
  join public.service_attribute_values av on av.attribute_id = sa.id and av.value_key = t.value_key
on conflict do nothing;

-- ---------------------------------------------------------------------------------------------------------------
-- 8. Controles después de cargar (MIG-03 y búsqueda intacta). Valen también en la segunda corrida (idempotencia).
-- ---------------------------------------------------------------------------------------------------------------
do $post$
declare n int;
begin
  if exists (select distinct fragment_id, service_id from public.fragment_services
             except select fragment_id, service_id from p4_pares_antes) then
    raise exception 'P4 agregó un par (fragmento, categoría) nuevo: cambiaría match_knowledge_fragments';
  end if;
  select count(*) into n from public.fragment_services where attribute_value_id is not null;
  if n <> 466 then raise exception 'P4: se esperaban 466 filas de vínculo por prestación y hay %', n; end if;
  select count(*) into n from public.service_keywords where attribute_value_id is not null;
  if n <> 176 then raise exception 'P4: se esperaban 176 términos y hay %', n; end if;
end $post$;

commit;

-- ---------------------------------------------------------------------------------------------------------------
-- ROLLBACK (solo lo que cargó P4; no borra nada que use un reporte). MIG-05: controla también report_routing y
-- service_keywords antes de borrar una prestación nueva.
-- ---------------------------------------------------------------------------------------------------------------
-- begin;
-- delete from public.fragment_services where attribute_value_id is not null;
-- delete from public.service_keywords  where attribute_value_id is not null;
-- drop index if exists public.fragment_services_uq;
-- drop index if exists public.fragment_services_attribute_value_idx;
-- alter table public.fragment_services add constraint fragment_services_pkey primary key (fragment_id, service_id);
-- alter table public.fragment_services drop column if exists attribute_value_id, drop column if exists tipo_fundamento;
-- drop index if exists public.service_keywords_uq;
-- alter table public.service_keywords add constraint service_keywords_pkey primary key (service_id, keyword);
-- alter table public.service_keywords drop constraint if exists service_keywords_origin_check;
-- alter table public.service_keywords drop column if exists attribute_value_id, drop column if exists origin;
-- -- upsert_knowledge_fragment: volver a la versión de 20260920210000_rep3774 (re-ejecutar ese create or replace).
-- -- Prestaciones nuevas (las 70 de REP-3863_c_prest_nuevas.sql): solo las que ningún reporte usa.
-- --   create temporary table p4_nuevas (value_key text) on commit drop;  insert … (las 70 claves);
-- --   create temporary table p4_borrables on commit drop as
-- --     select av.id from public.service_attribute_values av join p4_nuevas n on n.value_key = av.value_key
-- --      where not exists (select 1 from public.infraction_attribute_responses r where r.selected_value = av.value_key)
-- --        and not exists (select 1 from public.report_routing rr                -- la prestación va en input/result (jsonb)
-- --                         where rr.input::text like '%"' || av.value_key || '"%' or rr.result::text like '%"' || av.value_key || '"%')
-- --        and not exists (select 1 from public.service_keywords k where k.attribute_value_id = av.id);
-- --   delete from public.agency_services where attribute_value_id in (select id from p4_borrables);
-- --   delete from public.service_attribute_values where id in (select id from p4_borrables);
-- commit;
