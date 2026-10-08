# REP-3822 — Ficha y respuestas: despliegue, modelo y trazabilidad de la verificación visual

Tarea: https://unlz2026.atlassian.net/browse/REP-3822 · Antecedente de costos: https://unlz2026.atlassian.net/browse/REP-3799
Guía de origen: `docs/REP-3822_Pasos_Mati_despliegue_modelo_lote_QA.md`
Relevado el **2026-10-08** sobre el código del repo (rama `staging`, commit `7e11567`) y sobre la base **CiudadAR** (`yryuhyiujyignkdhiyua`) con consultas de solo lectura. Nada se escribió ni se desplegó para armar este documento.

> **Cómo leer este documento.** Cada dato está marcado: **[EVIDENCIA]** salió del código o de la base, **[PENDIENTE]** hay que completarlo o confirmarlo, **[BRECHA]** hoy no existe y hay que construirlo antes del lote principal. No hay estimaciones presentadas como evidencia.

---

## 0. Resumen para Leo (PM)

| Pregunta de REP-3822 | Respuesta corta | Estado |
|---|---|---|
| ¿Desde cuándo está disponible la verificación visual? | Función `analizar-imagen-reporte` v1 desplegada el **2026-10-05T18:43:01-03:00** (21:43:01Z). Primer análisis exitoso: **2026-10-05T18:50:04-03:00** (21:50:04Z). | Desplegada y con recorrido probado |
| ¿Qué modelo ejecuta? | `gemini-3.8-flash`, `thinkingLevel: low`, prompt `visual-v1`, salida máx. 1024 tokens, **una foto por llamada**. | Confirmado en código y en 150 de 151 análisis completados (el otro usó el fallback) |
| ¿Hay fallback? | Sí: `gemini-3.7-flash` y luego `gemini-3.5-flash-lite`. **Ya se usó una vez** (2026-10-07). | Confirmado |
| ¿Podemos distinguir cada llamada del lote QA? | **No todavía.** Hay un resultado por foto, pero no hay `qa_batch_id`, `call_id`, intentos fallidos ni `usageMetadata` original. | **[BRECHA]** — propuesta en §4 |
| ¿Qué tokens/latencia hay hoy? | `input_tokens`, `output_tokens` (ya **incluye** thinking), `latency_ms`, por foto. Línea base real en §6. | Disponible parcialmente |

**Lo que bloquea la medición principal:** (1) identificar lote/caso, (2) registrar cada intento incluido el fallido, (3) guardar el uso original del proveedor. Es una migración chica más un cambio acotado en la función (§4), sin tocar el frontend ni el RAG textual.

---

## 1. Disponibilidad real

### 1.1 Qué hay desplegado **[EVIDENCIA]**

| Pieza | Dato |
|---|---|
| Proyecto Supabase | **CiudadAR** (`yryuhyiujyignkdhiyua`, us-east-2). Es el único proyecto con la función visual desplegada. |
| Edge Function | `analizar-imagen-reporte`, **versión 1**, `ACTIVE`, `verify_jwt: true`. Hash de despliegue (`ezbr_sha256`): `fa7e518f3a8d05bd2a49a0a1704442a9e46bb119c7c2b3a1d73c2c88d3950999` |
| Commit del código de la función | `dfcc834` — *feat(REP-3818): Edge Function analizar-imagen-reporte con validacion deterministica* (2026-10-04T21:53:59-03:00) |
| Migración de cola y persistencia (REP-3817) | `20261005163523` y `20261005163640`, aplicadas el 2026-10-05; registro en `5953978` |
| Pantalla (REP-3820) | `ReportVisualVerification.jsx`, `useReportImageAnalysis.js`, `reportImageAnalysisService.js`; integrada en `ReportDetailPage.jsx` |
| Despachador | cron `visual-analysis-dispatch` cada minuto (`dispatch_visual_analysis_queue`), 20 mensajes por corrida, 3 reintentos máx. por mensaje |

### 1.2 Horarios

