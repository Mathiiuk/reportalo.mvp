-- Cierre del hallazgo V-03: dispatch_rag_analysis_queue y enqueue_rag_analysis
-- quedan reservadas al disparo interno (trigger / cron, que corren como
-- postgres/service_role) y ya no son invocables via RPC publico ni por
-- usuarios autenticados.
revoke execute on function public.dispatch_rag_analysis_queue() from authenticated;
revoke execute on function public.enqueue_rag_analysis() from authenticated;
