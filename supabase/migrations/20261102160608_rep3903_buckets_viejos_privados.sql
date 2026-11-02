-- =============================================================================
-- REP-3903 · Buckets heredados privados (evidencia-infracciones, infraction-images)
-- -----------------------------------------------------------------------------
-- Hallazgo (02/11, solo lectura): los dos buckets de antes de REP-2501 son públicos y
-- tienen políticas que dejan listar y descargar sus 48 imágenes (41 + 7, abril–junio)
-- sin sesión. La app no los usa desde REP-2501 y ninguna fila de report_images los
-- referencia (todas apuntan a report-evidences).
--
-- Qué hace: los vuelve privados y quita sus cuatro políticas (dos de lectura pública y
-- dos de subida que ya no usa nadie). NO borra ningún objeto: las 48 imágenes quedan
-- guardadas y solo las lee la clave de servicio.
--
-- APLICADA en staging el 02/11/2026 con OK de Matías, registrada como 20261102160608.
-- Después: los 5 buckets privados, 2 políticas en storage.objects (las de report-evidences y cuarentena),
-- 48 objetos intactos, anon ve 0 objetos y la URL pública responde 400 «Bucket not found».
--
-- Rollback (deja todo exactamente como estaba):
--   update storage.buckets set public = true where id in ('evidencia-infracciones', 'infraction-images');
--   create policy "Lectura pública para todo el bucket" on storage.objects for select to public
--     using (bucket_id = 'evidencia-infracciones'::text);
--   create policy "Usuarios autenticados suben sus evidencias" on storage.objects for insert to public
--     with check ((bucket_id = 'evidencia-infracciones'::text) and (auth.uid() = owner));
--   create policy infraction_images_public_read on storage.objects for select to public
--     using (bucket_id = 'infraction-images'::text);
--   create policy infraction_images_insert_own on storage.objects for insert to authenticated
--     with check ((bucket_id = 'infraction-images'::text) and ((storage.foldername(name))[1] = (auth.uid())::text));
-- =============================================================================

-- 1. Los dos buckets dejan de servir URLs públicas
update storage.buckets
   set public = false
 where id in ('evidencia-infracciones', 'infraction-images');

-- 2. Sin lectura pública ni subida para los buckets heredados
drop policy if exists "Lectura pública para todo el bucket" on storage.objects;
drop policy if exists "Usuarios autenticados suben sus evidencias" on storage.objects;
drop policy if exists infraction_images_public_read on storage.objects;
drop policy if exists infraction_images_insert_own on storage.objects;

-- 3. Control: los buckets quedaron privados, sin políticas que los nombren, y no se perdió ningún objeto
do $$
declare
  v_publicos  int;
  v_politicas int;
  v_objetos   int;
begin
  select count(*) into v_publicos
    from storage.buckets
   where id in ('evidencia-infracciones', 'infraction-images') and public;

  select count(*) into v_politicas
    from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and (coalesce(qual, '') ~ 'evidencia-infracciones|infraction-images'
          or coalesce(with_check, '') ~ 'evidencia-infracciones|infraction-images');

  select count(*) into v_objetos
    from storage.objects
   where bucket_id in ('evidencia-infracciones', 'infraction-images');

  if v_publicos <> 0 or v_politicas <> 0 then
    raise exception 'REP-3903: quedaron % buckets públicos y % políticas', v_publicos, v_politicas;
  end if;
  -- Informativo: en staging tienen que seguir siendo 48 (en una base local nueva, 0)
  raise notice 'REP-3903: % objetos en los buckets heredados, ninguno borrado', v_objetos;
end $$;