| Hito | ISO 8601 con offset | UTC | Fuente |
|---|---|---|---|
| Despliegue técnico de la función (v1) | `2026-10-05T18:43:01-03:00` | `2026-10-05T21:43:01Z` | `updated_at` de la función en Supabase (1791236581505 ms) |
| Dos mensajes agotan reintentos (`fallido`) | `2026-10-05T18:45:00-03:00` | `2026-10-05T21:45:00Z` | `report_image_analysis`, `msg_id` 4 y 5 |
| **Primera prueba exitosa del recorrido integrado** | `2026-10-05T18:50:04-03:00` | `2026-10-05T21:50:04Z` | primera fila `completado` (`coincide`, `gemini-3.8-flash`) |
| Primer `no_coincide` | `2026-10-05T19:49:04-03:00` | `2026-10-05T22:49:04Z` | primera fila `no_coincide` |
| Primer `no_concluyente` | `2026-10-07T14:40:07-03:00` | `2026-10-07T17:40:07Z` | única fila `no_concluyente` |

Entre despliegue técnico y primera prueba exitosa pasaron **~7 minutos**. Los dos `fallido` del 05/10 caen en esa ventana (la URL de Vault se cargó recién después de que el mensaje ya estaba en cola); no se confirmó en logs.

### 1.3 Pendientes de esta sección **[PENDIENTE]**

| Dato | Estado | Qué hacer |
|---|---|---|
| URL de staging | **https://reportalo-staging.vercel.app/** (confirmada por Mati el 2026-10-08). | — |
| ¿CiudadAR es staging o producción? | **CiudadAR es la única base de datos** (confirmado por Mati el 2026-10-08). No existe una base de producción separada. | Decirlo explícito en la ficha: el entorno de las pruebas es `staging` y no hay datos de producción aparte. |
| Commit/deployment del **frontend** | No identificable desde la base. | Mati: id de deploy de Vercel que sirve la pantalla de REP-3820. |
| Commit exacto del backend desplegado | Se despliega con `supabase functions deploy` desde la rama local; Supabase guarda solo el hash. | Registrar `dfcc834` (último commit que toca la carpeta) y el hash de arriba. Para la v2 que se haga en §4, anotar commit en la ficha. |
| Flag para habilitar la verificación | **No existe flag.** La verificación se enciende/apaga con el secret de Vault `visual_analizar_imagen_url`: sin él el despachador no consume la cola. | Documentar así. Estado actual: **encendida** (el cron corre y la cola está en 0 según `Pruebas_manuales_Sprint15.md` §9.1, verificado el 06/10). |
| ¿También habilitada en producción? | No hay base de producción separada: la verificación corre sobre la única base (CiudadAR). | — |
| Reporte/llamada de humo identificado como `smoke` | **No existe.** La primera corrida exitosa no quedó marcada. | Repetir un humo etiquetado después de §4 (ver §5). |

---

## 2. Modelo y configuración efectiva **[EVIDENCIA]**

Fuente: `supabase/functions/analizar-imagen-reporte/{contract,gemini,analyze}.ts`. Sin claves ni secretos.

| Ítem | Valor |
|---|---|
| Modelo pedido (principal) | `gemini-3.8-flash` (`PRIMARY_MODEL`) |
| Alias que puede cambiar | **No es alias con sufijo `-latest`**: es el nombre fijo. Igual conviene guardar el modelo que devuelve la API (`modelVersion`), hoy **no se guarda**. |
| Versión devuelta por la respuesta | **[BRECHA]** no se lee `modelVersion`. |
| Endpoint | `POST https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent`, clave en header `x-goog-api-key` (nunca en la URL) |
| Versión de prompt | `visual-v1` (`PROMPT_VERSION`; se incrementa a mano) |
| Thinking | `thinkingConfig: { thinkingLevel: 'low' }`. `minimal` da HTTP 400 en este modelo (REP-3816). |
| Límite de salida | `maxOutputTokens: 1024` |
| Salida estructurada | `responseMimeType: application/json` + `responseSchema` obligatorio (`OUTPUT_SCHEMA`); sin `temperature` explícita |
| Timeout por llamada | 20 000 ms (`GEMINI_TIMEOUT_MS`) |
| Imagen: resolución / compresión / recorte | **No se redimensiona, comprime ni recorta.** Se envía la foto ya anonimizada del bucket `report-evidences` tal cual, en base64 (`inlineData`). Tope 10 MB; MIME permitidos `jpeg/png/webp`. El coste de imagen lo fija el proveedor (~1 100 tokens medidos en REP-3816). |
| Fotos por llamada | **Una foto por llamada.** Un reporte con N fotos genera N llamadas independientes (una fila por foto, `UNIQUE(image_id)`). |
| Cómo entran descripción y categoría | Se leen de la base (nunca del cuerpo del pedido) y se insertan en el prompt entre delimitadores `<<< >>>`, con la orden de tratarlos como datos. |
| ¿Se reutilizan datos del análisis textual? | **No.** El circuito visual es independiente de `analizar-reporte` y de `report_ai_analysis`. Solo comparte el secret `GEMINI_API_KEY` y la clave de servicio `rag_service_role_key` en Vault. |
| Agregación entre fotos que discrepan | **No hay agregación a nivel reporte.** La pantalla muestra una tarjeta por foto («Foto 1», «Foto 2») sin fusionar. **[PENDIENTE]** definir con PO/Iván la regla si el QA la requiere (REP-3819). |
| Categoría sin análisis | `VULNERABILIDAD_SOCIAL` → fila `omitido` (`categoria_no_analizable`), **sin llamada al modelo** (9 filas hasta hoy). |

