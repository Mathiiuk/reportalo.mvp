# RAG · Citas con «...» rechazadas por la validación literal

**Fecha:** 16/10/2026 · **Para:** Matías Krepchuk (líder técnico) · **Con copia a:** Hernán Gregorini (PO), Leonel Nuñez
**Origen:** hallazgo aparte del §5 de `docs/RAG-S16_busqueda_hibrida_bateria_81.md` (rama `claude/zen-fermi-205081`, commit 681eb25): pasa igual con y sin búsqueda híbrida.

> **Para leer primero.**
> - **No se desplegó nada ni se escribió en la base de staging.** Las mediciones usan los contextos congelados de esa rama (`--reusar`) y solo llaman a Gemini.
> - **Recomendación: validación por tramos** (opción B). Con las mismas respuestas del modelo, las **10 de 70** corridas rechazadas del contexto actual pasan a válidas y **ninguna** de las 297 corridas guardadas cambia de válida a rechazada. No toca el prompt (sigue en v5).
> - **Prohibir la elisión en el prompt (opción A) no sirve:** saca las elisiones, pero cambia lo que cita el modelo, y «Zona sin iluminación…» pasa a dar `indeterminado` en **11 de 32** corridas (antes 0).
> - El cambio está en esta rama (`claude/rag-s16-citas-con-elision`) y **falta desplegar** `analizar-reporte`.

## 1. El problema

En D3 (alumbrado en Avellaneda), Gemini cita la LOM art. 59 (fragmento `20000000-0000-4000-8000-000000000003`) salteando los incisos a), b) y c):

> «Constituyen obras públicas municipales:\n... d) Las de infraestructura urbana, en especial las de pavimentación, […] iluminación, electrificación, provisión de gas y redes telefónicas.»

Usa tres marcas: `\n...`, ` ... ` y ` [...] `. Cada tramo es texto literal del fragmento, pero `validateLlmAnalysis` exige que **toda** la cita sea un único tramo continuo, así que rechaza la respuesta y el reporte queda `indeterminado` con un motivo de validación, aunque la respuesta estaba bien fundamentada (las 10 rechazadas eran `fundamentado`).

## 2. Línea de base (prompt v5, contexto actual B, temperatura 0)

| Texto | Corridas | Rechazadas por la elisión | `indeterminado` |
|---|---|---|---|
| «Falta de mantenimiento del servicio de alumbrado público a cargo del municipio.» | 35 | 3 | 0 |
| «Zona sin iluminación que afecta la seguridad de peatones y vehículos por la noche.» | 35 | 7 | 0 |
| **Total** | **70** | **10 (14 %)** | **0** |

Son 22 corridas de la sesión de la búsqueda híbrida (6 rechazadas) y 48 de esta (4 rechazadas). Con el mismo prompt y el mismo contexto, la frecuencia varía entre tandas (6 de 16 y 1 de 16), así que importa el total y no una tanda suelta. Con el contexto híbrido (V3) pasa lo mismo: 4 de 22.

## 3. Opción A: prohibirlo en el prompt

Regla agregada a continuación de la de literalidad (medida, **no** incluida en la rama):

> «La cita_textual tiene que ser un único tramo continuo del fragmento: nunca uses puntos suspensivos ("...", "…", "[...]") para saltear partes. Si lo que necesitás está en partes separadas del fragmento (por ejemplo, el encabezado de un artículo y uno de sus incisos), citá solo el tramo continuo más pertinente, como el inciso que aplica.»

| Texto | Corridas | Con elisión | `indeterminado` | Citan la LOM art. 59 | Citan el art. 49 del DL 8031/73 |
|---|---|---|---|---|---|
| «Falta de mantenimiento…» · v5 | 24 | 1 | 0 | 13 | 0 |
| «Falta de mantenimiento…» · con la regla | 32 | **0** | 0 | **5** | 0 |
| «Zona sin iluminación…» · v5 | 24 | 3 | 0 | 24 | 0 |
| «Zona sin iluminación…» · con la regla | 32 | **0** | **11** | 22 | **9** |

(Las filas v5 son las 48 corridas de esta sesión, para comparar en las mismas condiciones.)

