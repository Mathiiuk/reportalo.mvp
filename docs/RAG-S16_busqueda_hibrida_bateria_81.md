# RAG · Búsqueda híbrida (V3) medida sobre la batería de 81 casos

**Fecha:** 16/10/2026 · **Para:** Matías Krepchuk (líder técnico) · **Con copia a:** Hernán Gregorini (PO), Leonel Nuñez
**Base:** `docs/RAG-S16_variantes_de_recuperacion.md` (§6, punto 1: «antes de desplegar, medirla sobre la batería de 81 casos») y §5 del LEEME de Hernán (`Entrega_Matias_RAG_Sprint15`).

> **Para leer primero.**
> - **No se desplegó nada ni se escribió en la base de staging.** La migración queda escrita para revisión; los rankings se calcularon con el RPC actual (lectura), una consulta `SELECT` de texto completo y vectores en memoria.
> - **El SQL de la migración se probó tal cual** en el Postgres 17 de staging, ejecutando su cuerpo como `SELECT` (sin crear la función) en dos casos: devolvió exactamente el mismo top 8 que la medición.
> - **Conclusión corta:** la híbrida mejora el orden en los 81 casos sin empeorar ninguno fuera de D4 (MRR 0,544 → **0,634**; sin D4, 0,640 → **0,745**), mueve sobre todo **D2, D3 y los baches de Avellaneda**, y no resuelve D4. **En la generación, D2 mejora claramente** (todas las citas pasan a ser aceptables) **pero D3 empeora en dos de sus cuatro textos**: el art. 49 del DL 8031/73, que §5 marca como no aceptable para alumbrado, sube en el contexto y Gemini responde `indeterminado` en 8 de 16 corridas (0 de 16 con el orden actual).
> - Recomendación: **aplicarla junto con una decisión sobre el art. 49 en D3**, no sola, y volver a medir D3 antes de darla por cerrada (§7).

## 1. Resumen

| Pregunta | Respuesta |
|---|---|
| ¿Mejora la posición de la norma aceptable? | **Sí.** La primera norma aceptable queda primera en el 47 % de los reportes (hoy 35 %); fuera de D4, en el 56 % (hoy 41 %) |
| ¿Empeora algún caso en la recuperación? | **No fuera de D4.** Los únicos dos que bajan son textos de D4 donde la norma ya estaba en el puesto 25 y pasa al 26 |
| ¿Cambia lo que ve el modelo? | Sí, en **40 de los 81 reportes** entra al menos un fragmento que hoy no llega. El umbral de 0,45 no recorta nada: el número de fragmentos entregados es el mismo en todos los casos |
| ¿Arregla D4? | **No.** Solo un texto técnico («Deterioro de la calzada con pozos…») lleva la Ley 6684 art. 26 al puesto 8. D4 sigue esperando una decisión de diseño |
| ¿Qué cita Gemini con el contexto híbrido? | **D2: mejor.** 15 de 15 corridas citan solo aceptables (hoy 11 de 15) y deja de citar el DL 8751/77 art. 35 (procedimiento). **D3: peor en dos textos.** 8 de 16 corridas dan `indeterminado` (hoy 0) y 3 citan el art. 49 del DL 8031/73, no aceptable para D3 |
| Costo | **Cero llamadas extra a Gemini por reporte**; una búsqueda de texto completo más dentro de la misma consulta (la columna `fts` ya tiene índice GIN) |

## 2. Qué se agrega: la migración

`docs/rag/PROPUESTA_REP-3860_busqueda_hibrida_rrf.sql` crea **`match_knowledge_fragments_hibrida`** (no reemplaza a la actual):

