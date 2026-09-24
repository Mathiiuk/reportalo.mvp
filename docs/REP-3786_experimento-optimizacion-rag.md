# Reportalo

*Plataforma de Auditoría Ciudadana*

## EXPERIMENTO DE OPTIMIZACIÓN DEL MOTOR RAG (TOP-K, UMBRAL, THINKING Y SALIDA)

**Versión 1.0 · 23 de septiembre de 2026 · Construcción · Proyecto RAR-2026**

**Jira:** [REP-3786](https://unlz2026.atlassian.net/browse/REP-3786) (tarea técnica P1 · Sprint 13)
**Confluence:** espacio `Reportalo` — pendiente de publicar
**Referencia:** [REP-2908](https://unlz2026.atlassian.net/browse/REP-2908) · [REP-3773](https://unlz2026.atlassian.net/browse/REP-3773) · [REP-3777](https://unlz2026.atlassian.net/browse/REP-3777) · [REP-3784](https://unlz2026.atlassian.net/browse/REP-3784) · `docs/REP-3778_propuesta_optimizacion_consumo_rag_gemini.md` · `docs/REP-3764_casos_esperados.md`

> **Propósito.** Comprobar con corridas reales, y no con estimaciones, si la propuesta de REP-3778 permite reducir tokens, costo y latencia
> del motor RAG sin degradar precisión, trazabilidad ni abstención. Sus cifras se trataron como **hipótesis**.

---

## 1. Resumen ejecutivo

**Recomendación: mantener el baseline** (top-k 6 · umbral 0.45 · thinking `low` · `maxOutputTokens` 2048) y abrir un seguimiento acotado (§9).
La decisión final es del equipo: hay un punto de criterio que se explica abajo.

Se corrieron **360 generaciones reales** (8 configuraciones × 9 casos × 5 repeticiones) sin ningún error de API, truncamiento ni JSON inválido.

1. **La propuesta no se reproduce en magnitud.** Lo que se midió, frente a lo estimado:

| | Propuesta (REP-3778) | Medido (mejor variante con top-3) |
|---|---|---|
| Tokens de entrada | −45 % | **−14.5 %** |
| Tokens de salida | −57 % | **−12 %** |
| Latencia (mediana) | 2.5× más rápido | **−4 % a −6 % en A y B, +1 % en C: dentro del ruido** |
| Total de tokens por llamada | — | **−13.8 %** |

2. **Todo el ahorro medible sale de recuperar menos fragmentos (top-3), y ahí hay una pérdida de normativa relevante.** En el caso B
   («auto estacionado sobre la rampa»), el baseline cita la **Ley 451 art. 6.1.52 (estacionamiento o detención prohibida) en 5 de 5 corridas**. Ese fragmento es
   el 4.º de la recuperación, así que top-3 lo deja afuera y, en las seis configuraciones con top-3, el modelo lo cita **0 de 5** veces: pasa a citar el art. 6.1.37
   (obstrucción de vía), menos específico. Un cálculo posterior (§9) muestra que tampoco hay una variante intermedia (top-k 4) que ahorre lo suficiente: ~3.7 %.
3. **Desactivar el thinking no aporta nada medible.** El baseline (`low`) ya casi no razona (4 de 45 corridas); con `thinkingBudget: 0` casi desaparecen esos picos (B: 0 de 45; C: 1 de 45, de 442 tokens),
   pero el promedio de salida y la latencia no cambian, y no garantiza 0.
4. **`maxOutputTokens` 1024 y la instrucción de concisión son seguros pero de poco valor en costo.** 0 truncamientos (máximo observado 644 tokens) y concisión
   cumplida en el 100 %, pero la instrucción suma unos 58 tokens de entrada y el total baja solo −1 %. El baseline ya escribe textos breves (mediana de 30 palabras).

**Punto de criterio para el equipo.** Aplicada al pie de la letra, la regla pre-registrada (R1–R5, con R3 a nivel de norma) **la cumplen A, B, C, B+ y C+**. Pero la aclaración
de R3 que fijé antes de correr fue demasiado laxa: no distingue artículos dentro de una misma ley, y el ticket exige que la configuración «no pierda normativa relevante
por bajar recall». La evidencia del caso B muestra que sí la pierde. Por eso se recomienda no adoptar top-3, aun cumpliendo la regla literal. Es una recomendación mía, no una decisión tomada.

## 2. Qué se evaluó

La propuesta de `REP-3778` se trató como hipótesis. Ocho configuraciones, con corpus, casos, modelo (`gemini-3.8-flash`) y `temperature` (default de la API) constantes:

| Id | top-k | umbral | thinking | maxOutputTokens | prompt |
|---|---|---|---|---|---|
| **BASE** | 6 | 0.45 | `low` | 2048 | v1 |
| **A** | 3 | 0.52 | `low` | 2048 | v1 |
| **B** | 3 | 0.52 | desactivado (`thinkingBudget: 0`) | 2048 | v1 |
| **C** | 3 | 0.55 | desactivado (`thinkingBudget: 0`) | 2048 | v1 |
| **BASE+ · A+ · B+ · C+** | igual que su base | igual | igual | 1024 | v1 + concisión |

Fuera de alcance, por el ticket: caché semántica, cambio de proveedor, Flash-Lite y cambios en el corpus.

## 3. Método

- **Protocolo pre-registrado.** La regla de decisión se commiteó en `58ebbfe` y la rúbrica y el arnés en `7b89c0b`, **antes** de la primera llamada de generación
  (`.agents/workflow/specs/REP-3786.md` §6 y §12).
- **Casos.** Los de REP-3764 y de la ronda P-01. Deciden: A, B, C, D-Av, D-CABA, E y F. Informativos: E sin categoría, Prueba 1 y Prueba 2.
- **Repeticiones.** 5 por caso y configuración, con el orden de las configuraciones intercalado y semilla fija.
- **Recuperación.** Una consulta k=6 por caso contra CiudadAR (solo lectura). El RPC ordena por similitud y corta con `LIMIT`, así que top-3 son los tres primeros de top-6 y el
  umbral se aplica después. Vectores con 5 decimales, cada consulta validada por el md5 del vector recibido, y recuperación coincidente con la de referencia (caso A: 0.591 / 0.582 / 0.559).
  El texto de los 14 fragmentos se verificó por md5 contra la base.
- **Generación.** Réplica exacta de `generateJustification` y `validateLlmAnalysis` de `analizar-reporte/index.ts`, ejecutada localmente. **Producción no se modificó en ningún punto.**
- **Latencia.** Solo la llamada de generación, medida desde una máquina; excluye embedding y RPC. Sirve para comparar variantes entre sí, no como latencia de producción.

### 3.1 Regla de decisión (fija)

| | Condición |
|---|---|
| **R1** Aciertos | En cada caso que decide, aciertos ≥ los de BASE (sobre 5) |
| **R2** Seguridad | Casos que deciden: 0 citas incorrectas. Informativos: no mayores que BASE. Todos: 0 JSON truncados o inválidos |
| **R3** Recall | La recuperación conserva las normas esperadas de cada caso positivo (a nivel de norma; A exige sus tres fragmentos) |
| **R4** Abstención | F queda en `sin_normativa` y ningún caso positivo que decide pasa a abstención |
| **R5** Ganancia | Al menos una: mediana de entrada −10 %, de salida −15 % o de latencia −20 % |

Para las «+»: 0 truncamientos, máximo de salida ≤ 819 tokens (80 % de 1024) y concisión medida en ≥ 90 % de las corridas.

## 4. Fase 0: recuperación (sin LLM)

| Caso | BASE (k6 · 0.45) | A y B (k3 · 0.52) | C (k3 · 0.55) | Normas esperadas |
|---|---|---|---|---|
| A | 3 | 3 | 3 | Conservadas |
| B | 4 | 3 | 3 | Conservadas a nivel de norma |
| C | 4 | 3 | 3 | Conservadas |
| D-Av | 3 | 3 | 3 | Conservadas |
| D-CABA | 2 | 2 | 2 | Conservadas |
| E | 4 | 3 | 3 | Conservadas |
| E sin categoría (info) | 6 | 3 | 3 | — |
| Prueba 1 (info) | 2 | 2 | 2 | — |
| Prueba 2 (info) | 4 | 3 | 3 | — |
| F | 0 | 0 | 0 | Abstención por construcción (0 fragmentos elegibles) |

- El umbral 0.52 o 0.55 no descarta ningún fragmento de A, B, C, D ni E (similitudes entre 0.559 y 0.698). Solo descarta un fragmento irrelevante en E sin categoría (LOM art. 52, 0.5198).
- **Margen justo en A:** su 3.er fragmento (Const. PBA art. 192 inc. 4) tiene 0.559 y el umbral de C es 0.55: margen de 0.009.
- Lo que top-3 deja afuera: B, Ley 451 art. 6.1.52 (0.646); C, Ley 24.449 art. 48 inc. i) (0.651); E, Ley 24.449 art. 49 inc. b) 3 (0.595); Prueba 2, Ley 24.449 art. 49 inc. b) 1 (0.659).

