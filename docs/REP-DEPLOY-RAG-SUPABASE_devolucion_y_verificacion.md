# Reportalo

*Plataforma de Auditoría Ciudadana*

## DEVOLUCIÓN Y PLAN DE VERIFICACIÓN — DESPLIEGUE DEL RAG EN SUPABASE

**Versión 1.0 · 14 de septiembre de 2026 · Proyecto RAR-2026**

**Responde a:** informes `REP-DEPLOY-RAG-SUPABASE-run-001` y `REP-DEPLOY-RAG-SUPABASE_reporte-para-hernan` (Matías, 14/09)
**Jira:** [REP-2908](https://unlz2026.atlassian.net/browse/REP-2908) · [REP-3772](https://unlz2026.atlassian.net/browse/REP-3772) · [REP-3773](https://unlz2026.atlassian.net/browse/REP-3773) · [REP-3775](https://unlz2026.atlassian.net/browse/REP-3775) · [REP-3776](https://unlz2026.atlassian.net/browse/REP-3776) · [REP-3777](https://unlz2026.atlassian.net/browse/REP-3777) · [REP-2909](https://unlz2026.atlassian.net/browse/REP-2909) · [REP-2910](https://unlz2026.atlassian.net/browse/REP-2910) · [REP-3764](https://unlz2026.atlassian.net/browse/REP-3764) · [REP-3769](https://unlz2026.atlassian.net/browse/REP-3769)
**Archivos de apoyo (carpeta Drive del proyecto):** https://drive.google.com/drive/folders/1JJ6T0Y2MhhzONvaffT8PN7j34lTJjoe9
- `REP-3769_seed_y_RAG.sql` — script idempotente de seeds y RAG (su PARTE 8 es la verificación)
- `REP-3769_guia_ejecucion_seeds_y_RAG.md` (v2.3) — cambios de base y de código
- `REP-3764_casos_esperados.md` — los 6 casos A–F

**Equipo:** Hernán Gregorini (PO · DBA) · Leonel Nuñez (PM / Scrum Master) · Matías Krepchuk (Líder Técnico · UX/UI) · Iván Juárez (QA · UX/UI)

---

## 0. Reglas para quien ejecute este documento (persona o agente)

1. **Este documento es la única fuente de instrucciones.** Si algo no está acá o no está claro, se le pregunta a Matías. No se completa por intuición.
2. **Nunca se escribe una clave en ningún lado.** Esto vale para archivos, commits, capturas, respuestas de consultas o el chat. Las consultas de este documento están armadas para devolver **nombres**, nunca valores.
3. **Todas las consultas de las secciones 3 y 5 son de solo lectura**, salvo las que dicen **[ESCRIBE]**. Esas se corren con el OK de Matías.
4. **Nada se borra.** No se ejecuta `drop` ni `delete` en ningún paso.
5. **Todo cambio de base se hace con una migración en el repositorio** y entra por Pull Request (V-05). Si algo se tiene que aplicar a mano porque es urgente (por ejemplo, rotar la clave de V-01), después se lo escribe igual como migración.
6. **Si una columna o tabla tiene otro nombre en la base real, se usa el nombre real** y se lo anota en la evidencia. Esa diferencia es un dato que necesitamos.

---

## 1. Resumen

El RAG de texto ya corre contra el Supabase real (proyecto CiudadAR), con embeddings y generación reales de Gemini. Es un avance real. Lo más importante que queda probado:

- **No inventa:** el caso F devuelve `sin_normativa` y la validación rechaza las citas que no son literales.
- **Filtra por jurisdicción:** en el caso C no aparece ninguna norma de CABA.

Antes de dar por cerrado el objetivo del Sprint 12 (viernes 18/09, 18 hs) falta:

- **Seguridad.** Hay una clave de administrador escrita en texto plano en la base (V-01 a V-03).
- **Reproducibilidad.** Los cambios se aplicaron a mano y no están en el repositorio. No sabemos con certeza qué esquema y qué seeds hay hoy (V-04 y V-05).
- **Trazabilidad.** Falta demostrar que un reporte que entra por el proceso automático termina con su análisis y su evidencia guardados (V-07 y V-08). Es la parte del objetivo del sprint que todavía no está probada.
- **Evidencia de calidad.** Cada caso se corrió una sola vez, y los casos se conocían de antemano (V-09).

**Cómo usar este documento:** cada punto V-xx dice qué encontramos, qué hay que hacer, **qué nos tienen que mandar** y **cuándo lo damos por cerrado**. La sección 4 es la lista de entrega.

---

## 2. Lo que queda validado

| Qué | Por qué lo damos por bueno |
|---|---|
| La validación rechaza lo dudoso | Una paráfrasis en el caso D terminó en `indeterminado` y no en una cita falsa |
| El caso F no inventa | `sin_normativa`, sin citas, confianza 0 |
| Filtro por jurisdicción | El caso C (Avellaneda) no recuperó ninguna norma de CABA |
| El error de `responseSchema` | Diagnóstico correcto: la Edge Function había perdido el esquema de salida al copiarse de `geminiClient.js` |
| Permisos de `report_ai_analysis` y `report_ai_evidence` | Antes cualquiera podía leerlas; ahora están restringidas |
| Facturación de Gemini activada | En el plan pago, Google no usa los datos para mejorar sus productos (Ley 25.326) |
| Backup previo de solo lectura | Buena práctica (ver igual V-02) |

---

## 3. Puntos a verificar

**Prioridad:** P1 = antes del cierre del Sprint 12 (18/09) · P2 = en el Sprint 12, si hay tiempo; si no, en el Sprint 13 · P3 = decisión del PO.

| ID | Tema | Prioridad | Responsable |
|---|---|---|---|
| V-01 | Clave service_role escrita en el trigger `audit_ia` | P1 | Matías |
| V-02 | Backup con datos reales fuera de Git | P1 | Matías |
| V-03 | Hallazgos de seguridad que ya existían | P1 | Matías → Hernán |
| V-04 | Estado real de la base: esquema, seeds y corpus | P1 | Matías |
| V-05 | Cambios a migraciones y Pull Request | P1 | Matías · revisión de base: Hernán |
| V-06 | Mismo embedding en el script y en la Edge Function | P2 | Matías |
| V-07 | Prueba de punta a punta por el proceso automático | P1 | Matías |
| V-08 | Límite de reintentos y alerta de presupuesto | P1 | Matías |
| V-09 | Casos A–F repetidos 5 veces, con la lista recuperada | P2 | Matías |
| V-10 | Caso A: no aparece la Constitución PBA 192.4 | P3 | Hernán (REP-3773) |
| V-11 | Modelo de generación y parámetros | P2 | Matías |
| V-12 | Ninguna clave de Gemini en el frontend | P1 | Matías |
| V-13 | Registro en Jira | P2 | Matías · Hernán · Leonel |

---

### V-01 · Clave service_role escrita en el trigger `audit_ia` — P1

**Qué encontramos.** El informe dice que el trigger heredado `audit_ia` (sobre `infractions`) tiene un JWT de `service_role` en texto plano. Esa clave se saltea todos los permisos de la base.

- Cualquiera que vea el código de esa función tiene acceso total.
- El código de la función puede verse en un dump, en el backup de V-02 o en una migración vieja del repositorio.
- Por eso la tratamos como **clave filtrada**, aunque no haya evidencia de que alguien la haya usado.

**Qué hacer.**

1. Buscar todas las funciones y tareas programadas que tengan una clave escrita (consulta 1). Pueden ser más de una.
2. Cambiar esas funciones para que lean la clave desde Vault, como ya hace `dispatch_rag_analysis_queue` con `rag_service_role_key`. Si el trigger `audit_ia` no se usa, se desactiva (sin borrarlo).
3. Rotar la clave `service_role` desde el panel de Supabase.
4. Actualizar todos los lugares que la usan:
   - el secreto de Vault `rag_service_role_key`;
   - los secretos de Edge Functions que la usen;
   - las variables de Vercel, si la rotación también cambia la clave `anon` que usa el frontend.
5. Probar que el proceso automático sigue funcionando (se prueba en V-07).

**Consulta 1 — funciones y tareas con una clave escrita** (devuelve solo nombres):

```sql
select 'function' as tipo, n.nspname as esquema, p.proname as nombre
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where p.prosrc ~ 'eyJ[A-Za-z0-9_-]{10,}\.' or p.prosrc ~ 'sb_secret_'
union all
select 'cron', 'cron', j.jobname
from cron.job j
where j.command ~ 'eyJ[A-Za-z0-9_-]{10,}\.' or j.command ~ 'sb_secret_';
```

**Consulta 2 — secretos de Vault** (solo nombres y fechas, nunca el valor):

```sql
select name, created_at, updated_at from vault.secrets order by name;
```

**Qué nos tienen que mandar.**
- El resultado de la consulta 1 **antes** y **después** de la corrección.
- La fecha de rotación de la clave.
- El resultado de la consulta 2 después de rotar.

**Queda cerrado cuando:**
- la consulta 1 devuelve 0 filas;
- el `updated_at` de `rag_service_role_key` es posterior a la rotación;
- V-07 pasa con la clave nueva.

---

### V-02 · Backup con datos reales fuera de Git — P1

**Qué encontramos.** El backup `supabase/backups/2026-09-14_pre-deploy-rag/` tiene el esquema, las funciones (incluida la clave de V-01) y los datos de las 44 tablas. Está dentro del repositorio y la rama todavía no se subió.

**Qué hacer.**
1. Agregar `supabase/backups/` al `.gitignore`.
2. Confirmar que no entró en ningún commit.
3. Guardar el backup fuera del repositorio, en un lugar con acceso restringido.

```bash
git log --all --oneline -- supabase/backups/   # tiene que salir vacío
git check-ignore -v supabase/backups/          # tiene que mostrar la regla del .gitignore
```

**Qué nos tienen que mandar.** La salida de los dos comandos y dónde quedó guardado el backup (el lugar, no el archivo).

**Queda cerrado cuando** el primer comando sale vacío y el segundo muestra la regla. Si el backup llegó a entrar en un commit, se avisa **antes** del push. En ese caso hay que limpiar el historial y, además, la rotación de V-01 pasa a ser obligatoria sí o sí.

---

### V-03 · Hallazgos de seguridad que ya existían — P1

**Qué encontramos.** El informe dice que el control de seguridad dio "sin **nuevos** hallazgos críticos". Eso da a entender que había hallazgos críticos anteriores. La base tiene 44 tablas, más que el modelo v3.2, así que hay tablas heredadas (por ejemplo, `infractions`).

**Consultas:**

```sql
-- Tablas sin RLS (tiene que dar 0 filas)
select c.relname as tabla
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
order by 1;

-- Políticas de las tablas del análisis
select tablename, policyname, cmd, roles, qual
from pg_policies
where tablename in ('report_ai_analysis', 'report_ai_evidence')
order by 1, 2;

-- Inventario de tablas (para separar las heredadas de las del modelo)
select table_name from information_schema.tables
where table_schema = 'public' and table_type = 'BASE TABLE'
order by 1;
```

**Qué nos tienen que mandar.**
- La lista completa del Security Advisor: nombre del hallazgo, nivel y objeto. Sale de Dashboard → Advisors → Security, o de `get_advisors(type: security)`.
- La salida de las tres consultas.

**Queda cerrado cuando** no queda ningún hallazgo crítico sin plan: cada uno está corregido o tiene ticket y responsable. Hernán (DBA) decide el tratamiento de las tablas heredadas.

---

### V-04 · Estado real de la base: esquema, seeds y corpus — P1

**Qué encontramos.** El informe dice que el esquema del RAG "ya existía parcialmente" y que había 15 fragmentos cargados, lo que coincide con nuestra PARTE 7. No dice si se recargaron los seeds (geografía, organismos, categorías, estados, perfiles y reportes demo) ni si existe la PARTE 5B (áreas, trazabilidad, `profile_attends_report`). Las políticas nuevas usan `profile_attends_report`, así que algo de la 5B, o una versión propia, tiene que existir.

**Qué hacer.** Correr las consultas siguientes, que son todas de solo lectura:

**Consulta 1 — la verificación completa de la PARTE 8** de `REP-3769_seed_y_RAG.sql` (está en el Drive). Hay que correrla entera: la tabla de conteos y la consulta de cascada.

**Consulta 2 — qué partes del modelo existen:**

```sql
select
  to_regclass('public.report_events')              is not null as p5b_report_events,
  to_regclass('public.agency_services')            is not null as p5b_agency_services,
  to_regclass('public.profile_services')           is not null as p5b_profile_services,
  to_regclass('public.report_timeline')            is not null as p5b_report_timeline,
  to_regprocedure('public.profile_attends_report(uuid,uuid)') is not null as p5b_profile_attends_report,
  to_regprocedure('public.mark_report_viewed(uuid)')          is not null as p5b_mark_report_viewed,
  to_regclass('public.source_adhesions')           is not null as p6_source_adhesions,
  to_regclass('public.generation_models')          is not null as p6_generation_models,
  to_regclass('public.open311_requests')           is not null as p5_open311_requests,
  to_regclass('public.normativas')                 is not null as legado_normativas;
```

**Consulta 3 — el corpus es exactamente el verificado.** Compara una huella (md5) del texto de cada fragmento con la tabla de abajo:

```sql
select id, md5(replace(content, E'\r', '')) as huella
from public.knowledge_fragments
where is_current
order by id;
```

| Fragmento | id | Norma | Huella esperada |
|---|---|---|---|
| FR01 | `20000000-0000-4000-8000-000000000001` | Constitución PBA art. 192 inc. 4 | `2ddd2dcd0d16aa0f1bcfdfa9294a0513` |
| FR02 | `20000000-0000-4000-8000-000000000002` | Dec-Ley 6769/58 (LOM) art. 52 | `7b9020641e8619692b5f63677842dc89` |
| FR03 | `20000000-0000-4000-8000-000000000003` | Dec-Ley 6769/58 (LOM) art. 59 | `89885891eaed4618c888e7e9bcda2a1c` |
| FR04 | `20000000-0000-4000-8000-000000000004` | Ley 210 CABA art. 3 inc. j) | `9ceccf2ea0fadd2f605831991ca77147` |
| FR05 | `20000000-0000-4000-8000-000000000005` | Ley 210 CABA art. 2 inc. b) | `58eb75a0b9d02b842bc38ff16177a6e9` |
| FR06 | `20000000-0000-4000-8000-000000000006` | Ley 210 CABA art. 2 inc. c) | `ef24d0957d9c67768bd98ecb6d3ff5a1` |
| FR07 | `20000000-0000-4000-8000-000000000007` | Ley 24.449 art. 48 inc. i) | `a25a40ff024c0e647721feb2f321cbe7` |
| FR08 | `20000000-0000-4000-8000-000000000008` | Ley 24.449 art. 48 inc. t) | `600fd4cd08bb37b471c71d3b2fa9545f` |
| FR09 | `20000000-0000-4000-8000-000000000009` | Ley 24.449 art. 49 inc. b) 1 | `774438888d39d9973d41fc29ba3d9d5e` |
| FR10 | `20000000-0000-4000-8000-000000000010` | Ley 24.449 art. 49 inc. b) 3 | `10fb02fda1c43c44a3d2b6ff2c211ce6` |
| FR11 | `20000000-0000-4000-8000-000000000011` | Ley 2148 CABA art. 7.1.8 | `06c07e2aa429dc4b205abf497250b46c` |
| FR12 | `20000000-0000-4000-8000-000000000012` | Ley 2148 CABA art. 7.1.9 | `0ae17a316c51675d49bec988dabffba6` |
| FR13 | `20000000-0000-4000-8000-000000000013` | Ley 451 CABA art. 6.1.52 | `c5a5f6bdd0591bd70628d1226437876a` |
| FR14 | `20000000-0000-4000-8000-000000000014` | Ley 451 CABA art. 6.1.37 | `8837b7a529bf55cab9ca6dbcad094ef8` |
| FR15 | `20000000-0000-4000-8000-000000000015` | Dec-Ley 8031/73 (Código de Faltas PBA), índice | `aa0ce135d1712ca08bb0840fd8ca5ba0` |