- Elimina las elisiones, pero el modelo, en vez de citar solo el inciso d), en muchos casos **deja de citar el art. 59**.
- En «Zona sin iluminación…» empieza a citar el **art. 49 del DL 8031/73** (quien apaga el alumbrado sin autorización, no aceptable para D3 según §5) y concluye que no hay infracción del municipio: es el mismo efecto que tenía la híbrida en ese texto.
- Además obligaría a pasar a prompt v6 y a volver a medir D4, D5 y vulnerabilidad social con el criterio del PO.

## 4. Opción B: validación por tramos (recomendada)

Si la cita no aparece entera, se separa por las marcas de elisión (`...`, `…`, `[...]`, `[…]`, `(...)`, `(…)`) y se acepta solo si se cumplen **todas** estas condiciones:

| Regla | Para qué |
|---|---|
| Cada tramo aparece literal en el fragmento (con la misma tolerancia a espacios que hoy) | Sigue sin admitir paráfrasis, cambios de tildes, mayúsculas o puntuación |
| Los tramos aparecen en el orden de la cita y sin superponerse | No se puede reordenar el texto de la norma |
| Cada tramo tiene al menos 15 caracteres | No se puede armar una frase juntando palabras sueltas («Constituyen ... iluminación» se rechaza) |
| El texto salteado no contiene «no», «ni», «nunca», «jamás», «salvo», «excepto», «excepción», «siempre que» ni «sin perjuicio» | No se puede citar una prohibición sin su salvedad ni sacar una negación (es la misma lógica de la regla de excepciones del prompt v3) |

Una cita sin marcas se valida exactamente igual que hoy. Una cita que es solo la marca se rechaza.

**Resultado** (revalidando sin red las respuestas ya generadas, porque el cambio no toca lo que genera el modelo):

| Conjunto | Corridas | Rechazadas hoy | Rechazadas con tramos |
|---|---|---|---|
| D3, contexto actual (B), los dos textos | 70 | 10 | **0** |
| D3, contexto híbrido (V3), los dos textos | 22 | 4 | **0** |
| Resto de las corridas guardadas (D2, D4, D5, los otros textos de D3, las 64 con la regla de la opción A; de esta rama, de la híbrida y del checkout principal) | 205 | 1 | 1 |

La única que sigue rechazada es de D2-AVE-4 y por otro motivo (cita un `fragment_id` que no estaba en el contexto). Ninguna corrida válida pasa a rechazada.

## 5. Qué cambia en el código

| Archivo | Cambio |
|---|---|
| `supabase/functions/analizar-reporte/index.ts` | `quoteMatchesFragment` (nuevo) reemplaza la comparación literal dentro de `validateLlmAnalysis`. El motivo del rechazo y la cita guardada en `status_reason` quedan iguales. Prompt, esquema y `PROMPT_VERSION` sin cambios |
| `src/services/validateLlmAnalysis.js` | Mismo cambio en el espejo testeable |
| `scripts/rag-local-dev/rep-diag-generacion/lib.mjs` | `validateRun` usa la misma regla, así el diagnóstico informa lo que haría el servidor |
| `src/test/ValidateLlmAnalysis.test.js`, `AnalizarReporteRep3795.test.js`, `RagDiagGeneracion.test.js` | Los casos reales del art. 59 con las tres marcas, y rechazo por tramo no literal, desorden, tramo corto, excepción o negación salteada, y marca sola |

Los tres archivos de test pasan. La suite completa tiene 15 archivos de UI y mapa que fallan en este worktree por el entorno (Vite no deja cargar el worker de `maplibre-gl` desde el `node_modules` del checkout principal), no por este cambio.

## 6. A tener en cuenta

- **La cita se guarda tal cual la escribió el modelo**, con los «...». `report_ai_evidence.quoted_text` la conserva y el borrador para el organismo (`legalFoundationService.js`, REP-2801) la muestra como «Cita textual: «…»». Es la forma habitual de citar salteando incisos; el panel del ciudadano no muestra `quoted_text`.
- **El validador viejo del cliente** (`src/services/legalRagService.js`, que todavía usa `includes` exacto) no se tocó: no está en el camino de `analizar-reporte`.
- **No resuelve el art. 49 del DL 8031/73 en D3**, que es el otro problema del §5 de la medición de la híbrida.

