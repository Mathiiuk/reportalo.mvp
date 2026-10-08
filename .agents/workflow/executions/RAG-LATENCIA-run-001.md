# Reporte de Ejecución: RAG-LATENCIA-run-001

## Identificación
- **Tarea**: RAG-LATENCIA · Guardar `latency_ms` en `analizar-reporte`
- **Rama**: `fix/RAG-LATENCIA-guardar-latency-ms-en-analizar-reporte` (desde `staging`)
- **Fecha**: 2026-10-08
- **Estado**: READY_FOR_PR (la Edge Function hay que **redesplegarla** para que tenga efecto; ver sección 4)

## 1. Problema
En staging (proyecto CiudadAR), `report_ai_analysis.latency_ms` está en NULL en los 365 análisis. Sin ese dato no se
puede medir el tiempo del RAG por reporte (D8 de la guía técnica del Sprint 15 y el cruce de consumo con REP-3822).

## 2. Causa raíz
`buildAnalysisRow` (`supabase/functions/analizar-reporte/index.ts`) ya mapeaba `result.latencyMs` a `latency_ms`, y el RPC
`persist_rag_analysis` ya inserta esa columna (verificado en la base de staging). Pero ningún camino de la función asignaba
`result.latencyMs`, así que siempre se guardaba NULL. No hay falla en la base ni en el RPC.

## 3. Qué se implementó
| Archivo | Cambio |
|---|---|
| `supabase/functions/analizar-reporte/index.ts` | `const startedAt = Date.now()` al arrancar el análisis y `result.latencyMs = Date.now() - startedAt` justo antes de persistir. Mide embedding + recuperación + generación + validación; **no** cuenta la persistencia. |
| `src/test/AnalizarReporteLatencia.test.js` | 3 pruebas sobre el fuente (mismo patrón que `AnalizarReporteRep3795.test.js`, porque `index.ts` no se puede importar desde Vitest). Fallaban 2 de 3 antes del cambio. |
| `.agents/workflow/tasks/RAG-LATENCIA.yml` | Requisito y criterios de aceptación reales. `bdd_tests: false`: el proyecto no tiene el script `test:bdd` (la plantilla de `agt` lo da por hecho y las tareas anteriores tienen el mismo gate roto). |

No cambia estados, citas, prompt, temperatura, top-k ni umbral. No requiere migración.

## 4. Pendiente fuera de este PR
- **Redeploy** de `analizar-reporte` en staging: sin eso los análisis nuevos siguen con NULL.
- Los 365 análisis anteriores quedan con `latency_ms` NULL (no se puede reconstruir).
- Verificación posterior: tras el redeploy y un reporte de prueba,
  `select latency_ms from report_ai_analysis order by created_at desc limit 5;` debe dar valores. Los `asistencia` (corte sin llamar a Gemini) darán pocos ms, es lo esperado.

## 5. Pruebas
- `pnpm test`: 106 archivos, 861 pruebas, todo en verde.
- `agt task:verify RAG-LATENCIA`: unit_tests PASS; sin otros gates activos.
- No se probó contra Gemini real ni contra staging con escritura (solo se leyó la base).
