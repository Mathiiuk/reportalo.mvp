# Implementation Plan — TASK-ID

## 1. Resumen

## 2. Repositorio inspeccionado

- Stack:
- Runtime:
- Package manager:
- Branch base:
- CI actual:

## 3. Cambios propuestos

### [MODIFY]
- `path/to/file`

### [NEW]
- `path/to/file`

### [DELETE]
- `path/to/file`

## 4. Estrategia de implementación

## 5. Migraciones / datos

## 6. Seguridad

## 7. Observabilidad

## 8. Compatibilidad / rollback

## 9. Plan de verificación

- [ ] Lint
- [ ] Typecheck
- [ ] Unit
- [ ] Integration
- [ ] E2E
- [ ] Build
- [ ] Security
- [ ] Smoke

## 10. Definition of Done

## 11. Aprobación requerida

- [ ] No requerida
- [ ] Requerida

## 12. Notas de ejecución

**14/09/2026 — V-01 (clave service_role filtrada):**
- Confirmado: el trigger heredado `audit_ia` (sobre `infractions`, 0 filas) tenia un JWT
  `service_role` en texto plano en el header `Authorization` de su llamada a
  `supabase_functions.http_request`. La consulta 1 del documento de Hernan (regex sobre
  `pg_proc.prosrc`) no lo detecta porque la clave vive en `pg_trigger`, no en el codigo de
  una funcion — hallazgo nuevo a sumar a V-01.
- Se desactivo el trigger sin borrarlo (`alter table infractions disable trigger audit_ia`),
  con OK explicito de Matias. Verificado `tgenabled = 'D'`.
- **V-01 CERRADO.** Matias creo una `secret key` nueva (`sb_secret_...`, formato moderno) en
  Supabase (Settings > API Keys > Publishable and secret API keys) y actualizo el secreto
  de Vault `rag_service_role_key` via `vault.update_secret` desde el SQL Editor del
  dashboard (nunca paso el valor por este chat). Verificado `updated_at` posterior a
  `created_at` en `vault.secrets`.
  Se corrio V-07 (ver abajo) con la clave nueva antes de invalidar la vieja: el pipeline
  funciono sin cambios pese a que `analizar-reporte` tiene `verify_jwt: true` (riesgo que se
  habia anticipado: las `secret key` no son JWT; en la practica Supabase las acepto igual).
  Recien despues Matias deshabilito las "Legacy anon, service_role API keys" (JWT-based)
  desde el dashboard, invalidando la `service_role` filtrada. Confirmado que el sitio en
  produccion sigue funcionando (la `anon`/publishable ya estaba actualizada en Vercel).
  El texto de la clave vieja sigue escrito en la definicion del trigger `audit_ia`
  (desactivado, sin borrar — regla 4 del documento) pero ya no es una clave valida: inerte,
  no un riesgo activo.

**14/09/2026 — V-02 (backup en git):**
- Confirmado: `supabase/backups/2026-09-14_pre-deploy-rag/` (commit `f17e512`) ya esta
  pusheado y mergeado en `origin/staging` — no estaba en `.gitignore`.
- Se reviso el contenido del backup commiteado: NO contiene el JWT de `audit_ia` (el dump
  de `schema_triggers.json` no capturo los headers completos), pero si contiene datos
  reales de 44 tablas (perfiles, reportes, etc.) ya expuestos en el historial de la rama
  principal. Pendiente decidir con Hernan/Leonel si se limpia el historial.

**14/09/2026 — V-03 (Security Advisor):**
- 0 tablas sin RLS. 17 tablas con RLS habilitado sin ninguna politica (deny total, no
  hueco) — mayoria de solo-lectura server-side; a confirmar con Hernan cuales son
  intencionales.
