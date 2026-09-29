# REP-3795 / REP-3797 — Verificación del RAG con el corpus ampliado (Sprint 14)

Fecha: 29/09/2026 · Proyecto Supabase: CiudadAR · Función: `analizar-reporte` v34 (real) · `PROMPT_VERSION` v2 · `temperature` 0

## 1. Estado de la carga (verificado en base)

| Verificación | Esperado | Resultado |
|---|---|---|
| V-1 fuentes | 20 | 20 |
| V-1 fragmentos vigentes | 83 | 83 |
| V-1 mapeos `fragment_services` | 89 | 89 |
| V-3 categorías con fragmentos | 5 | 5 (VULN 29, AMBIENTE 17, INFRA 16, TRÁNSITO 13, COMERCIO 13) |
| V-4 vigentes sin categoría | vacío salvo distractor | 1 |
| V-5 sin embedding | 0 | 0 (67 generados con `scripts/corpus-loader/embed-pending.mjs`) |
| V-6 fuente sin URL/fecha | 0 | 0 |
| V-7 fuentes elegibles | función operativa | Avellaneda 10 · Balvanera 12 |

## 2. Reportes de prueba (pipeline real: insert → trigger → cola pgmq → cron → función real)

Creados con autorización de Matías, `user_id` a9420d51-… (el de las pruebas de REP-3793). Sin marca en la descripción para no sesgar el embedding; se identifican por id y se borran al cerrar.

| Caso | Id | Localidad | Categoría | Texto |
|---|---|---|---|---|
| VS-1 | d4372c70-28eb-4a83-8adc-f9a862664216 | Balvanera | VULNERABILIDAD_SOCIAL | Persona en situación de calle |
| VS-2 | 52ac20dd-7780-4015-a547-de0743ffe8e5 | Wilde | VULNERABILIDAD_SOCIAL | Refugio improvisado bajo estructura vial |
| AM-CABA | fd6344e6-d808-479c-8818-9b19de10a35f | Balvanera | AMBIENTE | Basura acumulada en la vereda hace varios días |
| AM-AV | d7b71d5e-071a-4069-9859-c3d2e1f758a0 | Piñeyro | AMBIENTE | Basural a cielo abierto en la esquina, tiran residuos todos los días |
| CI-1 | 7725a56e-7172-4129-9ab5-e9cd33f0db8f | Balvanera | COMERCIO_IRREGULAR | Un puesto vende bebidas en la vereda sin habilitación |
| CE-1 | f361d3c8-6421-473c-81fe-82edd1a581ae | Puerto Madero | TRANSITO (errónea) | Un puesto vende bebidas en la vereda sin habilitación |
| IN-CABA | 8040a027-c53e-48d8-a09b-b0138f2a42bb | Balvanera | INFRAESTRUCTURA | La vereda está rota y levantada por las raíces de un árbol |
| CO-AV | 2eb0d9a1-36a4-4974-80fc-efee1480897c | Piñeyro | COMERCIO_IRREGULAR | Venta ambulante de ropa ocupando toda la vereda |
| T-1 | 4a836e54-8374-41af-a252-aa1a86423f9f | Puerto Madero | TRANSITO | Auto mal estacionado |
| T-4 | 5438205b-718c-49d8-8275-14565e7b8fde | Piñeyro | TRANSITO | Auto abandonado hace meses en la calle |

## 3. Resultados

### 3.1 Ronda 1 — 10 casos (textos de prueba redactados por el equipo)

| Caso | Estado | Gemini | Lectura |
|---|---|---|---|
| VS-1, VS-2 | `asistencia` | No | Igual que antes (Punto 4, costo cero) |
| AM-CABA, AM-AV | `fundamentado` | Sí | **Mejora**: antes el corpus de Ambiente era casi inexistente |
| IN-CABA (vereda rota) | `fundamentado` | Sí | **Mejora**: antes solo Ley 210 |
| T-1 (auto mal estacionado) | `fundamentado` | Sí | Sin regresión |
| CI-1 (comercio, categoría correcta) | `fundamentado` | Sí | **Mejora**: antes `sin_normativa` sin corpus |
| CE-1 (comercio con categoría errónea TRANSITO) | `sin_normativa` | Sí | Abstención correcta, no repite el bug de la Prueba 2 |
| T-4 "Auto abandonado hace meses en la calle" | `indeterminado` | Sí | El modelo dice que no hay regulación sobre abandono. Ver 3.3 |
| CO-AV "Venta ambulante de ropa…" (Avellaneda) | `indeterminado` | **Sí** (la columna `generation_model_code` queda nula por diseño al fallar la validación; ver 3.5) | La cita a `b6717f77` no aparece literal. Ver 3.3 y 3.5 |

### 3.2 Ronda 2 — 8 casos con lenguaje de ciudadano argentino

| Texto | Jurisdicción / categoría | Estado |
|---|---|---|
| "Hay un señor durmiendo en la calle con este frío, ¿alguien lo puede ayudar?" | CABA · Vulnerabilidad | `asistencia` |
| "Hay un montón de bolsas de basura tiradas en la vereda y hace días que no las levanta nadie" | CABA · Ambiente | `fundamentado` |
| "Hace meses que hay un auto tirado en la calle, todo destrozado y sin patente, nadie se lo lleva" | Avellaneda · Tránsito | `fundamentado` |
| "Un vecino se sube con el auto a la vereda todos los días y me tapa la entrada del garage" | Avellaneda · Tránsito | `fundamentado` |
| "Dejaron la camioneta estacionada en la vereda y no dejan pasar a la gente con el cochecito" | CABA · Tránsito | `fundamentado` |
| "La luz de la calle está quemada hace más de un mes y de noche no se ve nada" | CABA · Infraestructura | `sin_normativa` |
| "Che, hay un tipo vendiendo choripanes en la esquina de casa sin ninguna habilitación…" | Avellaneda · Comercio | `indeterminado` |
| "Hay manteros vendiendo ropa en toda la vereda y no se puede ni pasar…" | Avellaneda · Comercio | `indeterminado` |

## 3.3 Hallazgos

