# RAG · Tres variantes de recuperación medidas contra la actual

**Fecha:** 16/10/2026 · **Para:** Matías Krepchuk (líder técnico) · **Con copia a:** Hernán Gregorini (PO), Leonel Nuñez
**Base:** medición del 16/10 sobre staging (~400 análisis desde el 29/09) y `docs/RAG-S15_aplicado_en_staging_Sprint16.md` §5 (D4).

> **Para leer primero.**
> - Se midió **solo la recuperación** (en qué posición queda la norma aceptable), no lo que Gemini hace después con los fragmentos.
> - **No se desplegó nada ni se escribió en la base.** Los candidatos salen del RPC `match_knowledge_fragments` de staging (mismo filtro de categoría y jurisdicción que producción); los vectores de las variantes se calcularon en memoria y quedaron en un archivo local.
> - Runner: `scripts/rag-local-dev/rep-diag-variantes/` (`run.mjs` + `resumen.mjs`). Corrida del 16/10/2026, 15:47 UTC.
> - **Conclusión corta:** la búsqueda híbrida es la mejora más barata y la única que mueve algo en D4; el texto enriquecido es la que más esperados mete en el top 8; `taskType` no hace nada en este modelo. **Ninguna de las tres resuelve D4.**

## 1. Resumen

| Variante | ¿Mejora la posición? | Costo de aplicarla | Recomendación |
|---|---|---|---|
| **V3 · Búsqueda híbrida** (RRF entre vectores y `fts`) | **Sí.** MRR 0,614 → **0,746** fuera de D4; es la única que sube un esperado de D4 al top 8 (1 de 9 casos) | Cero llamadas a la API. Una migración (RPC nuevo) y un cambio en `analizar-reporte` | **Aplicar primero** |
| **V2 · Texto enriquecido** (norma + ruta + contenido) | **Sí, en cobertura.** Esperados dentro del top 8: 68 % → **82 %** fuera de D4 (84 % combinado con V3). La primera posición no mejora sola | Revectorizar 127 fragmentos (~23 mil tokens, menos de US$ 0,01) y cambiar `embed-pending.mjs` | **Aplicar segundo**, sobre V3 |
| **V1 · Instrucción de tarea** | Leve en el orden (MRR 0,692), pero **empeora** la separación de casos sin norma | Revectorizar el corpus y cambiar la consulta | **No aplicar por ahora** |
| `taskType` (lo pedido originalmente) | **No hace nada:** el vector con y sin `taskType` es idéntico (coseno 1,000000) | — | Descartado |

## 2. `taskType` en `gemini-embedding-2`

La documentación de Gemini dice que **`gemini-embedding-2` no usa el campo `task_type`** (es de `gemini-embedding-001`) y que la tarea va **escrita en el texto**:

| Lado | Formato documentado |
|---|---|
| Consulta | `task: search result \| query: {contenido}` |
| Documento | `title: {título} \| text: {contenido}` (`title: none` si no hay título) |

Se verificó contra la API: mandar `taskType: RETRIEVAL_QUERY` **no da error**, pero el vector sale **idéntico** al que se obtiene sin el campo. Es decir, agregarlo a `embedText` y a `embed-pending.mjs` como se planteaba no cambiaría nada y daría una falsa sensación de haberlo aplicado. La variante V1 de este informe usa el formato en el texto.

## 3. Cómo se midió

### 3.1 Casos (48)

| Grupo | Casos | De dónde salen |
|---|---|---|
| **D** · D1 a D5 | 20 | Todos los textos distintos de D1 a D5 en `casos_D1_a_D8.csv` (D1: 1, D2: 7, D3: 4, D4: 7, D5: 1), con la localidad y la categoría del reporte original |
| **R** · reportes de staging | 20 | Filas de `citizen_reports` (solo lectura), elegidas para cubrir tránsito, ambiente, comercio e infraestructura en CABA y en Avellaneda. Son reportes de la base de staging, en buena parte cargados por el equipo en las baterías de prueba |
| **N** · sin norma aplicable | 8 | Control negativo: reportes de staging cuyo texto no corresponde a la categoría elegida (p. ej. «Pozo grande en la calle…» en Comercio irregular, «La luminaria de la esquina no funciona» en Tránsito) o sin hecho reclamable («Gato durmiendo») |