## 5. Sonda de thinking (una llamada por modo, orientativa)

| Modo | Aceptado | Razonamiento | Respuesta | Latencia |
|---|---|---|---|---|
| `thinkingLevel: low` (baseline) | Sí | **0** | 568 | 3246 ms |
| `thinkingBudget: 0` | Sí | **0** | 546 | 2398 ms |
| `thinkingLevel: minimal` | **No** (400) | — | — | — |
| sin `thinkingConfig` | Sí | **1248** | 338 | 5071 ms |

«Desactivado» se probó con `thinkingBudget: 0`, porque `minimal` no está soportado por este modelo. Omitir `thinkingConfig` dispara un razonamiento caro que la configuración actual ya evita.

## 6. Resultados de la Fase 1 (BASE, A, B, C)

| Config | Aciertos (deciden) | Citas incorrectas | Falsos positivos | A abstención | Truncados / JSON inv. / validación | Entrada media | Salida media | Razonamiento medio (máx) | Latencia mediana | p90 |
|---|---|---|---|---|---|---|---|---|---|---|
| **BASE** | 30/30 | 0 | 0 | 0 | 0 / 0 / 0 | 863 | 356 | 29 (379) | 1944 ms | 2470 ms |
| **A** | 30/30 | 0 | 0 | 0 | 0 / 0 / 0 | 738 (−14.5 %) | 313 (−12.1 %) | 4 (162) | 1824 ms (−6 %) | 2501 ms |
| **B** | 30/30 | 0 | 0 | 0 | 0 / 0 / 0 | 738 (−14.5 %) | 312 (−12.4 %) | 0 (0) | 1869 ms (−4 %) | 2429 ms |
| **C** | 30/30 | 0 | 0 | 0 | 0 / 0 / **1** | 738 (−14.5 %) | 328 (−7.9 %) | 10 (442) | 1960 ms (+1 %) | 2453 ms |

