# REP-3828 · Guion de los casos controlados de 1, 2 y 4 fotos

**Fecha:** 13/10/2026 · **Lote:** `REP-3828-QA-01` · **Entorno:** staging · **Prepara:** Matías · **Ejecuta:** *(a definir: quien cargue los casos desde la app de staging)*
**Informe asociado:** [`REP-3828_Medicion_cola_y_tiempos_verificacion_visual.md`](REP-3828_Medicion_cola_y_tiempos_verificacion_visual.md)

> **Para qué sirve.** Hoy el histórico de staging tiene 187 reportes de 1 foto, 2 de 2 fotos, 5 de 3 y 1 de 4 (casi todos de pruebas distintas y sin registro de intentos): no alcanza para decir nada sobre el efecto del tamaño del lote. Este guion pide **15 reportes nuevos, todos con el mismo texto, categoría, localidad y fotos**, cargados desde la app, para medir la cola, el despacho y la verificación visual con 1, 2 y 4 fotos. **No lo ejecuté yo**: crea datos en la base de staging compartida y dispara llamadas reales a Gemini, así que lo corre una persona con su cuenta, desde la app.

---

## 1. Qué se mide y qué no

| Se mide | No se mide |
|---|---|
| Espera en la cola hasta el primer intento contra Gemini | El **costo en moneda** (no hay precios verificados; sí se registran tokens por llamada) |
| Ejecución: llamadas a Gemini, reintentos y esperas entre ellos | Conectividad degradada (todo el lote es con conexión normal) |
| Total desde que la evidencia se guarda hasta el último resultado visual | Varias personas enviando a la vez |
| Reintentos, errores y resultado `coincide` / `no_coincide` / `no_concluyente` | Atribución exacta de facturación de Google (se hace por `qa_batch_id`, no desde Billing) |
| **Lo que se ve en pantalla** al enviar (anotado a mano en la planilla de la sección 5) | |

El tramo **previo a guardar la evidencia** (reducción, subida y anonimización en el dispositivo) no tiene marcas de tiempo en el servidor. La planilla pide el **cronómetro de la pantalla** para tener, al menos, una referencia.

## 2. Qué NO tocar (para que los casos sean comparables)

Todo es **igual en los 15 casos**, salvo la cantidad de fotos:

| Dato | Valor |
|---|---|
| Categoría | Ambiente |
| Localidad | Gerli — Avellaneda, Buenos Aires |
| Descripción (copiar tal cual, 90 caracteres) | `Hay bolsas de basura acumuladas en la vereda y en la calle junto al contenedor, hace días.` |
| Dispositivo y navegador | Escritorio, Chrome, ventana de unos 1366 px (como la prueba de Hernán). Mismo equipo para todo el lote |
| Conexión | Normal, sin simular señal débil |
| Pin / ubicación | El mismo punto en todos los casos |

### Fotos (en este orden, siempre las mismas)

Salen de `docs/Entrega_Matias_RAG_Sprint15/fotos/` (las mismas del caso D8 de Hernán, que dio `coincide` en las 4):

| Orden | Archivo | Tamaño original |
|---|---|---|
| 1 | `ejemplos/hacinamientobasura.jpg` | 165.587 bytes |
| 2 | `wikimedia/ambiente/ambi1.jpg` | 481.122 bytes |
| 3 | `wikimedia/ambiente/ambi2.jpg` | 647.136 bytes |
| 4 | `wikimedia/ambiente/ambi3.jpg` | 439.331 bytes |

- Caso de **1 foto**: la 1.
- Caso de **2 fotos**: la 1 y la 2.
- Caso de **4 fotos**: la 1, 2, 3 y 4 (en ese orden).

## 3. Los 15 casos

| Bloque | Fotos | Casos | Resultado esperado (fijado antes de cargar) |
|---|---|---|---|
| A | 1 | `S1-01` a `S1-05` | `coincide`, análisis `completado`, sin reintentos |
| B | 2 | `S2-01` a `S2-05` | `coincide` en ambas fotos, `completado` |
| C | 4 | `S4-01` a `S4-05` | `coincide` en las 4 fotos, `completado` |

**Orden de carga (intercalado, para que la hora del día y el estado del servicio no se asocien a un tamaño):**
`S1-01, S2-01, S4-01, S1-02, S2-02, S4-02, S1-03, S2-03, S4-03, S1-04, S2-04, S4-04, S1-05, S2-05, S4-05`.

**Reglas de la carga:**
1. **De a uno**: esperar a ver el resultado en pantalla (aviso o «Reporte enviado») antes de cargar el siguiente.
2. **Anotar el momento** (hora local con segundos) en que se toca el botón de envío, y qué pantalla aparece (sección 5).
3. **Separar los envíos unos 20 a 40 segundos** entre sí. El despacho corre una vez por minuto, así que conviene que los casos caigan en momentos distintos del minuto.
4. **No repetir ni reenviar** un caso fallido: anotarlo como está. Un caso que falla es un dato.
5. **Si alguien más usa staging mientras tanto**, avisarlo en las notas (no invalida los casos, pero hay que saberlo).
6. Opcional pero recomendable: **grabar la pantalla** de todo el lote.

