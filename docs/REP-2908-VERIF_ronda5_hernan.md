# Reportalo

*Plataforma de Auditoría Ciudadana*

## VERIFICACIÓN DEL RAG — QUINTA RONDA: REVISIÓN DEL CÓDIGO REAL, PRIVACIDAD Y CIERRE DE TICKETS

**Versión 1.0 · 16 de septiembre de 2026 · Proyecto RAR-2026**

**Responde a:** `REP-2908-VERIF_estado-actual-RAG-2026-09-16.md` (Matías, 16/09)
**Base de la revisión:** código de la rama `staging` al 16/09, leído archivo por archivo:
- `supabase/functions/analizar-reporte/index.ts`
- `supabase/schema.sql`, `supabase/seed.sql`, `supabase/rag_normativas.sql`, `supabase/rag_knowledge_schema.sql`, `supabase/rag_rls_policies.sql`
- `.gitignore`
- la Guía de Replicación y Continuidad del Sistema
- 7 migraciones:
  - `20260914205949_add_rls_policies_report_images`
  - `20260915003000_add_rag_dispatch_retry_limit_and_cleanup`
  - `20260915140000_v09_match_knowledge_fragments_filter_by_category`
  - `20260915141500_v08_ronda2_max_retries_3_and_fix_archive_insert`
  - `20260915200000_fix_states_provinces_missing_rls_policy`
  - `20260916010000_p04_rls_lectura_14_tablas`
  - `20260916020000_p02_status_reason`

