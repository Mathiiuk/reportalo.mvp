# REP-3827 (D7) · Diagnóstico del tramo previo al alta: carga, anonimización y error 520

**Fecha:** 13/10/2026 · **Responsable:** Matías · **Entorno:** staging (proyecto Supabase `CiudadAR`) · **Horarios:** UTC (ART = UTC-3)
**Script reproducible (solo lectura):** [`scripts/rep3827/huerfanas_report_evidences.sql`](../scripts/rep3827/huerfanas_report_evidences.sql)

> **Estado:** diagnóstico parcial. **El error 520 en sí NO está reproducido ni su causa confirmada.** En cambio, al revisar el tramo previo al alta aparecieron tres hallazgos **confirmados con datos de la base y con el código**, que explican el comportamiento que Hernán vio en D8 y dejan basura en el bucket. Las correcciones están **propuestas, no aplicadas**: necesito tu decisión (sección 6).

---

## 1. Resumen

| # | Hallazgo | Estado |
|---|---|---|
| H1 | El tramo previo al alta procesa las fotos **de a una**, a razón de **~11 s por foto**, y la pantalla de procesamiento se rinde a los **45 s**: con 4 fotos el tiempo ya está en el límite | **Confirmado** (código + datos) |
| H2 | Cuando la pantalla se rinde, el reporte pasa a la cola, pero **la primera tanda sigue procesando en segundo plano** y la cola **vuelve a procesar todo desde cero**: trabajo duplicado y **fotos protegidas guardadas sin reporte** | **Confirmado** (código + datos) |
| H3 | Quien se queda esperando la pantalla «Reporte enviado» **no la ve nunca** en ese camino: ve el aviso «Reporte guardado con éxito» y vuelve al mapa. Es el comportamiento diseñado, pero explica «no confirmó en 120 s» de D8 | **Confirmado en el código**; lo que vio el probador es **inferencia** |
| H4 | La subida a cuarentena **no reintenta** ante un error transitorio (como un 520) | **Confirmado en el código** |
| H5 | La causa del 520 de D7 (origen, etapa, frecuencia) | **NO confirmada** |

---

## 2. Cómo está armado el tramo previo al alta (leído del código)

1. `NewReportPage` → paso 4 → `ReportProcessingScreen`, que llama a `processAllEvidencesThroughQuarantine`.
2. Ese servicio recorre las fotos **con un `for` secuencial** (`quarantinePipelineService.js`): por cada foto reduce y endereza en el dispositivo, **sube** a `evidence-quarantine` (`uploadToQuarantine`, un solo intento) e **invoca** `quarantine-anonymize`, que guarda la copia protegida en `report-evidences` como `<client_side_id>/<epoch_ms>_sanitized.jpg`. Ante el primer fallo, corta todo.
3. `ReportProcessingScreen` tiene un **temporizador de 45 s** (`timeoutMs = 45000`; `NewReportPage` no lo cambia). Si vence y hay a dónde mandarlo, marca la ejecución como abandonada y llama a `saveForLaterAndExit`: el borrador pasa a `PENDING_SYNC`, aparece el aviso «Reporte guardado con éxito · Se enviará automáticamente apenas recuperes señal» y se vuelve al mapa.
4. La promesa de la primera tanda **no se cancela**: sigue corriendo en segundo plano y su resultado se descarta.
5. `PendingSyncManager` **no reintenta de inmediato** cuando un reporte entra a la cola (el código lo dice: «sin reintentar ya: la señal acaba de fallar»); arranca un reintento **cada 60 s** (`PENDING_RETRY_INTERVAL_MS`). Cada reintento (`sendPendingDraft`) **vuelve a ejecutar el pipeline completo** de todas las fotos y recién después crea el reporte (alta idempotente por `client_side_id`, REP-3810).
6. Si la subida falla, el servicio devuelve `reason: 'upload_failed'`; la pantalla de fallo dice «No pudimos subir la foto. Revisá tu conexión y probá de nuevo». No hay ningún reintento automático en ese tramo.

---

## 3. Datos medidos en la base (staging, 13/10/2026)

### 3.1 Tiempo por foto

Los objetos protegidos de una misma tanda se guardan con esta separación (segundos entre fotos consecutivas):

| Tanda | Separaciones |
|---|---|
| Reporte de 3 fotos `39883e9e` (21:22:36 → 21:22:57) | 11 s · 10 s |
| Reporte de 3 fotos `156fc530` (21:25:49 → 21:26:11) | 14 s · 8 s |
| Reporte de 4 fotos `3091e5f5`, tanda adjunta (21:25:42 → 21:26:14) | 10 s · 10 s · 12 s |
| Reporte de 4 fotos `3091e5f5`, primera tanda (21:23:36 → 21:24:14) | 13 s · 14 s · 11 s |

