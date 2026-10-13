# Pedido a Hernán e Iván · Sprint 16

**Fecha:** 13/10/2026 · **De:** Matías Krepchuk · **Para:** Hernán Gregorini (PO) e Iván Juárez (UX/QA) · **Con copia a:** Leonel Nuñez

> **Para qué es esto.** De mis 10 tareas del Sprint 16, hay 4 que ya avanzaron, 1 que espera un dictamen y 5 que no puedo empezar sin una decisión o una entrega de ustedes. Este pedido junta, en un solo lugar, **qué necesito de cada uno, para qué ticket y qué se destraba con la respuesta**. No incluye fechas: no sé la fecha de cierre del sprint, así que al final les pido que me digan para cuándo pueden.

---

## 1. Resumen: qué está bloqueado y por quién

| Ticket | Tarea (mía) | Estado | Qué falta | De quién |
|---|---|---|---|---|
| REP-2800 | Routing de organismo receptor (2 SP) | **No puedo empezar** | La matriz de organismos aprobada (**REP-2806**, "Tareas por hacer") | **Hernán** |
| REP-2801 | Reporte estructurado al organismo (1 SP) | **No puedo cerrarla** | REP-2800, la plantilla (**REP-2805**, "En curso") y REP-2902; y el canal de envío | **Hernán** e **Iván** |
| REP-2902 | Fundamento legal en el reporte (2 SP) | Puedo avanzar en parte | Política de qué se envía al organismo, y el dictamen de REP-3829 | **Hernán** e **Iván** |
| REP-2502 | Estados y trazabilidad (1 SP) | Puedo avanzar en parte | Máquina de estados, permisos y definición de «resuelto» | **Hernán** |
| REP-3535 | Landing Municipios (2 SP) | **No puedo empezar** | El handoff de **REP-3830** ("En curso"), que bloquea el desarrollo | **Iván** y **Hernán** |
| REP-3834 | Cierre de REP-3805 | **Esperando dictamen** | Validación en staging | **Iván** |
| REP-3827 | Error 520 previo al alta | Parcial | El caso original (hora, URL) | **Hernán** |
| REP-3828 | Cola y tiempos con 1, 2 y 4 fotos | Parcial | Alguien que cargue 15 casos en staging | **Iván** (propuesto) |
| REP-3813, REP-3814 | Bugs de foto WEBP y de Piñeyro | **Hechos, esperan PR y QA** | Validación en staging | **Iván** |

---

## 2. Para Hernán

### H-1 · REP-2806: catálogo y reglas de organismos receptores (bloquea REP-2800, REP-2801, REP-2809 y REP-2810)
Es tu tarea y figura "Tareas por hacer". Sin ella no se puede implementar el routing.
- La **matriz** por categoría y jurisdicción (CABA y Avellaneda): organismo, área y canal de cada combinación.
- Las **precedencias**: qué pasa cuando una combinación tiene más de un organismo posible.
- Qué contactos/canales están **aprobados** para recibir un reclamo, y cuáles **no** (para que el sistema responda "sin destino verificado" y no invente uno).
- Si falta algo para alguna combinación, lo más útil es que lo marques como "sin destino" en la matriz, en vez de dejarlo vacío.

**Se destraba:** REP-2800 (2 SP) y, a través de ella, la validación de Iván en REP-2809 y REP-2810 y la entrega completa de REP-2801.

### H-2 · REP-2502: estados del reporte
La descripción de la tarea dice que necesito tu confirmación **antes de dar la historia por terminada**:
- La **máquina de estados**: ¿recibido, en revisión, aprobado y rechazado son los vigentes? ¿Qué transiciones están permitidas?
- **Quién** puede cambiar cada estado (ciudadano, quien atiende, sistema) y con qué permisos.
- La definición funcional de **«resuelto»**: ¿entra o queda fuera de este sprint? Hoy no lo infiero de ninguna otra señal (que se reporte, se reciba, se apruebe o se encuentre norma no equivale a resolución).
- El **estado inicial** de un reporte nuevo.
- La nomenclatura, coordinada con la plantilla de REP-2805.

### H-3 · REP-2801: canal de entrega al organismo
La tarea me pide confirmar con vos el **canal operativo del MVP** antes de cualquier envío externo:
- ¿**Correo real**, **envío de prueba controlado** o **solo preparación de borrador**?
- El **destinatario aprobado** (o la lista), y si hay uno de prueba.
- Mientras no esté definido, el reporte queda **"pendiente / no enviado, con motivo"** y no sale ningún correo.

### H-4 · REP-2902: qué fundamento va al organismo
- Confirmar la política: la **respuesta de IA completa solo para quien reportó**; al organismo, solo por el canal y con los permisos que vos aprobaste. ¿Qué parte del fundamento viaja (referencia legal y texto citado, sin la redacción para el ciudadano)?
- Cómo se muestra "sin fundamento verificado" cuando el RAG se abstiene (¿texto fijo?).
- Este ticket **se contrasta con el dictamen de REP-3829** de Iván (ver I-6).