1. **T-4 era un problema del texto de prueba**, no del corpus: con "auto tirado… sin patente" el mismo caso da `fundamentado`.
2. **Comercio en Avellaneda: `indeterminado` reproducible (3 de 3).** La búsqueda trae solo Ley 24.449 art. 48 t) (venta "en zona alguna del camino", ruta, no vereda urbana), LOM art. 27 incs. 1 y 6 y los canales del municipio. El modelo intenta citar `b6717f77` (art. 48 t) y la validación de cita literal lo rechaza. La causa de fondo es cobertura: falta la ordenanza municipal (Ord. 7180, Código de Faltas), ya registrada por Hernán como P-6 / P-9 / P-12 en `corpus/normativas/PENDIENTES_corpus.md`. **No es información omitida: es un hueco declarado.** Queda una decisión de producto: cuando el validador rechaza una cita, hoy el estado es `indeterminado`, no `sin_normativa`.
3. **Alumbrado en CABA: `sin_normativa`.** La Ley 210 (art. 2 b, art. 3 j) enuncia la competencia del Ente pero no la obligación de mantenimiento; el modelo, con la regla de precisión del Punto 5, se abstiene. Es coherente con REP-3796 (visibilidad de sanciones/obligación sustantiva), pero conviene que Hernán confirme si el art. 3 j alcanza como fundamento de derivación.
4. Los 4 casos de tránsito, los 3 de ambiente/infraestructura y los de vulnerabilidad no muestran regresiones.

## 3.4 Lectura de las citas (primera revisión, NO es validación jurídica)

Fuente: `report_ai_evidence` (fragmentos recuperados y cuáles se citaron). Cada estado `fundamentado` se contrastó contra la cita elegida.

| Caso | Cita elegida | Lectura |
|---|---|---|
| Auto mal estacionado (CABA) | Faltas 6.1.52 "estacione en lugar prohibido o en forma antirreglamentaria" | Correcta |
| Camioneta sobre la vereda (CABA) | Faltas 6.1.37 (obstrucción) + 6.1.54 (estacionar sobre aceras) | Correcta, muy ajustada |
| Vecino sube el auto a la vereda (Avellaneda) | Ley 24.449 art. 49 b.3 (aceras) + b.1 | Correcta |
| Basura en la vereda (CABA), 2 textos | Ley 1854 art. 36 + Faltas 1.3.13 (arrojar residuos) | Razonable; el art. 36 es genérico (basura a cielo abierto) |
| Basural (Avellaneda) | Ley 13.592 art. 9 (municipio obligado a clausurar basurales) | Correcta |
| Puesto de bebidas sin habilitación (CABA) | Faltas 4.1.2 "venda mercaderías en la vía pública sin permiso" | Correcta |
| Vereda rota por raíces (CABA) | Ley 5902 art. 7, 2.º párrafo: "…como consecuencia de obras ejecutadas por el Gobierno de la Ciudad…, **o por raíces de árboles**, la reparación o reconstrucción corre por cuenta y cargo de aquél." | **Correcta.** (Corrección del 29/09: la primera versión de este informe abreviaba la cita con "…" y la marcaba "a revisar" por error; la cita guardada por el modelo está completa e incluye "o por raíces de árboles"). |
| Auto abandonado (Avellaneda) | Ley 24.449 art. 48 "estorbar u obstaculizar la calzada" | **A revisar**: abandono no es lo mismo que obstruir. Es posible que el `indeterminado` de la ronda 1 fuera más fiel que este `fundamentado` |
| Puesto con categoría errónea (CE-1) | ninguna | Correcto |
| Comercio Avellaneda (3 casos) | ninguna (el modelo intentó `b6717f77`, rechazado) | Ver 3.3 |
| Alumbrado (CABA) | ninguna | Solo se recuperó Ley 210 art. 2 b; **el art. 3 j (quejas y reclamos) no entró en los 6 primeros**, aunque en REP-3795 sí se había recuperado |

Observaciones:
- En Avellaneda, los fragmentos de canales del municipio (`cav`, `produccion-comercio-ambiente`) quedan primeros por similitud en casi todos los casos de Avellaneda, y desplazan normas de fondo del puesto 1.
- Caso CO-AV (ronda 1): `indeterminado` con `generation_model_code` nulo pero con motivo de cita rechazada. No cuadra y sigue sin investigarse.
- Una sola corrida por caso; sin medición de consistencia en esta tanda.

## 3.5 Investigación de los puntos abiertos (29/09/2026)

### CO-AV: `indeterminado` con `generation_model_code` nulo — RESUELTO, y corrige un dato anterior
- **Corrección:** en la primera versión de este informe figuraba que CO-AV "no llamó a Gemini". **Era incorrecto.** Gemini sí se llamó: el motivo (`La cita de "b6717f77…" no aparece literal`) solo existe si el modelo devolvió una cita.
- **Por qué la columna queda nula:** en `supabase/functions/analizar-reporte/index.ts` (líneas ~658-671), `generationModelCode`, `promptVersion` y los tokens se guardan **solo** en la rama de éxito. Cuando la validación rechaza la respuesta, se guarda `indeterminado` con el motivo pero **sin modelo, sin tokens y sin la cita rechazada**.
- **Consecuencias:** (a) un `indeterminado` por cita rechazada parece "no se llamó al modelo" en los datos; (b) el costo real de esas llamadas no queda registrado; (c) no se puede saber qué texto citó el modelo, lo que impide diagnosticar. Es una brecha de observabilidad, no un error de datos de Hernán.

