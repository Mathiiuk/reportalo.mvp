-- Backup de funciones de aplicacion en el schema public del proyecto Supabase real
-- "CiudadAR" (yryuhyiujyignkdhiyua), tomado el 2026-09-14 antes de cualquier
-- despliegue de REP-2908/2909. Excluye las funciones internas de la extension
-- pgvector (array_to_vector, halfvec_*, etc.) que no son codigo de la app.
-- Fuente: pg_get_functiondef() vía Supabase MCP execute_sql (solo lectura).

CREATE OR REPLACE FUNCTION public.check_high_priority_zone()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  recent_count INT;
BEGIN
  SELECT count(*) INTO recent_count FROM public.infractions
  WHERE created_at > (now() - interval '1 hour')
    AND ST_DWithin(location, NEW.location, 100);

  IF recent_count >= 5 THEN
    INSERT INTO public.high_priority_zones(center_location, infraction_count)
    VALUES (NEW.location, recent_count);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.eligible_knowledge_sources(p_locality_id uuid)
 RETURNS TABLE(source_id uuid, scope_level integer)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.get_auth_user_jurisdiction()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jurisdiction FROM public.profiles WHERE id = (select auth.uid());
$function$;

CREATE OR REPLACE FUNCTION public.get_auth_user_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT role FROM public.profiles WHERE id = (select auth.uid());
$function$;

