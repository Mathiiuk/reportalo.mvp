-- REP-2908-VERIF ronda 5, R5-03: report_images.insert_publico permite a
-- cualquiera (rol public, sin sesion) asociar cualquier image_url a
-- cualquier reporte, incluida una URL externa sin anonimizar.
--
-- Verificado por grep (16/09): ningun codigo del repositorio (cliente ni
-- Edge Functions) escribe en report_images -- ni siquiera la funcion
-- quarantine-anonymize, que solo mueve objetos entre buckets de Storage.
-- La tabla queda para cuando ADR-013 conecte la escritura server-side; por
-- ahora la politica esta expuesta sin ningun uso legitimo. Se dropea.
drop policy if exists "insert_publico" on public.report_images;
