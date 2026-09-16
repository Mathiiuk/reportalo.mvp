-- REP-2908-VERIF ronda 5, R5-02: storage.objects tenia politicas `to public`
-- (cualquiera, aun sin sesion) que permitian leer/reemplazar/borrar fotos
-- SIN anonimizar en 'evidence-quarantine' y subir/reemplazar/borrar
-- evidencia publica en 'report-evidences'. Deja sin efecto la anonimizacion
-- de servidor (ADR-013) y esta ligado a REP-2405.
--
-- Precondiciones verificadas contra el codigo real (grep, 16/09):
--   1. quarantine-anonymize usa SUPABASE_SERVICE_ROLE_KEY (index.ts:195-198):
--      lee/mueve/borra con clave de servidor. OK.
--   2. El navegador solo sube a cuarentena, con sesion iniciada
--      (quarantinePipelineService.js: supabase.storage del cliente logueado). OK.
--   3. La subida usaba `upsert: true` -- se saco en el mismo cambio
--      (quarantinePipelineService.js), porque el path ya es unico por
--      clientSideId + timestamp y nunca deberia colisionar. Sin upsert,
--      la politica de solo-INSERT alcanza.
--
-- Repetible: dropea antes de crear.
begin;

-- Cuarentena: el ciudadano solo sube, y con sesion. Leer, mover y borrar lo
-- hace la funcion quarantine-anonymize con clave de servidor.
drop policy if exists "Permitir lectura transitoria de cuarentena"        on storage.objects;
drop policy if exists "Permitir actualizacion transitoria en cuarentena"  on storage.objects;
drop policy if exists "Permitir purga de cuarentena"                      on storage.objects;
drop policy if exists "Permitir subida transitoria a cuarentena"          on storage.objects;
drop policy if exists "Subida a cuarentena con sesion"                    on storage.objects;
create policy "Subida a cuarentena con sesion" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'evidence-quarantine');

-- Evidencias anonimizadas: lectura publica se mantiene; escritura SOLO
-- desde el servidor (quarantine-anonymize, con clave de servicio).
drop policy if exists "Permitir subida de evidencias protegidas"        on storage.objects;
drop policy if exists "Permitir actualizacion de evidencias protegidas" on storage.objects;
drop policy if exists "Permitir eliminacion de evidencias protegidas"   on storage.objects;
-- "Lectura publica de evidencias anonimizadas" se mantiene sin cambios.

commit;
