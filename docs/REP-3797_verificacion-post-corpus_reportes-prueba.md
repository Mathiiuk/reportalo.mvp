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

## 4. Antes (REP-3795, corpus de 16 fragmentos)

- VS-1/VS-2: `asistencia`, 0 citas, sin llamada a Gemini.
- CE-1: `sin_normativa`, 0 citas (abstención correcta).
- CI-1 (comercio sin corpus): `sin_normativa`, 0 recuperados, sin llamada de generación.
- T-1: `fundamentado` 5/5 · T-4: `fundamentado`, Ley 24.449.
- Infraestructura/Ambiente en CABA: cobertura mínima (solo Ley 210).
