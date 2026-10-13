# REP-3828 (D8) · Cola y tiempos de la verificación visual

**Fecha de la medición:** 13/10/2026 · **Entorno:** staging (proyecto Supabase `CiudadAR`) · **Horarios:** UTC (ART = UTC-3)
**Responsable:** Matías · **Script reproducible:** [`scripts/rep3828/medicion_cola_visual.sql`](../scripts/rep3828/medicion_cola_visual.sql) (solo lectura)

> **Estado:** primera pasada hecha con los datos que ya existen en staging. **Faltan los casos controlados de 2 y 4 fotos** (hay 2 reportes de 2 fotos y 1 de 4, todos de la batería de Hernán del 07/10). Ver «Qué falta».

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