**Total de tokens por llamada (entrada + salida):** BASE 1219 · A 1051 (−13.8 %) · B 1050 (−13.9 %) · C 1066 (−12.6 %).
**Ruido:** el desvío estándar de la salida es de ~120 tokens en cada configuración (45 corridas), así que las diferencias de salida entre A, B y C no son distinguibles del azar.

**Aciertos por caso (sobre 5):** todos los casos que deciden dan 5/5 en las cuatro configuraciones, y también los informativos, salvo **E sin categoría en C: 4/5** (ver §10).

### 6.1 La cita que top-3 pierde (caso B)

Citas del caso B por configuración (5 corridas cada una):

| Config | Ley 2148 art. 7.1.9 | Ley 451 art. 6.1.37 (obstrucción de vía) | **Ley 451 art. 6.1.52 (estacionamiento prohibido)** |
|---|---|---|---|
| BASE | 5 | 4 | **5** |
| A · B · C | 5 | 5 | **0** |
| BASE+ | 5 | 3 | **5** |
| A+ · B+ · C+ | 5 | 5 | **0** |

La rúbrica a nivel de norma marca ambas como correctas porque las dos son de la Ley 451. En el fondo no es lo mismo: para un auto estacionado sobre una rampa,
el artículo de «estacionamiento o detención prohibida» es la sanción más específica y es la que el baseline cita siempre. Es el único caso donde el baseline cita un
fragmento fuera del top-3; en el resto, toda cita cae dentro de los tres primeros.

