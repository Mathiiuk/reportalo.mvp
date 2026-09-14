# Reporte de Ejecución: REP-DEPLOY-RAG-SUPABASE-run-001

## Identificación
- **Tarea**: REP-DEPLOY-RAG-SUPABASE: Desplegar RAG productivo (REP-2908/2909) contra Supabase real
- **Rama**: `feat/REP-DEPLOY-RAG-SUPABASE-desplegar-rag-productivo-rep-2908-2909-contra-supabase-real`
- **Proyecto Supabase real**: CiudadAR (`yryuhyiujyignkdhiyua`), Postgres 17, us-east-2
- **Fecha**: 2026-09-14
- **Estado**: En progreso — puntos 1 y 2 completados y verificados (backfill de embeddings, secrets de Vault y pipeline asíncrono). Pendiente: deploy de la Edge Function `analizar-reporte` y revalidación de los 6 casos A-F contra el entorno real.

---

## 1. Resumen

Antes de tocar nada se hizo un backup completo de solo lectura de las 44 tablas + schema + RLS + funciones + extensiones del proyecto Supabase real (`supabase/backups/2026-09-14_pre-deploy-rag/`). De ahí salieron varios hallazgos que cambiaron el diagnóstico inicial:

- El schema del RAG (`knowledge_sources`, `knowledge_fragments`, `fragment_embeddings`, `match_knowledge_fragments`, etc.) **ya existía parcialmente desplegado** en Supabase real, pero `fragment_embeddings` estaba vacía (15 fragmentos sin embedding).
- `pgmq` y `pg_cron` **no estaban habilitados** (requeridos para el pipeline asíncrono de REP-2909).
- La Edge Function `analizar-reporte` **no estaba desplegada**.
- `report_ai_analysis`/`report_ai_evidence` tenían **RLS totalmente pública** (heredada de un despliegue previo del schema), sin la restricción por `profile_attends_report` que define `rag_rls_policies.sql`.
- Se encontró un JWT de `service_role` hardcodeado en texto plano en un trigger legacy no relacionado (`audit_ia` sobre `infractions`) — reportado a Matías, no tocado (fuera de alcance de esta tarea, decisión explícita de Matías de no actuar sobre esto ahora).

Con el OK explícito de Matías en cada punto, se ejecutó:

1. Habilitación de `pgmq` y `pg_cron` (extensiones, sin efecto en datos).
2. Reemplazo de las políticas RLS públicas de `report_ai_analysis`/`report_ai_evidence` por las restrictivas de `rag_rls_policies.sql` (ciudadano ve su reporte, organismo ve lo que atiende, nadie inserta desde el cliente).
3. **Backfill de embeddings reales**: se generaron los 15 embeddings (`gemini-embedding-2@768`, 768 dimensiones) con la API real de Gemini para los 15 `knowledge_fragments` ya cargados, y se insertaron en `fragment_embeddings` vía `INSERT ... ON CONFLICT DO UPDATE` (idempotente).
4. **Secrets de Vault**: `rag_analizar_reporte_url` (creado vía MCP, apunta a `https://yryuhyiujyignkdhiyua.supabase.co/functions/v1/analizar-reporte`) y `rag_service_role_key` (cargado manualmente por Matías desde el SQL Editor, sin pasar por la conversación — es un secret con bypass total de RLS, más sensible que la API key de Gemini).
5. **Resto del pipeline asíncrono** (`scripts/rag-local-dev/apply-async-pipeline.sql`): cola `rag_analysis_queue`, trigger `trg_enqueue_rag_analysis` sobre `citizen_reports`, función `dispatch_rag_analysis_queue`, cron job `rag-analysis-dispatch` (cada 10s). Este paso lo aplicó Matías manualmente porque el clasificador de permisos del entorno bloqueó el `apply_migration` automático (razón: "Protected-Scope IaC Apply" — crear un trigger sobre una tabla de producción + un cron job se trata como cambio de infraestructura de mayor alcance que habilitar extensiones o ajustar RLS).

---

## 2. Evidencia

- **Extensiones activas verificadas**: `pgmq 1.5.1`, `pg_cron 1.6.4`, `pg_net 0.20.0`, `vector 0.8.0` (`select extname, extversion from pg_extension`).
- **RLS verificado**: `report_ai_analysis` y `report_ai_evidence` ahora solo tienen políticas `SELECT` restringidas a `authenticated` con `profile_attends_report`/ownership — confirmado vía `pg_policies` y `get_advisors(type: security)` (sin nuevos hallazgos críticos introducidos por el cambio).
- **Embeddings**: `select count(*), count(distinct fragment_id) from fragment_embeddings` → `15, 15`.
- **Prueba de humo end-to-end de `match_knowledge_fragments`**: usando el embedding del fragmento "Ley 2148 art. 7.1.9 (rampas discapacitados)" como consulta contra la localidad Chacarita (CABA), el segundo resultado más similar (0.6884) es exactamente la sanción correspondiente — Ley 451 art. 6.1.52 ("...rampas para discapacitados... trescientas unidades fijas") — confirmando que la cascada jurisdiccional y la similitud semántica real funcionan correctamente sobre datos reales, replicando el comportamiento ya validado localmente para el caso B de REP-3764.
- **Scripts usados** (no committeados a `staging`, viven en esta rama): `scripts/rag-local-dev/generate-fragment-embeddings.mjs`, `scripts/rag-local-dev/fragments-to-embed.json`, y los `insert_batch_*.sql` generados a partir de la salida (aplicados manualmente por Matías vía `psql`/SQL Editor para los batches 4 y 5, por los últimos 6 fragmentos, tras límite de uso de la sesión). `scripts/rag-local-dev/apply-async-pipeline.sql` para el pipeline asíncrono.
- **Pipeline asíncrono verificado**: `pgmq.list_queues()` muestra `rag_analysis_queue`; `pg_proc` confirma `enqueue_rag_analysis` y `dispatch_rag_analysis_queue`; `information_schema.triggers` confirma `trg_enqueue_rag_analysis` sobre `citizen_reports`; `cron.job` confirma `rag-analysis-dispatch`.

---

## 3. Qué queda pendiente (puntos 3-4 de la tarea)

- Desplegar la Edge Function `analizar-reporte` (no existe aún en el proyecto real). Hasta que esto pase, `dispatch_rag_analysis_queue()` corre cada 10s sin efecto real (la URL en Vault no responde todavía).
- Probar el pipeline de punta a punta (insert → cola → cron → Edge Function → persistencia).
- Revalidar los 6 casos A-F de REP-3764 contra el Supabase real y comparar con los resultados ya documentados del entorno local.
- Reportar resultados a Matías antes de habilitar pruebas de Hernán.

Cada uno de estos pasos requiere OK explícito de Matías antes de ejecutarse contra el proyecto real, según lo definido en `.agents/workflow/tasks/REP-DEPLOY-RAG-SUPABASE.yml` (`requires_approval: true`).