**Si faltan partes.** Se cargan con el script del Drive, en el orden de la guía v2.3, **avisando antes**. Con el trigger del proceso automático activo, la PARTE 4 (8 reportes demo) dispara 8 análisis reales de Gemini. El costo es bajo y además sirve como prueba de V-07. La PARTE 6 avisa (`notice`) si `report_ai_analysis` ya tiene filas: en ese caso, dos columnas quedan opcionales, y hay que informárnoslo.

**Qué nos tienen que mandar.** La salida de las consultas 1, 2 y 3.

**Queda cerrado cuando:**
- todas las filas de la PARTE 8 dan `OK`;
- la cascada coincide con lo esperado: en Retiro (CABA) **nunca** aparece la Ley 24.449, y en Piñeyro (Avellaneda) sí aparece, por la adhesión de la Ley 13.927;
- las 15 huellas coinciden. Si alguna difiere, se reporta cuál y **no se edita el texto**: los textos son literales y los corrige Hernán.

---

### V-05 · Cambios a migraciones y Pull Request — P1

**Qué encontramos.** Todo se aplicó directo sobre la base, por MCP o por el editor SQL: extensiones, permisos, cola, trigger, tarea programada, secretos de Vault, embeddings y la versión 4 de la Edge Function. Hoy la base no se puede reconstruir desde el repositorio. Es el mismo problema que hizo perder los seeds.

