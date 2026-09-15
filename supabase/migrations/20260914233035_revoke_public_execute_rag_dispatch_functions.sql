-- El revoke de anon (migracion anterior) no alcanzo: Postgres otorga EXECUTE
-- a PUBLIC por defecto al crear una funcion, y anon hereda ese privilegio de
-- PUBLIC salvo que se revoque explicitamente ahi.
revoke execute on function public.dispatch_rag_analysis_queue() from public;
revoke execute on function public.enqueue_rag_analysis() from public;
