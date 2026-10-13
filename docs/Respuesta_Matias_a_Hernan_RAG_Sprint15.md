# Respuesta de Matías a Hernán · RAG del Sprint 15

**Fecha:** 13/10/2026 · **De:** Matías Krepchuk · **Para:** Hernán Gregorini (PO) · **Con copia a:** Leonel Nuñez
**Base:** tu entrega `Entrega_Matias_RAG_Sprint15` (00_LEEME del 08/10/2026, casos, informes y propuesta de corpus).

> **Para leer primero.** Esta respuesta separa lo que **está hecho y verificado**, lo que **está hecho pero sin aplicar o sin medir**, y lo que **todavía no se hizo**. Todos los números salen de consultas de solo lectura a la base de staging del 13/10/2026 o del código del repositorio. Donde no pude comprobar algo, lo digo. Los reportes de prueba de tu cuenta están incluidos en los conteos.

---

## 1. Estado de tus 10 pedidos (sección 10 de tu LEEME)

| # | Pedido | Estado | Dónde |
|---|---|---|---|
| 1 | Generar y aplicar el lote de corpus (con la Ley 6.851 para el art. 26), correr embeddings y verificar que no queden fragmentos sin vector | **Lote escrito y probado, NO aplicado.** Embeddings: no corridos | Sección 2 |
| 2 | Despublicar el índice del Código de Faltas y cargar el art. 49 completo | **Escrito dentro del mismo lote, NO aplicado** | Sección 2 |
| 3 | Cambiar la línea del prompt para D5 y medir con 10 corridas | **Línea escrita (prompt v5). NO medida y NO desplegada** | Sección 3 |
| 4 | Medir D2, D3 y D4 con redacción coloquial, técnica y jurídica | **No hecho.** Depende de aplicar el lote y de los embeddings | Sección 9 |
| 5 | Medir la repetibilidad con más corridas | **No hecho** | Sección 9 |
| 6 | Entregar 10 a 15 textos reales para tu revisión jurídica | **No hecho** | Sección 9 |
| 7 | Revisar D7 (520) y D8 (4 fotos) | **Parcial:** código revisado y datos de D8 cruzados con la base. D7 no reproducido | Secciones 4 y 5 |
| 8 | Temperatura o semilla de los modelos | **Respondido** | Sección 7 |
| 9 | Costo por foto y por reporte (tokens y latencia) | **Tokens y latencia medidos. Costo en moneda NO calculado** | Sección 8 |
| 10 | ¿Filtro de contenido? ¿Cubre patentes? | **Respondido. Hay una contradicción en la FAQ que necesito que veas** | Sección 6 |

Las ramas con el trabajo están subidas a GitHub, pendientes de PR y de revisión:

- `feat/RAG-S15-lote3-corpus-D2-D3-D4-codigo-de-faltas` (lote de corpus e instructivo)
- `feat/RAG-D5-salvedad-cuando-no-se-aclara-el-permiso` (prompt v5)

---

## 2. Pedidos 1 y 2 · Lote 3 del corpus

### 2.1 Qué contiene

Archivos: `docs/corpus/RAG-S15_lote3_corpus.sql` y `docs/corpus/RAG-S15_lote3_INSTRUCTIVO.md`. Sigue el mismo método de los lotes 1 y 2 de REP-3797: ids deterministas, `ON CONFLICT DO NOTHING`, transacciones separadas, guardas al inicio, sin `ALTER`, `DROP` ni `DELETE`, y reversión incluida.

| Fuente nueva | Ámbito | Fragmentos | Mapeo a categoría |
|---|---|---|---|
| Ordenanza Fiscal 31321 (Avellaneda, 27/11/2025, ejercicio 2026) | Partido de Avellaneda | Arts. 132, 231, 233, 235 | 132 → INFRAESTRUCTURA · 231, 233, 235 → COMERCIO_IRREGULAR |
| Ley 1777 (CABA) | CABA | Arts. 10 y 11 | 10 → INFRAESTRUCTURA · 11 → INFRAESTRUCTURA y COMERCIO_IRREGULAR |
| Ley 6684 (CABA), texto sustituido por la Ley 6.851 | CABA | Art. 26 (20 incisos, 3.543 caracteres) | INFRAESTRUCTURA y COMERCIO_IRREGULAR |
| Decreto-Ley 8031/73 (fuente que ya existía) | Provincia de Buenos Aires | Art. 49 (incisos a a d) | INFRAESTRUCTURA |