| Aspecto | Cómo queda |
|---|---|
| Candidatos | **Los mismos** que `match_knowledge_fragments`: fuentes elegibles por jurisdicción (`eligible_knowledge_sources`), fragmentos vigentes con vector del modelo, filtro por `service_code` (V-09) |
| Orden | RRF con k = 60: `1 / (60 + puesto vectorial) + 1 / (60 + puesto de texto)`. Empates: gana el mejor puesto vectorial |
| Texto completo | `ts_rank` sobre `knowledge_fragments.fts` con los lexemas de la **descripción sola** (sin «(categoría: X)») unidos con OR. Si no hay lexemas o no hay coincidencias, el orden es el vectorial |
| Columnas | Las mismas de la actual, con `similarity` = coseno (el umbral de 0,45 de `analizar-reporte` sigue igual), más `vector_rank`, `text_rank` y `rrf_score` para diagnóstico |
| Permisos | Igual que la actual (R5-11): sin `execute` para `public`, `anon` y `authenticated`; solo `service_role` |
| Parámetros nuevos | `p_query_text` (la descripción) y `p_rrf_k` (60 por defecto) |

**Cambio en `analizar-reporte` (no incluido en este PR, a propósito):** llamar a `match_knowledge_fragments_hibrida` en vez de `match_knowledge_fragments`, pasando `p_query_text: description.trim()`. Volver atrás es volver a llamar a la anterior; no hay que revectorizar nada.

**Para la revisión:**
- La columna `fts` (`to_tsvector('spanish', content)`, generada) y su índice `knowledge_fragments_fts_idx` existen en staging pero **no están en ninguna migración del repo**. La función depende de ellas: antes de aplicarla en producción hay que confirmar que existen ahí o agregarlas en la misma migración.
- La consulta de texto convierte la salida de `plainto_tsquery` de AND a OR reemplazando `' & '` por `' | '`. Es seguro porque esa salida siempre es un `tsquery` válido y los lexemas no tienen espacios; se probó con un texto solo de palabras vacías (queda en orden vectorial) y con una palabra compuesta («auto-estacionado»).
- `similarity` sigue siendo el coseno: con la híbrida un fragmento de baja similitud puede subir al top 8, pero si queda debajo de 0,45 la función lo sigue descartando. En la batería esto no pasó nunca.

## 3. Cómo se midió

| Paso | Detalle |
|---|---|
| Casos | `bateria_completa_81.csv` (checkout principal). Las 81 filas son **47 consultas distintas** (mismo texto, categoría y localidad dan la misma recuperación), y cada consulta **pesa tantas filas como tiene** |
| Localidad | Flores (CABA) y Gerli (Avellaneda): se controló contra `citizen_reports.locality_id` de los 80 reportes con uuid (el restante es el envío perdido de D7) |
| Norma aceptable | Los «aceptables» de §5 del LEEME de Hernán, por escenario: D1 ambiente PBA, D2 comercio PBA, D3 alumbrado PBA, D4 baches CABA (Ley 1777 art. 10 y Ley 6684 art. 26) y los «casos sin desvío» (tránsito CABA y PBA, ambiente CABA, baches PBA). Los mismos ids que la medición del 16/10 |
| Fuera de las métricas | **2 controles sin norma** («Auto estacionado sobre la vereda…» cargado en Ambiente en CABA) y **4 de Vulnerabilidad social**: §5 no define aceptables y `analizar-reporte` los resuelve **antes** de recuperar (estado `asistencia`), así que la recuperación no los afecta |
| Variantes | **B** = orden actual (RPC de staging). **V3** = híbrida. V3+V2 (texto enriquecido) solo como referencia |
| Control | La similitud recalculada en memoria coincide con la de la base (diferencia máxima 3,4 × 10⁻⁷). El SQL de la migración, ejecutado como `SELECT` en staging, reprodujo el top 8 de V3 en los dos casos probados (`verificar-rpc.mjs`) |

Métricas: **Recall@8** (al menos un aceptable dentro del top 8), **puesto 1** (la primera aceptable queda primera), **MRR** (promedio de 1 / puesto de la primera aceptable), **esperados dentro del top 8** (de los aceptables elegibles del caso, qué parte entra), **aceptables / entregados** (de lo que llega al modelo, qué parte es aceptable).