**Qué hacer.**
1. Pasar a migraciones en el repositorio, en `supabase/migrations/`:
   - `create extension pgmq` y `create extension pg_cron`;
   - las políticas de `rag_rls_policies.sql`;
   - el contenido de `apply-async-pipeline.sql`;
   - la corrección de V-01.
2. Los secretos de Vault **no** van con su valor en la migración. Se documenta el **nombre** del secreto y cómo se carga.
3. Los embeddings no van como migración: se documenta el comando del script que los genera.
4. Subir la rama y abrir un Pull Request contra `develop`, con este documento enlazado en la descripción.

**Revisión del PR.** Todo merge requiere revisión. La parte de base (migraciones, RLS, funciones) la revisa Hernán como DBA. El resto del código lo revisa quien se defina en la decisión D-1, que sigue abierta: quién revisa el código de Matías.

**Qué nos tienen que mandar.** El enlace al PR y la lista de migraciones que incluye.

**Queda cerrado cuando** una base vacía queda igual a la real aplicando las migraciones y el script de seeds, y el PR está aprobado.

---

### V-06 · Mismo embedding en el script y en la Edge Function — P2

**Qué encontramos.** El error de `responseSchema` apareció porque había dos copias del mismo cliente de Gemini. Con los embeddings pasa algo parecido: los de los fragmentos se generaron con un script de Node (`generate-fragment-embeddings.mjs`) y los de las consultas se generan en la Edge Function. Si las dos llaman a Gemini con parámetros distintos (modelo, dimensiones, tipo de tarea), la búsqueda pierde calidad **sin mostrar ningún error**.

