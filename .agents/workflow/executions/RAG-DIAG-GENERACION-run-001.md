# Reporte de Ejecución: RAG-DIAG-GENERACION-run-001

## Identificación
- **Tarea**: RAG-DIAG-GENERACION · Script de diagnóstico de repetibilidad de la generación del RAG
- **Rama**: `chore/RAG-DIAG-GENERACION-script-de-diagnostico-de-repetibilidad-de-la-generacion-del-rag` (desde `staging`)
- **Fecha**: 2026-10-08
- **Estado**: READY_FOR_PR (el script **todavía no se corrió contra Gemini ni staging**; ver sección 4)

## 1. Para qué
Experimento B de la guía técnica del Sprint 15 (§8.1): con el contexto congelado, repetir N veces la generación para saber si
la variación que vio Hernán (D1, parte de D2) es del modelo o de la recuperación. El diagnóstico de ranking
(RAG-DIAG-RANKING) mostró que las 4 redacciones de Avellaneda reciben casi el mismo conjunto de fragmentos, lo que apunta a la generación.

## 2. Qué se implementó
| Archivo | Responsabilidad |
|---|---|
| `scripts/rag-local-dev/rep-diag-generacion/lib.mjs` | Lógica pura. Lee del fuente de `analizar-reporte/index.ts` las instrucciones del prompt, el esquema, modelo, versión, temperatura, thinking, tope de salida, top-k y umbral (no se copian). Arma el prompt igual que `generateJustification`, hashea los bytes, valida cada respuesta (réplica reducida) y resume estados, conjuntos de citas y tokens. |
| `scripts/rag-local-dev/rep-diag-generacion/run.mjs` | Congela el contexto (embedding + RPC real + umbral + top-k de producción, guardado en `salida/`), llama N veces a `generateContent` con los mismos bytes y escribe un informe `.md`/`.json`. Opciones: `--caso`, `--corridas`, `--temperatura`, `--reusar`. |
| `scripts/rag-local-dev/rep-diag-generacion/casos.json` | 5 casos exploratorios (D2, D5, D4, D3). |
| `scripts/rag-local-dev/rep-diag-generacion/LEEME.md` | Requisitos, uso, cómo leer el resultado y límites. |
| `src/test/RagDiagGeneracion.test.js` | 16 pruebas de la lógica pura, incluida la lectura del fuente real. |

Solo lectura en la base; no imprime claves. Cuesta N llamadas de generación (5 por defecto).

## 3. Pruebas
- `pnpm test` / `agt task:verify`: todo en verde. `bdd_tests: false` (el proyecto no tiene `test:bdd`).
- Las pruebas se escribieron junto con el código (no se vio el rojo previo).
- Humo: `readGenerationSpec` sobre el fuente real devuelve prompt `v4`, 8 líneas de instrucciones y el enum de estado sin `asistencia`.
- `node --check run.mjs`: sintaxis válida.

## 4. Pendiente (no verificado)
- **El script no se ejecutó de punta a punta** (necesita las claves en el `.env` local de Matías). La primera corrida puede revelar ajustes.
- El prompt es una réplica de `generateJustification`: si esa función cambia su plantilla (no las instrucciones), hay que actualizar `buildPrompt`. Las instrucciones y el esquema sí se leen del fuente.
- La validación es una réplica reducida de la del servidor.
- Caso exploratorio, no el reporte original de Hernán. Con 5 corridas no se obtiene una métrica comparable con el 87,5 % original.