## 4. Resultados de la recuperación

### 4.1 Los 75 reportes con norma aceptable (42 consultas distintas)

| Variante | Recall@8 | 1.ª aceptable en el puesto 1 | Posición mediana | MRR | Esperados dentro del top 8 | Aceptables / entregados |
|---|---|---|---|---|---|---|
| **B** (actual) | 84 % | 35 % | 2 | 0,544 | 57 % | 37 % |
| **V3** (híbrida) | 85 % | **47 %** | 2 | **0,634** | 63 % | 41 % |
| V3+V2 (referencia) | 85 % | 48 % | 2 | 0,637 | 70 % | 46 % |

Sin ponderar (cada consulta distinta una vez) da lo mismo: MRR 0,550 → 0,651.

### 4.2 Sin D4 (63 reportes) y solo D4 (12 reportes)

| | Variante | Recall@8 | Puesto 1 | Mediana | MRR | Dentro del top 8 | Aceptables / entregados |
|---|---|---|---|---|---|---|---|
| **Sin D4** | B | 100 % | 41 % | 2 | 0,640 | 68 % | 44 % |
| | **V3** | 100 % | **56 %** | **1** | **0,745** | 74 % | 49 % |
| **Solo D4** | B | 0 % | 0 % | 26 | 0,039 | 0 % | 0 % |
| | V3 | 8 % (1 de 12) | 0 % | 26 | 0,049 | 4 % | 1 % |

El resultado fuera de D4 (MRR 0,745) es el mismo que dio la muestra de 48 casos del 16/10 (0,746): la mejora se sostiene en la batería completa.

### 4.3 Por escenario

| Escenario | Reportes | MRR B → V3 | Puesto 1 B → V3 | Dentro del top 8 B → V3 |
|---|---|---|---|---|
| **D2 · comercio en Avellaneda** | 11 | 0,271 → **0,495** | 0 % → 9 % | 39 % → **64 %** |
| **D3 · alumbrado en Avellaneda** | 5 | 0,500 → **0,800** | 0 % → **60 %** | 100 % → 100 % |
| **Baches en Avellaneda** | 7 | 0,476 → **0,857** | 0 % → **71 %** | 60 % → 60 % |
| D1 · ambiente en Avellaneda | 10 | 0,400 → 0,400 | 10 % → 10 % | 64 % → 64 % |
| D5 · comercio en CABA | 7 | 0,643 → 0,643 | 29 % → 29 % | 67 % → 67 % |
| Tránsito en CABA | 9 | 1,000 → 1,000 | 100 % → 100 % | 88 % → 97 % |
| Tránsito en Avellaneda | 7 | 1,000 → 1,000 | 100 % → 100 % | 50 % → 54 % |
| Ambiente en CABA | 7 | 1,000 → 1,000 | 100 % → 100 % | 100 % → 100 % |
| D4 · baches en CABA | 12 | 0,039 → 0,049 | 0 % → 0 % | 0 % → 4 % |

**Lectura.**
- **En Avellaneda, hoy el puesto 1 lo ocupa casi siempre un canal**, no una norma: el Centro de Atención al Vecino o la Secretaría de Producción, Comercio y Ambiente (complementarios en §5, no aceptables). La híbrida corre al canal en D3 y en dos de los cuatro textos de baches, donde la LOM (arts. 52, 59 o 27 inc. 2) pasa al primer lugar; en D2 el canal sigue primero salvo en el texto largo.
- **D2** es donde más entra al top 8: la primera aceptable (Ordenanza Fiscal 31321 o LOM) pasa del puesto 3 a 5 al 2 detrás de la Secretaría, o al 1 en el texto largo (Ordenanza Fiscal art. 233), y entran uno o dos aceptables más («Comercio en la vía pública sin permiso…»: primera aceptable del 5 al 2 y aceptables dentro del top 8 de 2 a 4). Con los textos cortos («venden en la calle», «Venta ambulante en la vereda») **no hay ninguna coincidencia de texto completo** en el corpus de comercio y el orden queda igual.
- **D3**: la LOM (art. 59 o art. 52) pasa al primer lugar en los tres textos con vocabulario de servicio («Luminaria del alumbrado público…», «Falta de mantenimiento del servicio de alumbrado…», «Zona sin iluminación…»). «La luminaria de la esquina está apagada…» (2 reportes) no tiene coincidencias y queda igual.
- **D1 y D5 no cambian**: en D1 el problema que vio Hernán es la variación de la generación, no el orden; en D5 «venden en la calle» ya tiene la norma primera.
- Tránsito y ambiente en CABA ya estaban en el puesto 1; la híbrida solo suma algún aceptable más dentro del top 8.