### 6.2 Otras observaciones

- **La Prueba 2 (falla conocida del baseline) no se reproduce en ninguna configuración:** 0 de 40 corridas fundamentaron (5 por configuración × 8); las 40 dieron `sin_normativa` sin citas. Lo mismo ocurre con la Prueba 1.
  Con P-01 fallaba 2 de 2. Es probable que lo haya corregido la separación de fragmentos del art. 48 inc. t) de la ronda R5-08, no las variantes; no es un mérito de ninguna configuración.
- **Estado del caso D-CABA (`fundamentado` vs `asistencia`).** La rúbrica acepta ambos, pero la mezcla cambia entre configuraciones: `asistencia` en 2/5 (BASE), 2/5 (A), 2/5 (B), 3/5 (C), 4/5 (BASE+), 2/5 (A+), 4/5 (B+) y 5/5 (C+).
  Con la instrucción de concisión el modelo tiende a `asistencia` en este caso. No viola la regla, pero cambia lo que ve el ciudadano y conviene que lo mire el PO.

## 7. Resultados de la Fase 2 (maxOutputTokens 1024 y concisión)

| Config | Aciertos | Truncados | Salida máx. | Entrada media | Salida media | Palabras ciudadano (mediana / máx.) | Palabras oficial (mediana / máx.) | Concisión cumplida |
|---|---|---|---|---|---|---|---|---|
| BASE (referencia, sin instrucción) | 30/30 | 0 | 598 | 863 | 356 | 30 / 41 | 46 / 85 | — |
| **BASE+** | 30/30 | 0 | 524 | 921 (+6.7 %) | 286 (−19.7 %) | 22 / 32 | 37 / 56 | 100 % |
| **A+** | 30/30 | 0 | 644 | 796 | 290 | 21 / 32 | 35 / 49 | 100 % |
| **B+** | 30/30 | 0 | 378 | 796 | 272 | — | — | 100 % |
| **C+** | 30/30 | 0 | 450 | 796 | 275 | — | — | 100 % |

- **1024 tokens es seguro:** 0 truncamientos y máximo observado de 644 (por debajo del límite de 819 fijado).
- **La concisión funciona pero el baseline ya era conciso:** mediana de 30 palabras para el fundamento ciudadano y ninguna con más de 2 oraciones, es decir que la premisa de la propuesta
  («párrafos de 3 o 4 oraciones») no se observa con `gemini-3.8-flash`. La instrucción baja la mediana a 22 palabras.
- **Costo neto casi nulo:** la instrucción agrega ~58 tokens de entrada por llamada. BASE+ ahorra 70 tokens de salida y gasta 58 de entrada: −1 % en total.
  El beneficio real sería de lectura en el celular, no de costo.

## 8. Aplicación de la regla de decisión (lectura literal)

| Config | R1 | R2 | R3 | R4 | R5 | Extra «+» | Resultado literal | Δ entrada | Δ salida | Δ latencia |
|---|---|---|---|---|---|---|---|---|---|---|
| A | sí | sí | sí | sí | sí | — | **cumple** | −15 % | −27 % | −6 % |
| B | sí | sí | sí | sí | sí | — | **cumple** | −15 % | −9 % | −4 % |
| C | sí | sí | sí | sí | sí | — | **cumple** | −15 % | −4 % | +1 % |
| BASE+ | sí | sí | sí | sí | **no** | sí | no cumple | +7 % | −14 % | −3 % |
| A+ | sí | sí | sí | sí | **no** | sí | no cumple | −9 % | −13 % | −10 % |
| B+ | sí | sí | sí | sí | sí | sí | **cumple** | −9 % | −25 % | −11 % |
| C+ | sí | sí | sí | sí | sí | sí | **cumple** | −9 % | −31 % | −9 % |

