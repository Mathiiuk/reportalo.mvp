-- V-03 (ronda 2 de Hernan): fija el search_path de las 10 funciones que
-- marca el Security Advisor como "Function Search Path Mutable" -- sin
-- esto, una funcion SECURITY DEFINER puede ser enganada resolviendo un
-- objeto de otro esquema si alguien manipula el search_path de la sesion.
alter function public.get_infractions_geojson() set search_path = public;
alter function public.handle_infraction_status_change() set search_path = public;
alter function public.get_infractions_nearby(p_lat double precision, p_lng double precision, p_radius_meters double precision) set search_path = public;
alter function public.handle_updated_at() set search_path = public;
alter function public.get_infraction_stats(p_days_ago integer) set search_path = public;
alter function public.check_high_priority_zone() set search_path = public;
alter function public.get_clustered_infractions(p_lat double precision, p_lng double precision, p_radius_meters double precision, p_grid_size double precision) set search_path = public;
alter function public.match_learning_corpus(query_embedding vector, match_threshold double precision, match_count integer) set search_path = public;
alter function public.handle_new_user() set search_path = public;
alter function public.match_normativas(query_embedding vector, match_threshold double precision, match_count integer, filter_categoria text, filter_jurisdiccion text) set search_path = public;