**Jira:** [REP-2908](https://unlz2026.atlassian.net/browse/REP-2908) · [REP-3772](https://unlz2026.atlassian.net/browse/REP-3772) · [REP-2900](https://unlz2026.atlassian.net/browse/REP-2900) · [REP-2901](https://unlz2026.atlassian.net/browse/REP-2901) · [REP-2909](https://unlz2026.atlassian.net/browse/REP-2909) · [REP-3775](https://unlz2026.atlassian.net/browse/REP-3775) · [REP-3776](https://unlz2026.atlassian.net/browse/REP-3776) · [REP-3777](https://unlz2026.atlassian.net/browse/REP-3777) · [REP-3774](https://unlz2026.atlassian.net/browse/REP-3774) · [REP-2500](https://unlz2026.atlassian.net/browse/REP-2500) · [REP-2405](https://unlz2026.atlassian.net/browse/REP-2405) · [REP-3773](https://unlz2026.atlassian.net/browse/REP-3773) · [REP-3769](https://unlz2026.atlassian.net/browse/REP-3769)
**Archivos de apoyo (carpeta Drive del proyecto):** https://drive.google.com/drive/folders/1JJ6T0Y2MhhzONvaffT8PN7j34lTJjoe9
- `REP-3769_seed_y_RAG.sql`
- `REP-3764_casos_esperados.md`
- `REP-2908-VERIF_ronda4_hernan.md`

**Equipo:** Hernán Gregorini (PO · DBA) · Leonel Nuñez (PM / Scrum Master) · Matías Krepchuk (Líder Técnico · UX/UI) · Iván Juárez (QA · UX/UI)

---

## 0. Reglas para quien ejecute este documento (persona o agente)

1. **Este documento es la única fuente de instrucciones.** Si algo no está acá o no está claro, se le pregunta a Matías. No se completa por intuición.
2. **Nunca se escribe una clave en ningún lado:** ni archivos, ni commits, ni capturas, ni chat. Las consultas devuelven nombres o conteos, nunca valores ni datos personales.
3. **Primero se corre la sección 2** (consultas de solo lectura). Varias correcciones dependen de su resultado.
4. **Todo cambio de base va por migración y PR contra `staging`.** La parte de base la revisa Hernán **antes** del merge.
5. **Los cambios de Storage, permisos y la cola se prueban antes en el proyecto descartable** (`reportalo-p08-verificacion-descartable`) y recién después se aplican a CiudadAR.
6. **Nada se borra sin el OK escrito de Hernán:** ni datos ni reportes. Quitar una política de permisos sí se puede, porque es una corrección y va por PR.
7. **Si un nombre real difiere del de este documento, se usa el real y se anota la diferencia.**
8. **Las marcas de este documento significan:**
   - **[ESCRIBE]**: la consulta modifica algo;
   - **[DECISIÓN HERNÁN]**: no se aplica hasta que Hernán confirme;
   - **[PRECONDICIÓN]**: hay que comprobarlo antes de aplicar el cambio.

---

## 1. Resumen

**El código del RAG está casi todo hecho.** En `staging` están:
- el filtro por categoría;
- el guardado del motivo (`status_reason`);
- los permisos de P-04;
- el tope de tokens y la suma de los tokens de razonamiento;
- el máximo de 3 reintentos y la limpieza de la tarea programada;
- las tres validaciones de REP-3772.

**Lo que todavía no está probado:** las 37 corridas de P-01, que esté desplegada la versión que guarda el motivo, la reconstrucción de la base (P-08) y un caso de falla controlada de la cola.

**Lo más importante de esta ronda no es el RAG: es privacidad.** Las políticas de `schema.sql`, y lo que dicen los comentarios de las migraciones, permiten que **cualquier persona, aun sin sesión**:
- lea, reemplace y borre fotos **sin anonimizar** en el bucket de cuarentena;
- suba, reemplace y borre la evidencia pública;
- asocie cualquier imagen a cualquier reporte;
- cree reportes a nombre de otro usuario, disparando además costo de Gemini;
- lea todos los reportes junto con el `user_id` de quien reportó.

**Si la sección 2 confirma que eso está aplicado en CiudadAR, es prioridad 1**, por encima del resto. Deja sin efecto la anonimización en servidor (ADR-013) y está directamente ligado a REP-2405 ("Impedir persistencia de la imagen original").

**Orden de trabajo:**

| Orden | Qué | Prioridad |
|---|---|---|
| 1 | R5-01 Consultas de estado real | P1, hoy |
| 2 | R5-02, R5-03, R5-04 Privacidad y abuso | P1, hoy si la consulta lo confirma |
| 3 | R5-05, R5-06 Función de análisis y cola | P1 |
| 4 | R5-07 Despliegue de P-02 y P-06 | P1 |
| 5 | R5-08 Corridas P-01 | P1 |
| 6 | R5-09 Migraciones y guía de replicación | P1 |
| 7 | R5-10, R5-11 Alerta, contraseñas y permisos de funciones | P1 (minutos) |
| 8 | R5-12, R5-13 Datos de prueba y pendientes menores | P2 |

---

## 2. R5-01 · Estado real aplicado en CiudadAR — P1, primero

Son consultas de solo lectura, sin datos personales en la salida. **Se manda la salida completa de cada una.**

```sql
-- C1) Migraciones aplicadas de verdad
select version, name from supabase_migrations.schema_migrations order by version;

-- C2) Todo lo que puede hacer un visitante sin sesión, incluido Storage
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname in ('public','storage') and ('anon' = any(roles) or 'public' = any(roles))
order by 1, 2, 3;

-- C3) Todas las políticas de las tablas del reporte y de las fotos (cualquier rol)
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public' and tablename in ('citizen_reports','report_images')
order by 1, 2;

-- C4) P-04 aplicado
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename in ('countries','service_attributes','service_attribute_values','agencies',
                    'report_state_history','report_events','profiles','infraction_attribute_responses')
order by 1, 2;

-- C5) Quién puede ejecutar las funciones del RAG (con su firma)
select p.proname, pg_get_function_identity_arguments(p.oid) as firma, p.prosecdef as definer,
       has_function_privilege('anon', p.oid, 'execute') as anon,
       has_function_privilege('authenticated', p.oid, 'execute') as con_sesion
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('match_knowledge_fragments','pgmq_delete_message','dispatch_rag_analysis_queue',
                    'enqueue_rag_analysis','profile_attends_report','mark_report_viewed')
order by 1;

-- C6) Nulos y unicidad de report_ai_analysis (define cómo se corrige R5-06)
select column_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'report_ai_analysis'
  and column_name in ('report_id','is_infraction','confidence_score','embedding_model_code','result_status_code');

select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.report_ai_analysis'::regclass and contype in ('u','p');

-- C7) Resultados y motivos guardados
select result_status_code, count(*) as analisis, count(status_reason) as con_motivo
from public.report_ai_analysis group by 1 order by 1;

-- C8) ¿Quedaron fotos originales en cuarentena? (REP-2405) — solo conteos y fechas
select count(*) as objetos, min(created_at) as mas_viejo, max(created_at) as mas_nuevo
from storage.objects where bucket_id = 'evidence-quarantine';

-- C9) Reportes por día y por rol de quien los creó (para identificar datos de prueba)
select date(r.created_at) as dia, coalesce(p.role, 'sin perfil') as rol, count(*)
from public.citizen_reports r
left join public.profiles p on p.id = r.user_id
group by 1, 2 order by 1, 2;
```

**Del panel de Supabase, a mano:**
- **Edge Functions → `analizar-reporte`:** versión activa y fecha de despliegue.
- **Edge Functions → `quarantine-anonymize`:** versión activa.
- **Authentication:** estado de la protección de contraseñas filtradas.

**Del repositorio**, para las precondiciones de R5-02 a R5-04:

```bash
# ¿Quién escribe report_images y con qué cliente?
grep -rn "report_images" src/ supabase/functions/
# ¿Cómo se suben las fotos? (¿usa upsert? ¿con sesión?)
grep -rn "evidence-quarantine\|report-evidences" src/ supabase/functions/
# ¿Cómo lee el mapa los reportes? (¿select * o columnas explícitas? ¿usa user_id?)
grep -rn "from('citizen_reports')" src/
```

**Se cierra cuando** se manda la salida completa de C1 a C9, los tres datos del panel y la salida de los tres `grep`.

---

## 3. Privacidad y abuso — P1

### R5-02 · Storage: fotos originales y evidencia — P1

**Qué dice el código.** `schema.sql` define estas políticas sobre `storage.objects`, todas **`TO public`** (cualquiera, aun sin sesión):

| Bucket | Qué permite a cualquiera | Riesgo |
|---|---|---|
| `evidence-quarantine` (fotos **sin anonimizar**) | Subir, **leer**, modificar y **borrar** | Que el bucket sea "privado" solo quita el enlace público. Con estas políticas, igual se pueden listar y bajar desde la API. Las fotos con caras y patentes quedan accesibles mientras estén ahí, y para siempre si la anonimización falla |
| `report-evidences` (evidencia pública) | **Subir**, modificar y borrar | Alguien puede subir una foto sin difuminar directo al bucket público, o reemplazar o borrar una ya anonimizada. Deja sin efecto ADR-013 |

**[PRECONDICIÓN]** Antes de aplicar, comprobar con los `grep` de la sección 2:
1. Que `quarantine-anonymize` lea, mueva y borre usando la **clave de servidor**, no el cliente del navegador.
2. Que el navegador **solo suba** a cuarentena y **con sesión iniciada**. Si sube sin sesión, avisar antes de aplicar.
3. Que la subida **no use `upsert: true`**. Si lo usa, necesita también permiso de actualización: avisar antes de aplicar.

**Corrección propuesta [ESCRIBE, por migración, probada primero en el proyecto descartable]:**

```sql
begin;

-- Cuarentena: el ciudadano solo sube, y con sesión. Leer, mover y borrar lo hace la función con clave de servidor.
drop policy if exists "Permitir lectura transitoria de cuarentena"        on storage.objects;
drop policy if exists "Permitir actualizacion transitoria en cuarentena"  on storage.objects;
drop policy if exists "Permitir purga de cuarentena"                      on storage.objects;
drop policy if exists "Permitir subida transitoria a cuarentena"          on storage.objects;
create policy "Subida a cuarentena con sesion" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'evidence-quarantine');

-- Evidencias anonimizadas: lectura pública; escritura SOLO desde el servidor.
drop policy if exists "Permitir subida de evidencias protegidas"        on storage.objects;
drop policy if exists "Permitir actualizacion de evidencias protegidas" on storage.objects;
drop policy if exists "Permitir eliminacion de evidencias protegidas"   on storage.objects;
-- "Lectura publica de evidencias anonimizadas" se mantiene.

commit;
```

**Además:** actualizar `schema.sql` para que no vuelva a crear estas políticas si alguien sigue la guía de replicación.

**Pruebas y evidencia a mandar:**
1. **Salida de C2** después de aplicar: no queda ninguna política de escritura para `public` o `anon` en `report-evidences`, ni de lectura, modificación o borrado en `evidence-quarantine`.
2. **Prueba negativa sin sesión**, con la clave pública. Listar y bajar un archivo de `evidence-quarantine` y subir un archivo a `report-evidences` tiene que devolver **error de permiso**. Se manda el código de error, sin URLs firmadas.
3. **Prueba positiva:** un reporte con foto de punta a punta (subida → anonimización → evidencia pública → reporte guardado) sigue funcionando. Se manda una captura de la foto difuminada **sin datos personales**.
4. **C8 antes y después:** si hay objetos viejos en cuarentena, es evidencia para REP-2405. **No se borran sin el OK de Hernán.**

---

### R5-03 · `report_images`: cualquiera puede asociar imágenes — P1

**Qué dice el código.** La migración `20260914205949` crea `insert_publico` con `with check (true)` para `public`. Cualquiera puede registrar cualquier `image_url`, incluso una externa sin anonimizar, sobre cualquier reporte.

**Corrección según quién escribe la tabla** (el `grep` de la sección 2 lo dice):

- **Si la escribe la función de anonimización con la clave de servidor** (lo esperado por ADR-013):

  ```sql
  -- [ESCRIBE, por migración]
  drop policy if exists "insert_publico" on public.report_images;
  ```

- **Si la escribe el navegador:**

  ```sql
  -- [ESCRIBE, por migración]
  drop policy if exists "insert_publico" on public.report_images;
  create policy "insert own report image" on public.report_images
    for insert to authenticated
    with check (exists (select 1 from public.citizen_reports r
                        where r.id = report_id and r.user_id = (select auth.uid())));
  ```

  En este caso, además, se crea un ticket para que la escritura pase al servidor, como pide ADR-013.

**Evidencia:**
- salida de C3 después de aplicar;
- prueba sin sesión: insertar en `report_images` falla;
- el reporte con foto de R5-02 sigue funcionando.

---

### R5-04 · `citizen_reports`: inserción y lectura públicas — P1

**Qué sabemos.** El comentario de la migración de `report_images` dice que copia "el mismo patrón que `citizen_reports` (insert_publico / lectura_publica)". Esas políticas **no están en ningún archivo del repositorio**: se aplicaron directo en la base. C3 lo confirma.

**Si C3 confirma `insert_publico` con `with check (true)`:**
- **Se puede suplantar a otro usuario:** un visitante sin sesión puede crear reportes con cualquier `user_id`.
- **Hay un riesgo de costo:** cada inserción dispara un análisis de Gemini. El captcha protege la pantalla, no la API.

**Corrección de la inserción [ESCRIBE, por migración]:**

**[PRECONDICIÓN]** La app envía los reportes con sesión iniciada y con `user_id` igual al usuario de la sesión (incluida la sincronización sin conexión).

```sql
drop policy if exists "insert_publico" on public.citizen_reports;
create policy "insert own report" on public.citizen_reports
  for insert to authenticated
  with check (user_id = (select auth.uid()));
```

**Evidencia:**
- prueba sin sesión: insertar falla;
- prueba con sesión y el `user_id` de otro usuario: falla;
- prueba con sesión y el `user_id` propio: funciona y dispara el análisis;
- un reporte creado sin conexión y sincronizado después se guarda bien.

**Lectura pública [DECISIÓN HERNÁN — no aplicar].** Si `lectura_publica` expone todas las columnas, cualquiera ve `user_id` junto a coordenadas exactas y puede vincular reportes con personas. Hernán decide el diseño. Opción candidata: permisos por columna para visitantes sin sesión (el mapa público no necesita `user_id`). Requiere que el mapa pida columnas explícitas, no `select *`:

```sql
-- NO APLICAR sin OK de Hernán y sin revisar la consulta del mapa
-- revoke select on public.citizen_reports from anon;
-- grant select (id, service_id, locality_id, latitud, longitud, description, current_state_code, created_at)
--   on public.citizen_reports to anon;
```

**Qué mandar para la decisión:**
- la salida del `grep` de la consulta del mapa;
- si el mapa funciona sin sesión o con sesión.

---

## 4. Función de análisis y cola — P1

### R5-05 · `analizar-reporte` confía en lo que le mandan — P1 (REP-3775)

**Qué dice el código.** La función:
- solo exige un token de sesión válido (`verify_jwt: true`);
- no verifica que la llame el despacho de la cola;
- toma `reportId`, `description`, `category` y `localityId` **del cuerpo del pedido**.

Cualquier usuario con sesión puede llamarla con un texto inventado: genera costo de Gemini y, si el reporte todavía no tiene análisis, **deja guardado un análisis con un fundamento armado por él**.

**Corrección:**

1. **Aceptar solo al despacho de la cola.** Usar un secreto propio, más simple y estable que comparar claves de servidor:
   - un secreto de Edge Functions `RAG_DISPATCH_TOKEN` y un secreto de Vault `rag_dispatch_token`, con el mismo valor (**solo se documentan los nombres**);
   - `dispatch_rag_analysis_queue` lo manda en el encabezado `x-rag-dispatch-token` (ver R5-06);
   - la función lo verifica al principio:

   ```ts
   const dispatchToken = Deno.env.get('RAG_DISPATCH_TOKEN') || '';
   if (!dispatchToken || req.headers.get('x-rag-dispatch-token') !== dispatchToken) {
     return new Response(JSON.stringify({ error: 'No autorizado.' }),
       { status: 403, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
   }
   ```

2. **Leer el reporte desde la base, no desde el pedido.** Con `reportId`, se busca en `citizen_reports`, con la clave de servidor, la descripción, la categoría (`services.service_code`) y la localidad. Lo que venga en el cuerpo para esos campos se ignora.

   ```ts
   const { data: report, error: reportError } = await supabaseAdmin
     .from('citizen_reports')
     .select('description, locality_id, services(service_code)')
     .eq('id', payload.reportId)
     .single();
   // si reportError o !report: 404, sin llamar a Gemini y sin persistir
   ```

3. **El panel local de pruebas** usa la misma cabecera. El valor se carga desde el entorno local, nunca en código.

**Evidencia:**
- llamada con una sesión de ciudadano, sin el token: **403** y ninguna fila nueva en `report_ai_analysis`;
- el recorrido de punta a punta de V-07 sigue funcionando: un reporte nuevo queda analizado;
- versión desplegada de la función.

---

### R5-06 · Un mensaje fallido puede bloquear toda la cola — P1 (REP-3776 y REP-3777)

**Qué dice el código.**
1. **El guardado no es atómico.** `persistAnalysis` hace dos inserciones separadas: el análisis y después la evidencia. El comentario del archivo dice "dentro de una transacción", pero el código no lo es.
2. **Si falla la evidencia,** el análisis queda guardado y el mensaje se reintenta. Cada reintento vuelve a insertar el análisis. Si `report_id` es único (C6), choca siempre y el mensaje nunca se borra.
3. **Al superar los 3 intentos,** `dispatch_rag_analysis_queue` inserta un `indeterminado` **sin manejar el conflicto** y con `is_infraction` nulo. Si ese insert falla, el error **aborta toda la corrida**: se repite cada minuto y **ningún otro reporte se analiza**.
4. **El mismo tipo de error que tuvo `embedding_model_code`** puede estar pasando con `is_infraction` y `confidence_score`. El modelo aprobado dice que no aceptan nulos, y el código los manda nulos en los errores técnicos. C6 lo confirma o lo descarta.

**Corrección — parte A: guardado atómico [ESCRIBE, por migración].**

**[PRECONDICIÓN]** C6 muestra una restricción única sobre `report_id`. Si no existe, avisar: sin esa restricción puede haber análisis duplicados, y se agrega aparte con el OK de Hernán.

```sql
create or replace function public.persist_rag_analysis(p_analysis jsonb, p_evidence jsonb)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into report_ai_analysis (
    report_id, result_status_code, is_infraction, suggested_service_id, suggested_agency_id,
    citizen_feedback, official_legal_foundation, confidence_score, embedding_model_code,
    generation_model_code, prompt_version, input_tokens, output_tokens, latency_ms, status_reason)
  select a.report_id, a.result_status_code, a.is_infraction, a.suggested_service_id, a.suggested_agency_id,
         a.citizen_feedback, a.official_legal_foundation, a.confidence_score, a.embedding_model_code,
         a.generation_model_code, a.prompt_version, a.input_tokens, a.output_tokens, a.latency_ms, a.status_reason
  from jsonb_populate_record(null::public.report_ai_analysis, p_analysis) a
  on conflict (report_id) do nothing
  returning id into v_id;

  if v_id is null then
    -- Ya existía un análisis para ese reporte: no se duplica ni se pisa.
    select id into v_id from report_ai_analysis where report_id = (p_analysis ->> 'report_id')::uuid;
    return v_id;
  end if;

  insert into report_ai_evidence (analysis_id, fragment_id, rank, similarity, was_cited, quoted_text)
  select v_id, e.fragment_id, e.rank, e.similarity, e.was_cited, e.quoted_text
  from jsonb_to_recordset(coalesce(p_evidence, '[]'::jsonb))
       as e(fragment_id uuid, rank int, similarity numeric, was_cited boolean, quoted_text text);

  return v_id;  -- todo en una sola transacción: o se guardan los dos, o ninguno
end;
$$;

revoke execute on function public.persist_rag_analysis(jsonb, jsonb) from public, anon, authenticated;
grant  execute on function public.persist_rag_analysis(jsonb, jsonb) to service_role;
```

**En `index.ts` y en `reportAiAnalysisPersistence.js`:**
- reemplazar las dos inserciones por `supabaseAdmin.rpc('persist_rag_analysis', { p_analysis: analysisRow, p_evidence: evidenceRows })`, con las filas de evidencia sin `analysis_id`;
- borrar el mensaje de la cola **solo si el RPC no devolvió error**, aunque el análisis ya existiera;
- si C6 muestra que `is_infraction` o `confidence_score` no aceptan nulos, en los errores técnicos guardar `false` y `0`. El estado `indeterminado` y `status_reason` ya indican que no se determinó.

**Corrección — parte B: despacho que no se bloquea [ESCRIBE, por migración].** Reemplaza la versión de `20260915141500` y agrega el encabezado de R5-05:

```sql
create or replace function public.dispatch_rag_analysis_queue()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  msg record;
  function_url text;
  service_role_key text;
  dispatch_token text;
  max_retries constant int := 3;
begin
  select decrypted_secret into function_url     from vault.decrypted_secrets where name = 'rag_analizar_reporte_url';
  select decrypted_secret into service_role_key from vault.decrypted_secrets where name = 'rag_service_role_key';
  select decrypted_secret into dispatch_token   from vault.decrypted_secrets where name = 'rag_dispatch_token';

  if function_url is null or service_role_key is null or dispatch_token is null then
    raise notice 'Faltan secrets en Vault (rag_analizar_reporte_url / rag_service_role_key / rag_dispatch_token).';
    return;
  end if;

  for msg in select * from pgmq.read('rag_analysis_queue', 90, 20) loop
    begin  -- cada mensaje aislado: un error no corta la corrida
      if msg.read_ct > max_retries then
        perform pgmq.archive('rag_analysis_queue', msg.msg_id);
        begin
          insert into public.report_ai_analysis (
            report_id, result_status_code, is_infraction, citizen_feedback, official_legal_foundation,
            confidence_score, embedding_model_code, status_reason)
          values (
            (msg.message ->> 'reportId')::uuid, 'indeterminado', false,
            'El análisis legal está en revisión.',
            null, 0,
            (select code from public.embedding_models where is_active),
            format('Se superó el límite de %s reintentos; mensaje archivado (msg_id=%s).', max_retries, msg.msg_id))
          on conflict (report_id) do nothing;
        exception when others then
          raise warning 'dispatch_rag_analysis_queue: no se pudo registrar el indeterminado de msg_id=%: %', msg.msg_id, sqlerrm;
        end;
      else
        perform net.http_post(
          url := function_url,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || service_role_key,
            'x-rag-dispatch-token', dispatch_token),
          body := msg.message || jsonb_build_object('queueMessageId', msg.msg_id));
      end if;
    exception when others then
      raise warning 'dispatch_rag_analysis_queue: msg_id=% falló: %', msg.msg_id, sqlerrm;
    end;
  end loop;
end;
$$;

revoke execute on function public.dispatch_rag_analysis_queue() from public, anon, authenticated;
```

**Notas de esta versión:**
- **`is_infraction`:** si C6 muestra que acepta nulos y se prefiere `null` para "no determinado", se usa `null` y se avisa.
- **Modelo:** el código del modelo se lee de `embedding_models`, no queda escrito fijo.
- **Motivo:** va a `status_reason`, no a `official_legal_foundation`.

**Pruebas en el proyecto descartable (no en CiudadAR). Evidencia a mandar:**
1. **Falla controlada** (pedida por REP-3776): encolar un mensaje con un `reportId` inexistente. Después de 3 intentos queda archivado, y **un reporte válido encolado después se analiza igual**. Mandar los conteos de `pgmq.q_rag_analysis_queue` y `pgmq.a_rag_analysis_queue`, y la fila del reporte válido.
2. **Reintento sin duplicado:** llamar dos veces a la función con el mismo reporte. Queda **una** fila en `report_ai_analysis`, la evidencia no se duplica y el mensaje se borra.
3. **Atomicidad:** forzar un error en la evidencia (por ejemplo, un `fragment_id` inexistente en una prueba directa del RPC). **No queda** análisis sin evidencia.

---

### R5-07 · Desplegar P-02 y P-06 — P1

El código está en `staging` (PR #71), pero el estado del 16/09 dice que no estaba desplegado y que las 49 filas tienen el motivo vacío.

1. Desplegar `analizar-reporte` con R5-05 y R5-06 incluidos.
2. Generar al menos **un análisis de cada estado** que produzca el código. Para `indeterminado` por error técnico, alcanza con una prueba en el proyecto descartable.
3. Correr C7.

**Evidencia:**
- versión desplegada y fecha;
- salida de C7 donde los `indeterminado` por error técnico tengan motivo;
- tokens de salida de un análisis nuevo, mayores que antes porque ahora incluyen los de razonamiento.

**[DECISIÓN HERNÁN]** El modelo también declara `indeterminado` por su cuenta, y el catálogo dice "error o validación fallida". Propuesta de nueva descripción, a aplicar solo con OK:

```sql
-- update public.ai_result_statuses
--   set description = 'No se emite fundamento: validación fallida, error técnico o la normativa recuperada no alcanza para determinar'
--   where code = 'indeterminado';
```

**Regla de qué ve cada rol** (propuesta de la ronda 4, pendiente de confirmación de Hernán):
- con `indeterminado`, el ciudadano ve "El análisis legal está en revisión", sin citas;
- el organismo ve el motivo y lo recuperado.

---

## 5. Evidencia de calidad — P1

### R5-08 · Corridas P-01 con el filtro — P1 (cierra REP-2908, REP-3772 y REP-2900)

Igual que en la ronda 4 (5 corridas por caso y 2 pruebas de categoría mal elegida), **más un caso nuevo**:

| Caso | Texto | Jurisdicción | Categoría | Esperado |
|---|---|---|---|---|
| A | Boca de tormenta rota | Avellaneda | INFRAESTRUCTURA | LOM 52/59 |
| B | Auto sobre la rampa | CABA | TRANSITO | Ley 2148 art. 7.1.9 + Ley 451 |
| C | Auto sobre la rampa | Avellaneda | TRANSITO | Ley 24.449; nada de CABA |
| D-Av | No anda la luz | Avellaneda | INFRAESTRUCTURA | LOM 52 |
| D-CABA | No anda la luz | CABA | INFRAESTRUCTURA | Ley 210 art. 2 inc. b) |
| E | Discuten y frenan el tránsito | Avellaneda | TRANSITO | Ley 24.449; no el Código de Faltas |
| **E-sin-categoría (nuevo)** | Discuten y frenan el tránsito | Avellaneda | **ninguna** (`null`) | Ley 24.449; **no citar** el Código de Faltas |
| Prueba 1 | Auto sobre la rampa | CABA | INFRAESTRUCTURA (mal elegida) | `sin_normativa` |
| Prueba 2 | Venta ambulante | Avellaneda | TRANSITO (mal elegida) | **No** citar el art. 48 inc. t) |

