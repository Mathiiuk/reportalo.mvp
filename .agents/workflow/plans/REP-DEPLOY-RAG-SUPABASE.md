# Implementation Plan — REP-DEPLOY-RAG-SUPABASE

## 1. Resumen

No hay código nuevo que escribir: REP-2908/2909 ya entregaron todo (servicio RAG, Edge Function, SQL de RLS y pipeline asíncrono, seed). Esta tarea es de **despliegue e infraestructura**: llevar esos artefactos, ya escritos y validados localmente, al proyecto Supabase real, paso por paso y con autorización puntual de Matías antes de cada acción irreversible.

## 2. Repositorio inspeccionado

- Stack: Supabase (Postgres + Edge Functions Deno + pgmq + pg_cron + pg_net + Vault).
- Runtime: Node/pnpm en frontend; SQL + Deno en backend Supabase.
- Package manager: pnpm.
- Branch base: `staging` (una vez mergeados `feat/REP-2908-...` y `feat/REP-2909-...`).
- CI actual: no aplica CI de despliegue a Supabase; esta tarea se ejecuta manualmente vía Supabase CLI/dashboard.

## 3. Cambios propuestos

No hay archivos de código a modificar. Los artefactos a desplegar ya existen en el repo:

### Artefactos a ejecutar/desplegar contra Supabase real (sin modificar)
- `docs/REP-3769_seed_y_RAG.sql` — carga de conocimiento jurídico (fuente de verdad del seed).
- `docs/REP-3769_guia_ejecucion_seeds_y_RAG.md` — guía de ejecución del seed anterior.
- `supabase/functions/analizar-reporte/index.ts` — Edge Function a desplegar con `supabase functions deploy`.
- `supabase/rag_rls_policies.sql` — políticas RLS a aplicar.
- `supabase/rag_async_pipeline.sql` — trigger + cola + cron a aplicar.
- `docs/REP-3764_casos_esperados.md` — los 6 casos A-F para re-validar contra el entorno real.
- `scripts/rag-local-dev/run-rep3764-cases-real-gemini.mjs` — puede adaptarse (cambiar connection string / usar el cliente Supabase real) para re-correr los mismos 6 casos contra el proyecto real en vez de Postgres local.

### [NEW]
- Ninguno esperado. Si al re-validar contra el entorno real aparece algún gap no cubierto por el SQL existente, se documenta aquí antes de escribir código nuevo (fuera del alcance original de "solo desplegar").

## 4. Estrategia de implementación

1. **Confirmar prerequisitos**: `feat/REP-2908-...` y `feat/REP-2909-...` mergeados a `staging`. Sin esto, no tiene sentido desplegar (el código de la Edge Function y el schema todavía no están en la rama base).
2. **Habilitar extensiones en Supabase** (si no lo están ya): `pgmq`, `pg_cron`, `pg_net`, `vector` — verificar desde el dashboard antes de aplicar SQL que las necesite. **Requiere OK de Matías antes de tocar el dashboard real.**
3. **Ejecutar el seed** (`docs/REP-3769_seed_y_RAG.sql`) siguiendo la guía (`docs/REP-3769_guia_ejecucion_seeds_y_RAG.md`) contra Supabase real. Verificar counts en `knowledge_sources`/`knowledge_fragments`/`fragment_embeddings` post-ejecución. **Requiere OK explícito de Matías inmediatamente antes de correr contra la base real.**
4. **Configurar `GEMINI_API_KEY` en Supabase Vault** (nunca como env var plana del frontend ni committeada). **Requiere OK de Matías.**
5. **Aplicar `supabase/rag_rls_policies.sql` y `supabase/rag_async_pipeline.sql`** contra el proyecto real. **Requiere OK de Matías.**
6. **Desplegar la Edge Function `analizar-reporte`** vía `supabase functions deploy analizar-reporte`. **Requiere OK de Matías.**
7. **Probar el pipeline de punta a punta**: insertar un reporte de prueba → verificar que se encola (pgmq) → que `pg_cron` lo despacha → que la Edge Function corre → que el resultado se persiste en `report_ai_analysis`/`report_ai_evidence`.
8. **Re-correr los 6 casos A-F** contra el Supabase real (adaptando el script de casos o vía panel de pruebas apuntando a la URL/keys reales) y comparar contra los resultados ya documentados del entorno local.
9. **Reportar resultados a Matías** (éxito/gaps) antes de que se avise a Hernán que puede empezar a probar.

## 5. Migraciones / datos

- El seed de REP-3769 carga datos reales de conocimiento jurídico — es la migración de datos central de esta tarea. Verificar si es idempotente (re-ejecutable sin duplicar) antes de correrlo si el entorno ya tiene datos parciales de pruebas manuales previas.

## 6. Seguridad

- `GEMINI_API_KEY` solo en Supabase Vault, nunca en el repo ni en `.env` del frontend.
- Validar que las políticas RLS de `rag_rls_policies.sql` efectivamente restringen `report_ai_analysis`/`report_ai_evidence` a los usuarios que atienden ese reporte (`profile_attends_report`) antes de considerar el despliegue completo — este es el punto de mayor riesgo de exposición de datos si algo queda mal aplicado.

## 7. Observabilidad

- No hay dashboards de monitoreo nuevos en esta tarea. Como mínimo, verificar manualmente logs de la Edge Function (`supabase functions logs analizar-reporte`) durante la prueba de punta a punta del paso 7, y el estado de la cola pgmq (mensajes pendientes/fallidos) para confirmar que no queda nada colgado tras las pruebas.

## 8. Compatibilidad / rollback

- SQL de RLS y pipeline asíncrono: reversible via `DROP POLICY`/`DROP TRIGGER`/`cron.unschedule` si algo falla.
- Seed: si no es idempotente, el rollback es más costoso (borrar filas cargadas) — de ahí la pregunta abierta en la spec sobre idempotencia, a resolver antes de ejecutar contra el entorno real.
- Edge Function: desplegar una versión nueva no rompe nada existente (Supabase versiona los despliegues); rollback es re-desplegar la versión anterior.

## 9. Plan de verificación

- [ ] Lint — no aplica (sin código de app nuevo).
- [ ] Typecheck — no aplica.
- [ ] Unit — no aplica (ya cubierto por REP-2908/2909).
- [x] Integration — re-correr los 6 casos A-F contra Supabase real.
- [ ] E2E — no aplica en esta tarea (pantalla de ciudadano queda fuera de alcance).
- [ ] Build — no aplica.
- [x] Security — validar RLS efectiva antes de cerrar la tarea.
- [x] Smoke — prueba de punta a punta del pipeline asíncrono (insert → cola → cron → Edge Function → persistencia).

## 10. Definition of Done

- Seed cargado y verificado en Supabase real.
- Edge Function, RLS y pipeline asíncrono desplegados y probados de punta a punta.
- Secret de Gemini en Vault.
- 6 casos A-F corridos contra el entorno real con resultado igual al local.
- Reporte de resultados entregado a Matías.

## 11. Aprobación requerida

- [ ] No requerida
- [x] Requerida — cada paso que toca el Supabase real (habilitar extensiones, correr seed, configurar secrets, aplicar SQL, desplegar función) necesita OK explícito y puntual de Matías antes de ejecutarse, no una aprobación genérica al inicio de la tarea.

## 12. Notas de ejecución

Pendiente — se completa en `.agents/workflow/executions/REP-DEPLOY-RAG-SUPABASE-run-001.md` cuando se ejecute.
