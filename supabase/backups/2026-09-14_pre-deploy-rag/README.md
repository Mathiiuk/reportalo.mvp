# Backup pre-despliegue RAG — Supabase real "CiudadAR"

- **Proyecto**: CiudadAR (`yryuhyiujyignkdhiyua`), Postgres 17, us-east-2.
- **Fecha**: 2026-09-14, antes de cualquier acción de REP-DEPLOY-RAG-SUPABASE.
- **Método**: solo lectura vía Supabase MCP (`execute_sql`, `list_tables`, `list_extensions`, `list_edge_functions`). No se modificó nada.

## Contenido

- `_manifest.json` — conteo de filas por tabla en el momento del backup.
- `<tabla>.json` (44 archivos) — dump completo de datos de cada tabla del schema `public`.
- `schema_rls_policies.json` — todas las políticas RLS activas en `public`.
- `schema_triggers.json` — triggers activos en `public` (JWT del trigger `audit_ia` redactado, ver advertencia abajo).
- `schema_functions_app.sql` — funciones de aplicación en `public` (excluye funciones internas de `pgvector`).
- `schema_extensions_installed.json` — extensiones **efectivamente instaladas** (no la lista completa de disponibles).

## Hallazgos importantes (antes de tocar nada)

1. **El schema del RAG ya existe en Supabase real, parcialmente.** Las tablas `knowledge_sources` (8 filas), `knowledge_fragments` (15 filas), `fragment_embeddings` (0 filas), `source_adhesions`, `normativas` (7 filas, con su propio `match_normativas`), y las funciones `eligible_knowledge_sources`, `match_knowledge_fragments`, `profile_attends_report` **ya están desplegadas**. Esto no coincide con el supuesto de la tarea de que "nada se desplegó" — el schema sí, los datos de embeddings y el pipeline no.
2. **`fragment_embeddings` está vacía (0 filas).** Aunque hay 15 `knowledge_fragments`, no tienen embeddings generados todavía — por eso `match_knowledge_fragments` no devolvería nada útil hoy.
3. **`pgmq` y `pg_cron` NO están instalados** en este proyecto (`schema_extensions_installed.json` no los incluye). El pipeline asíncrono de `supabase/rag_async_pipeline.sql` no puede aplicarse tal cual sin habilitar ambas extensiones primero. `pg_net` y `vector` sí están instalados.
4. **La Edge Function `analizar-reporte` NO está desplegada.** Solo existen `analyze-infraction` (legacy) y `quarantine-anonymize`.
5. **Seguridad — hallazgo a resolver antes de avanzar**: el trigger `audit_ia` sobre `infractions` (tabla legacy, no la de REP-2908/2909) tiene un JWT de `service_role` **hardcodeado en texto plano** dentro de la definición del trigger (`action_statement`), visible vía `information_schema.triggers` a cualquiera con permiso de lectura sobre ese catálogo. Se redactó en `schema_triggers.json` de este backup por precaución. **No se tocó, pero se recomienda rotarlo y moverlo a Vault** — es un riesgo real independiente del trabajo de RAG.
6. **RLS de `report_ai_analysis` (la tabla de REP-2909) es completamente pública hoy**: las políticas `insert_publico` (`with_check: true`) y `lectura_publica` (`qual: true`) no restringen nada — cualquiera puede insertar o leer cualquier análisis. Esto es **anterior** a `supabase/rag_rls_policies.sql` (que restringe por `profile_attends_report`) — probablemente son las políticas de un despliegue previo del schema, antes de que existieran las políticas más estrictas de REP-2909. Hay que decidir si `rag_rls_policies.sql` reemplaza estas políticas abiertas o coexiste con ellas.
7. **`report_ai_evidence` no tiene ninguna política RLS** — con RLS habilitado y sin políticas, el comportamiento por defecto es denegar todo acceso (más restrictivo de lo esperado, pero conviene confirmarlo antes de asumir que el panel del ciudadano puede leer evidencia).
8. Hay un proyecto legacy completo (`infractions`, `agencies`, `high_priority_zones`, OCR, notificaciones) convivimendo en el mismo schema `public` que el RAG nuevo — no se tocó nada de eso.

## Cómo restaurar (si algo se rompe durante el despliegue)

Cada `<tabla>.json` es un array de filas en formato `jsonb` (columnas `vector`/`geography` quedan serializadas como su representación de texto). Para restaurar una tabla:

```sql
-- ejemplo para knowledge_fragments
truncate table public.knowledge_fragments cascade; -- ojo: revisar FKs antes
-- luego reinsertar desde el JSON via un script (no vía SQL Editor directo, por los tipos vector/geography)
```

No es un `pg_dump` binario — es la mejor reconstrucción posible con las herramientas de solo-lectura disponibles (MCP de Supabase, sin acceso a `pg_dump` nativo). Para una restauración con garantías más fuertes, considerar generar un backup nativo desde el dashboard de Supabase (Database → Backups) antes de cualquier cambio, si el plan del proyecto lo permite.

## Nada de esto modificó el proyecto real

Todo lo anterior se obtuvo con `execute_sql` en modo lectura (`SELECT`) y llamadas de listado (`list_tables`, `list_extensions`, `list_edge_functions`, `list_migrations`). No se ejecutó ningún `INSERT`/`UPDATE`/`DELETE`/`CREATE`/`ALTER` contra el proyecto Supabase real.