### ¿Por qué falla la cita literal en `b6717f77`? — CONFIRMADO (29/09/2026, con la rama de observabilidad desplegada)
- Tras desplegar `analizar-reporte` v35 (rama `fix/REP-3795-observabilidad-rechazo-validacion`), el motivo del rechazo ahora incluye lo que citó el modelo. En 2 corridas de "manteros vendiendo ropa" (Avellaneda) citó: `"Está prohibido en la vía pública:
t) instalarse o realizar venta de productos en zona alguna del camino;"`.
- El fragmento guarda `Está prohibido en la vía pública:

t) instalarse…`. **El texto es idéntico; difiere solo en el salto de línea (`
` del modelo vs `

` del fragmento).** La validación `fragment.content.includes(cita_textual)` lo rechaza igual.
- 49 de los 83 fragmentos vigentes tienen `

`. Las citas aceptadas hasta ahora eran de una sola línea, por eso no se veía. Cualquier cita que cruce una línea de un fragmento con `

` fallará.
- **Consecuencia:** el `indeterminado` de comercio en Avellaneda no se debe (solo) a falta de norma: el modelo citó bien y el validador lo rechazó por un salto de línea. Corregir esto es un cambio de código sin criterio jurídico (normalizar saltos de línea y espacios al comparar, sin dejar de exigir el mismo texto). **Todavía no se implementó.**
- **Dato nuevo de no determinismo:** el texto "choripanes" dio `indeterminado` 3 de 3 antes, y en esta corrida dio `fundamentado` (modelo `gemini-3.8-flash`, prompt v2, 1431 tokens de entrada). El mismo texto puede dar estados distintos según cite o no cruzando línea.
- Verificado también: los rechazos ahora guardan modelo, versión de prompt y tokens (p. ej. 1427 de entrada, 262-269 de salida).

### Consistencia (3 corridas por caso, mismo texto)
| Caso | Estados | Citas |
|---|---|---|
| Choripanes, Avellaneda | `indeterminado` ×3 | ninguna (misma cita rechazada) |
| Camioneta en la vereda, CABA | `fundamentado` ×3 | idénticas: 6.1.37 + 6.1.54 |
| Auto abandonado, Avellaneda | `fundamentado` ×3 | **varían**: 48 t.obstruccion en una corrida; 48 t.obstruccion + 49 b.1 en las otras dos |
| Vereda rota, CABA | `fundamentado` ×3 | idénticas: art. 7 (Ley 5902) |
| Luz quemada, CABA | `sin_normativa` ×3 | una corrida cita Ley 210 art. 2 b, las otras dos ninguna |

Conclusión: el **estado** es estable en los 5 casos; el **conjunto de citas** varía en 2 de 5 (coincide con lo visto en REP-3795, `temperature: 0` no es determinismo absoluto). Reportes de la tanda: 10 nuevos, ids en la base (`user_id` a9420d51-…, creados 29/09 00:36 UTC).

## 3.6 Ronda 3 — con el lote 2 aplicado, `

` normalizado y 120 embeddings regenerados (29/09/2026, 12:34 UTC)

Estado de la base tras la carga: 26 fuentes · 123 fragmentos (120 vigentes) · 158 mapeos · W-5 = 0 · W-6 = 0. `analizar-reporte` v35. 16 reportes (choripanes, manteros y auto abandonado ×3; luz ×3; vereda, camioneta, "auto mal estacionado" y basural ×1).

| Caso | Antes (lote 1) | Ahora (lote 2) | Lectura |
|---|---|---|---|
| Choripanes, Avellaneda (×3) | `indeterminado` ×3 (1 vez `fundamentado`) | `fundamentado` ×3, cita DL 8751/77 art. 35 y 4 bis | **Mejora** (marco provincial cargado) |
| Manteros, Avellaneda (×3) | `indeterminado` ×3 | `sin_normativa` ×3 | Más honesto; sin cita forzada de la Ley 24.449 |
| Auto abandonado, Avellaneda (×3) | `fundamentado` con art. 48 (no encajaba) | `fundamentado` ×3 con Ley 24.449 art. 49 b.7 (más de 5 días) | **Mejora**: norma específica |
| Vereda rota, CABA | `fundamentado`, Ley 5902 art. 7 | igual | Sin cambios |
| Camioneta sobre la vereda, CABA | `fundamentado`, 6.1.37 + 6.1.54 | igual | Sin cambios |
| **Auto mal estacionado, CABA** | `fundamentado`, Faltas 6.1.52 | **`indeterminado`** (el modelo pide más detalle) | **REGRESIÓN** |
| **Basural, Avellaneda** | `fundamentado`, Ley 13.592 art. 9 | **`indeterminado`**, cita rechazada | **REGRESIÓN** |
| **Luz quemada, CABA (×3)** | `sin_normativa` | **`indeterminado` ×3**: el modelo devuelve `asistencia` y el validador lo rechaza | **REGRESIÓN** |

### Causas

1. **Auto mal estacionado.** La recuperación cambió: el puesto 1 pasó a ser Faltas 1.3.31 (vehículo abandonado, fragmento nuevo) y aparecieron Ley 2148 7.1.8 b, 7.1.9 e y 7.1.9 c (incisos nuevos con encabezado). **Faltas 6.1.52 (`estacione en lugar prohibido o en forma antirreglamentaria`), que antes era el puesto 4 y fundamentaba el caso, quedó fuera de los 6 recuperados.** Es el efecto de "crowding" advertido en la sección D del pedido a Hernán: fragmentos nuevos más específicos desplazan al genérico que sí encajaba.
2. **Basural.** La cita rechazada es `"…en sus respectivas jurisdicciones. Las Autoridades Municipales quedan obligadas a clausurar dichos basurales"`. El fragmento (Ley 13.592 art. 9) tiene un **salto de línea** entre "jurisdicciones." y "Las Autoridades"; el modelo unió con un espacio y el `includes` exacto lo rechazó. Ya no hay `
`: **el problema no era solo el `

