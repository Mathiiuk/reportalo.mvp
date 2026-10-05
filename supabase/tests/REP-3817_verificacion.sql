-- REP-3817 · Verificación de la migración 20261005163523_rep3817_analisis_visual_cola_y_persistencia.sql
--
-- Se corre contra una base donde la migración YA está aplicada (o, para probarla sin dejar rastro, se corre la
-- migración y este script dentro de la misma transacción y se deshace todo).
-- NO deja nada: el bloque termina SIEMPRE con una excepción para que cualquier ejecutor revierta los cambios
-- (reportes, evidencias, mensajes de la cola y secrets de prueba). Si todo está bien, el mensaje de esa excepción
-- empieza con «REP-3817 OK». Cualquier otro mensaje es la verificación que falló.
--
-- Cubre los criterios de aceptación del ticket:
--   A1. Una fila nueva en report_images genera exactamente una unidad procesable.
--   A2. Los reintentos no generan análisis duplicados.
--   A3. Si falta el secret o falla el despacho, el flujo principal del reporte no se rompe.
--   A4. No se toca el circuito RAG (sus funciones y su cola siguen existiendo y la cola visual es otra).
--   RLS: dueño lee; otro ciudadano y anónimo no; el cliente no escribe ni ejecuta persist_visual_analysis.

do $$
declare
  v_uid uuid;
  v_other uuid := gen_random_uuid();
  v_service uuid;
  v_locality uuid;
  v_report uuid;
  v_img1 uuid;
  v_img2 uuid;
  v_id1 uuid;
  v_id2 uuid;
  n int;
  v_read_ct int;
  v_failed boolean;
  v_had_secrets boolean;