### H-5 · REP-3535: landing de Municipios
- **Aprobar el handoff de REP-3830** cuando Iván lo entregue (el desarrollo no puede empezar antes).
- Decidir qué dice la UI de un **CTA sin proceso de negocio** aprobado (la tarea pide informarlo con honestidad y sin simular contratación ni envío).

### H-6 · Lo que quedó abierto en mi respuesta del RAG (`docs/Respuesta_Matias_a_Hernan_RAG_Sprint15.md`)
Resumo lo que depende de vos; el detalle y los datos están en ese documento:
1. **FAQ y patentes (sección 6.2):** la FAQ dice «difuminar rostros y patentes», pero el código y los términos dicen que **solo se difuminan rostros**. ¿Corregimos la FAQ o reactivamos el difuminado de patentes?
2. **Tipos de fundamento de la Ordenanza Fiscal (sección 2.3):** art. 132 `competencia`, arts. 231 y 233 `obligacion`, art. 235 `sancion`. ¿Los confirmás o corregís? También: ¿Ley 6684 art. 26 va a AMBIENTE, y el título del art. 235?
3. **Boletines de Avellaneda posteriores al 117º:** la última mirada por modificatorias de la Ordenanza Fiscal que dijiste que quedaba pendiente.
4. **Regla D5 (sección 3):** ¿aceptás la redacción antes de que la mida?
5. **Filtro de contenido (sección 6.1):** hoy no existe. ¿Entra como tarea nueva?
6. **D7 (sección 4):** la **hora exacta (UTC)** y la **URL completa** del recurso que devolvió 520 en la tanda `B1-18` a `B2-27`, qué mostraba la pantalla y qué había en **Pendientes**. Si podés repetir la tanda con la pestaña de red abierta, el HAR.

### H-7 · REP-3828: los 15 casos de prueba
Necesito que **vos e Iván acuerden quién los carga** (ver I-4). Si preferís hacerlo vos, el guion está listo.

---

## 3. Para Iván