## 4. Antes de empezar

1. **Identificar la versión de staging** que se está probando (commit y hora de despliegue) y anotarla en la sección 5. Importa: la rama de REP-3827 cambia el tramo previo al alta (reintento de subida y cancelación de la tanda abandonada); según esté o no desplegada, los 4 fotos pueden comportarse distinto. **Medir con la versión que esté y decir cuál era.**
2. Confirmar que el despacho visual está activo (`visual-analysis-dispatch` cada minuto) y que la cola está vacía. Lo verifico yo con la consulta 4 del script antes del lote.
3. Acordar quién carga y con qué cuenta de staging.

## 5. Planilla (la completa quien carga)

| Caso | Hora de envío (local, con segundos) | Pantalla que apareció | Cronómetro hasta esa pantalla (s) | Código `#RP-XXXXXXXX` | Notas (errores, avisos, cola) |
|---|---|---|---|---|---|
| S1-01 | | | | | |
| S2-01 | | | | | |
| S4-01 | | | | | |
| S1-02 | | | | | |
| S2-02 | | | | | |
| S4-02 | | | | | |
| S1-03 | | | | | |
| S2-03 | | | | | |
| S4-03 | | | | | |
| S1-04 | | | | | |
| S2-04 | | | | | |
| S4-04 | | | | | |
| S1-05 | | | | | |
| S2-05 | | | | | |
| S4-05 | | | | | |

- **Pantalla que apareció**: «Reporte enviado», o «Reporte guardado» y vuelta al mapa (el reporte pasó a la cola), o un error. Esto importa: con 4 fotos el procesamiento puede pasar de los 45 s y el reporte va a la cola (ver REP-3827).
- El código `#RP-XXXXXXXX` figura en la pantalla de éxito. Si el reporte fue por la cola, el código se ve después en «Mis reportes»; anotarlo apenas aparezca.
- **Versión de staging probada:** *(commit / deploy)* · **Cuenta:** *(cuál)* · **Equipo y navegador:** *(cuáles)*.

## 6. Después de cargar (lo hace Matías)

1. Con la planilla, correr el **PASO 1** de [`scripts/rep3828/registrar_lote_qa.sql`](../scripts/rep3828/registrar_lote_qa.sql) (solo lectura) para comprobar que cada código identifica un reporte con la cantidad de fotos correcta.
2. Correr el **PASO 2** (escribe 15 filas en `visual_qa_cases`). El resultado esperado ya está fijado en este guion: **no se completa mirando lo que devolvió el modelo**.
3. Esperar a que terminen los análisis (hasta ~2 minutos después del último envío).
4. Correr la **consulta 5** de [`scripts/rep3828/medicion_cola_visual.sql`](../scripts/rep3828/medicion_cola_visual.sql): una fila por caso, con ventanas en UTC (y ART al convertir), espera de cola, ejecución, total, intentos, fallidos, tokens, modelo, esperado frente a resultado.
5. Pasar los resultados al informe de REP-3828: tabla por tamaño de lote con los 15 IDs, y **recomendación cuantificada** (mantener u optimizar el despacho).

## 7. Qué tiene que revisar QA (Iván)

Criterio del ticket: *«QA valida que el funcionamiento con varias fotos no rompe envío ni altera fundamento/estado/categoría»*.

1. **El envío no se rompe**: los 15 casos llegan a quedar como reporte (con la cantidad de fotos que se cargó), sin errores ni duplicados.
2. **La categoría no se altera**: todos los reportes quedan en Ambiente.
3. **El estado del reporte no se altera**: todos con el mismo estado inicial.
4. **El fundamento jurídico no cambia con la cantidad de fotos**: comparar el fundamento de los casos de 1, 2 y 4 fotos. El texto es idéntico en todos, así que cualquier diferencia debería explicarse por la variación propia del modelo y no por las fotos. **Ojo**: Hernán ya midió variación del fundamento con la misma entrada (D1), así que una diferencia aislada no prueba que las fotos influyan; hay que mirar si hay un patrón por tamaño.
5. **Dictamen APROBADO / RECHAZADO** con fecha, versión de staging y evidencia.

## 8. Costo de correr el lote

Estimación con los promedios medidos en staging (no es un precio):

| Concepto | Cantidad |
|---|---|
| Fotos analizadas | 5 × (1 + 2 + 4) = **35** llamadas a Gemini, más reintentos (hoy ~4 % de los intentos fallan) |
| Tokens de entrada por foto | ~1.580 (promedio medido) → **~55.000** en total |
| Tokens de salida por foto | ~120 (promedio medido, incluye razonamiento) → **~4.200** en total |
| Análisis jurídico (RAG textual) | 15, de ~2.100 tokens de entrada y ~350 de salida cada uno |

## 9. Si algo sale distinto de lo previsto

- **Un caso queda en cola** (aviso «Reporte guardado»): anotarlo, no reenviar, y esperar a que se envíe solo. Es un dato del propio lote.
- **Un reporte no aparece** o aparece duplicado: avisar, no corregir a mano.
- **El análisis visual tarda más de ~3 minutos** o queda `fallido`: es un hallazgo; anotarlo con la hora.
