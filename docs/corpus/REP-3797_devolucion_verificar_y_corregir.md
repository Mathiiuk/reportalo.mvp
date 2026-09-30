# Reportalo

*Plataforma de Auditoría Ciudadana*

## DEVOLUCIÓN AL PEDIDO DE VERIFICACIÓN Y CORRECCIÓN

**Versión 1.0 · 29 de septiembre de 2026 · Construcción · Proyecto RAR-2026**

**Jira:** [REP-3797](https://unlz2026.atlassian.net/browse/REP-3797) · responde a `REP-3797_para-IA-de-Hernan_verificar-y-corregir.md`
**De:** Hernán Gregorini (PO · DBA) · **Para:** Matías Krepchuk (Líder Técnico)

> **Resumen en tres líneas.** Las tres correcciones de la sección A son válidas y están aplicadas. Los tres pedidos de la sección B están hechos, y el B.2 quedó dentro del lote. Los siete puntos de la sección C están verificados contra la fuente oficial, con URL y fecha — y uno de ellos destapó un problema nuevo que hay que corregir. Sobre la sección D, mi evaluación y un interruptor listo para cuando la medición decida.

---

## A. Correcciones: las tres van

| # | Qué decía | Qué queda |
|---|---|---|
| **A.1** | "Son 83 fragmentos con `\r\n`" | **Son 50** (49 vigentes + 1 no vigente). Tenés razón: sólo los de varias líneas tienen salto. Corregido en `REP-3797_respuesta_verificacion_Matias.md` §2, y también el "83 embeddings a regenerar" |
| **A.2** | "El modelo truncó la cita del art. 7" | **No hubo truncado.** La premisa era mía y era falsa: la armé leyendo tu informe, donde la cita estaba abreviada con puntos suspensivos, en lugar de mirar `report_ai_evidence.quoted_text`. Quité la hipótesis y el pedido del §7 punto 4, que queda cerrado. **Conclusión que se mantiene:** la Ley 5902 art. 7 alcanza y el modelo citó bien |
| **A.3** | "¿Se usa `fts`?" | Respondido por vos y anotado: `match_knowledge_fragments` ordena sólo por distancia vectorial y `fts` está sin uso. Queda como el camino más barato para el caso de alumbrado |

Sobre A.2, una cosa que me llevo: pedí "no inventar datos" en la regla de trabajo y después construí una hipótesis sobre un resumen en vez de sobre la base. Es exactamente el error que el documento de trabajo dice evitar.

---

## B. Los tres pedidos, hechos

### B.1 · `ley_210_caba_ente_regulador.md`

Hecho, y con una aclaración que importa: **yo no pisé ese archivo**. El que está en `docs/fuentes/normativas/` tiene fecha 07/09/2026 y es el de referencia de REP-2906; nunca lo edité en esta ronda. Lo que pasó es que **el nombre choca**: cuando la carpeta de fuentes del PO se copia sobre `corpus/normativas/`, la fixture del loader queda tapada por el archivo de referencia. Por eso ya pasó dos veces sin que nadie lo hiciera a propósito.

Lo resuelto:

- La versión de referencia ahora se llama **`ley_210_caba_referencia.md`**. El nombre `ley_210_caba_ente_regulador.md` ya no existe en la carpeta del PO, así que no puede volver a pisar tu fixture.
- Agregué un **`README.md`** en `docs/fuentes/normativas/` que deja escrita la regla: esos `.md` son materia prima para leer y verificar, **no** entrada del loader, y **no se copian** sobre `corpus/normativas/`. La vía de carga es el SQL.

**Lo que necesito de vos:** decime **qué otros nombres son fixtures del loader**. De la ronda de REP-2906 quedaron ocho archivos con nombres que podrían chocar igual — `constitucion_pba_arts_190_192.md`, `LOM_decreto_ley_6769-58_arts_52_59.md`, `ley_24449_arts_48_49.md`, `ley_451_caba_art_6.1.52_y_6.1.37.md`, `ley_2148_caba_arts_7.1.8_7.1.9.md`, `codigo_faltas_decreto_ley_8031-73_indice.md` y dos de Avellaneda. Con la lista los renombro todos de una y cerramos el tema.

*(Nota menor: documentos históricos de REP-2906, REP-2907 y REP-3769 mencionan el nombre viejo. No los reescribí — son el registro de lo que se hizo entonces. El README explica el cambio.)*

### B.2 · Lote 2 inmune al `\r\n`

Hecho, con tu consulta y en transacción propia: **Parte 8 quater**, antes de la verificación. Y agregué la advertencia que pediste, en la cabecera del lote y en el instructivo: los fragmentos cuyo texto cambia ahí **necesitan re-embedding**, no alcanza con generar los faltantes, porque el vector viejo quedó calculado sobre un texto que ya no está en la base.

**W-6** queda en la verificación.

### B.3 · Instructivo

Aclarado en la cabecera del lote 2:

- Corre **después** del lote 1, y las guardas lo exigen.
- **W-5 y W-6 son la condición de cierre**, las dos en cero.
- **W-1** imprime los conteos esperados contra los reales. Actualizados con lo que se agregó en esta ronda: **26 fuentes · 124 fragmentos (120 vigentes) · 159 mapeos**.

---

## C. Verificación contra fuentes oficiales

Todo leído el **29/09/2026** con Firecrawl sobre la página oficial de cada jurisdicción. Donde el texto vino por extracción asistida por modelo lo dice la fila.

| # | Norma | URL | Resultado |
|---|---|---|---|
| 1 | **Ley 24.449 art. 5, incs. h), i) y z)** | https://servicios.infoleg.gob.ar/infolegInternet/anexos/0-4999/818/texact.htm | **Confirmado sobre texto crudo.** "h) Calzada: la zona de la vía destinada sólo a la circulación de vehículos; i) Camino: una vía rural de circulación; […] z) Zona de camino: todo espacio afectado a la vía de circulación y sus instalaciones anexas, comprendido entre las propiedades frentistas;". El fragmento `60000000-…39` coincide y **sostiene el desmapeo** del art. 48 t) de comercio irregular |
| 2 | **Ley 24.449 art. 49 inc. b) apto. 7** | misma URL | **Confirmado sobre texto crudo.** El artículo abre con "ESTACIONAMIENTO. **En zona urbana** deben observarse las reglas siguientes" y el apartado 7 dice "Por un período mayor de cinco días o del lapso que fije la autoridad local;". Sirve para "auto abandonado" en Avellaneda |
| 3 | **Ley 451 art. 1.3.31** | PDF consolidado oficial en el repositorio (`pdf/ley_451_caba_texto_completo.pdf`, descargado 07/09/2026 de https://boletinoficial.buenosaires.gob.ar/normativaba/norma/391197) | **Confirmado.** Texto del hecho y del procedimiento (intimación por diez días hábiles y remolque), con su cadena: Conf. Ley N° 4811/13, BOCBA N° 4329 del 30/01/2014. **Pendiente menor:** la numeración se verificó contra el PDF consolidado de septiembre, no contra la web al día de hoy. Si querés certeza total antes de UAT, lo re-verifico sobre la página |
| 4 | **Decreto-Ley 8751/77 arts. 35 y 4 bis** | https://normas.gba.gob.ar/documentos/DxaMGF4x.html | **Confirmado dos veces, de forma independiente.** La fuente declara "Texto Actualizado según T.O. por Decreto N° 8526/86 y las modificaciones posteriores de las Leyes 10.269, 11.723 y por Decreto 40/07". Y quién incorporó el 4 bis se confirma desde la otra punta: el **art. 78 de la Ley 11.723** dice "Incorpórase al Decreto Ley 8.751/77 T.O. Decreto 8.526/86 los siguientes artículos: 'Artículo 4 bis: …'", con el mismo texto |
| 5 | **Ley 1217, Anexo arts. 2 y 3** | https://boletinoficial.buenosaires.gob.ar/normativaba/norma/50981 | **Confirmado sobre texto crudo del Anexo.** Y con una precisión que conviene no perder: son artículos **del Anexo**, no de la ley. La ley tiene tres artículos y el segundo es el de derogaciones. Las rutas jerárquicas de los fragmentos lo dicen (`anexo-1`, `anexo-2`, `anexo-3`, `anexo-34`) |
| 6 | **Teléfonos y horarios** | https://buenosaires.gob.ar/inicio/telefonos · https://www.mda.gob.ar/gobierno/observatorio-social-de-politicas-publicas/secretaria-de-desarrollo-social/ · https://www.mda.gob.ar/gobierno/observatorio-social-de-politicas-publicas/consejo-de-ninez-adolescencia-y-familia/ · https://tramitesweb.mda.gob.ar/index.php/pasos/3516 | **Confirmado el 29/09/2026** y con `verified_at` de esa fecha en las fuentes. Un dato que corrige lo que se venía diciendo: **el 147 no atiende 24 horas** — es lunes a viernes de 7 a 21 y sábados de 8 a 14, y su función declarada es asesoramiento e información de trámites. El canal de denuncia con número de seguimiento es Gestión Colaborativa. El 103 (emergencias) y el 108 y 102 (sociales) sí son 24 h |
| 7 | **Ley 5902 art. 7, segundo párrafo** | https://boletinoficial.buenosaires.gob.ar/normativaba/norma/392993 | **Confirmado sobre texto crudo**, y el digesto declara la norma **Vigente**, con abrogación de la Ordenanza 33.721 y modificación de la Ley 451. Coincide con lo que está en la base y con la cita del modelo |

**Queda escrito, como pediste:** ni la lectura del equipo técnico ni la mía son validación jurídica externa. Son verificación documental contra la fuente oficial, que es otra cosa.

### C.1 · La verificación destapó algo que hay que corregir

Al leer el texto crudo del art. 49 para el punto 2 apareció esto: **el fragmento ya cargado del inc. b) apartado 3 está cortado**, y la parte que falta cambia el sentido.