Promedio de esas 10 separaciones: **11,3 s por foto**. Son datos de una batería automatizada, con fotos de entre 66 y 679 KB protegidas, desde un navegador de escritorio y de un móvil emulado, sobre la conexión de quien las ejecutó. **No es una medición controlada** de cuánto tarda cada paso.

Consecuencia (aritmética, no medición directa del temporizador): con ~11 s por foto, 3 fotos quedan en ~33 s (bajo los 45 s) y **4 fotos en ~45 s o más**, es decir, en el borde del temporizador.

### 3.2 El caso D8 completo (borrador `32efe42e…`, reporte `3091e5f5`, 4 fotos)

Los 11 archivos protegidos que hay en el bucket para ese borrador (los 4 de la última fila son los únicos adjuntos al reporte):

| Guardada (UTC, 07/10) | Bytes | Adjunta a un reporte |
|---|---|---|
| 21:23:36 | 208.221 | no |
| 21:23:49 | 498.089 | no |
| 21:24:03 | 679.081 | no |
| 21:24:14 | 465.497 | no |
| 21:25:21 | 208.221 | no |
| 21:25:33 | 498.089 | no |
| 21:25:35 | 208.221 | no |
| 21:25:42 | 208.221 | **sí** |
| 21:25:52 | 498.089 | **sí** |
| 21:26:02 | 679.081 | **sí** |
| 21:26:14 | 465.497 | **sí** |

Reporte creado a las **21:26:14**. Lectura:

- Las **cuatro fotos se procesaron completas a las 21:23:36–21:24:14** (primera tanda) y **ninguna quedó adjunta**. Estimación: si la pantalla empezó unos 11 s antes del primer archivo (≈21:23:25), los 45 s vencían a las ≈21:24:10, unos 4 s antes del último archivo (21:24:14). Es coherente con que se rindió justo antes de terminar, pero la hora de inicio no está registrada.
- Después hay una segunda tanda a las **21:25:21** y **21:25:33**, y otro archivo de la primera foto a las **21:25:35**, **7 segundos antes** del que quedó adjunto a las 21:25:42. Una tanda secuencial no puede guardar la misma foto dos veces con 7 s de diferencia (cada foto lleva ~11 s): hubo **dos tandas simultáneas**.
- La primera foto de ese borrador (208.221 bytes) se guardó **4 veces**. El borrador tiene **4 fotos adjuntas y 11 archivos**: **7 archivos sin reporte**.
- El reporte se creó ~3 minutos después de la ventana en la que Hernán lo envió. Los reportes vecinos de 1 foto tienen una separación promedio de 26,8 s entre creaciones (65 casos, mínimo 21,4 s).

### 3.3 Controles: reportes de 3 fotos de la misma batería

`39883e9e` (3 fotos) y `156fc530` (3 fotos) tienen **3 archivos en el bucket y 3 adjuntos**: sin duplicados. Es lo que se espera cuando la tanda termina antes del temporizador.

### 3.4 Alcance del problema en todo el bucket

| Dato | Valor |
|---|---|
| Archivos protegidos en `report-evidences` | 398 |
| Sin ninguna fila en `report_images` que los use | **91** |
| …de borradores que **sí llegaron a ser reporte** (16 borradores; trabajo duplicado como el de D8) | 47 |
| …de borradores que **nunca llegaron a ser reporte** (9 borradores) | 44 |

Los días con más casos son el 23/09 (29), el 24/09 (15) y el 02/10 (23); **no sé a qué corresponden** (pueden ser pruebas, otras causas o esta misma). **No sé cuántas se deben a esta causa**; el script lista el detalle por borrador. En el caso concreto de D8, la causa sí es esta (sección 3.2).

> **Privacidad.** Son copias ya protegidas (rostros pixelados, metadatos quitados), no los originales: los originales viven en `evidence-quarantine` y `quarantine-purge` los elimina. Pero siguen siendo fotos de ciudadanos guardadas sin que ningún reporte las use y **sin que nada las limpie**, y las patentes no se difuminan (decisión de producto del 30/09).

---

## 4. D7 (el envío con error 520)