(Δ sobre medianas, frente a BASE.) R5 se cumple en A, B y C únicamente por la entrada (−15 %), y en B+ y C+ por la salida.

## 9. Recomendación

**Mantener el baseline** para la recuperación y el thinking, con un seguimiento acotado.

**Por qué no adoptar A, B ni C aunque cumplan la regla literal**
1. La ganancia real es de ~14 % en tokens totales, no del 45–57 % de la propuesta.
2. Sale de top-3, y top-3 hace perder el art. 6.1.52 de la Ley 451 en el caso B (0 de 5 vs 5 de 5). El ticket pide expresamente que la configuración «no pierda normativa relevante por bajar recall».
3. La latencia no mejora de forma medible.
4. B y C (thinking apagado) no mejoran nada frente a A: el ahorro es el mismo, sin que el razonamiento cambie el resultado. C, además, tuvo el único rechazo del validador (§10) y un umbral con margen de 0.009 en el caso A.

**Qué no cambiar:** el thinking `low` (no hay beneficio medible en apagarlo y `thinkingBudget: 0` no garantiza 0) y el umbral 0.45.

**Opcional, sin impacto en costo:** `maxOutputTokens` 1024 y la instrucción de concisión (BASE+). Es seguro (0 truncamientos, concisión 100 %), pero solo se justifica por legibilidad, y antes habría que revisar con el PO el desplazamiento del caso D-CABA hacia `asistencia`.

**Variante D (top-k 4 · umbral 0.52 · thinking `low`): analizada por cálculo, no corrida**

Se propuso como seguimiento porque conservaría el 4.º fragmento de B (0.646), de C (0.651) y de E (0.595), o sea todas las citas que el baseline hizo en este experimento.
Antes de gastar llamadas se calculó sobre la recuperación de la Fase 0 y los tokens medidos (`variant-d-estimate.mjs`; salida en `raw/variant-d-estimate.txt`), y resultó que no hay nada que medir:

- **El prompt de D es idéntico al de BASE en 8 de 9 casos.** BASE ya recuperaba 4 fragmentos o menos en todos salvo E sin categoría (6 → 4).
- **Ahorro esperado: ~3.7 % de la entrada** (unos 32 de 863 tokens por llamada, a ~143 tokens por fragmento), muy por debajo del 10 % que exige R5.
- **El ahorro de top-3 sale de no mandar lo que el baseline sí recuperaba:** el 4.º fragmento en B, C, E y Prueba 2 (−1 cada uno) y 3 fragmentos de E sin categoría, en total 7 fragmentos en 5 de 9 casos. Entre ellos está la Ley 451 art. 6.1.52 que el baseline cita en B.
- **Un umbral más alto tampoco lo resuelve con estos casos.** El fragmento que necesita el caso A tiene 0.559, y hay fragmentos irrelevantes de otros casos con más similitud (0.588 en E sin categoría), así que ningún corte global los separa.
  Es una observación sobre 9 casos, no una conclusión general.

**Conclusión:** en este corpus, ahorrar más del 10 % de entrada exige descartar normativa que el baseline usa. Refuerza la recomendación de mantener el baseline. No se corrieron llamadas de la variante D.

**Seguimiento que sigue abierto:** repetir la comparación de la configuración elegida sobre la matriz de 20 casos de REP-3784 cuando exista.

## 10. Parámetros finales

**No se adopta ningún cambio: siguen los valores vigentes.** `DEFAULT_MATCH_COUNT = 6`, `DEFAULT_SIMILARITY_THRESHOLD = 0.45`, `thinkingConfig: { thinkingLevel: 'low' }`, `maxOutputTokens: 2048`, `PROMPT_VERSION = 'v1'`.
Si el equipo decide adoptar algo (por ejemplo la variante D tras el seguimiento), el cambio va en otra tarea con su despliegue de `analizar-reporte`.

## 11. Limitaciones, desviaciones y observaciones

