-- REP-2908-VERIF ronda 5, R5-11: V-09 recreo match_knowledge_fragments y
-- solo le revoco el permiso a `public`; Supabase igual lo concede a `anon`
-- y `authenticated` por default de Postgres/PostgREST. El contrato dice
-- "solo el servidor" (la funcion la llama analizar-reporte con la clave de
-- servicio). Confirmado por C5 (16/09): anon=true, con_sesion=true.
revoke execute on function public.match_knowledge_fragments(vector, uuid, character varying, integer, text) from anon, authenticated;
grant  execute on function public.match_knowledge_fragments(vector, uuid, character varying, integer, text) to service_role;