CREATE OR REPLACE FUNCTION public.get_clustered_infractions(p_lat double precision, p_lng double precision, p_radius_meters double precision, p_grid_size double precision DEFAULT 0.01)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
AS $function$
BEGIN
  RETURN (
    SELECT jsonb_build_object(
      'type', 'FeatureCollection',
      'features', COALESCE(jsonb_agg(
        jsonb_build_object(
          'type', 'Feature',
          'geometry', ST_AsGeoJSON(ST_Centroid(ST_Collect(location::geometry)))::jsonb,
          'properties', jsonb_build_object(
            'is_cluster', count(*) > 1,
            'point_count', count(*),
            'id', (array_agg(id))[1],
            'image_url', (array_agg(image_url))[1],
            'status', (array_agg(status))[1],
            'type_name', (array_agg(type))[1],
            'created_at', (array_agg(created_at))[1]
          )
        )
      ), '[]'::jsonb)
    )
    FROM public.infractions
    WHERE ST_DWithin(location, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography, p_radius_meters)
    GROUP BY ST_SnapToGrid(location::geometry, p_grid_size)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_infraction_stats(p_days_ago integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
DECLARE
  v_jurisdiction text;
BEGIN
  v_jurisdiction := public.get_auth_user_jurisdiction();

  RETURN (
    SELECT jsonb_build_object(
      'trends', (
        SELECT COALESCE(jsonb_agg(d), '[]'::jsonb) FROM (
          SELECT date_trunc('day', created_at)::date as date, type, count(*) as count
          FROM public.infractions
          WHERE created_at > (now() - (p_days_ago || ' days')::interval)
          AND (v_jurisdiction IS NULL OR municipio = v_jurisdiction OR provincia = v_jurisdiction)
          GROUP BY 1, 2
          ORDER BY 1 ASC
        ) d
      ),
      'status_dist', (
        SELECT COALESCE(jsonb_agg(s), '[]'::jsonb) FROM (
          SELECT status, count(*) as count
          FROM public.infractions
          WHERE (v_jurisdiction IS NULL OR municipio = v_jurisdiction OR provincia = v_jurisdiction)
          GROUP BY 1
        ) s
      ),
      'total_count', (SELECT count(*) FROM public.infractions WHERE (v_jurisdiction IS NULL OR municipio = v_jurisdiction OR provincia = v_jurisdiction)),
      'pending_count', (SELECT count(*) FROM public.infractions WHERE status = 'pendiente' AND (v_jurisdiction IS NULL OR municipio = v_jurisdiction OR provincia = v_jurisdiction)),
      'assigned_jurisdiction', v_jurisdiction
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_infractions_geojson()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
AS $function$
BEGIN
  RETURN (
    SELECT jsonb_build_object(
      'type', 'FeatureCollection',
      'features', COALESCE(jsonb_agg(
        jsonb_build_object(
          'type', 'Feature',
          'geometry', ST_AsGeoJSON(location)::jsonb,
          'properties', jsonb_build_object(
            'id', id,
            'image_url', image_url,
            'status', status,
            'created_at', created_at
          )
        )
      ), '[]'::jsonb)
    )
    FROM public.infractions
    -- El SECURITY INVOKER asegura que solo se retornen filas garantizadas por el RLS del Usuario Actual!
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_infractions_nearby(p_lat double precision, p_lng double precision, p_radius_meters double precision)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
AS $function$
BEGIN
  RETURN (
    SELECT jsonb_build_object(
      'type', 'FeatureCollection',
      'features', COALESCE(jsonb_agg(
        jsonb_build_object(
          'type', 'Feature',
          'geometry', ST_AsGeoJSON(location)::jsonb,
          'properties', jsonb_build_object(
            'id', id,
            'image_url', image_url,
            'status', status,
            'type_name', type,
            'created_at', created_at
          )
        )
      ), '[]'::jsonb)
    )
    FROM public.infractions
    WHERE ST_DWithin(location, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography, p_radius_meters)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_infraction_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF (OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.notifications (user_id, title, message)
    VALUES (
      NEW.user_id,
      'Actualización de Reporte',
      'El estado de tu reporte "' || NEW.type || '" ha cambiado de ' || OLD.status || ' a ' || NEW.status || '.'
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  target_username TEXT;
BEGIN
  -- Regla: Si entra por Google/correo, el username es su email
  target_username := COALESCE(NEW.email, NEW.id::text);

  INSERT INTO public.profiles (
    id, username, full_name, avatar_url, role, created_at, updated_at
  )
  VALUES (
    NEW.id,
    target_username,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', target_username),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', NULL),
    'ciudadano',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    full_name = EXCLUDED.full_name,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = NOW();

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.mark_report_viewed(p_report_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  insert into report_events (report_id, event_type_code, actor_profile_id, actor_agency_id)
  select p_report_id, 'VISTO_POR_ORGANISMO', p.id, p.agency_id
  from profiles p
  where p.id = auth.uid()
    and p.agency_id is not null
    and profile_attends_report(p.id, p_report_id)
  on conflict (report_id, actor_agency_id) where event_type_code = 'VISTO_POR_ORGANISMO' do nothing;
$function$;

CREATE OR REPLACE FUNCTION public.match_knowledge_fragments(query_embedding vector, p_locality_id uuid, p_model_code character varying, match_count integer DEFAULT 6)
 RETURNS TABLE(fragment_id uuid, source_id uuid, hierarchy_path text, content text, scope_level integer, similarity double precision)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions'
AS $function$
  select f.id, f.source_id, f.hierarchy_path, f.content, e.scope_level,
         1 - (fe.embedding <=> query_embedding)
  from eligible_knowledge_sources(p_locality_id) e
  join knowledge_fragments f  on f.source_id = e.source_id and f.is_current
  join fragment_embeddings fe on fe.fragment_id = f.id and fe.model_code = p_model_code
  order by fe.embedding <=> query_embedding
  limit match_count;
$function$;

CREATE OR REPLACE FUNCTION public.match_learning_corpus(query_embedding vector, match_threshold double precision, match_count integer)
 RETURNS TABLE(id uuid, final_outcome character varying, municipality_notes text, similarity double precision)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT
    report_learning_corpus.id,
    report_learning_corpus.final_outcome,
    report_learning_corpus.municipality_notes,
    1 - (report_learning_corpus.embedding <=> query_embedding) AS similarity
  FROM report_learning_corpus
  WHERE 1 - (report_learning_corpus.embedding <=> query_embedding) > match_threshold
  ORDER BY report_learning_corpus.embedding <=> query_embedding
  LIMIT match_count;
$function$;

CREATE OR REPLACE FUNCTION public.match_normativas(query_embedding vector, match_threshold double precision DEFAULT 0.45, match_count integer DEFAULT 5, filter_categoria text DEFAULT NULL::text, filter_jurisdiccion text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, norma_codigo text, titulo text, jurisdiccion text, autoridad text, tipo_documento character varying, categoria text, articulo text, tipo_fundamento text, regla text, fuente_url text, similarity double precision)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT
    normativas.id,
    COALESCE(normativas.norma_codigo, 'N/A') AS norma_codigo,
    COALESCE(normativas.titulo, normativas.categoria) AS titulo,
    COALESCE(normativas.jurisdiccion, 'Municipal') AS jurisdiccion,
    COALESCE(normativas.autoridad, 'Autoridad Municipal') AS autoridad,
    normativas.tipo_documento,
    normativas.categoria,
    COALESCE(normativas.articulo, 'General') AS articulo,
    normativas.tipo_fundamento,
    normativas.regla,
    COALESCE(normativas.fuente_url, '') AS fuente_url,
    1 - (normativas.embedding <=> query_embedding) AS similarity
  FROM public.normativas
  WHERE (1 - (normativas.embedding <=> query_embedding)) > match_threshold
    AND (filter_categoria IS NULL OR normativas.categoria = filter_categoria)
    AND (filter_jurisdiccion IS NULL OR normativas.jurisdiccion = filter_jurisdiccion)
  ORDER BY normativas.embedding <=> query_embedding
  LIMIT match_count;
$function$;

CREATE OR REPLACE FUNCTION public.profile_attends_report(p_profile_id uuid, p_report_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;