**Norma esperada:** los artículos «aceptables» de la sección 5 de tu LEEME, por escenario (D1 ambiente en Avellaneda, D2 comercio en Avellaneda, etc., y los «casos sin desvío» para tránsito y ambiente en CABA). Para D4 y los baches de CABA se tomó **Ley 1777 art. 10 y Ley 6684 art. 26**; el canal 147 se dejó afuera porque es un canal, no una norma.

### 3.2 Variantes

| Variante | Texto de la consulta | Texto del fragmento | Ranking |
|---|---|---|---|
| **B** (actual) | `descripción (categoría: X)` | `content` | Coseno |
| **V1** | `task: search result \| query: descripción (categoría: X)` | `title: none \| text: content` | Coseno |
| **V2** | igual que B | `norma (número)` + `hierarchy_path` + `content` | Coseno |
| **V1+V2** | igual que V1 | `title: norma — hierarchy_path \| text: content` | Coseno |
| **V3** | B + texto completo | `content` (columna `fts`) | RRF k=60 entre el orden vectorial de B y el de `ts_rank` |
| **V3+V2**, **V3+V1+V2** | — | — | RRF sobre el orden vectorial de V2 o de V1+V2 |

- El artículo no se agrega aparte en V2: `hierarchy_path` ya lo trae («… > Artículo 4.1.2 (venta en la vía pública sin autorización)»).
- Texto completo: búsqueda con la **descripción sola** (sin el código de categoría), términos unidos con OR (`plainto_tsquery` los une con AND y en textos largos casi nunca hay coincidencia), mismo filtro de categoría y jurisdicción.
- **Control de la medición:** la similitud recalculada en memoria para B coincide con la que devuelve la base (diferencia máxima 3,2 × 10⁻⁷).

### 3.3 Métricas
- **Recall@8:** el caso tiene al menos un esperado dentro del top 8 (lo que ve el modelo).
- **Posición mediana** de la primera norma esperada y **MRR** (promedio de 1 / posición; 1 = siempre primera).
- **Esperados dentro del top 8:** de los esperados elegibles del caso, qué parte entra al top 8.
- **Separación:** similitud máxima de los casos con norma contra los casos sin norma; AUC = probabilidad de que un caso con norma tenga más similitud que uno sin norma.

## 4. Resultados

### 4.1 Todos los casos con norma esperada (40)

| Variante | Recall@8 | Posición mediana | MRR | Esperados dentro del top 8 |
|---|---|---|---|---|
| **B** (actual) | 78 % | 2 | 0,485 | 53 % |
| V1 | 78 % | 2 | 0,545 | 58 % |
| V2 | 78 % | 3 | 0,490 | 63 % |
| V1+V2 | 78 % | 3 | 0,499 | 59 % |
| **V3** | 80 % | 2 | **0,590** | 59 % |
| **V3+V2** | 80 % | 2 | 0,587 | **66 %** |
| V3+V1+V2 | 80 % | 2 | 0,585 | 62 % |

El 22 % sin acierto son **los 9 casos de baches en CABA** (D4 y dos reportes de staging). Por eso se separan:

### 4.2 Sin baches en CABA (31 casos)

| Variante | Recall@8 | Posición mediana | MRR | Esperados dentro del top 8 |
|---|---|---|---|---|
| **B** (actual) | 100 % | 2 | 0,614 | 68 % |
| V1 | 100 % | 1 | 0,692 | 75 % |
| V2 | 100 % | 3 | 0,621 | 82 % |
| V1+V2 | 100 % | 2 | 0,632 | 76 % |
| **V3** | 100 % | **1** | **0,746** | 75 % |
| **V3+V2** | 100 % | **1** | 0,742 | **84 %** |
| V3+V1+V2 | 100 % | 1 | 0,739 | 78 % |

**Lectura.** Fuera de D4 la norma correcta **ya entra al top 8 en todos los casos** (hay entre 11 y 20 candidatos por categoría y localidad, así que el top 8 es más de la mitad). Lo que cambia es el **orden**: hoy el 21 % de las citas sale de las posiciones 6 a 8, y subir la norma correcta al primer lugar deja menos margen para que el modelo cite un fragmento de procedimiento o lo descarte. Donde más se nota es **D2 (comercio en Avellaneda)**: en los 7 textos, la primera norma aceptable pasa de una posición mediana de 4 a una de 2 con V3+V2 (ninguno empeora), y en «Venta ambulante de ropa ocupando toda la vereda» (R17) de la 7 a la 1. En tránsito, ambiente en CABA y D5 la norma ya está primera con todas las variantes.