### 4.4 Movimiento caso por caso

| | Reportes | Consultas |
|---|---|---|
| La primera aceptable **sube** | 19 | 12 |
| Queda igual | 54 | 28 |
| **Baja** | 2 | 2 (D4: del puesto 25 al 26) |
| Entra al modelo al menos un fragmento que hoy no llega | 40 | 20 |

### 4.5 D4

| Texto | Ley 1777 art. 10 (B → V3) | Ley 6684 art. 26 (B → V3) |
|---|---|---|
| «Hay un bache grande y profundo…» (6 reportes) | 26 → 26 | 28 → 28 |
| «bache grande» · «Bache grande en el medio de la calle» | 26 → 26 | 28 → 28 |
| «Hay un bache muy grande y profundo… con agua acumulada…» | 25 → 26 | 28 → 28 |
| **«Deterioro de la calzada con pozos…»** | 26 → 27 | 28 → **8** (similitud 0,458: **llega al modelo**) |
| «Falta de conservación y mantenimiento de la vía pública…» | 22 → 22 | 28 → 12 |
| «Reclamo para que reparen las calles…» | 25 → 26 | 28 → 28 |

Confirma lo del 16/10: la híbrida solo rescata las normas de competencia cuando el ciudadano usa el vocabulario de la norma («calzada», «conservación», «vía pública»). **«bache» y «grande» no aparecen en ningún fragmento de Infraestructura del corpus**, así que la redacción coloquial no tiene coincidencia de texto. D4 sigue necesitando una de las decisiones de diseño de §6 del informe del Sprint 16.

## 5. Qué cita Gemini con el contexto híbrido (D2 y D3)

Se corrió `rep-diag-generacion` (prompt v5, `gemini-3.8-flash`, temperatura 0, leídos del fuente) con el contexto que llega al modelo con cada orden: **B** (el de hoy) y **V3** (el que devolvería la función nueva), los dos con top 8 y umbral 0,45. Se eligieron los textos de D2 y D3 donde la híbrida cambia el contexto: 5 de D2 y 3 de D3, con 3 corridas por contexto; los dos de D3 que empeoraron se repitieron con 8 corridas sobre el mismo contexto congelado (la tabla toma esas 8).

| Escenario · contexto | Corridas | Válidas | `indeterminado` | Con al menos un aceptable | Solo aceptables | Citas aceptables / citas |
|---|---|---|---|---|---|---|
| **D2 · B** (hoy) | 15 | 15 | 0 | 15 | 11 | 18 / 22 |
| **D2 · V3** | 15 | 15 | 0 | 15 | **15** | **37 / 37** |
| **D3 · B** (hoy) | 19 | 13 | **0** | 19 | 12 | 36 / 43 |
| **D3 · V3** | 19 | 15 | **8** | 19 | 16 | 34 / 37 |