### 2.1 Fallback y reintentos

| Orden | Modelo | Intentos | Cuándo se pasa al siguiente |
|---|---|---|---|
| 1 | `gemini-3.8-flash` | **2** (espera 1 500 ms entre ambos) | HTTP 401, 403, 404, 408, 429, 500, 502, 503, 504 o excepción de red |
| 2 | `gemini-3.7-flash` | 1 | mismo criterio |
| 3 | `gemini-3.5-flash-lite` | 1 | mismo criterio |

- **Máximo de llamadas al proveedor por foto en una pasada: 4** (2 + 1 + 1).
- Un HTTP 400 (solicitud rechazada) **no** prueba otro modelo: se guarda `fallido`.
- Si ningún modelo responde: la función contesta 503, **no guarda nada** y el mensaje queda en la cola. El despachador reintenta hasta 3 lecturas del mensaje; al superarlas guarda `fallido` sin modelo ni tokens. Es decir, **en el peor caso una foto puede generar hasta 3 pasadas × 4 llamadas = 12 llamadas al proveedor**, de las que hoy no queda registro individual.
- **Evidencia de que el fallback funciona:** una fila real con `gemini-3.7-flash` (2026-10-07T18:27:10-03:00, 1 592 entrada / 225 salida / 5 554 ms). El `model_code` guardado es el que respondió, no el pedido.
- **[BRECHA]** El intento que falló en el modelo principal (que sí puede cobrarse si Google devolvió 5xx tras procesar) no queda registrado. Hoy no se puede saber por qué esa foto cayó al respaldo.

### 2.2 Cloud Vision (anonimización) — separado del costo Gemini **[EVIDENCIA]**

- Lo ejecuta `quarantine-anonymize` (`vision.ts`), **antes** de la verificación visual. No lo invoca `analizar-imagen-reporte`.
- Funciones actuales en el código: `FACE_DETECTION` (máx. 50) siempre; `OBJECT_LOCALIZATION` (máx. 50) y `TEXT_DETECTION` en la rama con patentes (REP-3793).
- El historial de Billing con rostros, objetos y OCR es consistente con el código actual, pero **no lo prueba**: confirmar contra el despliegue de `quarantine-anonymize` (v28 al 08/10).
- **Regla de costos:** no sumar Cloud Vision ni embeddings al costo incremental de la verificación; la etapa visual solo invoca Gemini generación.

---

## 3. Qué se registra hoy y qué falta (mapeo de campos)

Tabla de auditoría existente: `public.report_image_analysis` (una fila por foto). **Reutilizable**, pero cubre solo el resultado final.

| Campo pedido por REP-3822 | Equivalencia hoy | Estado |
|---|---|---|
| `qa_batch_id`, `case_id` | — | **[BRECHA]** |
| `environment` | — (un solo proyecto) | **[BRECHA]** mínima: columna constante o campo del lote |
| `report_id` | `report_image_analysis.report_id` | OK |
| `photo_ids`, `photo_count` | `image_id` (una por fila); `photo_count` = `count(*) group by report_id` | OK, derivable |
| `call_id` (único por intento) | — (`id` es por resultado, no por intento) | **[BRECHA]** |
| `attempt` | — | **[BRECHA]** |
| `stage` | implícito (solo etapa visual; textual está en `report_ai_analysis`, anonimización en cuarentena) | OK, constante `visual` |
| `deployment_id` | — | **[BRECHA]** (versión de función no queda en la fila) |
| `prompt_version` | `prompt_version` | OK (solo en filas con respuesta del modelo) |
| `model_requested` | — | **[BRECHA]** |
| `model_returned` | `model_code` guarda el modelo **pedido que respondió**, no `modelVersion` de la API | Parcial |
| `started_at`, `finished_at` | `created_at` = momento de persistencia, no de la llamada | **[BRECHA]** |
| `duration_ms` | `latency_ms` (de una sola llamada: la exitosa o la rechazada) | Parcial |
| `input_tokens` | `input_tokens` = `usageMetadata.promptTokenCount` (incluye imagen + prompt + descripción) | OK |
| `output_tokens` | `output_tokens` = `candidatesTokenCount + thoughtsTokenCount` | OK, ver §3.1 |
| `thinking_tokens` | no separado | **[BRECHA]** |
| `raw_usage_metadata` | — | **[BRECHA]** |
| `status`, `error_code`, `error_message` | `status` (`completado/omitido/fallido`) y `status_reason` (texto libre, ≤300 car., claves redactadas) | Parcial: sin código de error estructurado |
| `visual_result` | `coherence` (`coincide/no_coincide/no_concluyente`); el fallo técnico va aparte en `status` | OK |