**Qué hacer.**
1. Anotar qué parámetros usa cada camino: modelo, `outputDimensionality`, tipo de tarea si se usa, y cualquier otra opción.
2. Tomar el texto del fragmento FR12 y generar su embedding con **el mismo código de la Edge Function**.
3. Comparar ese vector con el guardado:

```sql
-- Pegar el vector generado por la Edge Function en lugar de <VECTOR>
select 1 - (embedding <=> '<VECTOR>'::vector) as similitud
from public.fragment_embeddings
where fragment_id = '20000000-0000-4000-8000-000000000012'
  and model_code = 'gemini-embedding-2@768';
```

**Qué nos tienen que mandar.** La tabla de parámetros de los dos caminos y la similitud obtenida.

**Queda cerrado cuando** la similitud es de 0.99 o más con los mismos parámetros. Si se usan tipos de tarea distintos a propósito (documento y consulta), se deja escrito cuáles son y por qué. Lo ideal a mediano plazo es que haya una sola función que genere embeddings, usada por los dos caminos.

---

### V-07 · Prueba de punta a punta por el proceso automático — P1

**Qué encontramos.** Todo se probó llamando a la función a mano. El objetivo del sprint pide una respuesta **trazable**, así que hay que demostrar el recorrido completo:

1. se inserta un reporte;
2. el reporte entra en la cola;
3. la tarea programada lo toma;
4. la Edge Function lo analiza;
5. queda guardado en `report_ai_analysis`;
6. la evidencia queda en `report_ai_evidence`.

