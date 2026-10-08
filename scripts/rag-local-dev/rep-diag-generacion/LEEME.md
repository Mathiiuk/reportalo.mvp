# Diagnóstico de repetibilidad de la generación (experimento B)

Responde: **si el contexto es idéntico, ¿Gemini responde siempre lo mismo?** Congela el reporte y los fragmentos que hoy
llegan al modelo y llama N veces a la etapa generativa con exactamente los mismos bytes. Separa dos causas de la
variación que reportó Hernán (D1 y parte de D2): que cambie lo que se **recupera**, o que cambie lo que el modelo **decide**.
Corresponde al §8.1 de `docs/Propuestas_tecnicas_Mati_RAG_Sprint15.md`.

Prompt, esquema, modelo, temperatura, thinking, tope de salida, top-k y umbral se **leen del fuente** de
`supabase/functions/analizar-reporte/index.ts`; nada se copia, así prueba lo que está desplegado en el repo.

No escribe en la base y no imprime claves. **Cuesta N llamadas de generación** (5 por defecto, unos pocos miles de tokens cada una).

## Antes de correrlo
En el `.env` de la raíz (ignorado por git): `GEMINI_API_KEY`, `VITE_SUPABASE_URL` (**staging**; el script imprime el host)
y `SUPABASE_SERVICE_ROLE_KEY` (Dashboard → Project Settings → API Keys). Si ya congelaste el contexto y usás `--reusar`,
no se consulta Supabase.

## Correrlo
```bash
node scripts/rag-local-dev/rep-diag-generacion/run.mjs                              # D2-AVE-4, 5 corridas, config de producción
node scripts/rag-local-dev/rep-diag-generacion/run.mjs --caso D5-CABA-1 --corridas 10
node scripts/rag-local-dev/rep-diag-generacion/run.mjs --reusar --temperatura 1     # mismo contexto congelado, temperatura 1
```
Genera en `salida/` (no versionada): `contexto-<caso>.json` (el contexto congelado) y `generacion-<caso>-<fecha>.md/.json`.

## Cómo leerlo
| Lo que ves | Qué significa |
|---|---|
| Mismo estado y mismo conjunto de citas en las N corridas | La generación es estable. Si Hernán veía variación, viene de la recuperación o de la entrada: pasar a repetir la cadena completa (experimento A). |
| Estados o conjuntos de citas distintos con el **mismo** hash de prompt | La variación es del modelo. Ver si es temperatura (probar `--temperatura 1`), tokens de razonamiento o fragmentos igualmente pertinentes. |
| "NO válida" con motivo de cita | El modelo cita texto no literal o un fragmento fuera del contexto: falla de contrato, no de recuperación. |
| Solo cambia la redacción | Variación de estilo; no es un cambio de fundamento. |

Los conjuntos de citas se comparan por ID de fragmento, sin duplicados y sin orden (guía §8.1).

## Límites
- El caso es **exploratorio** (`casos.json`), no el reporte original de Hernán. Cuando tenga los textos reales, agregarlos.
- Con 5 corridas se ve si hay variación, no cuánta: no es una métrica comparable con el 87,5 % de Hernán (guía §8.1).
- La temperatura 0 es la de producción; la guía advierte que Gemini 3 recomienda 1,0. `--temperatura` permite compararlas, pero no es una recomendación de cambio.
- La validación es una réplica reducida de la del servidor (id dentro del contexto, cita literal, regla de `asistencia`), no la función real.