- Un fragmento es un artículo completo, con su encabezado, como pediste. El texto sale de tu archivo de propuesta por script, sin retranscribir.
- Se agrega `ordenanza` al catálogo `document_types`, porque no existía.
- Se **despublica** el fragmento del índice del Código de Faltas (`2000…0015`) con `is_current = false`. No se borra. Antes de preparar el lote comprobé que **ningún análisis lo citó** (0 filas en `report_ai_evidence`).
- Conteos esperados al aplicar: fuentes 26 → 29 · fragmentos 124 → 132 (120 → 127 vigentes) · mapeos a categoría 159 → 169. Hoy la base está en 26 / 124 / 159, es decir, el lote 3 no está cargado.

### 2.2 Qué verifiqué y qué no

| Verificación | Resultado |
|---|---|
| Guardas del lote contra la base real de staging (solo lectura) | **Pasan**: lote 2 aplicado, fuente y fragmento del Código de Faltas presentes, servicios y tipos de fundamento presentes, partido de Avellaneda presente, nada del lote 3 cargado |
| Corrida del lote en un Postgres local con un esquema equivalente | **Limpia**: 8 fragmentos y 10 mapeos; una segunda corrida no duplica nada |
| Higiene del texto | Sin retornos de carro; art. 26 con 20 incisos; art. 49 con incisos a a d; arts. 233 y 235 con 5 párrafos cada uno; art. 231 con incisos a a g |
| Estructura contra la página oficial | **Contrastada por contenido, no literal.** Coincide el número y la fecha de la Ordenanza 31321 (27/11/2025, ejercicio 2026), el contenido y el artículo siguiente de los arts. 132, 231, 233 y 235, los arts. 10 y 11 de la Ley 1777 (texto actualizado al 29/02/2024), los 20 incisos del art. 26 según la Ley 6.851 y los cuatro incisos del art. 49 con la marca `(Dec-Ley 9321/79)` |
| **Texto literal contra la página oficial** | **NO verificado.** La herramienta de lectura que usé no devuelve el texto textual completo. Sigue siendo extracción asistida por IA, igual que en tu propuesta. Lo voy a contrastar a mano antes de aplicar |
| Modificatorias de la Ordenanza Fiscal posteriores al boletín 117º | **NO verificado.** Es el pendiente que ya marcaste vos |

### 2.3 Decisiones que tomé y que necesito que confirmes

| Punto | Lo que hice | Por qué / alternativa |
|---|---|---|
| Tipo de fundamento de la Ordenanza Fiscal | Art. 132 `competencia`; arts. 231 y 233 `obligacion`; art. 235 `sancion` | No fijaste el tipo. El catálogo solo admite `obligacion`, `conducta_prohibida`, `sancion` y `competencia`. Elegí `competencia` para el 132 para no afirmar una obligación que la ordenanza no dice con esas palabras (tu advertencia de alcance) |
| Ley 6684 art. 26 y AMBIENTE | **No** lo mapeé a AMBIENTE | Escribiste "si se quiere" por el inciso 16. Si querés, es una línea en la PARTE 3 |
| Título del art. 235 | "renovación de permisos, revocación y ocupación sin permiso" | Tu propuesta lo titula "Ocupación sin permiso", pero en la página oficial el artículo trata de renovación y revocación, y la ocupación sin permiso aparece en su 4.º párrafo. Un título corto induce a citarlo mal |
| Art. 26 como un solo fragmento | Un fragmento de 20 incisos, como pediste | Tu propuesta advierte que un fragmento largo puede recuperarse mal. Se mide en D4 y D5; si no recupera bien, se puede partir por inciso |

### 2.4 Lo que el lote no cubre

- La Ordenanza 7180 (Código de Faltas de Avellaneda) sigue sin articulado en línea: **el dictamen no debe citar montos ni multas de Avellaneda**.
- No se localizó la definición de "vía secundaria" (Ley 1777 art. 10 inc. a).
- El art. 49 del Código de Faltas es la conducta de quien cava o apaga el alumbrado. No fundamenta "la luminaria está apagada". Por eso quedó mapeado solo a INFRAESTRUCTURA, no a comercio ni a vulnerabilidad social.