- Hallazgo nuevo no listado en el documento: `dispatch_rag_analysis_queue` y
  `enqueue_rag_analysis` (`SECURITY DEFINER`) eran ejecutables via RPC publico por `anon` y
  `authenticated` — relevante para V-08 (riesgo de disparo de costo real sin autenticarse).
  Corregido: `revoke execute ... from public` + `revoke ... from authenticated` (el REVOKE
  inicial solo sobre `anon` no alcanzo porque el privilegio se heredaba de `PUBLIC`).
  Verificado con `has_function_privilege`: `anon`/`authenticated` ya no pueden, `postgres`/
  `service_role` si. Confirmado que el trigger `trg_enqueue_rag_analysis` (habilitado) y el
  cron `rag-analysis-dispatch` (activo, cada minuto) siguen funcionando sin cambios.
- Pendientes menores (WARN, no bloqueantes): 10 funciones sin `search_path` fijo, extension
  `vector` en schema `public`, proteccion de contraseñas filtradas desactivada en Auth.

**14/09/2026 — V-04 (estado real de la base):**
- PARTE 8 corrida completa: todo `OK` salvo `profiles` (5 de 6 esperados) y
  `citizen_reports`/`report_state_history` (0 de 8 / 0 de 18) — los seeds de reportes demo
  (incluido el perfil `ciudadano.demo`) nunca se recargaron tras el incidente de borrado
  documentado en sesiones anteriores. Los 5 perfiles existentes son cuentas reales del
  equipo, no seed.
- PARTE 5B/6 presentes (`report_events`, `profile_attends_report`, `mark_report_viewed`,
  `source_adhesions`, `generation_models`, etc. — todo `true`).
- Las 15 huellas md5 del corpus coinciden exactamente con las esperadas.
- Cascada jurisdiccional correcta: Piñeyro (BA) recibe Ley 24.449 (nivel 3), Retiro (CABA)
  no la recibe, Avellaneda (Santa Fe) no recibe nada.
- Pendiente: decidir si se recargan los seeds demo (dispara 8 analisis reales de Gemini,
  bajo costo, sirve ademas como evidencia de V-07) — bloquea V-07 tal como esta escrito en
  el documento de Hernan (requiere el perfil `ciudadano.demo`).

**14/09/2026 — V-12 (clave de Gemini en el frontend):**
- `legalRagService.js`/`geminiClient.js` no tienen ningun import real desde paginas o
  componentes (solo desde tests) — quedaron huerfanos del lado cliente.
- `pnpm run build` + grep sobre `dist/`: cero coincidencias de `AIza...`, `generativelanguage`
  o codigo de `geminiClient` — eliminados por tree-shaking al no ser alcanzables desde el
  entrypoint. V-12 cerrado.

**14/09/2026 — V-07 (prueba de punta a punta):**
- El script exacto del documento no corre tal cual: no existe el perfil `ciudadano.demo`
  (confirmado en V-04). El servicio `TRANSITO` si existe. Se adapto usando el perfil real
  `krepchukmatias@gmail.com` en su lugar, con OK explicito de Matias antes del insert.
- Insert a las 23:51:48 (report id `40000000-0000-4000-8000-000000000101`, client_side_id
  `30000000-0000-4000-8000-000000000101`, Retiro/CABA, categoria TRANSITO). No se borra
  (queda como evidencia, regla del documento).
- `report_ai_analysis` creado a las 23:52:03 (~15s despues del insert): `fundamentado`,
  `is_infraction: true`, `confidence_score: 0.98`, `generation_model_code: gemini-3.8-flash`.
- Cola `pgmq.q_rag_analysis_queue` vacia para ese mensaje (procesado y removido).
- `report_ai_evidence`: 6 fragmentos recuperados, todos de jurisdiccion CABA (cero
  resultados de la Ley 24.449, que es de alcance nacional/PBA) — confirma el filtro
  jurisdiccional funcionando. 2 citas literales, ambas sobre rampas para personas con
  discapacidad, coincidentes con el texto del reporte de prueba.