**Por qué el caso nuevo.** El Código de Faltas (el distractor) no tiene categoría, así que con el filtro nunca se recupera y los casos A y E ya no prueban nada sobre él. Sin categoría, el distractor vuelve a competir.

**Cómo correrlas.** Directo contra la función, con el token de R5-05, en CiudadAR o en el proyecto descartable. **No** se insertan como reportes en CiudadAR (ver R5-12).

**Qué mandar:**
- una tabla por corrida con estado, citas, lista recuperada (posición, fragmento, similitud) y `status_reason`;
- el resumen X de 5 por caso;
- `prompt_version` y la versión de la función.

**Se cierra cuando:**
- **(excluyente)** no hay ninguna cita aceptada fuera de lo recuperado ni ninguna cita no literal;
- C nunca recupera normas de CABA;
- B y D-CABA nunca recuperan la Ley 24.449;
- la prueba 2 no cita el art. 48 inc. t);
- E-sin-categoría no cita el Código de Faltas.

---

## 6. Reproducibilidad — P1

### R5-09 · Desfasaje de migraciones y guía de replicación — P1 (P-08)

**Qué dice el código:**
1. **Migraciones en el repositorio con otra versión que en la base.** El archivo `20260915200000_fix_states_provinces_missing_rls_policy.sql` figura en la base como `20260916000654` (lo dice el propio comentario de la migración P-04), y **no es repetible**: no tiene `drop policy if exists`. Un `db push` fallaría.
2. **Políticas aplicadas sin archivo:** las de `citizen_reports` (R5-04) no están en ningún archivo.
3. **La guía de replicación arma el sistema viejo:**
   - su sección 4 manda correr `schema.sql` (Sprint 10), `seed.sql` y `rag_normativas.sql` (tabla `normativas` y `match_normativas`);
   - no menciona las migraciones, el corpus nuevo, la cola, los secretos ni el despliegue de `analizar-reporte`;
   - sus enlaces apuntan a una carpeta local (`file:///d:/…`) que nadie más tiene.

