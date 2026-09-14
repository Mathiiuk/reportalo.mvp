# Specification — REP-DEPLOY-RAG-SUPABASE

## 1. Objetivo

Llevar el RAG productivo construido y validado localmente en REP-2908/2909 al proyecto Supabase real, para que sea el entorno donde Hernán (y cualquier otra persona del equipo) pueda probarlo de verdad.

## 2. Problema actual

REP-2908 y REP-2909 reemplazaron el spike de RAG (REP-2907) por un pipeline real: embeddings y generación con Gemini real, cascada jurisdiccional resuelta en SQL, validación anti-alucinación que falla cerrado, pipeline asíncrono (trigger → pgmq → pg_cron → pg_net → Edge Function → persistencia), RLS y un panel de UI para el ciudadano. Todo esto se probó con Postgres real (local, sin Docker) y Gemini real, corriendo los 6 casos A-F de `docs/REP-3764_casos_esperados.md` con resultado correcto.

Pero nada de esto tocó nunca el Supabase real del proyecto — fue una decisión explícita durante REP-2908/2909 para no arriesgar el entorno compartido sin autorización puntual. Consecuencia: hoy, si alguien prueba el RAG contra el Supabase real, la tabla `knowledge_fragments` está vacía y todo el pipeline devuelve `sin_normativa` — no porque el código esté mal, sino porque no hay nada cargado.

## 3. Resultado esperado

El Supabase real tiene:
- El contenido jurídico cargado (seed de `docs/REP-3769_seed_y_RAG.sql`).
- La Edge Function `analizar-reporte` desplegada y funcionando.
- Las políticas RLS de `supabase/rag_rls_policies.sql` aplicadas.
- El pipeline asíncrono de `supabase/rag_async_pipeline.sql` (trigger + cola + cron) activo.
- El secret `GEMINI_API_KEY` en Supabase Vault (nunca en el repo).

Y los 6 casos A-F, corridos contra ese Supabase real, dan el mismo resultado que en el entorno local — recién ahí Hernán puede empezar a probar con sentido.

## 4. Alcance

### Incluido
- Ejecutar el seed real de conocimiento jurídico contra Supabase.
- Desplegar Edge Function, RLS y pipeline asíncrono contra Supabase.
- Configurar secrets en Supabase Vault.
- Re-validar los 6 casos A-F contra el entorno real.
- Reporte corto de resultados antes de habilitar pruebas de terceros.

### No incluido
- La pantalla de detalle del reporte para el ciudadano final (no existe ruta/página real hoy — `ReportsPage.jsx` usa datos mock; requeriría un ticket propio, no forma parte de este despliegue).
- Reconocimiento de imagen en el análisis RAG (explícitamente diferido por Matías hasta validar el flujo de solo texto).
- Cualquier cambio de código de aplicación — esta tarea es pura infraestructura/despliegue, el código ya fue mergeado vía REP-2908/2909.

## 5. Criterios de aceptación

Ver `.agents/workflow/tasks/REP-DEPLOY-RAG-SUPABASE.yml` AC-01 a AC-06.

## 6. Restricciones

- Ninguna acción contra el Supabase real (seed, deploy, RLS, secrets) se ejecuta sin OK explícito y puntual de Matías inmediatamente antes de esa acción — son pasos irreversibles o de alto impacto sobre un entorno compartido.
- No se toca la app en producción/staging del frontend en esta tarea; es solo backend/infraestructura de Supabase.

## 7. Dependencias

- Requiere que los PRs de `feat/REP-2908-...` y `feat/REP-2909-...` ya estén mergeados a `staging` (orden acordado: ICONS-SWEEP → 2908 → 2909).
- Requiere acceso de Matías al proyecto Supabase real (dashboard + CLI) para ejecutar seed/deploy/secrets.

## 8. Riesgos

- Ejecutar el seed dos veces sin idempotencia podría duplicar filas — verificar si `docs/REP-3769_seed_y_RAG.sql` es idempotente o requiere un `TRUNCATE`/`ON CONFLICT` antes de corrit en un entorno que ya tenga datos parciales.
- El pipeline asíncrono depende de `pg_cron`/`pg_net`/`pgmq` como extensiones habilitadas en el proyecto Supabase — confirmar que están disponibles en el plan actual antes de aplicar el SQL.
- Cuota gratuita de Gemini (20 llamadas/día para `gemini-3.8-flash`) puede no alcanzar para las pruebas reales de Hernán si se suma a las de validación — evaluar si hace falta habilitar billing antes de abrir las pruebas al equipo.

## 9. Impacto

### Frontend
Ninguno directo (el código ya está mergeado; esta tarea no lo modifica).

### Backend
Edge Function `analizar-reporte` pasa de "solo probada localmente" a desplegada en Supabase real.

### Database
Alta: carga de datos reales (seed), nuevas tablas/políticas/triggers activos contra la base real.

### Infraestructura
Alta: primer uso real de `pgmq` + `pg_cron` + `pg_net` + Vault en el proyecto Supabase.

### Seguridad
Media: manejo de `GEMINI_API_KEY` como secret de Supabase Vault; RLS debe quedar correctamente restrictiva antes de exponer el panel a usuarios reales.

## 10. Preguntas / incertidumbres

- ¿El seed de REP-3769 es re-ejecutable de forma segura si ya hay datos parciales en el Supabase real (por ejemplo, de pruebas manuales previas)?
- ¿Las extensiones `pgmq`, `pg_cron`, `pg_net` ya están habilitadas en el proyecto Supabase, o hay que habilitarlas primero desde el dashboard?
- ¿Hay presupuesto/decisión tomada sobre habilitar billing de Gemini antes de que Hernán empiece a probar, dado el límite de 20 llamadas/día del free tier?

## 11. Trazabilidad

Manifest: `.agents/workflow/tasks/REP-DEPLOY-RAG-SUPABASE.yml`
Informe previo: `docs/REP-2908_2909_informe-tecnico-rag-productivo.md`