### 3.1 Respuestas sobre tokens **[EVIDENCIA]**

- **`output_tokens` ya incluye thinking** en la columna guardada: se calcula como `candidatesTokenCount + thoughtsTokenCount` (`analyze.ts`, bloque `outputTokens`). Para el modelo principal con `thinkingLevel: low` el thinking medido fue **0 tokens** (REP-3816); con `gemini-3.7-flash` rondó ~184.
- **Riesgo de doble conteo:** si más adelante se agrega `thinking_tokens` como columna aparte, `output_tokens` seguirá incluyéndolo. Hay que documentarlo en el export (`output_billable = output_tokens`, `visible = output_tokens − thinking_tokens`) y **no sumar ambas**.
- **`input_tokens` = `promptTokenCount`** (todo el input, no solo la imagen). La imagen pesa ~1 100 tokens de ~1 550–1 590.
- Con fallo de la API no hay `usageMetadata`: la fila queda con tokens `NULL` (no 0). Correcto, pero hoy además no se registra el intento.

### 3.2 Latencia

- `latency_ms` mide **solo la llamada HTTP al proveedor** (de `fetch` a lectura del cuerpo), del intento que respondió. **No** incluye descarga de la foto, base64, espera de 1 500 ms entre reintentos, ni el tiempo en cola (el cron corre cada minuto, así que el usuario espera hasta ~60 s + proceso).
- Para la etapa completa por reporte hace falta `started_at`/`finished_at` por intento y el instante de encolado (`report_images.created_at`) para derivar espera en cola.
- Si un reporte tiene varias fotos, son llamadas **independientes y concurrentes**: no sumar duraciones como espera del usuario.

### 3.3 Varias fotos y costo

Como hay una foto por llamada, **el costo por foto es real, no promediado**: `input_tokens` y `output_tokens` de cada fila son los de esa foto. El costo de un reporte es la suma de sus filas. No aplica la asignación promedio que advierte la guía (solo valdría si algún día se mandan varias fotos en una llamada).

---

## 4. Cierre de las brechas — IMPLEMENTADO en la rama `feat/REP-3822-registro-de-intentos-visuales`

> **Estado (2026-10-08):**
> - Migración **aplicada en CiudadAR** (versión `20261008174835`, archivo `supabase/migrations/20261008174835_rep3822_registro_de_intentos_visuales.sql`): tablas `visual_call_log` y `visual_qa_cases` y función `log_visual_call(jsonb)`. Verificado: RLS activa, sin acceso para `anon`/`authenticated`, una fila de prueba guardada y revertida.
> - Función **v2 desplegada por Mati el 2026-10-08T15:06:05-03:00 (18:06:05Z)** (`ezbr_sha256` `36e4eaf8c2c7be83c564918a6932258df442ace5393450db1020c82555eb31f4`). Código probado con 884 pruebas en verde. Secret `FUNCTION_COMMIT` no cargado: `deployment_id` queda en NULL salvo que se cargue. Humo ejecutado y verificado (ver §5.4).
> - Cambios respecto del borrador: se quitó la columna `pass` (las pasadas se distinguen por `started_at` y `queue_message_id`), y la escritura va por la función `log_visual_call` (la función solo escribe por RPC, regla de REP-3818) en vez de un INSERT directo.
> - Para desplegar: `supabase functions deploy analizar-imagen-reporte` y, opcional, el secret `FUNCTION_COMMIT` con el commit desplegado (queda en `deployment_id`).
>
> Pedido de la guía: *«Reutilizá la auditoría existente si alcanza»*. Alcanza para el **resultado**, no para los **intentos**. Propongo **no tocar** `report_image_analysis` (la lee la pantalla de REP-3820) y sumar dos tablas append-only, sin cambios en el frontend ni en el RAG.