- **V-07 CERRADO**, corrido integramente con la clave `service_role` nueva (post-rotacion).

**14/09/2026 — V-05 (migraciones y PR):**
- Se leyo el historial interno real de Supabase (`supabase_migrations.schema_migrations`,
  visible via MCP `list_migrations` + `execute_sql`) en vez de reconstruir de memoria: tiene
  el SQL exacto de cada cambio aplicado a mano durante el despliegue original, con su
  timestamp real. Se versionaron como archivos en `supabase/migrations/` con esos mismos
  timestamps y nombres, para que coincidan exactamente:
  - `20260914150658_enable_pgmq_and_pg_cron_extensions.sql`
  - `20260914150751_restrict_report_ai_analysis_rls_rep2909.sql`
  - `20260914164131_create_vault_secret_rag_function_url.sql` (solo la URL, no es secreto)
  - `20260914170000_rag_async_pipeline.sql` (cola + trigger + dispatch + cron; **no** esta en
    el ledger de Supabase porque se aplico a mano en el SQL Editor, bloqueada la via MCP por
    el clasificador de permisos — ver `scripts/rag-local-dev/apply-async-pipeline.sql`;
    corregido el schedule inicial a `* * * * *`, igual al real, no el `*/10 segundos` que
    tenia ese script de desarrollo local)
  - `20260914184913_fix_rag_dispatch_cron_schedule.sql`
  - `20260914185641_create_pgmq_delete_wrapper.sql` — **hallazgo nuevo no documentado en
    ningun lado hasta ahora**: el schema `pgmq` no esta expuesto en la API de datos de
    Supabase, asi que el borrado de mensajes procesados desde la Edge Function fallaba
    silenciosamente ("Invalid schema: pgmq") y los reprocesaba cada minuto para siempre. Ya
    resuelto con un wrapper `SECURITY DEFINER` en `public`, exclusivo de `service_role`.
  - `20260914205949_add_rls_policies_report_images.sql`
  - Los 4 archivos de V-01/V-03 (231225, 232828, 233035, 233251) ya commiteados antes.
- **Excluido a proposito** (regla del documento de Hernan, punto 2 y 3 de "Que hacer" en
  V-05): los 3 backfills de embeddings (`backfill_fragment_embeddings_batch_1/2/3`, con los
  vectores completos) no se versionan como migracion — se documenta que existen en el
  ledger de Supabase y que el comando para regenerarlos es
  `node scripts/rag-local-dev/generate-fragment-embeddings.mjs`. La creacion del secreto de
  Vault `rag_service_role_key` (con el valor de la clave) tampoco se versiona; solo se
  documenta el nombre.
- Se eliminaron del working tree los archivos sueltos que quedaban redundantes con las
  migraciones formales (`supabase/report_images_rls_policies.sql`, ya cargado como
  migracion 205949) — `supabase/rag_rls_policies.sql` y
  `scripts/rag-local-dev/apply-async-pipeline.sql` se dejan como estaban (documentan el
  contexto original) pese a la redundancia, para no perder historia ya commiteada sin
  pedirlo.
- Pendiente: abrir el Pull Request contra `staging` (la base real de este branch; el
  documento de Hernan dice `develop`, que no existe en este repositorio) una vez que Matias
  confirme que se puede pushear la rama.

**14/09/2026 — V-06 (mismo embedding en script y Edge Function):**
- Comparados los parametros de `scripts/rag-local-dev/generate-fragment-embeddings.mjs`
  contra `supabase/functions/analizar-reporte/index.ts` (fuente real desplegada, leida via
  MCP `get_edge_function`): mismo modelo (`gemini-embedding-2`), mismas 768 dimensiones,
  mismo formato de request, sin `taskType` en ninguno de los dos.
