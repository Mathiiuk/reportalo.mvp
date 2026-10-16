# REP-3828 (D8) · Cola y tiempos de la verificación visual

**Fecha de la medición:** 13/10/2026 · **Actualizado:** 16/10/2026 con el lote controlado (sección 8) · **Entorno:** staging (proyecto Supabase `CiudadAR`) · **Horarios:** UTC (ART = UTC-3)
**Responsable:** Matías · **Script reproducible:** [`scripts/rep3828/medicion_cola_visual.sql`](../scripts/rep3828/medicion_cola_visual.sql) (solo lectura)

> **Estado (16/10/2026):** medición **completa**. Iván cargó los 15 casos controlados (lote `REP-3828-QA-01`, 5 de 1 foto, 5 de 2 y 5 de 4) y los validó en REP-3833. **Resultado (sección 8):** después del alta, la verificación visual **no depende de la cantidad de fotos** (las llamadas salen juntas, ~3 s cada una, 0 fallas en 35). La espera del cron (0 a 60 s) depende del segundo en que cae el alta, no del lote. **El cuello de botella de 4 fotos está antes del alta**: la anonimización secuencial (~11 s por foto) supera los 45 s de la pantalla y el reporte se crea ~2:30 min después (O-01 de QA). Las secciones 1 a 6 son la primera pasada del 13/10 y se conservan como estaban.

---

## 1. Conclusión

La hipótesis del Sprint 15 («el tiempo no está en Gemini sino en la cola») **se confirma, con un matiz**:

1. **El cuello de botella es el despacho por cron, no Gemini.** La función `dispatch_visual_analysis_queue` corre una vez por minuto (`visual-analysis-dispatch`, `* * * * *`). Una foto recién guardada espera hasta el próximo tick: **28,6 s en promedio y hasta 60 s**, contra 3,6 s de ejecución. Con 1 foto la espera es el **89 %** del tiempo total (28,6 de 32,2 s).
2. **Las fotos de un mismo reporte se procesan en paralelo.** En el reporte de 3 fotos las tres llamadas empezaron con menos de 1 s de diferencia. Más fotos no suman cola: suman llamadas simultáneas.
3. **El matiz:** los ~55 s del reporte de 3 fotos no son solo cola. Se componen de ~27 s de espera del cron, **~20 s por un timeout de Gemini** en una foto (más el reintento) y ~5 s de la llamada que sí respondió.

## 2. Reporte baseline de Sprint 15 (`2061a6b5-c306-4556-85d5-f20057f7bdba`, 3 fotos)

| Foto | Evidencia persistida | Primer intento | Intentos | Resultado guardado | Desde persistencia |
| --- | --- | --- | --- | --- | --- |
| 1 | 18:15:33.807 | 18:16:01.181 | 1 × ok (3,6 s) | 18:16:04.976 | 31,2 s |
| 2 | 18:15:34.066 | 18:16:01.812 | **timeout (20,0 s)** → ok (4,8 s) | 18:16:28.246 | **54,2 s** |
| 3 | 18:15:34.291 | 18:16:01.308 | 1 × ok (3,4 s) | 18:16:04.939 | 30,6 s |

Desglose de la foto más lenta (la que define el tiempo percibido): **~27,7 s** de espera del cron + **~20 s** de timeout + 1,4 s de espera entre intentos y overhead + **4,8 s** de la llamada exitosa.

## 3. Tabla por tamaño de lote (todo lo registrado en staging al 13/10/2026)

| Fotos del reporte | Reportes | Imágenes | Espera de cola prom. / mín. / p50 / máx. (s) | Ejecución prom. / máx. (s) | Total prom. / máx. (s) | Intentos fallidos |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 38 | 38 | 28,6 / 1,8 / 30,9 / 60,1 | 3,6 / 9,9 | 32,2 / 62,8 | 1 |
| 2 | **1** | 2 | 49,1 / 48,9 / 49,1 / 49,3 | 3,5 / 3,5 | 52,6 / 52,7 | 0 |
| 3 | **2** | 6 | 19,9 / 12,2 / 19,8 / 27,7 | 7,4 / 26,4 | 27,3 / 54,2 | 1 |
| 4 | **1** (D8) | 4 | ver nota | 3,5 / 4,7 (modelo) | 49,5 / 50,1 | 0 |

