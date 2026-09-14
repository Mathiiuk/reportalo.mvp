-- REP-2908-VERIF (V-03, hallazgo adicional no listado en el documento de
-- Hernan): dispatch_rag_analysis_queue y enqueue_rag_analysis son
-- SECURITY DEFINER y quedaban ejecutables via /rest/v1/rpc/... por los roles
-- anon y authenticated (heredado del grant por defecto a PUBLIC al crear la
-- funcion). Cualquiera, autenticado o no, podia disparar el pipeline de
-- analisis y generar costo real de Gemini sin pasar por un reporte real.
-- Quedan reservadas al disparo interno (trigger trg_enqueue_rag_analysis y
-- cron rag-analysis-dispatch), que corren como postgres/service_role y no
-- se ven afectados por este revoke.
revoke execute on function public.dispatch_rag_analysis_queue() from public;
revoke execute on function public.enqueue_rag_analysis() from public;
revoke execute on function public.dispatch_rag_analysis_queue() from authenticated;
revoke execute on function public.enqueue_rag_analysis() from authenticated;