**Paso 1 [ESCRIBE] — insertar un reporte de prueba.** Usa el texto del caso B, en Retiro (CABA). Requiere que existan el perfil `ciudadano.demo` y la categoría `TRANSITO` (V-04). Si no existen, se usa un perfil de prueba y se avisa.

```sql
insert into public.citizen_reports
  (id, client_side_id, user_id, service_id, locality_id, latitud, longitud, description, current_state_code, created_at, updated_at)
select '40000000-0000-4000-8000-000000000101', '30000000-0000-4000-8000-000000000101',
       p.id, s.id, l.id, -34.5920, -58.3745,
       'Un auto está estacionado sobre la rampa para discapacitados de la esquina',
       'RECIBIDO', now(), now()
from public.profiles p, public.services s, public.localities l
join public.subdivisions sd on sd.id = l.subdivision_id
where p.username = 'ciudadano.demo'
  and s.service_code = 'TRANSITO'
  and sd.name = 'Comuna 1' and l.name = 'Retiro'
on conflict (client_side_id) do nothing;
```

El reporte queda en la base como evidencia: **no se borra**.

**Paso 2 — un minuto después, revisar el recorrido:**

```sql
-- ¿Se programó y corre la tarea?
select jobid, jobname, schedule, active from cron.job where jobname = 'rag-analysis-dispatch';

select status, count(*), max(start_time)
from cron.job_run_details
where jobid = (select jobid from cron.job where jobname = 'rag-analysis-dispatch')
  and start_time > now() - interval '1 hour'
group by status;

-- ¿Quedó algo trabado en la cola?
select msg_id, read_ct, enqueued_at, vt from pgmq.q_rag_analysis_queue order by msg_id;

-- ¿Se guardó el análisis?
select id, result_status_code, is_infraction, confidence_score,
       embedding_model_code, generation_model_code, prompt_version,
       input_tokens, output_tokens, latency_ms, created_at
from public.report_ai_analysis
where report_id = '40000000-0000-4000-8000-000000000101';

-- ¿Se guardó la evidencia? (lo recuperado y lo citado)
select e.rank, round(e.similarity, 4) as similitud, e.was_cited, f.hierarchy_path, e.quoted_text
from public.report_ai_evidence e
join public.report_ai_analysis a on a.id = e.analysis_id
join public.knowledge_fragments f on f.id = e.fragment_id
where a.report_id = '40000000-0000-4000-8000-000000000101'
order by e.rank;
```