**Con todo el histórico de `report_image_analysis`** (incluye la batería de Hernán del 07/10, que no tiene registro de intentos y por eso solo permite medir el total): 1 foto 187 reportes, mediana 35,2 s · 2 fotos 2 reportes, 57,9 s promedio (máx. 63,5) · 3 fotos 5 reportes, 24,5 s (máx. 58,7) · **4 fotos 1 reporte, 49,5 s (máx. 50,1)**. Latencia del modelo en todos los tamaños: 3,1–3,5 s promedio. El promedio de 1 foto (195 s) lo distorsiona un caso viejo de ~4 h; por eso se informa la mediana.

**Nota sobre 4 fotos (reporte D8 de Hernán, `3091e5f5…`):** las 4 fotos se guardaron a las 21:26:15–16 UTC y las 4 llamadas arrancaron juntas y terminaron bien (2,8–4,7 s, sin reintentos); el último resultado se guardó a las 21:27:06. Es decir, con 4 fotos **la verificación visual tampoco es el problema**: tarda lo mismo que con 1, más la espera del cron.

- **Espera de cola** = persistencia de la evidencia → primer intento. **Ejecución** = primer intento → resultado guardado. **Total** = persistencia → resultado guardado.
- La espera de cola se reparte de forma pareja entre 0 y 60 s, que es lo esperable de un cron por minuto. No hay mensajes acumulados: la cola está vacía hoy (0 mensajes).
- Con 2 y 3 fotos la muestra es muy chica (1 y 2 reportes): **no permite concluir nada sobre el efecto del tamaño del lote**. Las diferencias entre filas se explican por el momento en que cayó cada reporte dentro del minuto.

### Llamadas al proveedor (48 intentos, todos con `gemini-3.8-flash`)

| Estado | Intentos | Duración prom. / máx. | Tokens de entrada / salida (prom.) |
| --- | --- | --- | --- |
| ok | 46 | 3,4 s / 9,8 s | 1.566 / 131 |
| timeout | 1 | 20,0 s | desconocido (sin respuesta) |
| http_error | 1 | 0,8 s | desconocido (sin respuesta) |

La llamada a Gemini es de **~3,4 s**; el 96 % de los intentos termina bien al primer intento. Los fallos (2 de 48) cuestan caro porque el timeout es de 20 s (`GEMINI_TIMEOUT_MS`).

## 4. Recomendación (cuantificada, sin cambiar la arquitectura todavía)

| Opción | Efecto esperado | Costo / riesgo |
| --- | --- | --- |
| **A. Mantener** | Total promedio ~32 s (1 foto), hasta ~63 s. | Ninguno. Es aceptable **solo si** el resultado visual es asíncrono para el ciudadano y la pantalla lo comunica. |
| **B. Despachar al encolar** (el trigger de la evidencia invoca la función sin esperar al cron). Hoy no existe: el RAG textual usa el mismo esquema de cron por minuto (`rag-analysis-dispatch`), así que tiene la misma espera y una mejora debería evaluarse para los dos | La espera de cola baja de ~29 s a ~0–2 s: **total ~5 s** con 1 foto. | Cambio de backend + migración. Hay que cuidar duplicados (ya existe el chequeo por `image_id`) y rate limits de Gemini con muchas fotos simultáneas. |
| **C. Cron más frecuente** (cada 10 s, soportado por `pg_cron`) | Espera promedio ~5 s, máxima 10 s. | Cambio mínimo, pero más ejecuciones vacías de la función de despacho. |
| **D. Bajar `GEMINI_TIMEOUT_MS` de 20 s a ~10–12 s** | Recorta la cola larga: el máximo observado de una llamada exitosa fue 9,8 s. | Con una sola muestra de timeout, **no conviene cambiarlo todavía**; primero juntar más intentos. |

**Recomendación:** optimizar el despacho (B o C; B da el mejor resultado) **después** de cerrar los casos de 2 y 4 fotos, y dejar el timeout (D) para una segunda iteración con más datos. La decisión es de producto (Hernán/Leo): depende de si 30 s de espera para ver la verificación visual es aceptable.

## 5. Qué falta (honestamente pendiente)