- La prueba `B1-22` (Avellaneda, Comercio irregular, móvil emulado, texto «Puestos de venta ambulante sobre la vereda…»): en la base, la creación anterior a ella es `27a4fbe2` (20:59:26) y la siguiente es `601fb52b` (21:02:03): **157 s de brecha**, contra 26,8 s promedio. Es lo que se espera de un script que esperó 120 s y siguió. **No existe ningún reporte con ese texto en esa ventana**, y no hay archivos protegidos sin reporte en esa ventana (los 7 huérfanos de esa tarde son todos del borrador de D8).
- **Eso es consistente con que el fallo ocurrió antes de que la foto llegara a protegerse**, es decir, en la subida a cuarentena (donde el probador vio el 520), pero **no lo demuestra**: el bucket de cuarentena está vacío por diseño (se purga) y no hay registro del lado del servidor para esa etapa.
- No sé **qué vio el ciudadano** en pantalla: el script no lo miró. Por el código habría visto «No pudimos subir la foto. Revisá tu conexión y probá de nuevo» con las opciones de reintentar, cambiar la foto o guardar para después; es lectura del código, **no observación**.
- **Mis reportes vs Pendientes.** Hernán buscó el reporte en «Mis reportes». Un borrador que pasó a la cola vive en el dispositivo y se ve en **Pendientes**, no en «Mis reportes». No sé si el probador miró Pendientes.
- **No consulté los logs del 07/10** del almacenamiento ni de las funciones: no sé si el plan de Supabase todavía los conserva.

**Conclusión sobre D7:** el diagnóstico queda **abierto**. Sin el caso original no puedo ubicar el 520 con certeza ni decir si es frecuente. Lo que sí confirmé es que, si ocurre en la subida, **no se reintenta** (H4).

---

## 5. Qué NO se pudo hacer (y por qué)

| Punto del ticket | Estado |
|---|---|
| Recuperar de Hernán el reporte D7 original (ID, hora con zona, pasos, capturas) | **Pendiente.** Tengo el plan (`B1-22`) y la ventana horaria, no la captura de consola con hora ni la URL del recurso |
| Reproducir en staging con conectividad normal y degradada | **No hecho.** Requiere ejecutar envíos reales en la cuenta de staging; no lo hice sin acordarlo |
| Comprobar que un fallo previo al alta conserva borrador e imágenes protegidas | **Parcial:** el código conserva el borrador (pasa a `PENDING_SYNC` y se reintenta cada 60 s) y los datos muestran que el alta final fue idempotente (el reporte `3091e5f5` se creó una sola vez). **No verifiqué en un dispositivo** qué ve el ciudadano si el fallo es de subida |
| Regresión con QA en iPhone/Safari | **No hecho** |

---

## 6. Correcciones propuestas (ninguna aplicada)

El ticket dice aplicar una corrección acotada **solo si la causa está confirmada**. H1–H4 están confirmadas en el código; el 520 (H5) no. Propongo, en este orden de menor a mayor impacto:

| # | Cambio | Qué resuelve | Riesgo / costo |
|---|---|---|---|
| A | **Cancelar la tanda abandonada** cuando la pantalla se rinde: que el procesamiento se detenga después de la foto en curso | Elimina la mayor parte de las fotos huérfanas (quedaría, como máximo, la foto que estaba en vuelo) y el trabajo duplicado | Bajo: es un indicador de cancelación que se revisa entre foto y foto. No cambia la experiencia |
| B | **Reintento acotado de la subida** a cuarentena ante errores transitorios (5xx como 520, caída de red), 2 reintentos con espera corta | Soluciona D7 **como síntoma** aunque no se conozca la causa del 520. Los 5xx y los cortes son transitorios por definición | Medio: agrega hasta unos segundos de espera en el peor caso. **El ticket pide la causa confirmada antes de corregir**, por eso lo dejo a tu decisión |
| C | **Temporizador proporcional** a la cantidad de fotos (por ejemplo, base + ~15 s por foto) en lugar de 45 s fijos | Con una buena señal y 4 fotos, el ciudadano ve «Reporte enviado» en vez de caer en la cola | Es una decisión de producto: el temporizador existe para la señal débil; moverlo cambia cuánto espera alguien con mala conexión antes de poder irse |
| D | **Limpieza de huérfanas** (por ejemplo, borrar las copias protegidas sin reporte con más de 24 h) | Evita que las fotos sin reporte se acumulen | Es **borrar datos**: requiere decisión explícita, criterio de antigüedad y respaldo previo. No lo haría sin tu OK |
| E | **Aviso al ciudadano** en la pantalla de «Reporte guardado» cuando entra a la cola por demora con buena señal | Evita la confusión «no confirmó» | Cambio de texto/UX; se coordina con UX |

Con **A + B** se cubre el ticket con el menor riesgo. C, D y E son decisiones de producto o de datos.

---

## 7. Lo que necesito

1. **De vos:** ¿aplico A y B en esta rama? ¿C, D o E van a otro ticket?
2. **De Hernán:** la captura de la consola de `B1-22` con la **hora exacta** y la **URL completa** del recurso que devolvió 520, y qué mostraba la pantalla y qué había en **Pendientes**. Si puede repetir la tanda con la pestaña de red abierta, el HAR.
3. **De Iván (QA):** una vez aplicadas las correcciones, regresión del recorrido de 1, 3 y 4 fotos y de un fallo simulado de subida, en iPhone/Safari y al menos otro entorno.
