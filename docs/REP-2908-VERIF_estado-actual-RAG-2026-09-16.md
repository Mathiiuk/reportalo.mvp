# Estado actual del RAG jurídico (REP-2908/2909/3772/2908-VERIF) — 2026-09-16

Snapshot armado leyendo: historial de git (`staging` + rama actual), el proyecto Supabase real **CiudadAR** (`yryuhyiujyignkdhiyua`) vía MCP (advisors, migraciones, tablas, conteos), y el diff sin commitear de la rama de trabajo. No se consultó Jira (el conector devolvió error de política de sitio para `unlz2026.atlassian.net`); el detalle de rondas se reconstruyó de los mensajes de commit, que citan cada ticket.

## 1. Resumen ejecutivo

El RAG dejó de ser el spike de REP-2907 (corpus hardcodeado + embeddings por keyword-matching) y hoy es un pipeline real, **desplegado y corriendo contra Supabase productivo**:

- Esquema `knowledge_sources` / `knowledge_fragments` / `fragment_embeddings` / `source_adhesions` con cascada de jurisdicción resuelta en SQL (RPC `match_knowledge_fragments`).
- Embeddings reales con `gemini-embedding-2` (768d) y generación con `gemini-3.8-flash`.
- Edge Function `analizar-reporte` (Deno, v13 activa) disparada async vía `pg_cron` + `pgmq` + `pg_net` al insertar en `citizen_reports`.
- Falla cerrado a `indeterminado`/`sin_normativa` cuando no hay evidencia suficiente o el RPC/LLM fallan — nunca inventa una cita.
- 49 reportes reales procesados en producción, 49 análisis persistidos (2 indeterminados, 10 sin_normativa, el resto con fundamento).