Lo que tenemos cargado (fragmento `20000000-…0010`) es sólo la primera oración. El texto vigente sigue —el apartado fue sustituido por el art. 5 de la **Ley 25.965**, B.O. 21/12/2004— y agrega:

> "Tampoco se admite la detención voluntaria. **No obstante se puede autorizar, señal mediante, a estacionar en la parte externa de la vereda cuando su ancho sea mayor a 2,00 metros** y la intensidad de tráfico peatonal así lo permita."

O sea: citando sólo la primera oración, el dictamen afirma una prohibición **más amplia que la de la norma** para el caso "auto sobre la vereda" en Avellaneda, que es uno de los casos que probaste y dio fundamentado. Es el mismo problema de chunking que la Ley 2148, pero con consecuencia jurídica en lugar de sólo de legibilidad.

**El lote 2 lo corrige** (Parte 8 ter): carga el apartado completo y versiona el viejo con `replaces_fragment_id`, sin borrar nada.

---

## D. El riesgo de ranking: mi evaluación

**Coincido con el riesgo, y te dejo el interruptor listo sin accionarlo.**

Mi lectura: los 8 fragmentos de procedimiento son **el peor candidato posible para recuperación semántica**. No porque no valgan —valen, son el respaldo legal del reporte— sino porque son **genéricos por definición**: "toda falta da lugar a una acción pública" no se parece más a un caso que a otro, así que su similitud con cualquier consulta es medianamente alta y medianamente constante. Eso es justo el perfil de un fragmento que entra siempre y no aporta a la respuesta del día. Y ya lo vimos pasar con los canales del municipio en Avellaneda.