### 4.3 Caso testigo: D4 y baches en CABA (9 casos, 28 candidatos cada uno)

| Variante | Recall@8 | Posición mediana | Mejor posición lograda |
|---|---|---|---|
| **B** (actual) | 0 % | 26 | 22 |
| V1 | 0 % | 25 | 21 |
| V2 | 0 % | 26 | 22 |
| V1+V2 | 0 % | 25 | 21 |
| **V3** | **11 %** (1 de 9) | 26 | **8** |
| V3+V2 | 11 % (1 de 9) | 26 | 8 |

Posición de cada norma de competencia (detalle):

| Caso | Fragmento | B | V1 | V2 | V1+V2 | V3 | V3+V2 |
|---|---|---|---|---|---|---|---|
| D4 «Hay un bache grande y profundo…» | Ley 1777 art. 10 | 26 | 25 | 27 | 27 | 26 | 27 |
| | Ley 6684 art. 26 | 28 | 28 | 28 | 26 | 28 | 28 |
| D4 «bache grande» | Ley 1777 art. 10 | 26 | 26 | 26 | 27 | 26 | 26 |
| | Ley 6684 art. 26 | 28 | 25 | 28 | 25 | 28 | 28 |
| D4 «Deterioro de la calzada con pozos…» | Ley 1777 art. 10 | 26 | 26 | 26 | 28 | 27 | 27 |
| | Ley 6684 art. 26 | 28 | 27 | 28 | 23 | **8** | **8** |
| D4 «Falta de conservación y mantenimiento de la vía pública…» | Ley 1777 art. 10 | 22 | 22 | 27 | 26 | 22 | 24 |
| | Ley 6684 art. 26 | 28 | 21 | 22 | 21 | **12** | **10** |
| D4, otros 3 textos y 2 reportes de staging | ambas | 25–28 | 25–28 | 26–28 | 24–28 | 26–28 | 26–28 |

**Lectura.** Las normas de competencia quedan **entre las últimas** de 28 con todas las variantes vectoriales: el texto del ciudadano habla de baches y gomas rotas, y la Ley 1777 y la 6684 hablan de competencias de Comunas y Ministerios. La híbrida solo las rescata cuando el ciudadano usa el vocabulario de la norma («calzada», «conservación», «mantenimiento», «vía pública»), que es la redacción técnica, no la habitual. **Esto confirma lo que dice §5 del informe del Sprint 16: D4 no se arregla con la técnica de recuperación**; hace falta una de las decisiones de diseño que ya están planteadas (cupo del top 8 para fragmentos de tipo `competencia`, partir el art. 26 por inciso o revisar el mapeo por categoría).

### 4.4 Separación entre casos con norma y sin norma

| Variante | Media con norma | Mínima con norma | Media sin norma | Máxima sin norma | AUC |
|---|---|---|---|---|---|
| **B** (actual) | 0,702 | 0,622 | 0,659 | **0,710** | 0,813 |
| V1 | 0,715 | 0,650 | 0,681 | 0,712 | 0,787 |
| V2 | 0,690 | 0,621 | 0,648 | 0,690 | 0,769 |
| V1+V2 | 0,705 | 0,640 | 0,664 | 0,698 | 0,847 |

**Lectura.** Ninguna variante separa: en todas, el caso sin norma con más similitud supera al caso con norma con menos. Con la actual, «Auto estacionado sobre la vereda…» en la categoría Ambiente llega a 0,710, por encima de casos reales con norma aplicable (0,622). Es el mismo hallazgo de la medición del 16/10 (fundamentados ~0,70 contra sin_normativa ~0,68), ahora con controles negativos explícitos: **ningún umbral de similitud puede decidir «sin normativa»**, con o sin estos cambios; esa decisión tiene que seguir en el modelo. V1 además **sube la similitud de lo irrelevante** («Gato durmiendo» pasa de 0,558 a 0,649), que es la razón para no aplicarla sola. V3 no cambia las similitudes (reordena), así que no aparece en esta tabla.

## 5. Costo

### 5.1 De esta medición

| Concepto | Valor |
|---|---|
| Llamadas a la API de Gemini | **9** (7 `batchEmbedContents` de hasta 100 textos + 2 `embedContent` para la prueba de `taskType`) |
| Textos vectorizados | 602 (127 fragmentos × 4 formatos + 48 consultas × 2 formatos + 2 de prueba) |
| Caracteres | 338.840 (≈ 85 mil tokens estimados a 4 caracteres por token) |
| Costo estimado | ≈ US$ 0,02 al precio de lista de `gemini-embedding-2` (US$ 0,20 por millón de tokens) |
| Consultas a staging | 48 llamadas al RPC (lectura) + 1 `SELECT` de texto completo + lectura del corpus |

