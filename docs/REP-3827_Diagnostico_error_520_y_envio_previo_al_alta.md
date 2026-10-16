# REP-3827 (D7) · Diagnóstico del tramo previo al alta: carga, anonimización y error 520

**Fecha:** 13/10/2026 · **Actualizado:** 16/10/2026 (sección 4.1) · **Responsable:** Matías · **Entorno:** staging (proyecto Supabase `CiudadAR`) · **Horarios:** UTC (ART = UTC-3)
**Script reproducible (solo lectura):** [`scripts/rep3827/huerfanas_report_evidences.sql`](../scripts/rep3827/huerfanas_report_evidences.sql)

> **Estado (16/10/2026):** diagnóstico **cerrado**. El 520 de D7 **está ubicado** en los logs del 07/10: lo devolvió el borde de Supabase (gateway) en 39 ms y **el pedido nunca llegó al servicio de Storage**. Fue el **único** 5xx del día: un error transitorio de infraestructura, no del código de la app (sección 4.1). El reporte de B1-22 **no se perdió**: el borrador quedó en el dispositivo y se envió en el caso siguiente. Las correcciones A y B (sección 6) están aplicadas y validadas por QA (REP-3833). C, D y E quedan como propuestas para otro ticket.

---

## 1. Resumen

| # | Hallazgo | Estado |
|---|---|---|
| H1 | El tramo previo al alta procesa las fotos **de a una**, a razón de **~11 s por foto**, y la pantalla de procesamiento se rinde a los **45 s**: con 4 fotos el tiempo ya está en el límite | **Confirmado** (código + datos) |
| H2 | Cuando la pantalla se rinde, el reporte pasa a la cola, pero **la primera tanda sigue procesando en segundo plano** y la cola **vuelve a procesar todo desde cero**: trabajo duplicado y **fotos protegidas guardadas sin reporte** | **Confirmado** (código + datos) |
| H3 | Quien se queda esperando la pantalla «Reporte enviado» **no la ve nunca** en ese camino: ve el aviso «Reporte guardado con éxito» y vuelve al mapa. Es el comportamiento diseñado, pero explica «no confirmó en 120 s» de D8 | **Confirmado en el código**; lo que vio el probador es **inferencia** |
| H4 | La subida a cuarentena **no reintenta** ante un error transitorio (como un 520) | **Confirmado en el código** |
| H5 | La causa del 520 de D7 (origen, etapa, frecuencia) | **Ubicada (16/10):** borde de Supabase, sin llegar a Storage; único 5xx del 07/10 (sección 4.1) |

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

**Conclusión sobre D7 (13/10):** el diagnóstico queda **abierto**. Sin el caso original no puedo ubicar el 520 con certeza ni decir si es frecuente. Lo que sí confirmé es que, si ocurre en la subida, **no se reintenta** (H4).

> **Corrección (16/10):** dos afirmaciones de esta sección resultaron incorrectas. La fecha real de la tanda es el **07/10**, no el 08/10 (Hernán, REP-3827). Y sí existe un reporte con el texto de B1-22 en la ventana: `601fb52b` lleva el `client_side_id` del borrador que falló. Ver 4.1.

### 4.1 El 520 en los logs del 07/10 (16/10/2026)

Hernán repitió la tanda `B1-18` a `B2-27` el 16/10 con la red grabando: 10 de 10 reportes creados, 0 errores en 854 pedidos, **el 520 no se reprodujo** (HAR en el Drive del equipo). Con la fecha corregida, los logs de Supabase del **07/10** todavía estaban disponibles y se consultaron (`edge_logs`, `storage_logs`; consultas de solo lectura).

**El pedido que falló**

| Campo | Valor |
|---|---|
| Hora | **07/10/2026 20:59:40.784 UTC** (17:59:40 ART), 14 s después del alta de `B1-21` (`27a4fbe2`) |
| Pedido | `POST /storage/v1/object/evidence-quarantine/<usuario>/temp_8a40b2f2-…_1791406780725.jpg` (supabase-js 2.112.4, web) |
| Respuesta | **520**, `text/plain`, **39 ms** en el borde (colo `SCL`, `cf_ray a46fd4bbfe4a92cf-SCL`, `request_id 01a1182a-3170-7206-97f7-d72453df1ab3`) |
| Del lado de Storage | **Ninguna entrada** en `storage_logs` para ese pedido. Las subidas anteriores y posteriores sí tienen su `storage.object.upload` |
| Frecuencia | **Único 5xx de todo el 07/10** (00:00–24:00 ART): 1 de 7.853 pedidos al borde, 1 de 1.277 a Storage |