Y hay un argumento más fuerte que el ranking: **estos fragmentos tienen que aparecer siempre, no a veces.** Que el respaldo legal del reporte entre o no según la distancia vectorial del día es lo peor de los dos mundos. Su lugar natural es el texto fijo del dictamen por jurisdicción, no el top-k.

Con eso, mi inclinación es la opción **(a)**: desmapearlos y usarlos como texto fijo. Pero **respeto tu criterio de no cambiarlo sin datos**, así que:

- El lote 2 va **con el mapeo puesto**, como estaba.
- La **Parte 11** del lote es el interruptor: un `delete` de esos 8 mapeos, comentado, listo para correr si la medición lo justifica. Con la aclaración de que el art. 4 bis del 8751/77 **no entra** en ese interruptor: ése no es procedimiento, dice qué materias son faltas de especial gravedad y es fundamento de fondo.
- Lo que propongo medir, para que la decisión no sea de gusto: **en cuántos de los 6 lugares recuperados entra un fragmento de procedimiento o de canal, y cuántas veces desplaza a una norma que sí fundamenta el caso.** Si es 1 de 6 y no desplaza nada, se queda. Si entra siempre y empuja afuera una norma de fondo, se corre la Parte 11.

Si el resultado es intermedio, hay una tercera vía que no está en el documento y que quizás sea la mejor: **dejar los fragmentos de procedimiento y de canal fuera del top-k y sumarlos al prompt por separado**, con un cupo propio. Eso requiere código y no lo propongo para este sprint.

---

## E. Lo que no toqué

Tal como pediste: los ids `50000000-…` y `60000000-…`, la idempotencia, el único `delete` y el único `update` del lote original, y las fuentes verbatim. La corrección del `\r\n` se hace en la base y en la ingesta, no en los `.md`.

Con lo agregado en esta ronda, el lote 2 pasó a tener **tres `update`** y **un `delete`**, todos declarados: el `update` del versionado de Ley 2148, el nuevo del versionado del art. 49 b.3, y el de normalización del `\r\n` que pediste en B.2.

---

## F. Lo que queda de cada lado

| Quién | Qué |
|---|---|
| **Matías** | Correr el lote 2 · regenerar embeddings de los 50 fragmentos normalizados y de los nuevos · W-5 y W-6 en cero · 4.1 y 4.2 · la lista de nombres de fixtures del loader (B.1) |
| **Iván** | Repetir los casos de auto abandonado, auto sobre la vereda en Avellaneda, comercio Avellaneda y alumbrado CABA ([REP-3784](https://unlz2026.atlassian.net/browse/REP-3784)) |
| **Los dos** | La medición de la sección D, con el criterio del final de esa sección |
| **Hernán** | La Ordenanza 7180 por vía institucional · la re-verificación del art. 1.3.31 sobre la web si se decide antes de UAT |

---

**Documentos relacionados:** [REP-3797](https://unlz2026.atlassian.net/browse/REP-3797) · [REP-3795](https://unlz2026.atlassian.net/browse/REP-3795) · [REP-3774](https://unlz2026.atlassian.net/browse/REP-3774) · [REP-3784](https://unlz2026.atlassian.net/browse/REP-3784) · [REP-2906](https://unlz2026.atlassian.net/browse/REP-2906)