### 5.2 De aplicar cada variante

| Variante | Una sola vez | Por reporte analizado |
|---|---|---|
| **V3** | Migración con un RPC nuevo (o una versión nueva de `match_knowledge_fragments`) que haga el RRF en SQL; cambio de una línea en `analizar-reporte`. **Cero llamadas a Gemini** | Sin llamadas extra; una búsqueda de texto completo más dentro de la misma consulta (el índice ya existe) |
| **V2** | Revectorizar los 127 fragmentos: 92 mil caracteres, ~23 mil tokens, 2 llamadas en lote, **menos de US$ 0,01**. Cambiar `embed-pending.mjs` para que arme el texto enriquecido (también para los fragmentos que se carguen después) | Ninguno (la consulta no cambia) |
| V1 | Igual que V2 más cambiar el texto de la consulta en `embedText` | Ninguno |

## 6. Recomendación y orden

1. **Primero V3 (búsqueda híbrida).** Es la mejora más grande en el orden (MRR 0,614 → 0,746 fuera de D4), no gasta API, no requiere revectorizar y la columna `fts` ya está indexada. Antes de desplegar, medirla sobre la batería de 81 casos (pedido 4 de tu LEEME) y en particular **los textos con errores de ortografía**: «ay un vache enorme en lacalle…» no tiene ninguna coincidencia de texto completo, así que ahí la híbrida cae al orden vectorial (no empeora, pero no ayuda).
2. **Después V2 (texto enriquecido)**, sobre V3. Mete más esperados dentro del top 8 (84 % combinado) a un costo de API despreciable. Hacerlo con un **`model_code` nuevo** (p. ej. `gemini-embedding-2@768-enriquecido`) para poder volver atrás sin revectorizar, y cambiar el loader en el mismo PR para que los fragmentos nuevos se vectoricen igual.
3. **No aplicar V1 por ahora.** Mejora poco el orden y sube la similitud de lo irrelevante. Si algún día se quiere usar la similitud como señal, V1+V2 es la de mejor AUC (0,847), pero sigue sin separar.
4. **No agregar `taskType`**: no tiene efecto en este modelo.
5. **D4 sigue esperando tu decisión de diseño** (§6 del informe del Sprint 16). Ninguna de estas variantes la reemplaza.

## 7. Límites de esta medición

- **Muestra chica:** 40 casos con norma y 8 sin norma. Las diferencias de MRR entre V3, V3+V2 y V3+V1+V2 (0,739 a 0,746) están dentro del ruido; la diferencia contra la actual (0,614) no.
- **Esperados por escenario, no por texto:** se usó la lista de aceptables de tu LEEME para todos los textos de un mismo escenario. Un texto puntual puede merecer otra norma (por ejemplo, un auto en la vereda tapando un garaje).
- **Recall@8 saturado:** fuera de D4 hay como mucho 20 candidatos, así que casi todo entra al top 8; por eso el informe pone el peso en el orden y en la cobertura.
- **RRF sin ajustar:** k=60 (el valor estándar) y pesos iguales para vectores y texto. Puede afinarse cuando se mida sobre la batería de 81.
- **Solo recuperación:** no se midió qué cita Gemini con el nuevo orden. El paso siguiente para V3 es correr `rep-diag-generacion` con el contexto que devuelve la híbrida en D2 y D3.
- Los vectores de las variantes se calcularon una sola vez; `gemini-embedding-2` es determinístico para el mismo texto (lo confirma el control de §3.2).

## 8. Archivos

| Archivo | Qué es |
|---|---|
| `scripts/rag-local-dev/rep-diag-variantes/run.mjs` | Runner: candidatos del RPC, vectores en memoria, RRF y métricas |
| `scripts/rag-local-dev/rep-diag-variantes/casos.json` | Los 48 casos y los esperados por escenario |
| `scripts/rag-local-dev/rep-diag-variantes/fts.sql` · `fts-ranks.json` | Consulta de texto completo (solo `SELECT`) y su resultado |
| `scripts/rag-local-dev/rep-diag-variantes/resumen.mjs` | Arma las tablas de este informe desde la salida |