begin
  select id into v_uid from public.profiles limit 1;
  select id into v_service from public.services limit 1;
  select id into v_locality from public.localities limit 1;
  if v_uid is null or v_service is null or v_locality is null then
    raise exception 'REP-3817 PRECONDICION: la base necesita al menos un perfil, un servicio y una localidad';
  end if;

  insert into public.citizen_reports (client_side_id, user_id, service_id, locality_id, description, latitud, longitud)
  values (gen_random_uuid(), v_uid, v_service, v_locality, 'Reporte de prueba REP-3817 para el analisis visual', -34.6, -58.4)
  returning id into v_report;

  -- A1 · una fila nueva = exactamente una unidad procesable --------------------------------------------------
  insert into public.report_images (report_id, image_url) values (v_report, 'https://x.supabase.co/storage/v1/object/public/report-evidences/a/1.jpg') returning id into v_img1;
  select count(*) into n from pgmq.q_visual_analysis_queue where message ->> 'imageId' = v_img1::text;
  if n <> 1 then raise exception 'A1 FALLO: la evidencia generó % mensajes (esperado 1)', n; end if;

  insert into public.report_images (report_id, image_url) values (v_report, 'https://x.supabase.co/storage/v1/object/public/report-evidences/a/2.jpg') returning id into v_img2;
  select count(*) into n from pgmq.q_visual_analysis_queue where message ->> 'imageId' = v_img2::text;
  if n <> 1 then raise exception 'A1 FALLO: la segunda evidencia generó % mensajes (esperado 1)', n; end if;

  -- El mensaje lleva solo imageId y reportId (nada que la función deba creer del cliente)
  select count(*) into n from pgmq.q_visual_analysis_queue
   where message ->> 'imageId' = v_img1::text and (message - 'imageId' - 'reportId') = '{}'::jsonb;
  if n <> 1 then raise exception 'A1 FALLO: el mensaje trae campos de más'; end if;

  -- A4 · la cola del RAG es otra y sigue existiendo
  if to_regclass('pgmq.q_rag_analysis_queue') is null or to_regprocedure('public.enqueue_rag_analysis()') is null
     or to_regprocedure('public.persist_rag_analysis(jsonb, jsonb)') is null or to_regprocedure('public.dispatch_rag_analysis_queue()') is null then
    raise exception 'A4 FALLO: falta algún objeto del circuito RAG';
  end if;

  -- A2 · idempotencia: persistir dos veces la misma evidencia deja una sola fila ------------------------------
  v_id1 := public.persist_visual_analysis(jsonb_build_object(
    'image_id', v_img1, 'status', 'completado', 'scene_summary', 'Un bache en la calzada.', 'coherence', 'coincide',
    'quality_flags', jsonb_build_array('oscura'), 'confidence_score', 0.9, 'model_code', 'gemini-3.8-flash',
    'prompt_version', 'visual-v1', 'input_tokens', 1552, 'output_tokens', 99, 'latency_ms', 2500));
  v_id2 := public.persist_visual_analysis(jsonb_build_object(
    'image_id', v_img1, 'status', 'completado', 'scene_summary', 'OTRO texto que no debe pisar', 'coherence', 'no_coincide'));
  if v_id1 is null or v_id1 <> v_id2 then raise exception 'A2 FALLO: el segundo persist devolvió otro id'; end if;
  select count(*) into n from public.report_image_analysis where image_id = v_img1;
  if n <> 1 then raise exception 'A2 FALLO: hay % análisis para la misma evidencia', n; end if;
  if (select scene_summary from public.report_image_analysis where id = v_id1) <> 'Un bache en la calzada.' then
    raise exception 'A2 FALLO: el reintento pisó el resultado original';
  end if;
  if (select report_id from public.report_image_analysis where id = v_id1) <> v_report then
    raise exception 'A2 FALLO: el reporte no se tomó de la evidencia';
  end if;

  -- Restricciones de la tabla: valores fuera de contrato se rechazan
  begin
    insert into public.report_image_analysis (image_id, report_id, status, scene_summary, coherence)
    values (v_img2, v_report, 'completado', 'x', 'quizas');
    raise exception 'RESTRICCION FALLO: aceptó una coherencia inválida';
  exception when check_violation then null; end;
  begin
    insert into public.report_image_analysis (image_id, report_id, status) values (v_img2, v_report, 'completado');
    raise exception 'RESTRICCION FALLO: aceptó un completado sin resumen';
  exception when check_violation then null; end;
  begin
    insert into public.report_image_analysis (image_id, report_id, status, quality_flags) values (v_img2, v_report, 'omitido', array['inventada']);
    raise exception 'RESTRICCION FALLO: aceptó una marca de calidad inventada';
  exception when check_violation then null; end;
  begin
    perform public.persist_visual_analysis(jsonb_build_object('image_id', gen_random_uuid(), 'status', 'omitido'));
    raise exception 'RESTRICCION FALLO: aceptó una evidencia inexistente';
  exception when raise_exception then
    if sqlerrm not like '%no existe' then raise; end if;
  end;

  -- A3 · el despacho nunca rompe el flujo ---------------------------------------------------------------------
  -- (a) falla el encolado: se borra la cola y la evidencia igual se guarda
  perform pgmq.drop_queue('visual_analysis_queue');
  insert into public.report_images (report_id, image_url) values (v_report, 'https://x.supabase.co/storage/v1/object/public/report-evidences/a/3.jpg');
  perform pgmq.create('visual_analysis_queue');  -- la cola se restablece (todo se revierte igual al final)
  insert into public.report_images (report_id, image_url) values (v_report, 'https://x.supabase.co/storage/v1/object/public/report-evidences/a/4.jpg') returning id into v_img2;

  -- (b) sin secrets: no se despacha, no se consumen mensajes ni reintentos
  select count(*) > 0 into v_had_secrets from vault.decrypted_secrets where name in ('visual_analizar_imagen_url', 'visual_dispatch_token');
  if not v_had_secrets then
    perform public.dispatch_visual_analysis_queue();
    select read_ct into v_read_ct from pgmq.q_visual_analysis_queue where message ->> 'imageId' = v_img2::text;
    if v_read_ct is distinct from 0 then raise exception 'A3 FALLO: sin secrets se leyó la cola (read_ct=%)', v_read_ct; end if;
  else
    raise notice 'REP-3817: los secrets ya están cargados; se omite la comprobación «sin secrets»';
  end if;

  -- (c) con secrets de prueba (la URL no existe y la transacción se revierte: no sale ninguna llamada)
  if not exists (select 1 from vault.decrypted_secrets where name = 'visual_analizar_imagen_url') then
    perform vault.create_secret('http://localhost.invalid/analizar-imagen-reporte', 'visual_analizar_imagen_url');
  end if;
  if not exists (select 1 from vault.decrypted_secrets where name = 'visual_dispatch_token') then
    perform vault.create_secret('token-de-prueba-rep3817', 'visual_dispatch_token');
  end if;
  if not exists (select 1 from vault.decrypted_secrets where name = 'rag_service_role_key') then
    perform vault.create_secret('clave-de-prueba-rep3817', 'rag_service_role_key');
  end if;

  perform public.dispatch_visual_analysis_queue();
  select read_ct into v_read_ct from pgmq.q_visual_analysis_queue where message ->> 'imageId' = v_img2::text;
  if v_read_ct is distinct from 1 then raise exception 'A3 FALLO: con secrets el mensaje debía leerse una vez (read_ct=%)', v_read_ct; end if;

  -- (d) ya tiene resultado: el despachador borra el mensaje en vez de volver a llamar al modelo
  perform public.persist_visual_analysis(jsonb_build_object('image_id', v_img2, 'status', 'omitido', 'status_reason', 'prueba'));
  -- el mensaje se leyó en (c) y quedó invisible 90 s: se lo vuelve visible para esta comprobación
  update pgmq.q_visual_analysis_queue set vt = now() where message ->> 'imageId' = v_img2::text;
  perform public.dispatch_visual_analysis_queue();
  select count(*) into n from pgmq.q_visual_analysis_queue where message ->> 'imageId' = v_img2::text;
  if n <> 0 then raise exception 'A3 FALLO: el mensaje de una evidencia ya analizada seguía en la cola'; end if;

  -- (e) supera los reintentos: se archiva y queda un «fallido» (falla cerrada)
  insert into public.report_images (report_id, image_url) values (v_report, 'https://x.supabase.co/storage/v1/object/public/report-evidences/a/5.jpg') returning id into v_img2;
  for i in 1..3 loop perform pgmq.read('visual_analysis_queue', 0, 100); end loop;  -- sube read_ct sin despachar
  perform public.dispatch_visual_analysis_queue();                                  -- 4.º intento: > 3
  select count(*) into n from pgmq.q_visual_analysis_queue where message ->> 'imageId' = v_img2::text;
  if n <> 0 then raise exception 'A3 FALLO: el mensaje agotado seguía en la cola'; end if;
  select count(*) into n from pgmq.a_visual_analysis_queue where message ->> 'imageId' = v_img2::text;
  if n <> 1 then raise exception 'A3 FALLO: el mensaje agotado no se archivó (nunca se borra)'; end if;
  if (select status from public.report_image_analysis where image_id = v_img2) is distinct from 'fallido' then
    raise exception 'A3 FALLO: no quedó el estado fallido';
  end if;

  -- RLS y permisos -------------------------------------------------------------------------------------------
  -- dueño: ve su análisis
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.report_image_analysis where report_id = v_report;
  reset role;
  if n < 1 then raise exception 'RLS FALLO: el dueño no ve el análisis de su reporte'; end if;

  -- otro ciudadano: no ve nada
  perform set_config('request.jwt.claims', json_build_object('sub', v_other, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.report_image_analysis where report_id = v_report;
  reset role;
  if n <> 0 then raise exception 'RLS FALLO: otro ciudadano ve % análisis ajenos', n; end if;

  -- anónimo: sin acceso
  begin
    set local role anon;
    select count(*) into n from public.report_image_analysis;
    reset role;
    if n <> 0 then raise exception 'RLS FALLO: un anónimo ve análisis'; end if;
  exception when insufficient_privilege then reset role; end;

  -- el cliente no escribe ni ejecuta la persistencia
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_failed := false;
  begin
    insert into public.report_image_analysis (image_id, report_id, status) values (gen_random_uuid(), v_report, 'omitido');
    v_failed := true;
  exception when insufficient_privilege then null; end;
  begin
    update public.report_image_analysis set scene_summary = 'pisado' where report_id = v_report;
    v_failed := true;
  exception when insufficient_privilege then null; end;
  begin
    perform public.persist_visual_analysis('{}'::jsonb);
    v_failed := true;
  exception when insufficient_privilege then null; end;
  begin
    perform public.dispatch_visual_analysis_queue();
    v_failed := true;
  exception when insufficient_privilege then null; end;
  reset role;
  if v_failed then raise exception 'RLS FALLO: el cliente pudo escribir o ejecutar una función de servidor'; end if;

  raise exception 'REP-3817 OK: A1 (una unidad por evidencia), A2 (idempotencia), A3 (sin secrets, con secrets, ya analizada, agotada, falla de encolado), A4 (RAG intacto) y RLS verificados. Todo se revierte.';
end $$;