### 2.5 Cómo se aplica (lo hago yo)

1. Contrastar el texto literal con las páginas oficiales.
2. Respaldo previo, igual que en `REP-3797_respaldo_pre-lote2_29-09-2026.md`.
3. Correr el lote en staging.
4. Correr el paso de embeddings (`scripts/corpus-loader/embed-pending.mjs`).
5. Verificar con las consultas del final del lote: conteos 29 / 132 / 127 / 169, ningún fragmento vigente sin categoría, ninguno sin vector, y 0 retornos de carro.
6. Recién ahí medir. Antes del paso 4 el RAG responde igual que hoy.

---

## 3. Pedido 3 · D5 con la opción A

### 3.1 Qué cambié

En `supabase/functions/analizar-reporte/index.ts` agregué **una regla** a las instrucciones y subí `PROMPT_VERSION` de `v4` a `v5`. El texto de la regla:

> Si el fragmento que citás prohíbe o exige contar con un permiso, habilitación o autorización previa para una conducta, y el reclamo describe esa conducta pero no aclara si el permiso existe, no declares "indeterminado" solo por eso: declará "fundamentado", citá la norma y aclará en fundamento_ciudadano y en fundamento_oficial que la norma aplica si no cuentan con el permiso y que corresponde que el organismo lo verifique. Si el reclamo dice que el permiso existe, o describe otra conducta, no uses esta regla.

- Es la misma lógica de la regla de excepciones de la v3.
- Mantiene la regla de base: solo se fundamenta con el contenido literal de los fragmentos y sin montos ni sanciones al ciudadano.
- Tomé tu texto sugerido para la salvedad como guía, pero no lo copié literal. Lo definimos nosotros, como dijiste.
- Ajusté 3 tests existentes que suponían 8 reglas y que la de excepciones era la última, y agregué 4 tests de la regla nueva. La suite completa pasa (914 de 914) y el build compila.

### 3.2 Qué NO está hecho

- **No está medida.** No tengo en esta sesión la clave de Gemini ni la clave de servicio, así que no corrí las 10 corridas.
- **No está desplegada.**
- Tu criterio de medición queda como está: al menos 9 de 10 corridas con el estado elegido, sin romper los casos donde `indeterminado` es correcto, y con las mismas citas. Casos que no deben cambiar: D4 (baches en CABA), cualquier reclamo sin conducta ni norma aplicable, y Vulnerabilidad social.

### 3.3 Cómo se mide

Con el diagnóstico de generación que ya existe, que lee el prompt directo del fuente:

```bash
node scripts/rag-local-dev/rep-diag-generacion/run.mjs --caso D5-CABA-1 --corridas 10
node scripts/rag-local-dev/rep-diag-generacion/run.mjs --caso D4-CABA-INFRA --corridas 10
```

- `D5-CABA-1` es "venden en la calle" en CABA, y `D4-CABA-INFRA` es el control de baches en CABA. Ambos ya están en `casos.json` como casos **exploratorios**; no son tus reportes `B2-34` ni `a07`.
- Hay que correrlos sobre **v4 y sobre v5** para comparar.
- El D5 de CABA se puede medir **sin** el lote 3, porque sus normas (Ley 1166 11.1.2, Ley 451 4.1.2, Ley 6101 art. 8) ya están cargadas con embedding. El equivalente en Avellaneda (`B1-23`, `B2-46`) necesita el lote 3 aplicado.

---

## 4. Pedido 7 · D7 (el envío con error 520)

**No pude reproducir D7 ni identificar la causa.** Lo que sí sé:

- **El código no reintenta.** `uploadToQuarantine` (`src/services/quarantinePipelineService.js`) sube la foto con **un único intento**. Si el almacenamiento devuelve un error, o la llamada lanza una excepción, devuelve `success: false` y no vuelve a intentar.
- **Qué ve el ciudadano si eso pasa:** el motivo `upload_failed` se muestra como "No pudimos subir la foto. Revisá tu conexión y probá de nuevo", con la opción de cambiar la foto, reintentar la protección y guardar para enviar cuando haya señal. Esto sale de leer el código (el motivo `upload_failed` se asigna cuando falla la subida); **no lo vi en pantalla con un 520 real**.
- **Respuesta corta a tu pregunta "¿se reintenta ante un 520? ¿se avisa?":** no se reintenta automáticamente; el aviso existe pero habla de la conexión, no de un error del servicio.
- **Tu prueba:** según tu CSV, el envío `B1-22` ("Puestos de venta ambulante…", Avellaneda, Comercio irregular, móvil emulado de 390 px) no creó el reporte, y tu script esperó 120 segundos sin mirar la pantalla. Por eso no sabemos qué vio el ciudadano. No busqué ese envío en la base.
- **Los logs del 07/10:** no los consulté; hay que ver si el plan de Supabase todavía los conserva.

**Qué necesito para avanzar con D7 (REP-3827):** la hora exacta en UTC del `Failed to load resource: 520` si quedó en la consola, la URL completa del recurso que falló, y si podés repetir la tanda `B1-18` a `B2-27` con la consola y la pestaña de red abiertas guardando el HAR. Mientras no esté confirmada la causa, no voy a agregar un reintento a ciegas.

---

## 5. Pedido 7 · D8 (4 fotos sin confirmación en 120 s)

Cruce de tu reporte `#RP-3091E5F5` con la base (`3091e5f5-7d49-4206-9498-e3209ba11a1f`). Todas las horas son **UTC del 07/10/2026**, no del 08/10 como figura en el encabezado de tu documento:

| Dato | Valor |
|---|---|
| Hora en que el reporte figura creado en la base | 21:26:14 |
| Fotos guardadas | 21:26:15.4 · 21:26:15.6 · 21:26:15.8 · 21:26:16.0 |
| Resultados visuales guardados | 21:27:04.2 · 21:27:04.8 · 21:27:05.7 · 21:27:06.1 |
| Duración de cada llamada al modelo | 2,8 s · 3,4 s · 3,1 s · 4,7 s |
| Resultado de las 4 | `completado` · `coincide` |
| Reportes vecinos de tu tanda | B9-71 a las 21:22:02 · B9-73 a las 21:23:00 · B9-74 a las 21:26:13 · B9-75 a las 21:26:48 |

Lo que se puede afirmar:

1. **La verificación visual no es la causa.** Corre después de enviar. Las 4 llamadas salieron juntas, respondieron bien y sin reintentos. Los resultados llegaron unos 50 s después de guardar las fotos porque el despacho corre por cron cada minuto (ver sección 8).
2. **El reporte quedó creado en la base a las 21:26:14**, y tu CSV ubica el envío entre las 21:22:02 y las 21:23:00. Es decir, el alta apareció **más de 3 minutos después** de la ventana de tu tanda, mientras los reportes vecinos se crearon con diferencias de segundos a pocos minutos. Es un indicio a favor de tu hipótesis (la reducción y anonimización de 4 fotos tarda mucho **antes** del alta), pero **no es una medición**.
3. Lo que **falta** es medir el tramo previo al alta (reducción, subida y anonimización por foto) con 1, 2 y 4 fotos, con marcas de tiempo tomadas en el dispositivo. Hoy el backend no registra ese tramo. Está en el alcance de REP-3827.

---

## 6. Pedido 10 · Filtro de contenido y patentes

### 6.1 Filtro de contenido

**No hay filtro de contenido.** El pedido a Google Vision (`supabase/functions/quarantine-anonymize/vision.ts`) solicita únicamente `FACE_DETECTION` y, solo si se pixelan patentes, también `OBJECT_LOCALIZATION` y `TEXT_DETECTION`. No se pide `SAFE_SEARCH_DETECTION`, que es la función de Vision para desnudos y violencia. Que Vision la ofrezca como producto es información general del proveedor; **no la confirmé en la documentación en esta sesión**. Sumarla sería un cambio nuevo: una función más en el pedido y una decisión sobre qué hacer con una foto marcada.

### 6.2 Patentes: hay una contradicción que tenés que ver