**Lectura.** El 520 lo generó el borde de Supabase (Cloudflare + gateway) al no recibir una respuesta válida del servicio de origen: el pedido **no llegó a Storage** (no hay log) y la respuesta tardó 39 ms, contra 300–550 ms de una subida normal. No hay nada en el pedido que lo distinga de las subidas buenas (mismo cliente, misma ruta, mismo navegador). Es un **fallo transitorio de infraestructura del proveedor**, fuera del código de Reportalo. La causa interna del lado de Supabase no es observable con nuestro acceso y no se investiga más.

**Qué pasó con el reporte.** El borrador del caso es `8a40b2f2-9921-4672-b951-2fd197fc32d6`:

1. **20:59:40**: falla la subida (520). El código desplegado ese día (`e0e063c`) no reintentaba (H4): la pantalla mostró el error con «Reintentar protección», y el borrador quedó en el dispositivo como `DRAFT_LOCAL`. Por eso no apareció ni en «Mis reportes» ni en Pendientes.
2. El script esperó 120 s y abrió un reporte nuevo para `B1-23`. Al abrirlo, la app **restauró el borrador en edición** (`getActiveDraftReport`, REP-2703), con el mismo `client_side_id`. El script lo completó con los datos de `B1-23`, que son iguales a los de `B1-22` (Gerli, Comercio irregular, mismo texto y misma foto).
3. **21:01:54**: subida del mismo borrador → 200. **21:02:03**: alta de `601fb52b` con `client_side_id = 8a40b2f2…`.

La planilla de Hernán (`bateria_completa_81.csv`) anota `601fb52b` como `B1-23`. Por el `client_side_id` es el borrador de `B1-22`: los dos casos quedaron en **un solo reporte**, sin duplicado ni pérdida de datos. Para un ciudadano real es el comportamiento diseñado: si la subida falla y sale de la pantalla, el borrador lo espera en el próximo reporte. La pérdida aparente es un efecto del script, que cargó un caso nuevo encima de un borrador restaurado.

**Con las correcciones de hoy:** la corrección B (hasta 2 reintentos, 0,8 s y 2 s) habría resuelto este caso en el primer reintento: el pedido siguiente al mismo servicio respondió bien. QA lo validó con 520 simulados (REP-3833, D7-02 y D7-03: reporte enviado en 11,6 s y 13,6 s, sin error visible).

**Conclusión sobre D7 (16/10):** causa **ubicada** (borde del proveedor, transitoria, aislada); recuperación **verificada** (sin pérdida ni duplicados); mitigación **aplicada y validada** (B). Se cierra.

---

## 5. Qué NO se pudo hacer (y por qué)

| Punto del ticket | Estado |
|---|---|
| Recuperar de Hernán el reporte D7 original (ID, hora con zona, pasos, capturas) | **Hecho (16/10).** Fecha corregida al 07/10 y ventana UTC; con eso se ubicó el pedido en los logs (4.1) |
| Reproducir en staging con conectividad normal y degradada | **Hecho por Hernán (16/10, sin 520) y por QA (REP-3833, 520, 403 y corte de red simulados)** |
| Comprobar que un fallo previo al alta conserva borrador e imágenes protegidas | **Hecho.** En el caso original el borrador quedó en el dispositivo y terminó en `601fb52b` (4.1). QA lo verificó con reintento manual y con la cola (REP-3833, D7-06b y D7-04), sin duplicados |
| Regresión con QA en iPhone/Safari | **No hecho.** QA no cuenta con dispositivos Apple; Iván lo propone como tarea QA aparte (REP-3833, sección 8) |

---

## 6. Correcciones propuestas (A y B aplicadas)

El ticket dice aplicar una corrección acotada **solo si la causa está confirmada**. H1–H4 están confirmadas en el código; el 520 (H5) no. Propongo, en este orden de menor a mayor impacto:

| # | Cambio | Qué resuelve | Riesgo / costo |
|---|---|---|---|
| A | **Cancelar la tanda abandonada** cuando la pantalla se rinde o se cierra: la tanda deja de procesar fotos | Evita procesar, anonimizar y guardar las fotos que **faltaban** cuando se abandonó. **No elimina** las copias de las fotos que ya se habían terminado (en D8, 3 de 4 más la que estaba en vuelo): esas siguen sin reporte, y la cola las vuelve a procesar | Bajo: es un indicador de cancelación que se revisa entre foto y foto. No cambia la experiencia |
| B | **Reintento acotado de la subida** a cuarentena ante errores transitorios (5xx como 520, caída de red), 2 reintentos con espera corta | Soluciona D7 **como síntoma** aunque no se conozca la causa del 520. Los 5xx y los cortes son transitorios por definición | Medio: agrega hasta unos segundos de espera en el peor caso. **El ticket pide la causa confirmada antes de corregir**, por eso lo dejo a tu decisión |
| C | **Temporizador proporcional** a la cantidad de fotos (por ejemplo, base + ~15 s por foto) en lugar de 45 s fijos | Con una buena señal y 4 fotos, el ciudadano ve «Reporte enviado» en vez de caer en la cola | Es una decisión de producto: el temporizador existe para la señal débil; moverlo cambia cuánto espera alguien con mala conexión antes de poder irse |
| D | **Limpieza de huérfanas** (por ejemplo, borrar las copias protegidas sin reporte con más de 24 h) | Evita que las fotos sin reporte se acumulen | Es **borrar datos**: requiere decisión explícita, criterio de antigüedad y respaldo previo. No lo haría sin tu OK |
| E | **Aviso al ciudadano** en la pantalla de «Reporte guardado» cuando entra a la cola por demora con buena señal | Evita la confusión «no confirmó» | Cambio de texto/UX; se coordina con UX |

