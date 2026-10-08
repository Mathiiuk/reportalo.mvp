# Reporte de Ejecución: RAG-ASISTENCIA-INFRA-run-001

## Identificación
- **Tarea**: RAG-ASISTENCIA-INFRA · El LLM no debe poder elegir el estado `asistencia`
- **Rama**: `fix/RAG-ASISTENCIA-INFRA-el-llm-no-debe-poder-elegir-el-estado-asistencia` (desde `staging`)
- **Fecha**: 2026-10-08
- **Estado**: READY_FOR_PR (hay que **redesplegar** `analizar-reporte`; el efecto sobre Gemini real **no se probó**)

## 1. Problema
En staging, 13 de los 65 análisis `indeterminado` tienen el motivo `estado "asistencia" no es válido para la categoría
"INFRAESTRUCTURA"`. Gemini devolvió `asistencia` y el validador, correctamente, lo rechazó (falla cerrado) y el reporte
quedó `indeterminado`. (Cifras de todo el historial de staging, incluye pruebas.)

## 2. Causa
El `responseSchema` que se le exige a Gemini permitía el estado `asistencia`. Pero `asistencia` solo es válido para
`VULNERABILIDAD_SOCIAL`, y esa categoría se resuelve **antes** de llamar al modelo (corte de costo cero, REP-3795 punto 4).
El modelo nunca tiene un caso legítimo para elegirlo.

## 3. Qué se implementó
| Archivo | Cambio |
|---|---|
| `supabase/functions/analizar-reporte/index.ts` | `asistencia` sale del enum de estado del esquema de salida. `RAG_RESULT_STATUSES`, el tipo y el validador **no** cambian (defensa en profundidad). `PROMPT_VERSION` pasa de `v3` a `v4`. |
| `src/test/AnalizarReporteAsistenciaLlm.test.js` | 5 pruebas. Antes del cambio fallaban 2 (enum y versión); las otras 3 fijan lo que no debe cambiar: el validador sigue rechazando, el corte de VULNERABILIDAD_SOCIAL sigue dando `asistencia` sin modelo, y el enum conserva los otros 4 estados. |
| `src/test/AnalizarReporteRep3795.test.js` | La aserción de versión pasa de `v3` a `v4`. Es el único cambio a un test existente. |

`src/services/geminiClient.js` (espejo del esquema para el arnés local) no se tocó.

## 4. Qué puede pasar con esos reportes
Los 13 casos terminaban `indeterminado`. Sin la opción `asistencia`, Gemini tiene que elegir entre `fundamentado`,
`indeterminado`, `sin_normativa` y `fuera_de_alcance`. Es probable que muchos pasen a `sin_normativa` o `indeterminado` por el
propio modelo; no se garantiza que mejoren a `fundamentado`. Es una corrección de contrato, no de calidad jurídica.

## 5. Pruebas
- `pnpm test` / `agt task:verify`: todo en verde. `bdd_tests: false` (el proyecto no tiene `test:bdd`).
- No se probó contra Gemini real.

## 6. Pendiente
- Redeploy de `analizar-reporte` en staging.
- Comprobación después de unos reportes nuevos (los de `prompt_version = 'v4'`):
  `select count(*) from report_ai_analysis where prompt_version='v4' and status_reason like 'estado "asistencia"%';` debe dar 0.
- Comparar el reparto de estados v3 contra v4 con la misma entrada (guía del Sprint 15, §12).