1. **Casos controlados de 2 y 4 fotos** (criterio de aceptación del ticket). Hoy hay solo 2 reportes de 2 fotos y 1 de 4, todos de otra prueba y sin registro de intentos. Hay que crear reportes nuevos en staging con la misma categoría, descripción, jurisdicción y juego de imágenes. El frontend **sí admite 4 fotos** (`MAX_PHOTOS = 4` en `EvidenceCaptureStep.jsx` y `EvidenceUploadDesktop.jsx`), así que D10 no es una restricción.
2. **Tiempo antes de persistir la evidencia** (reducción/anonimización/subida en el dispositivo): no hay marcas de tiempo de backend para eso. Los totales de arriba **no incluyen** ese tramo ni el de visualización al ciudadano.
3. **Cruce de costo con REP-3822:** no se infiere desde Billing sin `qa_batch_id`/`trace_id`. Para los casos nuevos hay que cargar el lote en `visual_qa_cases` **antes** de medir. Solo existe 1 caso cargado hoy.
4. **Regresión de QA (Iván):** validar que con varias fotos el envío no se rompe y que no cambian fundamento, estado ni categoría.
5. Hay un reporte (`a83d95f3…`) con 60,1 s de espera y otros con casi 0: la dispersión es la esperable de un cron por minuto, pero un lote de prueba debería correr en una ventana controlada para no mezclar reportes de otras personas.

## 6. Sobre D8 (el reporte de 4 fotos que «no confirmó en 120 s»)

La hipótesis de Hernán (la anonimización de 4 fotos tarda más de 2 minutos) **no se puede confirmar ni descartar con estos datos**, pero la verificación visual queda descartada como causa: corre después de enviar. Un indicio a favor de la hipótesis: el reporte figura creado en la base a las **21:26:14 UTC**, mientras que los reportes vecinos de la tanda (B9-71 a las 21:22:02 y B9-73 a las 21:23:00) se crearon con ~1 min de diferencia entre sí. Para cerrarlo hay que medir el tramo previo al alta (reducción + subida + anonimización por foto) con 1, 2 y 4 fotos, con marcas de tiempo en el dispositivo. Está relacionado con REP-3827.

## 7. Cómo reproducir

1. Abrir el SQL Editor de staging y ejecutar `scripts/rep3828/medicion_cola_visual.sql` (las 4 consultas son de solo lectura).
2. Para un lote de QA, acotar con `visual_qa_cases` (hay una nota en el script).
3. Contrastar con el export de REP-3822 por `report_id`.

---

## 8. Lote controlado `REP-3828-QA-01` (16/10/2026)