- **La anonimización NO cubre patentes hoy.** En `vision.ts`, `PIXELATE_LICENSE_PLATES = false`, por una decisión de producto del 30/09/2026 registrada en el código: la foto queda con la patente visible porque la evidencia pierde valor sin ella, y las fotos solo las ve el dueño del reporte. La detección de patentes está implementada y probada; se reactiva cambiando esa constante.
- Los **términos y condiciones** (`termsService.js`) lo dicen bien: el difuminado se aplica únicamente sobre los rostros y las patentes pueden verse.
- **La FAQ lo promete mal.** `src/content/faqContent.js`, línea 53: "…cada foto se procesa para **difuminar rostros y patentes** y eliminar los datos ocultos de la imagen…". Eso contradice el código y los términos. Como la revisión de contenido de la FAQ es tuya, necesito que decidas entre dos caminos: **(a)** corregir la FAQ para decir "rostros", o **(b)** reactivar el difuminado de patentes, con su costo de CPU y la pérdida de valor de la evidencia. Hasta que se decida, la FAQ es incorrecta.
- Además, el aviso del paso de descripción ("No incluyas nombres, teléfonos, documentos, patentes ni direcciones exactas") ya es coherente con que las patentes en la foto no se tapan.

---

## 7. Pedido 8 · Temperatura y semilla

Valores leídos del código del repositorio (rama de staging):

| Etapa | Modelo | Temperatura | Razonamiento | Salida máxima | Semilla |
|---|---|---|---|---|---|
| Generación jurídica (`analizar-reporte`) | `gemini-3.8-flash` | **0** (`GENERATION_TEMPERATURE`) | `thinkingLevel: low` | 2.048 tokens | **No se fija** |
| Embeddings | `gemini-embedding-2@768` | No aplica | No aplica | No aplica | No aplica |
| Verificación visual (`analizar-imagen-reporte`) | `gemini-3.8-flash`, con respaldo `gemini-3.7-flash` y `gemini-3.5-flash-lite` | **No se fija: usa el valor por defecto de la API** | `thinkingLevel: low` | 1.024 tokens | **No se fija** |

Lo que esto permite decir, y lo que no:

- **D1** (normas distintas con la misma entrada): la generación ya corre a temperatura 0. Entonces la variación que viste no se explica por la temperatura de esa etapa. La explicación pendiente es la que ya están investigando los diagnósticos de repetibilidad (qué se recupera frente a qué decide el modelo). No lo puedo dar por demostrado.
- **D6** (categoría sugerida distinta ante la misma foto ambigua): la verificación visual no fija temperatura, por lo que es **plausible** que el valor por defecto de la API contribuya a la variación. Es una hipótesis que se puede probar fijando la temperatura y repitiendo; **no la probé**.

---

## 8. Pedido 9 · Tokens, latencia y cola

Datos de la base de staging al 13/10/2026. **Incluyen los reportes de prueba** de tu cuenta, los del equipo y las corridas de QA; no son tráfico de ciudadanos. **No calculé costo en pesos ni en dólares**, porque no tengo verificada una tabla de precios vigente de los modelos.

### 8.1 Verificación visual (una llamada por foto)

| Dato | Valor |
|---|---|
| Resultados guardados con `gemini-3.8-flash` | 196 (todos con tokens registrados) |
| Tokens de entrada por foto | promedio 1.579 (mínimo 1.539, máximo 1.639) |
| Tokens de salida por foto (incluye razonamiento) | promedio 121 (mínimo 76, máximo 830) |
| Resultados con otro modelo | 1, con `gemini-3.7-flash` |
| Resultados sin modelo ni tokens registrados | 13: son los que no terminaron en `completado` (fallidos u omitidos) |
| Intentos registrados contra el proveedor | 48: 46 correctos (promedio 3,4 s, máximo 9,8 s), 1 timeout de 20 s y 1 error HTTP |
| Fotos por reporte en lo analizado | 187 reportes de 1 foto · 2 de 2 fotos · 5 de 3 fotos · 1 de 4 fotos |

### 8.2 Generación jurídica (una llamada por reporte)

| Versión del prompt | Análisis | Entrada promedio (mín. a máx.) | Salida promedio (mín. a máx.) |
|---|---|---|---|
| v1 | 55 | 870 (431 a 1.243) | 275 (104 a 538) |
| v2 | 72 | 1.669 (1.309 a 2.097) | 366 (138 a 711) |
| v3 | 206 | 2.108 (1.736 a 2.697) | 404 (114 a 849) |
| v4 | 43 | 2.093 (1.781 a 2.766) | 349 (127 a 563) |