**Qué hacer:**
1. **Comparar** con `supabase migration list`, que muestra local contra remoto.
2. **Por cada diferencia:**
   - si está aplicada en la base y no hay archivo, crear el archivo con **la misma versión y nombre** del remoto (el SQL aplicado está en `supabase_migrations.schema_migrations.statements`);
   - si el archivo existe con otra versión, renombrarlo a la versión remota o usar `supabase migration repair`. **Nunca volver a ejecutar SQL ya aplicado.**
3. **Hacer repetibles** las migraciones que no lo son (`drop policy if exists` antes de `create policy`).
4. **Versionar como migración** las políticas actuales de `citizen_reports` y las de Storage, ya corregidas en R5-02 a R5-04.
5. **Reconstruir en el proyecto descartable:**
   - `supabase db push`;
   - PARTES 2 a 7 de `REP-3769_seed_y_RAG.sql` (Drive);
   - script de embeddings;
   - secretos por nombre;
   - despliegue de las funciones;
   - PARTE 8.
6. **Reescribir la sección 4 de la guía de replicación** con ese mismo orden:
   - marcar `schema.sql`, `seed.sql` y `rag_normativas.sql` como **históricos** (o quitarlos);
   - listar los nombres de todos los secretos: `GEMINI_API_KEY`, `RAG_DISPATCH_TOKEN`, `rag_analizar_reporte_url`, `rag_service_role_key`, `rag_dispatch_token`;
   - usar enlaces relativos del repositorio, no rutas locales.