Desde que se cerró REP-2908/2909 (PRs #57, #58), el trabajo pasó a una **ronda de verificación de seguridad y correctitud** (REP-2908-VERIF) liderada por devoluciones de Hernán, con 4 rondas hechas (V-01 a V-13, P-01 a P-08) y una quinta en curso ahora mismo en esta rama.

## 2. Qué está hecho (verificado contra Supabase real)

### 2.1 Arquitectura RAG (REP-2908/2909)
- `legalRagService.js` reescrito: sin `INITIAL_LEGAL_CORPUS` ni `generateDeterministicEmbedding`.
- `src/services/geminiClient.js`: clientes de embeddings/generación inyectables (testeable sin red).
- Esquema `knowledge_*` en producción con datos reales: 8 fuentes, 15 fragmentos, 15 embeddings, 1 adhesión (`source_adhesions`) — cascada municipio → provincia/CABA → nación funcionando.
- `analizar-reporte` (Edge Function, versión activa **13**) implementa: vectorizar → `match_knowledge_fragments` con filtro por categoría (V-09) → umbral de similitud → generación con Gemini restringida a los fragmentos recuperados → validación de esquema → persistencia.
- Pipeline async real: `pg_cron` + `pgmq` + `pg_net` contra `citizen_reports`, con límite de reintentos y limpieza (V-06/V-08).
- 49/49 reportes reales tienen fila en `report_ai_analysis`; `report_ai_evidence` tiene 250 filas (citas por reporte).

### 2.2 Ronda de verificación de seguridad (REP-2908-VERIF)
Cerrado y mergeado a `staging` (PRs #62–#73):
- **V-01/V-07**: API key de Gemini que había quedado filtrada, rotada; trigger que la exponía desactivado.
- **V-03**: `search_path` fijado en 10 funciones (mitiga la advertencia de Security Advisor sobre `search_path` mutable).
- **V-05**: historial real de Supabase versionado como migraciones (`supabase/migrations/`).
- **V-06/V-08/V-11**: límite de reintentos del pipeline async, limpieza de mensajes de cola, `prompt_version` agregado y verificado en producción.
- **V-09**: filtro por categoría del ciudadano en `match_knowledge_fragments` (antes recuperaba fragmentos de cualquier categoría) + fix crítico de `embedding_model_code NOT NULL` que hacía perder registros de análisis en silencio (Caso F, falso positivo reproducible).
- **P-02, P-04, P-06, P-08** (ronda 4): RLS de lectura para 14 tablas, DDL de 13 tablas de producción documentado, ronda de `status_reason`/tokens en curso (ver §3).

### 2.3 Seguridad actual (Supabase Security Advisor, corrido ahora)
- **Sin hallazgos de nivel ERROR.**
- 1 `WARN` real de infraestructura: extensión `vector` instalada en `public` (debería moverse a un schema propio) — cosmético/bajo riesgo, no urgente.
- `leaked_password_protection` deshabilitado (HaveIBeenPwned) — un toggle en Auth settings, no requiere código.
- El resto de los `WARN` (`SECURITY DEFINER` ejecutable por `anon`/`authenticated`, RLS con acceso anónimo) son, en su mayoría, comportamiento **intencional** del producto (lectura pública de reportes/normativas/zonas, RPCs de solo-lectura como `get_infraction_stats`) — no son hallazgos nuevos, ya fueron revisados en rondas previas.

## 3. Qué falta / está en curso ahora mismo

### 3.1 En esta rama, sin commitear todavía
`fix/REP-2908-VERIF-v03-security-hardening` tiene cambios locales sin commit (P-02 y P-06 de la ronda 4), **aún no desplegados**:
- **P-02** — `status_reason`: hoy la Edge Function desplegada (v13) *no* guarda el motivo cuando un análisis queda `indeterminado`/`sin_normativa` por una razón técnica (error de RPC, cita no literal, `organismo_sugerido_id` inválido) — se confirmó en producción: la columna `status_reason` ya existe en `report_ai_analysis`, pero las 12 filas indeterminadas/sin_normativa actuales tienen `status_reason = null` (0 de 49 filas con motivo). El fix ya está escrito en `src/services/reportAiAnalysisPersistence.js` y en el espejo de `supabase/functions/analizar-reporte/index.ts`, con tests actualizados — falta commitear, PR y `deploy_edge_function`.
- **P-06** — control de costo/tokens: `maxOutputTokens: 2048` en la llamada a Gemini (tope de salida) + se empieza a sumar `thoughtsTokenCount` (tokens de razonamiento, que Gemini factura como salida) a `output_tokens`, que hoy se estaba subestimando. También escrito, no desplegado.

### 3.2 Deuda de migraciones (hallazgo de esta sesión, relacionado con P-08)
Hay drift entre los archivos de migración versionados en el repo y el historial real aplicado en Supabase:
- `supabase/migrations/20260916020000_p02_status_reason.sql` y `20260915160000_v04_seed_demo_profiles_and_reports.sql` están en el filesystem local pero **no** aparecen en `list_migrations` del proyecto remoto.
- Al revés: `fix_states_provinces_missing_rls_policy` (2026-09-16) y `create_pgmq_delete_wrapper` aparecen aplicados en Supabase pero no hay un archivo `.sql` con ese nombre exacto en el repo (posible aplicación directa vía MCP/dashboard sin pasar por archivo versionado, o nombre de archivo distinto al de la migración registrada).
- Esto es exactamente el tipo de problema que P-08 (ronda 4) ya señaló para las 13 tablas de producción nunca versionadas — sigue sin resolverse del todo: falta una reconciliación completa migración-por-migración entre repo y remoto antes de poder confiar en `supabase migration list` como fuente de verdad.

### 3.3 Advisors de seguridad/performance pendientes de decisión (no bloqueantes, no nuevos)
- **16 tablas con RLS activado pero sin ninguna policy** (`agencies`, `profiles`, `report_events`, `knowledge_sources` está bien pero p.ej. `agencies`, `countries`, `embedding_models`, `fragment_embeddings`, `generation_models`, `infraction_types`, `service_attributes`, etc.) — hoy son ilegibles para `anon`/`authenticated` vía API pública (probablemente intencional para catálogos internos, pero conviene que alguien confirme cuáles deberían tener lectura pública igual que sus pares `knowledge_fragments`/`source_types`).
- 38 foreign keys sin índice de cobertura (`unindexed_foreign_keys`, nivel INFO) — candidatas a index si el volumen crece; hoy con 49 reportes no es urgente.
- Índices duplicados (`infractions_location_idx`/`idx_infractions_location`, y 3 más en `localities`/`states_provinces`/`subdivisions`) — limpieza trivial.
- `auth_rls_initplan`: 12 policies re-evalúan `auth.<fn>()` por fila en vez de `(select auth.<fn>())` — optimización de performance, no de seguridad.
- Proyecto descartable `reportalo-p08-verificacion-descartable` (creado 2026-09-16, probablemente para probar P-08 en aislamiento) sigue activo — si ya no se usa, conviene pausarlo/eliminarlo para no dejar un proyecto Supabase huérfano.

### 3.4 Pendientes de arquitectura de más largo plazo (del docx REP-1009, §12, R-1 a R-6 — no se verificó si siguen abiertos)
Según la memoria de la migración original, estas decisiones (DER v3.2, adhesión CABA/Ley 24.449, parámetros iniciales de retrieval, si el filtro por categoría del ciudadano condiciona el retrieval) requerían sign-off explícito de Matías/Hernán. Dado que V-09 ya implementó el filtro por categoría, ese punto parece resuelto en la práctica — conviene confirmar con Hernán si el resto de R-1 a R-6 se dio por cerrado formalmente o sigue pendiente de decisión escrita.

## 4. Próximos pasos sugeridos

1. Commitear y desplegar P-02/P-06 (diff ya escrito en esta rama) → cierra la ronda 4 completa.
2. Reconciliar migraciones locales vs. remotas (§3.2) antes de sumar más migraciones nuevas, para no perder trazabilidad.
3. Confirmar con Hernán qué tablas de catálogo deberían tener policy de lectura pública (§3.3) y agregar la migración correspondiente si aplica.
4. Decidir si pausar/borrar el proyecto Supabase descartable de P-08.
5. Habilitar "Leaked Password Protection" en Auth (toggle, sin código).