**Qué nos tienen que mandar.**
- La salida de las cinco consultas.
- El tiempo que pasó entre la inserción y la fila en `report_ai_analysis`.
- Si alguna columna tiene otro nombre en la base real, la lista de diferencias (regla 6).

**Queda cerrado cuando:**
- hay **una** fila en `report_ai_analysis` con `result_status_code` cargado;
- hay filas en `report_ai_evidence`, con `was_cited = true` en las citas usadas;
- la cola queda vacía para ese reporte;
- la tarea no tiene corridas con error.

**Si el resultado es `indeterminado`,** también se tiene que guardar la fila, con su motivo, porque la trazabilidad incluye los fallos.

---

### V-08 · Límite de reintentos y alerta de presupuesto — P1

**Qué encontramos.** No está documentado qué pasa si Gemini falla (errores 429 o 503) o si un reporte siempre falla. Si el mensaje vuelve a la cola sin límite, se reintenta cada 10 segundos y **cada intento se cobra**. Además, con una corrida cada 10 segundos, `cron.job_run_details` suma unas 8.640 filas por día.

**Qué hacer.**
1. Poner un máximo de intentos. Cuando `read_ct` supera el máximo, el mensaje se archiva (`pgmq.archive`) y se guarda el análisis como `indeterminado`, con el motivo.
2. Configurar una alerta de presupuesto en Google Cloud para la clave de Gemini.
3. Agregar una tarea programada que limpie `cron.job_run_details` (por ejemplo, borrar lo anterior a 7 días).

```sql
-- Código actual del despacho, para revisar el manejo de reintentos
-- (antes, confirmar con la consulta 1 de V-01 que no tiene claves escritas)
select pg_get_functiondef('public.dispatch_rag_analysis_queue'::regproc);
select pg_get_functiondef('public.enqueue_rag_analysis'::regproc);
```

**Qué nos tienen que mandar.**
- El código de las dos funciones.
- El número máximo de intentos elegido.
- Una captura de la alerta de presupuesto configurada: el monto, no la clave.
- El nombre de la tarea de limpieza.

**Queda cerrado cuando** un mensaje que falla siempre termina archivado después de N intentos y queda guardado como `indeterminado`. Se prueba en entorno de prueba, o se explica en el código si no se puede simular sin afectar la base real.

---

### V-09 · Casos A–F repetidos 5 veces, con la lista recuperada — P2

**Qué encontramos.**
- **Una sola corrida por caso no alcanza.** Un modelo de lenguaje no responde siempre igual. El caso D falló una vez de dos, así que se registra como **1 de 2**, no como aprobado.
- **El caso A pasó a medias.** REP-3764 pedía recuperar los ítems 1, 2 y 3, y el 1 no apareció (ver V-10).
- **Los 6 casos no son una prueba independiente.** Se conocían de antemano y el arreglo se ajustó mirándolos. Miden que el sistema funciona, no su precisión; la precisión se mide con casos reservados, que corre REP-2910.

**Qué hacer.**
1. Correr **5 veces** cada caso: A, B, C, D-Avellaneda, D-CABA, E y F. Son 35 corridas.
2. Hacerlo con la misma versión de prompt y los mismos parámetros, y guardar cada corrida en `report_ai_evidence`, o como archivo si todavía no persiste.
3. Por cada corrida, anotar:
   - el estado;
   - las citas;
   - **la lista recuperada**: posición, fragmento y similitud;
   - si la validación rechazó la respuesta y por qué.

**Plantilla de entrega:**

| Caso | Corrida | Estado | Citas (fragmento) | Recuperados (pos · fragmento · similitud) | ¿Rechazo de validación? Motivo |
|---|---|---|---|---|---|
| A | 1 | | | | |
| … | … | | | | |

**Qué nos tienen que mandar.** La tabla completa y un resumen de aciertos por caso: X de 5.

