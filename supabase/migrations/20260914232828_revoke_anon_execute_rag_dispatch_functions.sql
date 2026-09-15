-- V-03 (hallazgo adicional, no listado en el documento de devolucion de
-- Hernan): dispatch_rag_analysis_queue y enqueue_rag_analysis son SECURITY
-- DEFINER y quedaban ejecutables via /rest/v1/rpc/... por el rol anon,
-- permitiendo a cualquiera sin autenticarse disparar el pipeline de analisis
-- (costo real de Gemini). Primer paso: revocar de anon. (Insuficiente por si
-- solo -- ver la migracion siguiente: el privilegio se heredaba de PUBLIC.)
revoke execute on function public.dispatch_rag_analysis_queue() from anon;
revoke execute on function public.enqueue_rag_analysis() from anon;