**Quién y cuándo:** cargado por Iván Juárez (QA) el 16/10/2026 entre las 04:10 y las 04:28 UTC, según el guion (`docs/REP-3828_Guion_casos_controlados_2_y_4_fotos.md`): mismo texto, Ambiente, Gerli, mismo pin, escritorio 1366×768, conexión normal, 25 s entre envíos. Los tiempos del navegador y la validación funcional están en su informe: [Regresión de evidencia, ubicación y D7-D8 (REP-3833)](https://unlz2026.atlassian.net/wiki/spaces/Reportalo/pages/157712389), anexos A y B. Esta sección agrega lo que mide la base **después del alta**, con la consulta 5 del script acotada a los 15 códigos (control del PASO 1: un reporte por código y la cantidad de fotos esperada en los 15).

### 8.1 Una fila por caso (base de datos, UTC)

| Caso | Fotos | Alta | Primer intento | Último resultado | Espera de cola (s) | Ejecución (s) | Total (s) | Llamada más lenta (s) | Intentos / fallidos | Tokens entrada / salida | Visual |
|---|---|---|---|---|---|---|---|---|---|---|---|
| S1-01 | 1 | 04:10:54 | 04:11:01 | 04:11:07 | 6,2 | 6,4 | 12,7 | 6,3 | 1 / 0 | 1.567 / 97 | coincide |
| S1-02 | 1 | 04:13:55 | 04:14:01 | 04:14:04 | 5,7 | 2,5 | 8,2 | 2,4 | 1 / 0 | 1.567 / 97 | coincide |
| S1-03 | 1 | 04:16:54 | 04:17:01 | 04:17:03 | 6,2 | 2,8 | 9,0 | 2,7 | 1 / 0 | 1.567 / 93 | coincide |
| S1-04 | 1 | 04:19:55 | 04:20:01 | 04:20:05 | 6,3 | 3,4 | 9,7 | 3,3 | 1 / 0 | 1.567 / 95 | coincide |
| S1-05 | 1 | 04:22:54 | 04:23:00 | 04:23:03 | 6,2 | 2,3 | 8,6 | 2,2 | 1 / 0 | 1.567 / 95 | coincide |
| S2-01 | 2 | 04:11:51 | 04:12:01 | 04:12:06 | 9,1 | 5,0 | 14,2 | 4,6 | 2 / 0 | 3.123 / 203 | coincide |
| S2-02 | 2 | 04:14:49 | 04:15:01 | 04:15:05 | 11,7 | 4,0 | 15,9 | 3,9 | 2 / 0 | 3.123 / 186 | coincide |
| S2-03 | 2 | 04:17:51 | 04:18:00 | 04:18:04 | 8,9 | 3,4 | 12,6 | 3,4 | 2 / 0 | 3.123 / 199 | coincide |
| S2-04 | 2 | 04:20:47 | 04:21:01 | 04:21:04 | 13,4 | 3,5 | 17,1 | 3,4 | 2 / 0 | 3.123 / 200 | coincide |
| S2-05 | 2 | 04:23:52 | 04:24:01 | 04:24:04 | 8,3 | 2,6 | 11,1 | 2,5 | 2 / 0 | 3.123 / 203 | coincide |
| S4-01 | 4 | 04:15:02 | 04:16:01 | 04:16:05 | **58,0** | 4,0 | **62,9** | 4,0 | 4 / 0 | 6.260 / 379 | coincide |
| S4-02 | 4 | 04:17:54 | 04:18:00 | 04:18:12 | 5,6 | 12,1 | 18,3 | **11,9** | 4 / 0 | 6.260 / 484 | coincide |
| S4-03 | 4 | 04:20:57 | 04:21:01 | 04:21:05 | 2,8 | 3,9 | 7,3 | 3,8 | 4 / 0 | 6.260 / 486 | coincide |
| S4-04 | 4 | 04:23:55 | 04:24:01 | 04:24:04 | 4,8 | 2,8 | 8,2 | 2,7 | 4 / 0 | 6.260 / 492 | coincide |
| S4-05 | 4 | 04:27:05 | 04:28:01 | 04:28:05 | **54,5** | 3,8 | **58,9** | 3,5 | 4 / 0 | 6.260 / 686 | coincide |

Mismas definiciones que la sección 3: **espera de cola** = última evidencia persistida → primer intento; **ejecución** = primer intento → último resultado guardado; **total** = primera evidencia → último resultado. Modelo `gemini-3.8-flash` en las 35 llamadas.

### 8.2 Resumen por tamaño de lote (medianas, con mínimo y máximo)

| Fotos | Espera de cola (s) | Ejecución (s) | Total después del alta (s) | Envío → alta (navegador, QA) | Envío → resultado visual (QA) |
|---|---|---|---|---|---|
| 1 | 6,2 (5,7–6,3) | 2,8 (2,3–6,4) | 9,0 (8,2–12,7) | 14 s | 23 s (20–28) |
| 2 | 9,1 (8,3–13,4) | 3,5 (2,6–5,0) | 14,2 (11,1–17,1) | 23 s | 36 s (35–38) |
| 4 | 5,6 (2,8–58,0) | 3,9 (2,8–12,1) | 18,3 (7,3–62,9) | **2:34** | **2:43 (2:40–3:40)** |

### 8.3 Lectura

1. **Después del alta, la cantidad de fotos no suma tiempo.** Las fotos de un reporte se despachan juntas: entre el primer y el último intento de un mismo reporte hubo **0,1 a 1,3 s**. La ejecución queda en ~3–4 s con 1, 2 o 4 fotos. Confirma lo visto el 13/10 con el reporte D8.
2. **La espera de cola la decide el reloj, no el lote.** El cron corre en el segundo :01 de cada minuto. Con 25 s entre envíos, casi todas las altas cayeron entre los segundos :47 y :57, justo antes del tick: esperaron 3 a 13 s. Las dos que cayeron justo después (S4-01 a las 04:15:02 y S4-05 a las 04:27:05) esperaron **58 y 54,5 s**. Por eso la fila de 4 fotos tiene el mínimo y el máximo de todo el lote: **no es un efecto del tamaño**. En uso real, la espera se reparte entre 0 y 60 s (promedio ~30 s, como en la sección 3).
3. **Gemini respondió bien en las 35 llamadas, sin reintentos.** Una sola llamada tardó 11,9 s (S4-02); el resto, entre 2,2 y 6,3 s.
4. **Con 4 fotos, el tiempo se pierde antes del alta.** Envío → alta: 14 s con 1 foto, 23 s con 2 y **2:34 con 4**. Según la medición de QA, la anonimización tarda ~11,3 s por foto y es secuencial: 4 fotos ≈ 49 s, más que los 45 s de la pantalla. El reporte pasa a la cola de Pendientes, que reintenta a los 60 s y vuelve a procesar todo (REP-3827, H1–H3; O-01 y O-02 de QA). La verificación visual, después, agrega solo 7 a 63 s.
5. **Explica el caso B9-72 de Hernán (#RP-3091E5F5):** el reporte se creó, pero el ciudadano nunca vio «Reporte enviado». Es el mismo camino: la pantalla se rinde a los 45 s y el reporte entra por la cola. QA lo reprodujo en 5 de 5 casos.
6. **Costo por foto (para REP-3822):** ~1.565 tokens de entrada y ~95–170 de salida por llamada visual, sin reintentos. **No se calculó el costo en moneda.** Con este lote, el costo crece en proporción a la cantidad de fotos (una llamada por foto); no hubo costo extra por reintentos.

### 8.4 Recomendación (cuantificada, sin cambiar la arquitectura)

| Tramo | Opción | Efecto esperado con 4 fotos | Costo / riesgo |
|---|---|---|---|
| **Antes del alta** (prioridad: es lo que ve el ciudadano) | **E · Aviso distinto** cuando el reporte entra a la cola con buena señal | No acorta el tiempo, pero deja de decir «apenas recuperes señal» cuando la señal es buena | Solo texto. Bajo |
| | **C · Límite de la pantalla según la cantidad de fotos** (por ejemplo, 15 s por foto: 60 s con 4) | Cubre la mediana de 49 s y casi el peor caso posible con lo medido (4 × 14,3 s ≈ 57 s). El ciudadano ve «Reporte enviado» a los ~50 s en vez de caer en la cola y esperar 2:34 | Cambio chico en `ReportProcessingScreen`. Con mala señal, el ciudadano espera más antes de poder irse. **Decisión del PO** (O-01) |
| | **F · Anonimizar de a 2 fotos a la vez** | Estimado ~23 s para 4 fotos (2 tandas de ~11 s). **No medido**: depende de cuántas ejecuciones simultáneas soporta `quarantine-anonymize` y del límite de Vision | Cambio en `quarantinePipelineService`. Medir antes de decidir |
| **Después del alta** | **A · Mantener el cron por minuto** | 0 a 60 s hasta el resultado visual (promedio ~30 s). **No bloquea al ciudadano**: «Reporte enviado» no espera a la IA | Ninguno |
| | B o C de la sección 4 (despachar al encolar o cron cada 10 s) | Resultado visual en ~5–15 s | Solo vale la pena si el PO quiere mostrar el resultado visual más rápido. No cambia O-01 |

**Recomendación:** no tocar la verificación visual por ahora (A). Para el problema real de 4 fotos, **E y C** en un ticket nuevo, junto con O-01 y O-02 de QA (decisión del PO entre C y E, o ambas), y **medir F** antes de decidirla. La cola de la verificación visual queda descartada como causa de D8.

### 8.5 Criterios de aceptación del ticket

| Criterio | Estado |
|---|---|
| Tabla reproducible por tamaño de lote con IDs, fotos, horarios, modelo, duración desglosada, reintentos y resultado | **Hecho:** 8.1 y 8.2, más los anexos A y B del informe de QA (códigos, horarios ART, tiempos del navegador) |
| Evidencia que ubica el cuello de botella, o diagnóstico de qué datos faltan | **Hecho:** antes del alta (anonimización secuencial y límite de 45 s); la cola visual queda descartada (8.3) |
| Recomendación cuantificada, sin cambiar la arquitectura | **Hecho:** 8.4 |
| QA valida que varias fotos no rompen el envío ni alteran fundamento, estado ni categoría | **Hecho:** REP-3833, APROBADO CON OBSERVACIÓN (15 de 15; 35 de 35 fotos «coincide»; 0 duplicados) |

**Pendiente, fuera de este ticket:** registrar el lote en `visual_qa_cases` (PASO 2 de `scripts/rep3828/registrar_lote_qa.sql`; escribe en la base y no hace falta para esta medición), el costo en moneda (REP-3822) y la validación en iPhone/Safari (REP-3833, sección 8).