**Queda cerrado cuando:**
- **(excluyente)** no hay ninguna cita aceptada que no esté entre los recuperados o que no sea literal;
- F da `sin_normativa` 5 de 5;
- C nunca recupera normas de CABA;
- B y D-CABA nunca recuperan la Ley 24.449.

La meta de acierto no se fija acá: la fija REP-2910 con casos reservados.

---

### V-10 · Caso A: no aparece la Constitución PBA 192.4 — P3 (decide Hernán)

**Qué encontramos.** El fragmento FR01 dice "la vialidad pública", y el reclamo habla de una "boca de tormenta". No se parecen en significado, así que bajar el umbral de 0.45 no lo resuelve: solo agrega ruido. De hecho, el informe dice que el umbral ya es permisivo.

**Opciones** (se deciden en REP-3773):

- **a)** Dejarlo así. LOM 52 y 59 alcanzan para fundamentar.
- **b)** Cuando la categoría ya está clasificada, sumar a lo recuperado los fragmentos de tipo `obligacion` de esa categoría y esa jurisdicción. Usa `fragment_services`, que ya existe.
- **c)** Revisar el umbral recién con los casos reservados de REP-2910.

**Qué nos tienen que mandar.** Nada por ahora. Con los resultados de V-09, Hernán decide y lo registra en REP-3773.

---

### V-11 · Modelo de generación y parámetros — P2

**Qué encontramos.** El informe no dice qué modelo genera las respuestas ni con qué parámetros. El contrato de arquitectura prevé `gemini-3.8-flash`. En ese modelo, los tokens de razonamiento (thinking) se cobran como salida.

```sql
select code, provider, model_name, is_active from public.embedding_models;
select code, provider, model_name, is_active from public.generation_models;
```

**Qué nos tienen que mandar.** El resultado de las consultas y los parámetros de la llamada de generación en la Edge Function:
- modelo;
- temperatura;
- nivel o presupuesto de razonamiento;
- máximo de tokens de salida;
- `responseSchema` presente;
- `prompt_version`.

**Queda cerrado cuando** lo que usa la Edge Function coincide con la fila activa de `generation_models` y cada análisis guarda `generation_model_code` y `prompt_version`.

---

### V-12 · Ninguna clave de Gemini en el frontend — P1

**Qué encontramos.**
- El prototipo del RAG corría en el navegador (`legalRagService.js` / `geminiClient.js`).
- En Vite, **toda variable `VITE_` queda pública** dentro del código que se descarga en el navegador.
- El informe menciona además que la clave de Gemini se regeneró.

**Qué hacer.** Confirmar que el frontend no incluye ninguna clave de Gemini y que no llama a Gemini directamente. Los comandos siguientes muestran nombres, no valores. Si aparece algo, se informa **dónde**, sin copiar el valor.

```bash
grep -rn "VITE_.*GEMINI\|generativelanguage" src/ .env.example 2>/dev/null
npm run build && grep -rlo "AIza[0-9A-Za-z_-]\{20,\}" dist/ | sort -u   # tiene que salir vacío
```

**Qué nos tienen que mandar.**
- La salida de los comandos.
- Por qué se regeneró la clave de Gemini y la confirmación de que la anterior quedó **eliminada** en Google.
- Qué va a pasar con `legalRagService.js` y `geminiClient.js` en el frontend: se retiran, o quedan solo para pruebas y sin clave.

**Queda cerrado cuando** el segundo comando sale vacío y la clave anterior está eliminada.

---

### V-13 · Registro en Jira — P2

**Qué encontramos.** "REP-DEPLOY-RAG-SUPABASE" no es un ticket. El trabajo corresponde a:

| Trabajo | Ticket | Sprint en Jira |
|---|---|---|
| Edge Function, prompt, `responseSchema` | REP-2908 | S12 (en curso) |
| Validación de citas literales | REP-3772 | S12 (figura "Por hacer") |
| RLS del análisis | REP-3775 | S14 |
| Cola, trigger y tarea programada | REP-3776 | S15 |
| Guardado del análisis y la evidencia | REP-3777 / REP-2909 | S15 / sin sprint |

**Qué hacer.**
- **Matías:** comentar en REP-2908 el resumen del despliegue, con enlace a su informe y a este documento.
- **Hernán y Leonel:** decidir si REP-3772, REP-3775 y REP-3776 se traen al S12 con lo avanzado, o se dejan en su sprint con un comentario de avance. REP-3773 se usa para ratificar lo que ya quedó funcionando: modelo, umbral y proceso automático.
- **Pendiente de documentación** (Hernán y Leonel): actualizar ADR-004 y el Anexo C con el modelo `gemini-embedding-2@768` y con que el disparo es por cola (pgmq + pg_cron), no por webhook.