- **Mi aclaración de R3 fue demasiado laxa.** La fijé (a nivel de norma) antes de correr la generación, pero no distingue artículos de una misma ley. La métrica «citas del baseline fuera de top-3» la agregué antes de correr, justamente para verlo,
  y es la que detectó el problema. No se modificó la regla: se informa la lectura literal (§8) y la sustantiva (§9), y se deja la decisión al equipo.
- **N = 5 por celda.** Suficiente para ver que el baseline cita el art. 6.1.52 siempre (5/5) y las variantes top-3 nunca (0/5), no para diferencias chicas en tokens (desvío de ~120 sobre la salida).
- **El baseline de P-01 no era el de hoy.** La Prueba 2 y el caso D-CABA se comportan distinto que en P-01; se compara siempre contra el baseline medido en este experimento.
- **Latencia de laboratorio:** una máquina y una red; comparable entre variantes, no extrapolable a producción. Aun así, la mediana del baseline (1.9 s) es menor que los 3.2–4.0 s que asumía la propuesta.
- **Un rechazo del validador (1 en 360).** En C, E sin categoría, repetición 2, el modelo citó el fragmento `…0016` y la cita no apareció literal. Ese fragmento tiene un salto de línea CRLF (`\r\n`) en su texto; si la cita lo abarca, el validador
  (`content.includes(cita)`) puede rechazar una cita correcta. Es un evento único y no se puede atribuir a una configuración, pero indica que el validador no normaliza saltos de línea. Conviene evaluarlo aparte.
- **Vectores redondeados a 5 decimales** en la recuperación (error ~1e-5), verificado contra la recuperación de referencia.
- **Sin desviaciones de procedimiento:** 360 de 360 corridas ejecutadas, sin errores de API ni reintentos.
- **No se probó:** caché semántica, otro proveedor, Flash-Lite ni cambios de corpus (fuera de alcance).

## 12. Evidencia

Todo en `scripts/rag-local-dev/rep3786/`, versionado y reproducible:

| Archivo | Contenido |
|---|---|
| `raw/runs.ndjson` | 360 corridas, una por línea: estado, citas, tokens, latencia y texto de los fundamentos |
| `raw/experiment.log` | Registro de la corrida |
| `raw/summary.json` | Resumen por configuración y aplicación de la regla |
| `raw/retrieval-01…07.json`, `fragments.json`, `raw/extra-fragments.json`, `phase0-analysis.json` | Fase 0: recuperación k=6, texto de los 14 fragmentos verificado por md5, recuperación derivada |
| `raw/thinking-mode.json` | Sonda de thinking |
| `variant-d-estimate.mjs` → `raw/variant-d-estimate.txt` | Cálculo de la variante D (top-k 4), sin llamadas a Gemini |
| `evaluate.mjs`, `run-experiment.mjs`, `analyze.mjs`, `phase0.mjs`, `probe-thinking.mjs`, `gemini-call.mjs`, `prepare-retrieval-sql.mjs` | Rúbrica, corredor, análisis y utilidades |

Reproducir: `node phase0.mjs && node probe-thinking.mjs && node run-experiment.mjs --reps 5 && node analyze.mjs`
(requiere `GEMINI_API_KEY` en `.env`; la recuperación se genera con `prepare-retrieval-sql.mjs` y se ejecuta de solo lectura contra el corpus).

## 13. Trazabilidad

REP-2908 (RAG textual) · REP-3773 (parámetros iniciales) · REP-3777 (auditoría y tokens) · REP-3784 (corrida completa de precisión) · REP-3764 (casos esperados) · REP-3778 (propuesta, tomada como hipótesis).

---

**Documentos relacionados:** [REP-3786](https://unlz2026.atlassian.net/browse/REP-3786) · [REP-2908](https://unlz2026.atlassian.net/browse/REP-2908) · [REP-3773](https://unlz2026.atlassian.net/browse/REP-3773) · [REP-3777](https://unlz2026.atlassian.net/browse/REP-3777) · [REP-3784](https://unlz2026.atlassian.net/browse/REP-3784)