`, es cualquier diferencia de saltos de línea/espacios entre la cita y el fragmento.** Refuerza la necesidad de normalizar espacios en la validación (cambio 4.2), con el caso negativo de una cita parafraseada.
3. **Luz quemada.** Los puestos 2 y 3 pasaron a ser los canales «147» y «103» (fragmentos informativos nuevos, mapeados a la categoría) y el art. 3 j de la Ley 210 sigue sin entrar. Con canales y sin norma sustantiva el modelo devolvió `asistencia`, que el validador rechaza para Infraestructura. Resultado: `indeterminado` en vez de `sin_normativa`. Es un segundo caso de fragmentos no normativos desplazando normas.

### Conclusión de la ronda
El lote 2 mejora comercio y auto abandonado, pero **degrada tres casos por dos causas técnicas**, no por falta de datos: (a) la recuperación de 6 fragmentos se satura con fragmentos nuevos y canales; (b) la validación literal es sensible a espacios/saltos de línea. Estas regresiones **están hoy en la base compartida**. Ninguna es un error de contenido de Hernán, pero sí confirman el riesgo de mapear fragmentos genéricos o informativos a las categorías de conducta.

## 3.7 Validador tolerante a espacios: desplegado y verificado (función v36, 29/09/2026 12:49 UTC)

Rama `fix/REP-3795-validador-tolerante-espacios` (commit `6bfb08b`, sobre la observabilidad). 73 tests pasan, incluidos los negativos (paráfrasis, mayúsculas, tildes, palabras ausentes, cita solo de espacios).

| Caso | Antes del cambio | Después (v36) | Lectura |
|---|---|---|---|
| Basural, Avellaneda (×3) | `indeterminado`, cita rechazada | **`fundamentado` ×3** | Corregido. Cita Ley 13.592 art. 9 (la misma frase que se rechazaba) y Ley 11.723 art. 65 (gestión de residuos comunes = responsabilidad municipal), ambas pertinentes |
| Camioneta sobre la vereda, CABA | `fundamentado` | `fundamentado` (6.1.37 + 6.1.54) | Sin regresión |
| Vereda rota por raíces, CABA | `fundamentado` | `fundamentado` (Ley 5902 art. 7) | Sin regresión |

**Sigue sin resolverse** (dependen de la recuperación, no del validador): auto mal estacionado (CABA) y luz quemada (CABA). Falta el resultado del experimento `scripts/rag-local-dev/rep3797/retrieval-experiment.mjs`.

## 3.8 Experimento de recuperación (solo lectura, 29/09/2026)

Script: `scripts/rag-local-dev/rep3797/retrieval-experiment.mjs`. Reproduce la consulta de `analizar-reporte` (texto + categoría, embedding, RPC, umbral 0,45) y mide en qué puesto entra el fragmento esperado. **Mide recuperación, no generación:** que el fragmento llegue al modelo no garantiza que el modelo fundamente bien.

| Caso | Fragmento esperado | Puesto hoy (k=6) | k=8 | k=10 | Sin canales |
|---|---|---|---|---|---|
| Auto mal estacionado (CABA) | Faltas 6.1.52 | **8** (sim 0,69) | entra | entra | sigue afuera (k=6) |
| Luz quemada (CABA) | Ley 210 art. 3 j | **24** (sim 0,58) | no | no | no (puesto 22) |
| Luz quemada (CABA) | Ley 210 art. 2 b | 1 | sí | sí | sí |
| Basural (Avellaneda) | Ley 13.592 art. 9 | 2 | sí | sí | sí |
| Choripanes (Avellaneda) | DL 8751/77 art. 35 | 3 | sí | sí | sí |
| Choripanes (Avellaneda) | LOM art. 27 inc. 1 | **7** | entra | entra | entra (puesto 5) |
| Camioneta, auto abandonado, vereda rota, basura CABA | los esperados | dentro del top 6 | sí | sí | sí |

Lugares del top 6 ocupados en 8 casos (48 lugares): **8 por canales/teléfonos y 4 por procedimiento**. Los canales entran en 5 de 8 casos; los de procedimiento, en 2 de 8 (choripanes: 3; auto abandonado: 1). En choripanes, 5 de los 6 lugares son canal o procedimiento y la LOM art. 27 inc. 1 queda en el puesto 7.

### Lo que el experimento desmiente de las hipótesis anteriores
1. **Auto mal estacionado NO se explica por canales ni por procedimiento**: en su top 6 hay 0 de cada uno. Lo desplazan **otros fragmentos normativos nuevos** más específicos (Ley 451 1.3.31, Ley 2148 7.1.8 b, 7.1.9 e y c). Quitar los canales no lo arregla; subir `k` a 8 sí lo recupera (en recuperación).
2. **Luz quemada NO es un problema de canales desplazando al art. 3 j**: el art. 3 j está en el **puesto 24** con similitud 0,58, lejos de cualquier `k` razonable, con o sin canales. La búsqueda por texto (`fts`) tampoco lo resolvería para esta consulta: el art. 3 j no contiene las palabras «luz», «calle» ni «alumbrado» (esas están en el art. 2 b). La regresión (`indeterminado` en vez de `sin_normativa`) viene de que el modelo devolvió `asistencia`, que el validador rechaza para infraestructura, con dos canales (147 y 103) dentro del contexto.
3. **Comercio en Avellaneda sí muestra saturación real** (5 de 6 lugares sin norma de fondo).

### Lo que NO está probado
- Que `k=8` mejore la respuesta final: falta una corrida de generación sobre los mismos casos y verificar que los 5 casos que hoy funcionan no cambien.
- Cualquier solución para la luz: ninguna variante de `k` ni de canales la alcanza.

## 3.9 Vectores con encabezado (`hierarchy_path` + contenido): experimento en memoria (29/09/2026)

Script: `scripts/rag-local-dev/rep3797/context-embedding-experiment.mjs`. Solo lectura: los vectores se calcularon en memoria y **no se guardó ninguno**; la base no cambió.

**Metodología validada:** la autocomprobación (vector del texto solo de 3 fragmentos contra la similitud que devuelve la base) dio diferencia **0,0000** en los tres. El cálculo reproduce exactamente al sistema.

| Caso | Fragmento esperado | Puesto actual | Con encabezado |
|---|---|---|---|
| Auto mal estacionado | Faltas 6.1.52 | 8 | **4** (entra al top 6) |
| Luz quemada | Ley 210 art. 3 j | 24 | 22 (sin mejora) |
| Luz quemada | Ley 210 art. 2 b | 1 | 3 |
| Basural | Ley 13.592 art. 9 | 2 | 3 |
| Camioneta | Faltas 6.1.37 / 6.1.54 | 1 / 2 | 2 / 4 |
| Choripanes | DL 8751/77 art. 35 / LOM art. 27 inc. 1 | 3 / 7 | 4 / **3** (LOM entra al top 6) |
| Auto abandonado | Ley 24.449 art. 49 b.7 | 3 | 2 |
| Vereda rota por raíces | Ley 5902 art. 7 | 4 | **1** |
| Basura en la vereda | Faltas 1.3.13 | 2 | 1 |

**Fragmentos esperados dentro del top 6: 8 de 11 (actual) → 10 de 11 (con encabezado).**

### Lectura y límites
- Mejoran 2 casos que hoy fallan (6.1.52 y LOM art. 27 inc. 1) y varios suben (vereda rota 4→1, basura 2→1, abandonado 3→2). Otros bajan de puesto sin salir del top 6 (art. 2 b 1→3, 6.1.54 2→4, art. 35 3→4).
- **La luz NO se resuelve:** el art. 3 j sigue en el puesto 22 y los canales 103 y 147 siguen ocupando 2 lugares (el 103 pasa al puesto 1).
- **Las similitudes absolutas bajan** (p. ej. 0,69 → 0,62 en varios). Con el umbral fijo en 0,45 hay que verificar que ningún fragmento útil quede fuera en consultas más débiles.
- **Muestra chica y posible sobreajuste:** 8 casos, 11 fragmentos esperados, y 3 de esos casos son los que motivaron la hipótesis. Falta un conjunto de prueba independiente (idealmente armado por el PO).
- **Mide recuperación, no generación.** Falta probar de punta a punta antes de adoptar.
- **`k=8` recupera los mismos dos fragmentos sin regenerar vectores**, pero deja a 6.1.52 exactamente en el puesto 8 (el límite); con encabezado queda en el 4, con margen.

## 3.10 Prueba de generación de punta a punta: 4 variantes × 8 casos × 3 corridas (29/09/2026)

Script: `scripts/rag-local-dev/rep3797/generation-experiment.mjs` (96 generaciones; prompt, esquema y constantes leídos de `index.ts`; validador tolerante a espacios). Solo lectura sobre Supabase. Los vectores con encabezado se calcularon en memoria.

| Caso | k=6 (hoy) | k=8 | k=6 sin canales | encabezado k=6 |
|---|---|---|---|---|
| **Auto mal estacionado** | indeterminado ×3 | **fundamentado ×3** | indeterminado ×3 | **fundamentado ×3** |
| **Luz quemada** | indeterminado ×3 | indeterminado ×2, sin_normativa ×1 | **sin_normativa ×3** | indeterminado ×3 |
| Basural (Avellaneda) | fundamentado ×3 | fundamentado ×3 | fundamentado ×3 | fundamentado ×3 |
| Camioneta en la vereda | fundamentado ×3 | fundamentado ×3 | fundamentado ×3 | fundamentado ×3 |
| **Choripanes (Avellaneda)** | fundamentado ×3 | fundamentado ×3 | fundamentado ×3 | **sin_normativa ×3 (citó esperado 0/3)** |
| Auto abandonado (Avellaneda) | fundamentado ×3 | fundamentado ×3 | fundamentado ×3 | fundamentado ×3 |
| Vereda rota por raíces | fundamentado ×3 | fundamentado ×3 | fundamentado ×3 | fundamentado ×3 |
| Basura en la vereda (CABA) | fundamentado ×3 | fundamentado ×3 | fundamentado ×3 | fundamentado ×3 |

Tokens de entrada (promedio por caso, k=6 → k=8): p. ej. 1628 → 2073 en auto mal estacionado (+27 %); 1829 → 2092 en choripanes (+14 %).

### Lo que quedó verificado
1. **Auto mal estacionado:** el 6.1.52 llegando al modelo lo arregla (3/3 con `k=8` y con encabezado). Quitar canales **no** lo arregla: no era un problema de canales.
2. **Luz quemada:** con los canales dentro del contexto el modelo devuelve `asistencia` (rechazado para infraestructura) en las tres corridas; **sin canales, con el mismo `k=6`, devuelve `sin_normativa` las tres veces.** Es un efecto causal medido: los canales inducen el `asistencia`.
3. **Ninguna variante logra `fundamentado` en la luz.** Coincide con la recuperación: el art. 3 j no llega (puesto 22-24).
4. **`k=8` no rompió ninguno de los otros 6 casos** (todos `fundamentado`, con citas esperadas) en esta muestra.

### Lo que desmienten los datos
- **El encabezado NO es seguro:** rompe choripanes (de `fundamentado` a `sin_normativa`, 3/3), aunque en la prueba de recuperación había mejorado (el LOM art. 27 inc. 1 entraba al top 6). **Que mejore la recuperación no garantizó una mejor respuesta**: es la razón para probar generación y no solo recuperación.
- **"Sin canales" solo funciona si los canales se entregan por otro camino.** Como variante de prueba quita los canales del contexto; en producción el ciudadano se quedaría sin canal, lo que contradice el principio del PO. Requiere código (agregar el canal de forma determinística según categoría y jurisdicción).

### Lo que NO está probado
- La combinación `k=8` + sin canales (podría arreglar las dos regresiones; no se corrió).
- Cómo se entregarían los canales por separado.
- Que estos resultados se sostengan con casos fuera de estos 8 (posible sobreajuste; falta un conjunto independiente, idealmente del PO).

## 3.11 Variante combinada `k=8` sin canales (29/09/2026)

Misma prueba de generación (3 corridas por caso), solo las variantes `k=6 (hoy)` y `k=8 sin canales`. Los canales quedan **fuera** del contexto del modelo.

| Caso | k=6 (hoy) | k=8 sin canales |
|---|---|---|
| **Auto mal estacionado** | indeterminado ×3 | **fundamentado ×3** (citó esperado 3/3) |
| **Luz quemada** | indeterminado ×3 (`asistencia` inválido) | **sin_normativa ×3** |
| Basural (Avellaneda) | fundamentado ×3 | fundamentado ×3 |
| Camioneta en la vereda | fundamentado ×3 | fundamentado ×3 |
| Choripanes (Avellaneda) | fundamentado ×3 | fundamentado ×3 (citó esperado **2/3**; 7 fragmentos al modelo) |
| Auto abandonado (Avellaneda) | fundamentado ×3 | fundamentado ×3 |
| Vereda rota por raíces | fundamentado ×3 | fundamentado ×3 |
| Basura en la vereda (CABA) | fundamentado ×3 | fundamentado ×3 |

**Costo:** tokens de entrada, suma de los 8 casos: 12.656 (k=6) → 14.738 (`k=8` sin canales), **+16,5 %** (por caso, entre −9 % y +28 %).

### Lectura
- **Arregla las dos regresiones** sin romper ninguno de los otros seis casos, en esta muestra.
- **La luz vuelve a `sin_normativa`**, la respuesta honesta que tenía antes del lote 2. El PO considera ese resultado incorrecto (la Ley 210 alcanza con art. 2 b + 3 j); **ninguna variante probada logra `fundamentado`**, porque el art. 3 j no llega al modelo.
- **Choripanes:** una de las tres corridas fundamentó con una cita fuera de la lista de esperados (`citó esperado 2/3`, estado `fundamentado` las tres veces). No se investigó cuál; conviene mirarlo antes de adoptar.

### Lo que NO se puede adoptar tal cual
En producción, "sin canales" significaría que el ciudadano **no recibe ningún canal** en la respuesta del RAG, contra el principio del PO ("nunca se queda sin canal"). Sería necesario entregarlos por otro camino (determinístico, según categoría y jurisdicción) y eso incluye cambios de código y de pantalla que **no están hechos ni probados**.

### Pendiente
Muestra de 8 casos (posible sobreajuste), sin conjunto independiente; cita del caso choripanes sin revisar; diseño de la entrega de canales; qué hacer con la luz.

## 3.12 `k=8` desplegado y verificado en el pipeline real (función v37, 29/09/2026 14:59 UTC)

Rama `fix/REP-3795-recuperar-8-fragmentos` (commit `b1878e2`, sobre el validador y la observabilidad). Suite completa: 521 tests; el único que falló (UT-CRP-16) lee la fixture `ley_210_caba_ente_regulador.md` y fallaba por la colisión de nombres; con la fixture restaurada pasa (18 de 18). 24 reportes (8 casos × 3), insertar → cola → cron → función real → Gemini.

| Caso | Estados (3 corridas) | Tokens de entrada | Fragmentos guardados por análisis |
|---|---|---|---|
| **Auto mal estacionado** | **fundamentado ×3** | 2073 | 8 |
| Basural (Avellaneda) | fundamentado ×3 | 2021 | 8 |
| Choripanes (Avellaneda) | fundamentado ×3 | 2092 | 8 |
| Camioneta en la vereda | fundamentado ×3 | 2097 | 8 |
| Auto abandonado (Avellaneda) | fundamentado ×3 | 1632 | 8 |
| Basura en la vereda (CABA) | fundamentado ×3 | 1944 | 8 |
| Vereda rota por raíces | fundamentado ×3 | 1765 | 8 |
| **Luz quemada** | indeterminado ×2 (`asistencia` inválido), sin_normativa ×1 | 1814 | 8 |

**Fidelidad:** los tokens de entrada y los estados coinciden con los que predijo la simulación (variante `k=8`): 2073, 2021, 2092, 2097 y 1814 son idénticos. La simulación reproduce al sistema real.

**Resultado:** el auto mal estacionado vuelve a `fundamentado` (3/3) y los otros seis casos siguen `fundamentado`. **La luz sigue sin resolver**: queda en `indeterminado` en 2 de 3 corridas, por el `asistencia` que induce la presencia de los canales en el contexto (ver 3.10). Pendiente para Hernán: decisión sobre la luz y la entrega de canales.

**Reportes de prueba en CiudadAR:** 77 creados desde las 00:12 UTC del 29/09 con el `user_id` de pruebas (a9420d51-…); el usuario acordó borrarlos al cerrar la revisión. Sin borrar todavía.

## 3.13 Verificación del texto de los fragmentos más citados contra la fuente oficial (29/09/2026)

Alcance: los **23 fragmentos vigentes que el sistema citó alguna vez** (de 120 vigentes). Son los que concentran el uso real; el resto no se verificó.

**Método y su fuerza:**
- **Ley 451 (5 fragmentos): comparación programática contra el texto crudo del PDF oficial** guardado en el repositorio (`ley_451_texto.txt`). Se quitaron solo artefactos del PDF (marcas `es-ES` y anotaciones de leyes modificatorias) y se comparó palabra por palabra. **Es la verificación más fuerte.**
- **Resto (17 fragmentos): páginas oficiales leídas con WebFetch**, una herramienta que lee la página y responde con un modelo chico. Es una verificación **más débil**: dos lecturas de la misma cláusula pueden discrepar (ver el caso del art. 4 bis). Coincide con lo que Hernán verificó sobre texto crudo, pero no lo reemplaza.
- La comparación fue programática (palabra por palabra), no a ojo. No es validación jurídica externa.

| Resultado | Fragmentos |
|---|---|
| **Cuerpo idéntico al oficial** (19) | Ley 451: 6.1.37, 6.1.52, 6.1.54, 1.3.13, 4.1.2 · Ley 24.449: art. 48 i), 48 t) en sus dos trozos, 49 b.1, 49 b.7 · Ley 5902 art. 7 · DL 8751/77 art. 35 · Ley 13.592 art. 9 y art. 3 inc. 12 · Ley 11.723 art. 65 y 6 · Ley 210 art. 2 b) y 2 c) · Ley 1854 art. 36 |
| **Con reparo** (3) | ver abajo |
| **No verificable** (1) | canal de Avellaneda (no es una norma; información de contacto con fecha) |

Notas sobre lo "idéntico": varios fragmentos anteponen el **título del artículo** («Eximición.-», «Arrojar residuos.», etc.) o el encabezado del artículo padre (art. 3 de la Ley 13.592); el cuerpo coincide palabra por palabra. En el 6.1.52 la única diferencia con el PDF es una palabra partida por la extracción del PDF («cie n»).

**Reparos:**
1. **Ley 24.449 art. 49 b.3** (citado 5 veces): el fragmento cargado es solo la primera oración; el texto oficial sigue con «Tampoco se admite la detención voluntaria. No obstante se puede autorizar, señal mediante, a estacionar en la parte externa de la vereda cuando su ancho sea mayor a 2,00 metros…». **Confirmado contra InfoLEG.** Corrección lista en el lote nuevo de Hernán (pendiente de aplicar).
2. **DL 8751/77 art. 4 bis inc. c)** (citado 6 veces): el fragmento dice «productos **alimentarios**»; la página del decreto se leyó dos veces como «productos **alimenticios**», y la página de la Ley 11.723 (art. 78, que incorpora el 4 bis) como «alimentarios». Hernán transcribió «alimentarios». **Discrepancia sin resolver**: no se puede zanjar sin el HTML crudo. Es una palabra de un inciso que no es el que fundamenta habilitación comercial (el e), pero el fragmento entero se cita.
3. **Ley 210 art. 3 inc. j)** (citado 1 vez): el fragmento es literal pero **omite la segunda oración** del inciso («El Ente dicta las normas internas de procedimiento del trámite administrativo»). No cambia el sentido de lo citado.

Además, el **inciso t) del art. 48 de la Ley 24.449** está partido en dos fragmentos (`t.obstruccion` y `t.venta`), ambos trozos literales del mismo inciso.

## 3.14 Lote nuevo del art. 49 b.3 aplicado y verificado (29/09/2026 15:35 UTC)

**Aplicado** solo el bloque corregido de la Parte 8 ter (1 `update`, 1 `insert` de fragmento, 1 `insert` de mapeo), tras ensayarlo solo con rollback. El lote original de Hernán fallaba en ese bloque por el orden de las sentencias (índice único parcial `knowledge_fragments_current_uq`): el `update` va antes del `insert`.

Estado resultante: 26 fuentes · 124 fragmentos (120 vigentes) · 159 mapeos · W-5 = 0 · W-6 = 0 (vectores generados con `embed-pending.mjs`, 1 fragmento). El b.3 viejo quedó con `is_current = false` y el sufijo «[SUPERADO — apartado incompleto, ver reemplazo]»; el nuevo (`60000000-…040`) lo reemplaza. Reversión exacta en el respaldo.

**Verificación (caso «vecino se sube a la vereda», Avellaneda, 3 corridas):**
- `fundamentado` ×3; el fragmento nuevo es el recuperado y citado en las tres (el viejo ya no aparece).
- **El texto completo con la excepción NO se refleja en la respuesta.** Las tres corridas citan solo las dos primeras oraciones del b.3 («…Tampoco se admite la detención voluntaria.») y **ninguna cita incluye la excepción** («No obstante se puede autorizar, señal mediante, a estacionar en la parte externa de la vereda cuando su ancho sea mayor a 2,00 metros…»).
- Texto al ciudadano: 2 de 3 corridas afirman una prohibición absoluta («ese espacio está reservado exclusivamente para la circulación peatonal»); 1 de 3 agrega «salvo que exista señalización expresa que lo autorice». **Ninguna menciona la condición de los 2 metros.**

**Conclusión:** corregir el dato **no alcanzó** para corregir la respuesta. El riesgo que motivó la corrección (afirmar una prohibición más amplia que la norma) sigue en 2 de 3 respuestas, aunque ahora el modelo tiene el texto completo. Arreglarlo exigiría una instrucción explícita en el prompt (p. ej. mencionar excepciones del fragmento citado), es decir un cambio de prompt (v3) que hay que probar antes de adoptar. No se hizo.

## 3.15 Regla de excepciones para el prompt (candidata a v3): prueba de generación (29/09/2026)

Script: `scripts/rag-local-dev/rep3797/generation-experiment.mjs`, variantes `k8` (producción hoy) contra `k8-excepciones` (mismo `k=8` + la regla agregada al final de las instrucciones reales). 10 casos × 3 corridas × 2 variantes = 60 generaciones. **La regla NO está en `index.ts`.**

Regla candidata: «Si un fragmento que citás contiene una excepción, condición o salvedad ("no obstante", "salvo", "excepto", "a excepción de", "siempre que"), tenés que mencionarla en fundamento_ciudadano y en fundamento_oficial, y no afirmar una prohibición u obligación absoluta. Incluí esa parte del texto en la cita_textual. Si ninguno de los fragmentos que citás trae una excepción, no agregues ni supongas ninguna.»

| Medida (heurística por palabras clave) | `k=8` (hoy) | `k=8` + regla |
|---|---|---|
| Corridas donde lo citado trae una excepción real | 6 | 6 |
| … la respuesta la **menciona** | 4 de 6 | **6 de 6** |
| … la **cita la incluye** | 3 de 6 | **6 de 6** |
| Corridas sin excepción en lo citado donde la respuesta menciona una igual | 0 de 24 | 3 de 21 (ver abajo: falso positivo) |
| Tokens de entrada | base | ≈ +100 por reporte (≈ +5 %) |

**Los dos casos con excepción real (3 corridas cada uno):**
- *Vecino se sube a la vereda* (Ley 24.449 art. 49 b.3): con la regla, 3/3 mencionan y citan la excepción; el texto al ciudadano pasa de «Está prohibido subir el auto y estacionar… sobre la vereda» a «Está prohibido estacionar… Sin embargo, la norma contempla la salvedad de que puede autorizarse, mediante la correspondiente señalización, a estacionar en la parte externa de la vereda cuando su ancho supere los 2,00 [metros]». Sin la regla: 2/3 mencionan (parcial) y **0/3 citan** la excepción.
- *Sumidero* (Ley 451 art. 1.3.2.3.4): con la regla 3/3 mencionan y citan «a excepción de aguas pluviales o superficiales»; sin ella 2/3 mencionan y 3/3 citan.

**Los 3 «posibles inventos» son un falso positivo de la heurística.** Ocurren en *vereda rota por raíces*: el art. 7 de la Ley 5902 se titula «Eximición» (es, por definición, una excepción a la obligación del art. 5) y el modelo la describe correctamente («la normativa establece una excepción…»). Verificado leyendo la respuesta. Con la regla, además, el modelo cita el art. 7 completo (ambos párrafos, incluida la frase de las raíces); sin ella cita solo el segundo párrafo.

**Los otros 8 casos no cambian de estado con la regla** (fundamentado ×3, con cita esperada 3/3), incluidos auto mal estacionado, basural, camioneta y choripanes.

**Luz quemada — inestable, no atribuible a la regla:** con la regla, `indeterminado` ×3 (`asistencia` inválido para infraestructura); sin ella, `sin_normativa` ×3 en esta corrida, pero la misma variante base había dado `indeterminado` ×2 en la simulación anterior y ×2 en el pipeline real (4 de 9 corridas base son `indeterminado`). El resultado de este caso fluctúa aun sin la regla.

### Límites
- Solo **2 casos con excepción real × 3 corridas**; la detección es por palabras clave y **solo leí a mano el texto de la primera corrida por variante**.
- Que la respuesta mencione la excepción no garantiza que la redacte bien; conviene que Hernán revise el texto (p. ej. «puede autorizarse… ancho supere los 2,00 [metros]»).
- Un cambio de prompt es una versión nueva (v3): falta implementarlo, desplegarlo y verificarlo en el pipeline real con los 10 casos antes de darlo por bueno.

## 3.16 Prompt v3 desplegado y verificado en el pipeline real (función v38, 29/09/2026 16:00 UTC)

Rama `fix/REP-3795-prompt-v3-excepciones` (commit `cd58aee`; suite completa de 526 tests en verde). 30 reportes (10 casos × 3), insertar → cola → cron → función real → Gemini. Todos los análisis quedaron con `prompt_version = v3`. Los tokens de entrada coinciden con los de la simulación (p. ej. 2173, 2121, 2192, 2197, 1914, 1848): la simulación reprodujo al sistema real.

| Caso | Estados (3 corridas) |
|---|---|
| Auto mal estacionado, basural, camioneta, choripanes, auto abandonado, vereda rota, basura en la vereda, **vecino sube a la vereda**, **sumidero** | **fundamentado ×3 en los 9** |
| **Luz quemada** | **indeterminado ×3** (`asistencia` inválido para infraestructura) |

**Casos con excepción (respuesta real al ciudadano):**
- *Vecino se sube a la vereda* (Ley 24.449 art. 49 b.3): **3 de 3 mencionan la excepción y la cita la incluye en 3 de 3**, con la condición completa: «…se puede autorizar, mediante la señalización correspondiente, a estacionar en la parte externa de la vereda cuando su ancho supere los 2,00 metros y la intensidad del tránsito peatonal lo permita». Antes (v2): 0 de 3 citas la incluían y ninguna mencionaba los 2 metros.
- *Sumidero* (Ley 451 art. 1.3.2.3.4): la cita incluye la excepción en 3 de 3; el texto al ciudadano dice «a excepción de aguas pluviales o superficiales» en 2 de 3 y en la tercera lo expresa de otra forma («únicamente está permitido el paso de aguas pluviales o superficiales»); el fundamento oficial la menciona en las 3.

**Sin regresiones en los otros 9 casos.**

**Pendiente — luz quemada:** `indeterminado` en 3 de 3, igual que en la simulación con la regla. El prompt v2 tenía este caso inestable (4 de 9 corridas `indeterminado`, el resto `sin_normativa`); con v3 en producción se observa `indeterminado` las tres veces. No se puede atribuir con certeza a la regla (la muestra es chica), pero **hoy este caso queda peor que el mejor caso de v2**. Las alternativas siguen siendo las de 3.10/3.11 (tratar un `asistencia` fuera de vulnerabilidad social como `sin_normativa`, o entregar los canales por otro camino) y requieren decisión con Hernán.

**Pendiente — revisión de Hernán:** los textos al ciudadano de los casos con excepción (redacción de la salvedad de los 2 metros).

## 3.17 ¿Puede el fundamento venir de algo que no sea el corpus? Grounding externo, búsqueda web y fallbacks (29/09/2026)

Criterio de REP-3795: «comprobar que todo fundamento provenga exclusivamente del corpus autorizado y que, sin respaldo suficiente, exista abstención explícita».

**Camino real (`analizar-reporte`, código leído en el repositorio y en la función desplegada v38):**
- La llamada a Gemini (`generateContent`) **no declara ninguna herramienta**: sin `tools`, sin búsqueda web y sin grounding. Solo se envían las instrucciones, el reclamo y los fragmentos recuperados de `knowledge_fragments`.
- La recuperación sale únicamente del RPC `match_knowledge_fragments` (cascada jurisdiccional + categoría, solo fragmentos vigentes con vector).
- **Fallar cerrado, sin reemplazos:** sin `GEMINI_API_KEY` el resultado es `indeterminado`; si falla el embedding o la generación, `indeterminado`; nunca se cae a un embedding local ni a otro corpus.
- **Abstención:** sin fragmentos sobre el umbral (0,45) no se llama al modelo y el resultado es `sin_normativa`; cada cita debe ser literal (con la tolerancia a espacios descripta en 3.7) y estar entre los fragmentos recuperados.
- Vulnerabilidad social corta antes de todo (`asistencia`, sin llamar a Gemini).

**Hallazgo — función heredada `analyze-infraction` (versión 30, abril, `gemini-1.5-flash-002`):**
- Está desplegada en CiudadAR (`verify_jwt = true`) pero **su código no está en el repositorio** (`supabase/functions` solo trae `analizar-reporte`, `quarantine-anonymize` y `quarantine-purge`).
- Su prompt le pide al modelo «Normativa infringida (**artículo plausible** del código de tránsito)» y una «sanción sugerida»: **genera normativa de memoria**, exactamente lo que el RAG cerrado debe impedir. Además manda la clave de Gemini en la URL (`?key=`).
- **Hoy está inerte:** el disparador `audit_ia` de la tabla `infractions` que la invoca está **deshabilitado** (`tgenabled = D`), `infractions` tiene **0 filas**, ningún cron la llama y la app no la invoca (búsqueda en `src`).
- Riesgo residual: cualquiera con un JWT de usuario válido podría invocarla por HTTP (costo de Gemini). **Recomendación: retirarla (undeploy) y, si hace falta, versionar su código.** No se hizo: es una decisión del equipo.

**Coherencia con el ticket:** el circuito RAG vigente cumple el criterio (todo fundamento sale del corpus; hay abstención explícita). La función heredada es un vector que no se usa pero sigue desplegada.

## 4. Antes (REP-3795, corpus de 16 fragmentos)

- VS-1/VS-2: `asistencia`, 0 citas, sin llamada a Gemini.
- CE-1: `sin_normativa`, 0 citas (abstención correcta).
- CI-1 (comercio sin corpus): `sin_normativa`, 0 recuperados, sin llamada de generación.
- T-1: `fundamentado` 5/5 · T-4: `fundamentado`, Ley 24.449.
- Infraestructura/Ambiente en CABA: cobertura mínima (solo Ley 210).