### 4.1 Lote y caso sin modificar el flujo del reporte

El reporte lo crea el ciudadano desde la app; propagar un `qa_batch_id` por el frontend sería invasivo. Alternativa que además cumple «no marcar retrospectivamente todo staging»:

```sql
-- Aplicado (versión 20261008174835).
create table public.visual_qa_cases (
  qa_batch_id text not null,                -- ej. 'REP-3822-QA-01'
  case_id     text not null,                -- ej. 'C07-3fotos-contradice'
  report_id   uuid not null references public.citizen_reports(id),
  expected    text check (expected in ('coincide','no_coincide','no_concluyente')),
  environment text not null default 'staging',
  created_at  timestamptz not null default now(),
  primary key (qa_batch_id, case_id)
);
```

Iván/Mati cargan cada fila **después** de crear el reporte (o antes, con el `report_id` conocido). La función registra el intento y el export une por `report_id`. Así el lote queda definido solo por las filas que se cargaron, no por una ventana horaria.

### 4.2 Un registro por intento

```sql
-- Aplicado (versión 20261008174835); ver el archivo de la migración para la definición completa.
create table public.visual_call_log (
  call_id            uuid primary key default gen_random_uuid(),
  image_id           uuid not null,         -- sin FK: debe sobrevivir si se borra la foto
  report_id          uuid not null,
  queue_message_id   bigint,
  attempt            int  not null,         -- 1..4 dentro de la pasada
  stage              text not null default 'visual',
  deployment_id      text,                  -- commit de la función (secret/const)
  prompt_version     text not null,
  model_requested    text not null,
  model_returned     text,                  -- usage/response.modelVersion
  started_at         timestamptz not null,
  finished_at        timestamptz not null,
  duration_ms        int not null,
  http_status        int,
  status             text not null check (status in ('ok','http_error','network_error','timeout','blocked','invalid_output')),
  error_code         text,
  error_message      text,                  -- redactado, sin contenido de la foto
  input_tokens       int,
  output_tokens      int,                   -- incluye thinking (igual que hoy)
  thinking_tokens    int,
  raw_usage_metadata jsonb,                 -- usageMetadata original
  visual_result      text                   -- coherence si hubo respuesta válida
);
create index on public.visual_call_log (report_id);
-- RLS habilitada sin policies de lectura para authenticated; solo service_role escribe/lee.
```

Cambios hechos en `analyze.ts`, `index.ts` y `contract.ts`: se escribe una fila en cada vuelta del bucle de modelos. Los intentos fallidos se guardan en el acto; el que respondió se guarda con su desenlace final (`ok`, `blocked`, `incomplete`, `invalid_output`) **antes** de persistir el análisis. Un `try/catch` hace que el registro **nunca** rompa el análisis si falla. `deployment_id` puede venir de un secret `FUNCTION_COMMIT` cargado al desplegar.

### 4.3 Qué NO cambia

`report_image_analysis`, la pantalla, el RAG textual (`analizar-reporte`), `quarantine-anonymize`, el despachador. Se agrega una función de exportación (consulta SQL, §5.2).

### 4.4 Mientras no esté hecho (alternativa de emergencia)

Los logs de la Edge Function de Supabase conservan poco tiempo y no tienen tokens por intento. **No** recomendado como fuente de medición. Sin §4.2 solo se pueden medir con rigor las fotos que respondieron en el primer intento del modelo principal.

---

## 5. Prueba de humo y export

### 5.1 Procedimiento (a ejecutar después de §4)

1. Cargar en `visual_qa_cases` un caso `qa_batch_id = 'REP-3822-SMOKE'`, `case_id = 'smoke-01'`, con `environment = 'staging'`.
2. Crear un reporte con **una foto** ya protegida (categoría ≠ Vulnerabilidad social) y esperar 1–2 minutos (el cron corre cada minuto).
3. Exportar con la consulta de §5.2 y comprobar: un `call_id` por intento, `model_requested`, tokens, duración, resultado y `raw_usage_metadata` no nulo.
4. Anotar `report_id` y `call_id` en la ficha (§8).
5. Separar este humo de la muestra: usar un `qa_batch_id` distinto al del lote (`REP-3822-QA-01`).