**D2 (comercio en Avellaneda): mejora.**
- Con el contexto de hoy, Gemini cita casi siempre solo la Ordenanza Fiscal art. 233, y en dos textos («Hay muchos puestos de venta ambulante…» y «Comercio en la vía pública sin permiso…») le suma en 2 de 3 corridas el **DL 8751/77 art. 35** (acción pública y denuncia), que §5 pone entre los no aceptables como único fundamento.
- Con la híbrida, en tres de los cinco textos cita **la Ordenanza Fiscal arts. 231, 233 y 235** (los tres aceptables nuevos de §5, el fundamento de permiso que pidió Hernán), en otro los arts. 233 y 235, y **nunca** el art. 35. En «Venta de mercadería en la calle sin habilitación…» cita el DL 8751/77 art. 4 bis y la LOM art. 27 inc. 1, también aceptables.
- Estado: `fundamentado` en las 30 corridas, con y sin híbrida.

**D3 (alumbrado en Avellaneda): mejora en un texto y empeora en dos.**

| Texto | Contexto de hoy (B) | Híbrida (V3) |
|---|---|---|
| «Luminaria del alumbrado público apagada…» | 3 de 3 `fundamentado`: LOM art. 52 + Ordenanza Fiscal art. 132 | 3 de 3 `fundamentado`, confianza 0,95: LOM arts. 52 y 59 + Ordenanza Fiscal art. 132. **Mejor** |
| «Falta de mantenimiento del servicio de alumbrado público…» | 8 de 8 `fundamentado` (LOM art. 52, art. 59, Ordenanza Fiscal art. 132) | **4 de 8 `indeterminado`**: el art. 49 del DL 8031/73 entra al contexto (puesto 8) en lugar del DL 8751/77 art. 38 |
| «Zona sin iluminación que afecta la seguridad…» | 8 de 8 `fundamentado` (LOM arts. 52 y 59) | **4 de 8 `indeterminado`** y **3 citan el art. 49** del DL 8031/73, que sube del puesto 7 al 2 |

- El art. 49 del DL 8031/73 (Código de Faltas de la Provincia) habla literalmente de «alumbrado público», así que es la mejor coincidencia de texto completo de esos reclamos. Hernán lo marcó **no aceptable** para D3: es la conducta de quien apaga el alumbrado, no el servicio municipal. Ya estaba en el contexto de hoy en los puestos 7 u 8 y el modelo no lo citaba; más arriba, el modelo busca una infracción y, al no encontrar sanción para el municipio, responde `indeterminado` («los fragmentos… no determinan un régimen de infracción o sanción específica ante la falta… del servicio a cargo del municipio»).
- **No es un problema de pesos:** con el lado de texto a la mitad de peso (variante `V3t05` del runner) el art. 49 sigue en el puesto 2 en «Zona sin iluminación…», y el MRR general apenas cambia (0,634 → 0,625).

**Hallazgo aparte, previo a la híbrida:** en D3, **6 de las 16 corridas con el contexto de hoy** citan la LOM art. 59 con «...» en el medio para saltear incisos. La validación de `analizar-reporte` (la misma que replica el script) exige cita literal, así que en producción esas respuestas se rechazan. Pasa igual con y sin híbrida; conviene tratarlo por separado (instrucción del prompt o validación por tramos).

## 6. Costo de esta medición

| Concepto | Valor |
|---|---|
| Vectorización (Gemini) | 1 llamada `batchEmbedContents` con 16 textos nuevos (2.160 caracteres); el resto salió de la caché local de la medición del 16/10 |
| Generación (Gemini) | 80 llamadas a `gemini-3.8-flash` (48 de la primera ronda + 32 de la repetición de D3): 192 mil tokens de entrada y 43 mil de salida |
| Lecturas en staging | 47 llamadas al RPC por corrida del runner, 1 `SELECT` de texto completo, 1 `SELECT` con el cuerpo de la migración, lectura de `citizen_reports`, `knowledge_fragments` y del catálogo (definición de `fts` e índices). **Ninguna escritura** |

## 7. Recomendación