### I-1 · REP-3834: validar en staging lo que ya está mergeado de REP-3805
Es el único ticket mío que **espera solo tu dictamen**. El código de REP-3805 está en `staging` desde el 05/10/2026 (PR #138, después de REP-3812, como se pedía).
- Ejecutar los **6 casos mínimos** de la descripción de REP-3834 en el build desplegado:
  1. Más de 200 reportes: se ven también los antiguos dentro de la zona visible.
  2. Carga y movimiento: sin consultas continuas.
  3. Límite por área: si la consulta llega a 200, aparece «Acercá el mapa para ver todos».
  4. Regresión de marcadores, filtros, pin, ficha y navegación (la ficha abierta no se cierra por pan).
  5. Privacidad y errores: sin 401/403 inesperados.
  6. Reversión: `VITE_MAP_VIEWPORT_LOADING=false`.
- Dejar **APROBADO / RECHAZADO**, con escenario, fecha, **build** y evidencia. Con el OK, cierro el ticket y dejo el comentario final en REP-3805.

### I-2 · REP-3830: handoff de la landing de Municipios
Es tu tarea ("En curso") y **bloquea el desarrollo de REP-3535**. ¿Para cuándo lo tenés y cuándo lo aprueba Hernán? Cuando esté, necesito: navegación, contenido y CTA aprobados, y el comportamiento responsive.

### I-3 · REP-2805: plantilla de comunicación al organismo
Es tu tarea ("En curso") y **bloquea REP-2801**: la plantilla define los campos exactos del mensaje. ¿En qué estado está y qué falta? Con la plantilla vigente más la nomenclatura de estados de H-2, cierro REP-2801.

### I-4 · REP-3828: cargar los 15 casos de 1, 2 y 4 fotos desde la app
- Guion completo en `docs/REP-3828_Guion_casos_controlados_2_y_4_fotos.md` (rama `docs/REP-3828-medicion-cola-verificacion-visual`): **15 reportes** (5 de 1 foto, 5 de 2, 5 de 4), todos con el mismo texto, categoría, localidad y fotos, cargados **de a uno**, con la planilla para completar.
- Lo propongo para vos porque el criterio del ticket incluye tu validación: *«QA valida que el funcionamiento con varias fotos no rompe envío ni altera fundamento/estado/categoría»*.
- **Si no podés,** decime quién (puede ser yo o Hernán). Lo que no puedo hacer es cargarlos sin una cuenta de staging acordada: crean datos en la base compartida y disparan llamadas reales a Gemini.

### I-5 · REP-3833: regresión de evidencia, ubicación y D7-D8
Lo que sigue necesita **mergear a `staging` primero**; hoy son ramas subidas, pendientes de PR y de merge. Cuando estén, para validar:

| Ticket | Qué probar |
|---|---|
| **REP-3813** (WEBP/AVIF con extensión `.jpg`) | Subir una imagen WEBP, otra AVIF y un PNG renombrados a `.jpg`: se convierten y protegen; si no se puede, el aviso habla de **formato** y **no** muestra consejos de luz/enfoque ni «Guardar y enviar cuando haya señal». Un JPEG normal y una foto de celular siguen igual |
| **REP-3814** (Piñeyro) | Pines en el **oeste, centro y este de Piñeyro** con la localidad Piñeyro elegida: el aviso de distancia no debe **bloquear** «Confirmar ubicación». También un pin lejos (por ejemplo CABA) con una localidad de Avellaneda: avisa, pero deja confirmar. Revisar las otras localidades de Avellaneda (cuyos puntos de referencia corregí) |
| **REP-3827** (tramo previo al alta) | Envíos de 1, 3 y 4 fotos con buena señal; un fallo de subida simulado; el recorrido cuando el reporte **pasa a la cola** (aviso «Reporte guardado» y reaparición en Pendientes); sin duplicados. **iPhone/Safari y al menos otro entorno**, como pide el ticket |
| **REP-3828** | Ver I-4 |

Tengo anotado que sin el caso original de Hernán **no se puede confirmar la causa del 520** (REP-3827): la regresión valida las correcciones aplicadas, no la causa.

### I-6 · REP-3829: dictamen de precisión RAG v2.3
Es tu tarea ("En curso"). Necesito saber **sobre qué versión** estás dictaminando, porque está cambiando:
- El **corpus**: preparé un lote 3 (Ordenanza Fiscal de Avellaneda, Ley 1777, Ley 6684 art. 26 y Código de Faltas art. 49) que **todavía no está aplicado**. Cuando se aplique, los resultados de D2, D3 y D4 cambian.
- El **prompt**: hoy en staging es `v4`; hay una `v5` (regla del permiso no aclarado, D5) **escrita y sin medir**.

Mi propuesta: dictaminar sobre el corpus y el prompt **vigentes hoy** y registrar la versión, y que repitamos D2, D3, D4 y D5 después de aplicar el lote 3. Si preferís esperar al lote, decime y coordinamos la fecha.

### I-7 · Sin acción por ahora
REP-2809 y REP-2810 dependen de REP-2800; REP-3831 depende de REP-3535; REP-3832 depende de REP-2801, REP-2902 y REP-2502. Los menciono solo para que sepan que **no los puedo destrabar hasta que Hernán responda H-1 a H-5**.

---

## 4. Lo que ya está listo de mi lado

Ramas subidas a GitHub. Los PR los abro yo a mano; **hasta que estén mergeados a `staging` no hay nada que QA pueda validar en el ambiente**.

| Rama | Contenido | Estado |
|---|---|---|
| `fix/REP-3813-fotos-webp-avif-con-extension-jpg` | Detección del formato real de la foto por sus bytes | Tests y build verdes (914/914). Falta QA |
| `fix/REP-3814-pineyro-confirmar-ubicacion-no-bloquea` | Puntos de Avellaneda corregidos (OpenStreetMap), aviso sin bloqueo, umbral de 4 km para Avellaneda | Tests y build verdes (914/914). Falta QA |
| `fix/REP-3827-diagnostico-error-520-previo-al-alta` | Diagnóstico + cancelar la tanda abandonada + reintento de la subida | Tests y build verdes (927/927). **No probado contra un 520 real** |
| `docs/REP-3828-medicion-cola-verificacion-visual` | Informe de cola/tiempos + guion y scripts de los 15 casos | Esperando quien cargue |
| `feat/RAG-S15-lote3-corpus-D2-D3-D4-codigo-de-faltas` | Lote 3 del corpus + instructivo | **Escrito y probado, NO aplicado**: falta contrastar el texto literal con las páginas oficiales y generar embeddings |
| `feat/RAG-D5-salvedad-cuando-no-se-aclara-el-permiso` | Prompt v5 (regla del permiso no aclarado) | **Sin medir y sin desplegar** |
| `docs/RAG-S15-respuesta-a-hernan` | Respuesta a la entrega del RAG | Para lectura de Hernán |

## 5. Lo que les pido para cerrar esto

1. **Hernán:** respuestas a **H-1, H-2 y H-3** primero (son las que más trabajo desbloquean: REP-2800, REP-2502 y REP-2801), después H-4, H-5 y H-6.
2. **Iván:** el dictamen de **I-1**, el estado de **I-2 y I-3**, y la respuesta de **I-4**.
3. **Los dos:** una **fecha**, para cada punto, en la que pueden responder. No sé cuándo cierra el sprint; con las fechas puedo decirle a Leo qué entra y qué no.
