# Reporte de Ejecución: RAG-DIAG-RANKING-run-001

## Identificación
- **Tarea**: RAG-DIAG-RANKING · Script de diagnóstico del ranking de recuperación del RAG
- **Rama**: `chore/RAG-DIAG-RANKING-script-de-diagnostico-del-ranking-de-recuperacion-del-rag` (desde `staging`)
- **Fecha**: 2026-10-08
- **Estado**: READY_FOR_PR (el script **todavía no se corrió contra staging**; ver sección 4)

## 1. Para qué
La guía técnica del Sprint 15 (paso 4) pide ver el ranking completo de candidatos, también lo que queda bajo el umbral
de 0,45 o fuera del top-k, para diagnosticar D2, D3, D4 y D5. En producción eso se descarta: `report_ai_evidence` guarda solo
lo que supera el umbral.

## 2. Qué se implementó
| Archivo | Responsabilidad |
|---|---|
| `scripts/rag-local-dev/rep-diag-ranking/lib.mjs` | Lógica pura: lee top-k, umbral y modelo de embeddings **del fuente de `analizar-reporte/index.ts`** (no los copia), arma el texto de consulta igual que la función y clasifica cada candidato (umbral, top-k, llega al modelo, puesto del artículo esperado). |
| `scripts/rag-local-dev/rep-diag-ranking/run.mjs` | Por caso: resuelve la localidad, vectoriza con `gemini-embedding-2` (768, sin taskType, igual que la función), llama al RPC real `match_knowledge_fragments` con una ventana de 20 y escribe un informe `.md` y `.json` en `salida/` (ignorada por git). |
| `scripts/rag-local-dev/rep-diag-ranking/casos.json` | 9 casos exploratorios: D2 (4 redacciones de Avellaneda), D5 (2 de CABA), D4 (baches con INFRAESTRUCTURA y con TRANSITO) y D3 (alumbrado en Avellaneda). |
| `scripts/rag-local-dev/rep-diag-ranking/LEEME.md` | Requisitos del `.env`, uso, cómo leer el resultado y límites. |
| `src/test/RagDiagRanking.test.js` | 10 pruebas de la lógica pura (incluye leer la configuración del fuente real). |

Solo lectura: no genera texto con el modelo, no escribe en la base y no imprime claves. No toca código de la app ni de las Edge Functions.

## 3. Pruebas
- `pnpm test` (vía `agt task:verify`): todo en verde.
- Las pruebas de `lib.mjs` se escribieron junto con el código, no antes: no se vio el rojo previo.
- `node --check run.mjs`: sintaxis válida.
- Contra staging (solo lectura, por MCP) se verificó que existen las claves foráneas `localities → subdivisions → states_provinces` que usa la consulta de localidad, y que "Avellaneda / Buenos Aires" y "Palermo / CABA" son únicas.
- `agt task:verify`: unit_tests PASS. `bdd_tests: false` porque el proyecto no tiene `test:bdd` (mismo problema que las tareas anteriores).

## 4. Pendiente (no verificado)
- **El script no se ejecutó de punta a punta.** Necesita `GEMINI_API_KEY`, `VITE_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en el `.env` local de Matías; esta sesión no maneja claves. La primera corrida puede revelar ajustes (por ejemplo, el formato del embebido `subdivisions!inner` de PostgREST).
- `esperado` solo está definido para D5 (`4.1.2`). Para D2, D3 y D4 falta acordar con Hernán qué artículo es aceptable.
- Los textos son exploratorios, no los reportes originales de Hernán.
- Confirmar que el host que imprime el script es **staging** antes de mirar resultados.