Con **A + B** se cubre el ticket con el menor riesgo. C, D y E son decisiones de producto o de datos.

### 6.1 Qué se aplicó (A y B)

**Archivos:** `src/services/quarantinePipelineService.js`, `src/components/report/ReportProcessingScreen.jsx` y la prueba nueva `src/test/Rep3827TandaAbandonadaYReintentoDeSubida.test.jsx` (17 tests).

| Cambio | Detalle |
|---|---|
| **B · reintento de la subida** | `uploadToQuarantine` hace hasta **3 intentos** (1 + 2 reintentos, esperas de 0,8 s y 2 s), con el **mismo nombre** de archivo. Reintenta ante 5xx (incluido el 520), 408, 429 y cortes de red; **no** reintenta un 4xx. Si en un reintento recibe un 409 («ya existe»), lo da por bueno: significa que el intento anterior sí guardó la foto y solo se perdió la respuesta. El log del reintento solo dice el número de intento y el código HTTP |
| **A · cancelar la tanda** | `processAllEvidencesThroughQuarantine` y `processEvidenceThroughQuarantine` aceptan `shouldAbort`. Se consulta antes de cada foto, antes de subirla, entre reintentos y **después de subirla**: si la tanda se abandonó en ese punto, se purga la original de cuarentena y no se invoca la anonimización. El corte devuelve `aborted: true`, que no se muestra como fallo de protección |
| **A · la pantalla** | `ReportProcessingScreen` pasa un `shouldAbort` propio de cada ejecución, que se activa cuando vence la espera (el reporte pasa a la cola) y cuando la pantalla se cierra o se reinicia el procesamiento. Es local a cada ejecución a propósito: un reintento manual reinicia el indicador compartido pero no debe reactivar una tanda vieja que sigue en vuelo |

**Verificación:** la suite completa pasa (927 de 927; la rama de staging tenía 910) y el build compila. La prueba nueva **falla 12 de 17 tests sin el cambio y pasa con él**.

**Lo que NO verifiqué:** no probé el recorrido en un dispositivo ni contra un 520 real (nadie pudo reproducirlo); los tests simulan los errores. Tampoco medí si el reintento resuelve el caso de Hernán: eso solo se sabe repitiendo la tanda en staging.

**Lo que sigue sin resolverse:** la cola (`PendingSyncManager`) sigue **volviendo a procesar todas las fotos** desde cero y recién reintenta a los 60 s. Las fotos terminadas antes del abandono siguen quedando sin reporte (D). Reutilizar lo ya procesado es un cambio más grande que no hice.

---

## 7. Cierre (16/10/2026)

| Criterio de aceptación | Estado |
|---|---|
| Caso original identificado y reproducido, o impedimento documentado | **Identificado** en los logs (4.1). La repetición de Hernán no lo reproduce: es consistente con un fallo transitorio |
| Se distingue dónde ocurre el 520 y se conservan log, versión y tiempos | **Sí:** borde de Supabase, antes de Storage; `request_id`, `cf_ray`, hora y versión del cliente en 4.1 |
| Sin pérdida de datos ante falla recuperable, reintento coherente y sin duplicados, verificado en staging | **Sí:** caso original sin pérdida (4.1) y regresión QA 9 de 9 (REP-3833) |
| QA registra esperado/observado y dictamen | **Sí:** REP-3833, APROBADO CON LIMITACIÓN. La limitación era la causa del 520, que queda resuelta en 4.1 |

**Queda fuera de este ticket** (va a otro, junto con las propuestas C, D y E):

- **O-01 de QA (Alta):** con 4 fotos y buena señal, la pantalla se rinde a los 45 s y el aviso habla de falta de señal. Es H1 + H3; se resuelve con C o E, a decisión del PO.
- **O-02 de QA (Media):** la corrección A no evita el reproceso cuando la cuarta foto ya arrancó antes de los 45 s. Es la parte de H2 que A no cubre (la cola vuelve a procesar todo) y la limpieza de huérfanas (D).
- **O-05 y O-06 de QA (Baja):** texto del error 403 («Revisá tu conexión») y «Reintentar protección» ofrecido ante un error de formato (415).
- **Validación en iPhone/Safari:** tarea QA aparte (REP-3833, sección 8).