### 5.2 Consulta de exportación (CSV)

```sql
-- Funciona una vez creadas las tablas de §4.
select c.qa_batch_id, c.case_id, c.environment,
       l.report_id, l.image_id as photo_id,
       (select count(*) from report_images ri where ri.report_id = l.report_id) as photo_count,
       l.call_id, l.attempt, l.stage,
       l.deployment_id, l.prompt_version,
       l.model_requested, l.model_returned,
       l.started_at at time zone 'UTC' as started_at_utc,
       l.started_at at time zone 'America/Argentina/Buenos_Aires' as started_at_ar,
       l.finished_at, l.duration_ms,
       l.input_tokens, l.output_tokens, l.thinking_tokens,
       l.raw_usage_metadata,
       l.status, l.http_status, l.error_code, l.error_message,
       l.visual_result, c.expected
from visual_call_log l
join visual_qa_cases c on c.report_id = l.report_id
where c.qa_batch_id = :'qa_batch_id'
order by l.started_at;
```

### 5.4 Resultado del humo (2026-10-08) **[EVIDENCIA]**

| Campo | Valor |
|---|---|
| Reporte | `c8692db2-ceb8-4c9b-a19d-34cac7cf3110` (1 foto, `COMERCIO_IRREGULAR`, staging) |
| Lote / caso | `REP-3822-SMOKE` / `smoke-01` (cargado a mano en `visual_qa_cases`, `expected` nulo) |
| `call_id` / intento | `83a3d957-b942-44a6-82d9-0ba9ce083b07` / 1 |
| Modelo pedido / devuelto | `gemini-3.8-flash` / `gemini-3.8-flash` |
| Inicio / fin | `2026-10-08T15:10:02.519-03:00` / `2026-10-08T15:10:05.766-03:00` (UTC `18:10:02.519Z` / `18:10:05.766Z`) |
| Duración | 3 247 ms (coincide con `latency_ms` de `report_image_analysis`) |
| Tokens | entrada 1 586 (texto 486 + imagen 1 100), salida 97, total 1 683 |
| `thinking_tokens` | NULL: con `thinkingLevel low` la API no informó `thoughtsTokenCount` |
| Estado / resultado | `ok`, HTTP 200 / `coincide` |
| Cruce con el resultado final | `report_image_analysis`: `completado`, `coincide`, mismos tokens y latencia |
| `deployment_id` | NULL (no se cargó el secret `FUNCTION_COMMIT`) |

Lo que demuestra: la foto se relaciona con su reporte, lote, intento, modelo, tokens, uso original, duración y resultado; el registro coincide con el análisis final. **No** probó todavía el registro de un intento fallido ni del fallback (cubierto solo por pruebas unitarias). Útil para el costo: la imagen pesa 1 100 tokens de 1 586 de entrada.

### 5.3 Export posible **hoy** (solo resultado final, sin intentos)

Sirve para mostrar la línea base y las columnas que ya existen; **no** reemplaza el humo de §5.1.

```sql
select a.report_id, a.image_id as photo_id,
       (select count(*) from report_images ri where ri.report_id = a.report_id) as photo_count,
       a.status, a.coherence as visual_result, a.model_code, a.prompt_version,
       a.input_tokens, a.output_tokens, a.latency_ms,
       a.created_at, a.status_reason
from report_image_analysis a
order by a.created_at;
```

---

## 6. Línea base real (datos de CiudadAR al 2026-10-08, ~14:00 -03:00)

Fuente: `report_image_analysis`, 162 filas desde el 2026-10-05. **Mezcla pruebas manuales, la QA de Sprint 15 y reportes de prueba**; sirve como orden de magnitud, **no** como muestra del lote.

| Estado | Resultado | Modelo | Filas | Latencia media | Entrada media | Salida media* |
|---|---|---|---:|---:|---:|---:|
| completado | coincide | gemini-3.8-flash | 124 | 2 901 ms | 1 586 | 106 |
| completado | no_coincide | gemini-3.8-flash | 25 | 3 440 ms | 1 572 | 164 |
| completado | no_concluyente | gemini-3.8-flash | 1 | 5 834 ms | 1 545 | 408 |
| completado | coincide | gemini-3.7-flash (fallback) | 1 | 5 554 ms | 1 592 | 225 |
| omitido | — (`categoria_no_analizable`) | — | 9 | — | — | — |
| fallido | — (superó 3 reintentos) | — | 2 | — | — | — |