7. **Borrar el proyecto descartable** al terminar R5-06 y este punto.

**Evidencia:**
- salida de `supabase migration list` con todas las filas coincidiendo;
- PARTE 8 del proyecto descartable en `OK`;
- enlace al PR de la guía actualizada;
- confirmación de que el proyecto descartable se borró.

---

## 7. Pendientes cortos

### R5-10 · Alerta de presupuesto y protección de contraseñas — P1

Son tareas de consola, de cinco minutos cada una. Mandar las capturas: el monto de la alerta sin la clave, y el control de contraseñas activado (o el aviso de que el plan no lo permite).

### R5-11 · Permisos de ejecución de funciones — P1

La migración V-09 recreó `match_knowledge_fragments` y solo le quitó el permiso a `public`. En Supabase, visitantes sin sesión y usuarios con sesión suelen recibirlo igual. El contrato decía "solo el servidor". Si C5 muestra `true` en `anon` o `con_sesion`:

```sql
-- [ESCRIBE, por migración]
revoke execute on function public.match_knowledge_fragments(vector, uuid, character varying, integer, text) from anon, authenticated;
grant  execute on function public.match_knowledge_fragments(vector, uuid, character varying, integer, text) to service_role;
-- Mismo tratamiento para pgmq_delete_message, usando la firma exacta que devuelve C5.
```