## 7. Para desplegar (Matías)

1. Revisar y abrir el PR de `claude/rag-s16-citas-con-elision` contra `staging`.
2. Desplegar `analizar-reporte` en staging (no hay migración).
3. Verificar con dos reportes de D3 en Avellaneda que, si el modelo cita con «...», el análisis queda `fundamentado` y la evidencia guarda la cita.

## 8. Cómo se midió y cuánto costó

- `scripts/rag-local-dev/rep-diag-generacion/run.mjs` en la versión de `claude/zen-fermi-205081` (con `--desde-variantes … --variante B --reusar`), sobre los contextos congelados `contexto-B-B8-64-B.json` y `contexto-B-B8-65-B.json`. La opción A se midió con la regla agregada temporalmente en `index.ts` (el script lee el prompt del fuente).
- La opción B se midió revalidando con `validateRun` todas las salidas `generacion-*.json` guardadas junto a su contexto.
- Costo: **112 llamadas** a `gemini-3.8-flash` (48 de línea de base y 64 con la regla del prompt); ninguna escritura en la base.

## 9. REP-3857 (P1, Sprint 17): qué se agregó sobre la rama de S16

La rama de S16 (`9c8492b`) se aplicó sobre `staging` el 21/10 en `feat/REP-3857-citas-con-elision-por-tramos`, sin conflictos. Se revisó contra el ticket:

| Regla del ticket | Estado |
|---|---|
| Marcas `...`, `…`, `[...]` y `(...)` | Ya estaba |
| Cada tramo literal, de 15 caracteres o más, en orden y sin superponerse | Ya estaba |
| Rechazar si lo omitido tiene «no», «ni», «nunca», «jamás», «salvo», «excepto», «excepción», «siempre que» o «sin perjuicio» | Ya estaba **entre tramos**. **Faltaba en los bordes:** con «...» al principio o al final de la cita, lo omitido no se revisaba |
| Normalizar CRLF y saltos de línea en la cita y en la fuente | Ya estaba (`normalizeWhitespace`), ahora con tests |
| Sin marca de elisión, el resultado es idéntico al de P0 | Sí: sin marca, el camino es el literal de siempre |

**Lo agregado:**
- **Bordes:** con la marca al principio, se revisa lo omitido desde el inicio de la oración (después del último «. », «; » o «: ») hasta el primer tramo. Con la marca al final, desde el último tramo hasta el fin de la oración. Ejemplo: de «No se permite estacionar…», la cita «... se permite estacionar» se rechaza.
- **Una sola regla en las tres copias:** la función, el espejo del frontend y la réplica de `rep-diag-generacion`. Ahora el runner de P0/P1 (`p0/esquema.mjs`) usa esa misma réplica, así que M2 de P1 mide con el validador nuevo.
- **Tests:** `Rep3857CitasConElision.test.js` (12) cubre los bordes, CRLF, las salvedades compuestas, la paridad del código entre las tres copias y el runner M2 con la regla nueva. El test de paridad de REP-3859 ahora busca `quoteMatchesFragment`.

**Para Hernán, antes del merge** (paso 3 del ticket):
1. ¿La lista de negaciones y salvedades es completa? Están «no», «ni», «nunca», «jamás», «salvo», «excepto», «excepción», «siempre que» y «sin perjuicio». Candidatas a sumar: «a menos que», «con excepción de», «solo si», «únicamente», «prohíbese».
2. ¿El límite en los bordes es la oración (corta en «. », «; » o «: »)?
3. ¿15 caracteres es un buen mínimo por tramo?
4. Casos límite para revisar: una elisión dentro de un inciso que tiene una salvedad en el inciso siguiente, una cita que empieza en la mitad de una enumeración, y un «ni» como conjunción («ni ... ni»).

**Lo que falta y espera a P0** (orden P0 → P1): correr M2 con el set v1 congelado (REP-3858), compararlo con la línea base de P0 (REP-3859), la auditoría de Iván (REP-3861) y la decisión de Hernán. **Recién después** se mergea y se despliega `analizar-reporte`. Hasta entonces **no se despliega nada**.