**Queda cerrado cuando** los tickets reflejan lo hecho.

---

## 4. Lista de entrega

Se sube al Drive del proyecto (enlace en el encabezado) o se le manda a Hernán. **Sin claves en ningún archivo.**

| # | Evidencia | Punto | ✔ |
|---|---|---|---|
| 1 | Consulta de claves escritas, antes y después de corregir, más la fecha de rotación | V-01 | ☐ |
| 2 | Nombres y fechas de los secretos de Vault | V-01 | ☐ |
| 3 | Salida de `git log` y `git check-ignore` del backup, más dónde quedó guardado | V-02 | ☐ |
| 4 | Security Advisor completo, tablas sin RLS, políticas del análisis e inventario de tablas | V-03 | ☐ |
| 5 | PARTE 8 completa, partes existentes y las 15 huellas | V-04 | ☐ |
| 6 | Enlace al PR y lista de migraciones | V-05 | ☐ |
| 7 | Parámetros de embedding de los dos caminos y la similitud de FR12 | V-06 | ☐ |
| 8 | Las cinco consultas de la prueba de punta a punta y la demora medida | V-07 | ☐ |
| 9 | Código del despacho, máximo de intentos, alerta de presupuesto y tarea de limpieza | V-08 | ☐ |
| 10 | Tabla de las 35 corridas y resumen X de 5 | V-09 | ☐ |
| 11 | Modelos activos y parámetros de generación | V-11 | ☐ |
| 12 | Revisión del frontend y estado de la clave de Gemini anterior | V-12 | ☐ |
| 13 | Comentario en REP-2908 | V-13 | ☐ |

---

## 5. Cuándo damos por cumplido el RAG del Sprint 12

El objetivo del sprint queda cumplido cuando se cumplen las cinco condiciones:

1. **Seguridad:** V-01, V-02, V-03 y V-12 cerrados.
2. **Reproducible:** V-04 da todo `OK` y V-05 tiene el PR aprobado.
3. **Trazable:** V-07 pasa por el proceso automático y V-08 limita los reintentos.
4. **Sin inventar:** V-09 no tiene ninguna cita aceptada fuera de lo recuperado ni ninguna cita no literal.
5. **Registrado:** V-13 hecho.

V-06, V-09 (salvo su criterio excluyente), V-10 y V-11 pueden quedar para el Sprint 13 si no hay tiempo. En ese caso quedan escritos como pendientes en la Sprint Review, no se dan por hechos.

---

## 6. Lo que hacemos nosotros en paralelo

| Qué | Quién | Para qué |
|---|---|---|
| Revisar la parte de base del PR (migraciones, RLS, funciones) | Hernán | V-05 |
| Armar entre 6 y 10 casos reservados, que Matías **no** vea antes de correrlos | Hernán | La prueba independiente de REP-2910 |
| Ratificar o corregir en REP-3773 el modelo, el umbral y la opción de V-10 | Hernán | Decisiones que hoy están tomadas de hecho |
| Decidir el sprint de REP-3772, REP-3775 y REP-3776 | Hernán · Leonel | V-13 |
| Ubicar en un sprint la conexión de `ReportAiAnalysisPanel` a una pantalla | Hernán · Leonel | Hoy no tiene ticket |

---

## 7. Preguntas para Matías

1. ¿Se recargaron los seeds de REP-3605 después de que se borraron? Si no, ¿los cargamos con el script del Drive (V-04)?
2. ¿La versión de `profile_attends_report` que usan las políticas es la de nuestra PARTE 5B o una propia?
3. ¿El trigger `trg_enqueue_rag_analysis` se dispara solo al insertar, o también al actualizar un reporte?
4. Las invocaciones manuales con `curl`, ¿guardaron filas en `report_ai_analysis`? Si lo hicieron, ¿contra qué reportes?
5. ¿Qué pasó con la clave de Gemini que se regeneró? ¿Dónde había quedado expuesta?

---

**Documentos relacionados:** [REP-1009 — Épica IA jurídica / RAG](https://unlz2026.atlassian.net/browse/REP-1009) · [REP-3764 — casos esperados](https://unlz2026.atlassian.net/browse/REP-3764) · [REP-3769 — DER y seeds](https://unlz2026.atlassian.net/browse/REP-3769) · Carpeta Drive del proyecto (encabezado)