**Evidencia:** C5 después, con `false` en `anon` y `con_sesion` para `match_knowledge_fragments`, `pgmq_delete_message`, `dispatch_rag_analysis_queue` y `enqueue_rag_analysis`.

### R5-12 · Datos de prueba en la base productiva — P2

El estado del 16/09 habla de "49 reportes reales procesados en producción", pero son datos demo y corridas de prueba. **Qué hacer:**
1. Con C9, identificar los reportes de prueba (fechas 14 a 16/09, rol de quien los creó) y mandar **la lista de sus `id`**, sin descripciones.
2. **No borrar.** Hernán decide si se eliminan, se marcan o quedan.
3. **Desde ahora, las pruebas no insertan reportes en CiudadAR** (ver R5-08).

### R5-13 · Pendientes menores de la ronda 4 — P2

| Punto | Qué falta |
|---|---|
| P-09 | Comentario en REP-2908. Si el conector de Jira falla, se escribe a mano desde la web |
| P-10 | Evidencia de V-06 (parámetros y similitud de FR12) y aclaración de las 47 contra 44 filas |
| P-11 | Aviso al equipo por los correos que quedaron publicados; comprobar que el commit del backup ya no se pueda abrir por su identificador ni desde referencias de PR |
| P-12 | `audit_ia`: sigue esperando el OK de Hernán |
| — | Código de modelo escrito fijo en `index.ts`: dejarlo como constante única, anotado para leerlo de `embedding_models` más adelante |