- Se genero el embedding de FR12 con el mismo codigo exacto de la Edge Function (script
  aislado, usando el `GEMINI_API_KEY` local) y se comparo contra el guardado en
  `fragment_embeddings` via coseno (`1 - (a <=> b)`). **Similitud: 1.0** (identico) — muy por
  encima del umbral de 0.99 pedido.
- **V-06 CERRADO.**

**14/09/2026 — V-11 (modelo de generacion y parametros):**
- `generation_models` activo: `gemini-3.8-flash`, coincide con `GENERATION_MODEL` en la
  Edge Function.
- Parametros de la llamada de generacion (leidos del codigo real): sin `temperature`
  explicito (usa el default de la API), `thinkingConfig: { thinkingLevel: 'low' }`,
  `responseSchema` presente (`LLM_OUTPUT_SCHEMA`), sin limite explicito de tokens de salida.
- **Hallazgo:** `prompt_version` nunca se popula — no aparece en ningun lado del codigo de
  `analizar-reporte/index.ts` (`buildAnalysisRow` no lo incluye). El resultado de V-07
  confirma esto (`prompt_version: null` en la fila creada). El criterio de cierre de V-11
  ("cada analisis guarda generation_model_code y prompt_version") no se cumple del todo:
  `generation_model_code` si se guarda, `prompt_version` no.
- **V-11 PARCIAL** — falta que se decida un esquema de versionado de prompt (podria ser un
  string fijo por ahora, ej. `'v1'`, incrementado a mano cuando cambien las instrucciones) y
  agregarlo a `buildAnalysisRow`.

**14/09/2026 — V-08 (limite de reintentos y alerta de presupuesto):**
- Confirmado el hallazgo: `dispatch_rag_analysis_queue` no revisaba `read_ct` en ningun
  lado — un mensaje que falla siempre queda reintentandose cada minuto para siempre, con
  costo real de Gemini en cada intento.
- Confirmado el crecimiento de `cron.job_run_details`: 350 filas en ~7.5 horas (~1100/dia
  con el schedule actual de 1 minuto — mucho menor que las ~8640/dia que hubiera dado el
  schedule original de 10 segundos, pero sigue sin limite).
- Con OK explicito de Matias, aplicado contra Supabase real:
  - `dispatch_rag_analysis_queue` ahora archiva (`pgmq.archive`, nunca borra) el mensaje
    cuando `read_ct > 5` y guarda un `report_ai_analysis` con `estado: 'indeterminado'` y el
    motivo, en vez de seguir reintentando.
  - Nueva tarea programada `rag-cleanup-job-run-details` (diaria, 3am) que borra filas de
    `cron.job_run_details` de mas de 7 dias.
  - Verificado que los privilegios revocados de V-03 (`anon`/`authenticated` sin `EXECUTE`)
    se mantuvieron despues del `create or replace function`.
  - Versionado como migracion: `supabase/migrations/20260915003000_add_rag_dispatch_retry_limit_and_cleanup.sql`.
- **Pendiente (no se puede hacer via MCP/SQL):** alerta de presupuesto en Google Cloud para
  la clave de Gemini — accion manual de Matias en la consola de Google Cloud, fuera del
  alcance de las herramientas disponibles en esta sesion.
- **V-08 PARCIAL** (la parte de base de datos cerrada; falta la alerta de presupuesto).

**14/09/2026 — V-09 (35 corridas de los casos A-F):**
- No iniciado. Implica ~35 llamadas reales a Gemini (costo real, aunque bajo) y requiere
  tiempo de ejecucion considerable (los casos ya definidos en
  `docs/REP-3764_casos_esperados.md`). Se deja pendiente de autorizacion explicita antes de
  lanzar las corridas, dado el volumen de llamadas reales a un servicio pago.

**Pendiente:** V-02 (decision sobre historial de git del backup), V-04 (decidir si se
recargan los seeds demo), V-09 (autorizacion para las 35 corridas), V-11 (decidir esquema de
prompt_version), alerta de presupuesto de V-08 (accion manual de Matias), V-13.