\* `output_tokens` = salida visible + thinking.

Lectura rápida:
- ~**1 580 tokens de entrada y 100–400 de salida** por foto; ~3 s por llamada.
- Las 9 `omitido` **no consumen modelo** (no sumar al costo).
- Las 2 `fallido` no tienen tokens: no se sabe cuántas llamadas hubo detrás (justo la brecha de §3).
- Los números de tokens no están convertidos a dinero: **tarifa pendiente de verificar** al medir (https://ai.google.dev/gemini-api/docs/pricing). Leo calcula costos.

---

## 7. AI Studio, Billing y plan de QA

### 7.1 Qué usar como fuente de qué

| Dato | Fuente | Nota |
|---|---|---|
| Tokens, latencia, intentos, resultado del lote | **CSV del backend** (§5.2) filtrado por `qa_batch_id` y timestamps | Fuente exacta |
| Contexto histórico de consumo | AI Studio (90 días) | No conciliar con el CSV Billing 07/09–06/10 |
| Gasto monetario | Billing, proyecto explícito `gen-lang-client-0092300839`, agrupado por SKU | Leo; registrar hora de captura, período, filtros y zona (UTC−8 en AI Studio) |

Cautela: la clave Gemini es compartida con el RAG textual y con experimentos. Una diferencia en Billing antes/después **no** prueba costo exclusivo del lote si hubo otras llamadas. Anotar consumo concurrente en la ficha. Si se usa una clave separada para QA visual, registrar **solo su alias**.

### 7.2 Diseño del lote (propuesta para acordar con Iván y Leo) **[PENDIENTE]**

| Elemento | Propuesta |
|---|---|
| `qa_batch_id` | `REP-3822-QA-01` (y `REP-3822-SMOKE` aparte) |
| `case_id` | `C01…Cnn`, con el resultado esperado fijado **antes** de ejecutar |
| Tipos de caso | coincide claramente · contradice la descripción · evidencia insuficiente (`no_concluyente`) |
| Cantidad de fotos | reportes de **1, 2 y 3 fotos** (la app permite hasta 4) |
| Tamaño y repeticiones | a acordar según el tiempo del sprint; no declarar «muestra estadística» por un número fijo |
| Si las fotos de un reporte discrepan | hoy no se agrega: se reporta cada foto. Definir regla si se necesita un único resultado por reporte |
| Congelar el lote | si cambia modelo, prompt o despliegue durante el lote, **cerrarlo** o abrir una cohorte nueva (`-02`); anotar inicio y fin exactos |
| Comparación textual | medir `analizar-reporte` con las mismas descripciones (ya guarda `latency_ms` desde PR #151); modelo `gemini-3.8-flash` + `gemini-embedding-2`, `thinkingLevel: low`, `maxOutputTokens: 2048` |

---

## 8. Ficha para completar y subir a REP-3822

Valores ya confirmados; lo marcado **[PENDIENTE]** requiere acción de Mati.

```text
Estado: v1 desplegada (recorrido probado el 2026-10-05); registro de intentos v2 desplegada el 2026-10-08T15:06:05-03:00 (rama feat/REP-3822-registro-de-intentos-visuales, PR pendiente); humo ejecutado el 2026-10-08
URL staging: https://reportalo-staging.vercel.app/ · Backend: https://yryuhyiujyignkdhiyua.supabase.co (proyecto CiudadAR, única base de datos; no hay producción separada)
Commit/deployment frontend: [PENDIENTE] (id de deploy de Vercel)
Commit/deployment backend: analizar-imagen-reporte v1, commit del código dfcc834,
  ezbr_sha256 fa7e518f3a8d05bd2a49a0a1704442a9e46bb119c7c2b3a1d73c2c88d3950999
Despliegue técnico (fecha, hora, zona): 2026-10-05T18:43:01-03:00 (2026-10-05T21:43:01Z)
Primera prueba integrada exitosa (fecha, hora, zona): 2026-10-05T18:50:04-03:00 (2026-10-05T21:50:04Z)
Reporte/llamada de humo: reporte c8692db2-ceb8-4c9b-a19d-34cac7cf3110 · call_id 83a3d957-b942-44a6-82d9-0ba9ce083b07 · lote REP-3822-SMOKE / smoke-01 (2026-10-08T15:10:02.519-03:00, staging, resultado coincide)
Modelo solicitado y versión devuelta: gemini-3.8-flash (nombre fijo, no alias -latest);
  versión devuelta por la API: gemini-3.8-flash (igual al pedido, sin sufijo de revisión; medido en el humo)
Prompt/configuración/thinking/límite salida: visual-v1 · thinkingLevel low · maxOutputTokens 1024 ·
  responseSchema JSON obligatorio · sin temperature · timeout 20 s · imagen sin redimensionar ni comprimir (base64 inline, tope 10 MB)
Fotos por llamada y agregación de resultados: 1 foto por llamada; sin agregación por reporte (una tarjeta por foto); costo por foto real, no promediado
Fallback y política de reintentos: gemini-3.8-flash x2 (espera 1,5 s) → gemini-3.7-flash x1 → gemini-3.5-flash-lite x1 ante
  401/403/404/408/429/5xx o red; HTTP 400 no cambia de modelo; mensaje de cola con hasta 3 pasadas.
  Fallback observado una vez (gemini-3.7-flash, 2026-10-07)
Funciones Vision actuales: FACE_DETECTION siempre; OBJECT_LOCALIZATION + TEXT_DETECTION en la rama de patentes
  (quarantine-anonymize, REP-3793). Corre antes de la verificación; costo separado
Identificador del lote QA: [PENDIENTE] REP-3822-QA-01 (propuesto) y REP-3822-SMOKE; acordar con Leo e Iván
Dónde se registra y cómo se exporta: resultado final en report_image_analysis; cada intento en visual_call_log (tablas creadas el 2026-10-08, se llenan al desplegar la v2); lotes en visual_qa_cases; export SQL a CSV (§5.2)
¿Se conservan intentos fallidos?: v1 desplegada: NO. v2 (rama): SÍ, incluidos reintentos, fallback, timeouts y 503, con tokens null si no hubo respuesta
¿Salida incluye thinking?: SÍ (con thinkingLevel low el humo no informó thoughtsTokenCount: thinking_tokens queda NULL = no informado, equivale a 0 en output_tokens). output_tokens = candidatesTokenCount + thoughtsTokenCount; no sumar thinking de nuevo
Campos pendientes: qa_batch_id, case_id, call_id, attempt, deployment_id, model_requested, model_returned (modelVersion),
  started_at/finished_at, thinking_tokens, raw_usage_metadata, error_code
Inicio/fin del lote (a completar al ejecutar): ______ / ______
Archivos/evidencias adjuntas: este documento; docs/export/REP-3822_humo_visual_call_log.csv; CSV del lote [PENDIENTE hasta correr el QA]
Limitaciones y siguiente acción:
  - Sin identificación de lote ni de intentos no se puede atribuir costo con rigor → implementar §4 antes de la muestra principal.
  - Línea base de §6 mezcla pruebas y QA de sprint; no usarla como muestra.
  - Una sola base (CiudadAR): confirmar si staging y producción comparten backend.
  - Tarifas: verificar al medir.
```

---

## 9. Checklist de entrega a REP-3822

- [x] Disponibilidad técnica y primera prueba exitosa (§1.2).
- [x] Modelo, configuración, fallback y versión de prompt (§2).
- [x] Mapeo de campos y lugar de registro actual (§3).
- [x] URL de staging (https://reportalo-staging.vercel.app/) y base única CiudadAR.
- [ ] Deploy del frontend (id de Vercel) — Mati.
- [x] Tablas `visual_call_log` y `visual_qa_cases` creadas y verificadas (§4).
- [x] Función v2 desplegada (2026-10-08T15:06:05-03:00).
- [ ] Abrir y mergear el PR de la rama (el código desplegado ya es el de la rama).
- [ ] Acordar `qa_batch_id` y casos con Iván y Leo (§7.2).
- [x] CSV de humo que demuestra recuperación de campos: `docs/export/REP-3822_humo_visual_call_log.csv` (§5.4).
- [ ] Después del QA: CSV completo del lote y horarios de inicio y fin.

## 10. Próximos pasos

1. Abrir el PR de `feat/REP-3822-registro-de-intentos-visuales` hacia `staging` (lo abre Mati) y desplegar la función v2.
2. Correr el humo (§5.1) con `qa_batch_id = 'REP-3822-SMOKE'` y exportar el CSV (§5.2).
3. Acordar con Leo e Iván el lote `REP-3822-QA-01` y cargar los casos en `visual_qa_cases` antes de ejecutar.