---

## 8. Qué cierra cada ticket (para los comentarios de Jira)

Criterios tomados de la descripción actual de cada ticket. **El ticket se pasa a Finalizada solo con la evidencia indicada.**

| Ticket | Estado hoy | Qué falta para cerrarlo | Evidencia |
|---|---|---|---|
| **REP-2908** Prompt controlado con salida JSON | Control de calidad | Evidencia de casos **con la versión actual**: entrada, fragmentos recuperados y salida | R5-08 |
| **REP-3772** Validación determinística | En curso | Implementada en código (las 3 validaciones y el cierre en `indeterminado`). Falta mostrar en R5-08 cuáles pasaron o fallaron, con motivo | R5-07 y R5-08 |
| **REP-2900** Sugerir norma aplicable | Control de calidad | Misma evidencia que REP-2908 | R5-08 |
| **REP-2901** Clasificar jurídicamente | Control de calidad | Hernán registra en REP-3773 que la clasificación se hace dentro de la categoría elegida, y que sugerir otra categoría va en un ticket nuevo | R5-08 más la decisión de Hernán |
| **REP-2909** Guardar clasificación jurídica | Sin sprint ni responsable | Ya está hecho: sumarlo al Sprint 12, asignarlo a Matías y cerrarlo | V-07, C7 y R5-06 |
| **REP-3776** Orquestación asíncrona | Sprint 15 | Un caso de falla controlada y ninguna pérdida o bloqueo silencioso | R5-06 (pruebas 1 y 2) |
| **REP-3777** Evidencia y auditoría | Sprint 15 | Guardado atómico y tokens completos | R5-06 (parte A, prueba 3) y R5-07 |
| **REP-3775** Seguridad del RAG | Sprint 14 | La función solo acepta al despacho, permisos de ejecución, pruebas de acceso permitido y denegado, y los hallazgos convertidos en tickets | R5-05, R5-11, P-04 (prueba con dos usuarios) y tickets de R5-02 a R5-04 |
| **REP-3774** Ingesta productiva del corpus | Sprint 14 | **No se cierra:** no hay un cargador desde `.md`, ni bucket `corpus-fuentes`, ni versionado en uso | — |
| **REP-2500** Conservar el reporte enviado | En curso | Su criterio dice "no se almacena la fotografía original": depende de R5-02. También de P-04 aplicado (recuperar el reporte) y de QA | R5-02, C4 y QA |
| **REP-2405** Impedir persistencia de la imagen original | Sin sprint | Es el ticket natural para R5-02 y C8. Propuesta: sumarlo al Sprint 12 o 13 como prioridad | R5-02 y C8 |

