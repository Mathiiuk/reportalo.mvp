-- REP-3817: igual que enqueue_rag_analysis, la funcion del trigger no la ejecuta ningun cliente
-- (el trigger dispara igual: verificado como ciudadano, con rollback). Cierra el aviso del linter de Supabase
-- «SECURITY DEFINER ejecutable por anon/authenticated» para enqueue_visual_analysis.
-- APLICADA en CiudadAR el 05/10/2026 (version 20261005163640), a continuacion de 20261005163523.
revoke execute on function public.enqueue_visual_analysis() from public, anon, authenticated;