1. **La híbrida vale la pena, pero no desplegarla sola.** En la recuperación mejora el orden en la batería completa sin empeorar nada fuera de D4, y en D2 lleva a Gemini a citar exactamente lo que pidió Hernán. En D3 hace subir el art. 49 del DL 8031/73 y con él aparecen respuestas `indeterminado` que hoy no hay.
2. **Decisión que hace falta (tuya, con Hernán):** qué hacer con el art. 49 del DL 8031/73 en Infraestructura. Opciones: (a) que el prompt diga que una norma de faltas de particulares no fundamenta un reclamo por el servicio municipal; (b) quitarle la etiqueta de alumbrado o partir el artículo por inciso para que el inciso b) no se recupere en reclamos de servicio; (c) aceptar el empeoramiento en D3 a cambio de D2. Bajar el peso del texto no lo resuelve (§5).
3. **Después de esa decisión,** aplicar la migración en staging, cambiar la llamada en `analizar-reporte` y repetir D3 con 8 corridas por texto (unas 32 llamadas) antes de darla por cerrada; mejor todavía, volver a correr los 81 casos de punta a punta (con fotos).
4. **Antes de producción:** confirmar que `knowledge_fragments.fts` y su índice existen ahí (en el repo no hay migración que los cree).
5. **Por separado:** las citas con «...» de la LOM art. 59 que la validación rechaza (§5); pasa también con el contexto de hoy.
6. **Después, V2 (texto enriquecido)** sobre la híbrida, como estaba previsto: en la batería sube los aceptables dentro del top 8 de 63 % a 70 %.
7. **D4 no se arregla con esto** (ni con V2): sigue pendiente la decisión de diseño.

## 8. Límites

- **47 consultas distintas, no 81 independientes.** Las repeticiones de la batería midieron la variación de la generación; para la recuperación son la misma entrada. Por eso se informan las dos cuentas (ponderada y sin ponderar).
- **Aceptables por escenario, no por texto**, como en la medición anterior.
- **RRF sin ajustar** (k = 60, pesos iguales). No se probaron otros valores para no sobreajustar a 47 consultas.
- **El SQL se probó en dos casos**, no en los 47: el resto se midió con la emulación en JS, que coincidió en esos dos y usa la misma consulta de texto completo.
- La generación se midió con la réplica del prompt de `rep-diag-generacion` (prompt v5, temperatura 0, leído del fuente), no con la función desplegada, y solo en 8 textos de D2 y D3 con 3 u 8 corridas. Aun con temperatura 0 las corridas varían, así que una corrida suelta no significa nada; la diferencia de D3 (8 de 16 contra 0 de 16) sí.

## 9. Archivos

| Archivo | Qué es |
|---|---|
| `docs/rag/PROPUESTA_REP-3860_busqueda_hibrida_rrf.sql` | La migración propuesta (sin aplicar) |
| `scripts/rag-local-dev/rep-diag-variantes/bateria.mjs` · `casos-bateria81.json` | Conversión de la batería a casos (47 consultas con sus filas y escenarios) |
| `scripts/rag-local-dev/rep-diag-variantes/fts-bateria81.sql` · `fts-ranks-bateria81.json` | Consulta de texto completo (solo `SELECT`) y su resultado |
| `scripts/rag-local-dev/rep-diag-variantes/run.mjs` | Runner (ahora con `--casos`, `--fts` y `--sin-sonda`, lo que llega al modelo tras el umbral y la sensibilidad `V3t05`) |
| `scripts/rag-local-dev/rep-diag-variantes/resumen-bateria.mjs` | Tablas de §4 |
| `scripts/rag-local-dev/rep-diag-variantes/verificar-rpc.mjs` | Ejecuta el cuerpo de la migración como `SELECT` y lo compara con la emulación |
| `scripts/rag-local-dev/rep-diag-generacion/run.mjs` | Ahora acepta `--desde-variantes … --variante B\|V3` para generar con el contexto de otra recuperación |
| `scripts/rag-local-dev/rep-diag-variantes/resumen-generacion.mjs` | Tabla de §5 |