---

## 9. Lista de entrega

| # | Evidencia | Punto | ✔ |
|---|---|---|---|
| 1 | C1 a C9, datos del panel y los tres `grep` | R5-01 | ☐ |
| 2 | Storage corregido: C2 después, pruebas negativas, reporte con foto y C8 | R5-02 | ☐ |
| 3 | `report_images`: C3 después y prueba sin sesión | R5-03 | ☐ |
| 4 | `citizen_reports`: pruebas de inserción y datos para la decisión de lectura | R5-04 | ☐ |
| 5 | Función con token: 403 sin token y punta a punta funcionando | R5-05 | ☐ |
| 6 | Guardado atómico y despacho: pruebas 1, 2 y 3 en el proyecto descartable | R5-06 | ☐ |
| 7 | Versión desplegada, C7 con motivos y tokens nuevos | R5-07 | ☐ |
| 8 | Tabla de corridas con el filtro, más E-sin-categoría | R5-08 | ☐ |
| 9 | `migration list` coincidiendo, PARTE 8 en el descartable, PR de la guía y proyecto borrado | R5-09 | ☐ |
| 10 | Capturas de la alerta y de la protección de contraseñas | R5-10 | ☐ |
| 11 | C5 después | R5-11 | ☐ |
| 12 | Lista de `id` de reportes de prueba | R5-12 | ☐ |
| 13 | Pendientes menores | R5-13 | ☐ |

---

## 10. Cuándo damos por cumplido el Sprint 12 (viernes 18/09)

**RAG, objetivo comprometido:**
1. R5-08 cumple su criterio excluyente, y REP-2908, REP-3772 y REP-2900 quedan listas para QA.
2. R5-07 está desplegado, con motivos guardados.
3. REP-3773 está registrada por Hernán.

**Privacidad, bloqueante para UAT aunque no sea parte del objetivo del sprint:**
4. R5-01 está corrido y R5-02 a R5-04 están aplicados, o, si no llegan esta semana, **registrados como defectos P1 del Sprint 13** con Leo.

**Lo que no llegue se declara pendiente en la Sprint Review, no hecho.**

---

**Documentos relacionados:** [REP-1009 — Épica IA jurídica / RAG](https://unlz2026.atlassian.net/browse/REP-1009) · [REP-1004](https://unlz2026.atlassian.net/browse/REP-1004) · [REP-2405](https://unlz2026.atlassian.net/browse/REP-2405) · `REP-2908-VERIF_ronda4_hernan.md` (Drive)