La latencia de la generación solo se registra desde la v4: **promedio 4,6 s, máximo 8,5 s** (43 análisis). Hay además 34 análisis sin versión, modelo ni tokens, con latencia promedio de 0,1 s (156 ms como máximo); no tienen modelo registrado y no los incluyo en los promedios.

### 8.3 Dónde se va el tiempo (REP-3828)

El tiempo que ve el ciudadano hasta el resultado visual **no está en Gemini sino en el cron de despacho**, que corre **una vez por minuto**:

| Fotos del reporte | Reportes | Total hasta el último resultado, desde que se guarda la evidencia |
|---|---|---|
| 1 | 187 | mediana 35,2 s |
| 2 | 2 | promedio 57,9 s (máximo 63,5 s) |
| 3 | 5 | promedio 24,5 s (máximo 58,7 s) |
| 4 | 1 | 49,5 s |

Con registro de intentos (38 reportes de 1 foto): la espera hasta la primera llamada promedia 28,6 s y llega a 60,1 s; la ejecución promedia 3,6 s. La muestra de 2, 3 y 4 fotos es muy chica para concluir algo sobre el tamaño del lote. El informe completo, con el desglose del reporte baseline de 3 fotos (≈27 s de cron, ≈20 s de un timeout de Gemini y ≈5 s de la llamada que respondió), está en `docs/REP-3828_Medicion_cola_y_tiempos_verificacion_visual.md` (rama `docs/REP-3828-medicion-cola-verificacion-visual`).

---

## 9. Lo que todavía no está hecho

| Pedido | Qué falta | Qué lo bloquea |
|---|---|---|
| 1, 2 | Contrastar el texto literal, aplicar el lote y generar embeddings | Mi tiempo de contraste y la clave de Gemini para los embeddings. No lo apliqué sin contrastar el texto |
| 3 | Medir v5 contra v4 con 10 corridas | Clave de Gemini y clave de servicio |
| 4 | Medir D2, D3 y D4 con tres redacciones (coloquial, técnica y jurídica) | Aplicar antes el lote y los embeddings. Además hay que definir esas redacciones: hoy los casos exploratorios no las tienen |
| 5 | Repetibilidad con más corridas | Misma clave; y el número no será comparable con tu 87,5 % salvo que usemos el mismo diseño de la batería |
| 6 | 10 a 15 textos reales para tu revisión jurídica (O-4) | Armar la muestra. La que sugeriste (tabla de la sección 8 de tu LEEME) está lista para usarse tal cual |
| 7 | D7 reproducido, y medición del tramo previo al alta para D8 | Datos tuyos para D7 (sección 4) |

## 10. Lo que necesito de vos

1. **FAQ y patentes:** decidir si se corrige el texto o se reactiva el difuminado (sección 6.2).
2. **Confirmar o corregir** las decisiones de la sección 2.3 (tipos de fundamento de la Ordenanza Fiscal, AMBIENTE en el art. 26, título del art. 235).
3. **Boletines de Avellaneda posteriores al 117º:** esa última mirada por si hay modificatorias de la Ordenanza Fiscal, que dijiste que quedaba pendiente.
4. **Datos para D7** (sección 4): la hora y URL del 520, y repetir la tanda con consola y red abiertas.
5. **Aceptar o ajustar** la redacción de la regla del permiso (sección 3.1) antes de que la mida.
6. **Decidir si el filtro de contenido** (sección 6.1) entra como tarea nueva.

## 11. Correcciones menores a tu entrega, por si ayudan

- Los reportes de las pruebas están creados el **07/10/2026**, no el 08/10: el 08/10 es la fecha de tu documento. Importa al buscar logs.
- El reporte `#RP-3091E5F5` (D8) aparece en tu CSV con una ventana de hora ("entre 21:22:02 y 21:23:00"), y en la base figura creado a las 21:26:14 UTC (sección 5).
- Tu nota de D10 ("hasta 4 fotos" frente a "2 o 3") coincide con el código: el límite de fotos es 4 en la captura y en la carga de escritorio (`MAX_PHOTOS = 4`).
