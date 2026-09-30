# Reportalo

*Plataforma de Auditoría Ciudadana*

## RESPUESTA A LA VERIFICACIÓN POST-CORPUS — DECISIONES DEL PO Y LOTE COMPLEMENTARIO

**Versión 1.0 · 29 de septiembre de 2026 · Construcción · Proyecto RAR-2026**

**Jira:** [REP-3797](https://unlz2026.atlassian.net/browse/REP-3797) · responde a la verificación de [REP-3795](https://unlz2026.atlassian.net/browse/REP-3795) del 29/09/2026
**De:** Hernán Gregorini (PO · DBA) · **Para:** Matías Krepchuk (Líder Técnico) · con copia a Leonel (PM) e Iván (QA)
**Confluence:** espacio `Reportalo` — pendiente de publicar

> **Lo primero: la verificación sirvió.** De los nueve hallazgos, cinco tienen respuesta cerrada con norma en mano, dos son de código y quedan aprobados, uno es una decisión de producto que tomo acá, y uno **me obligó a revertir una decisión propia del lote anterior**. Nada de eso se habría visto sin correr los 28 reportes.

---

## 1. Los números cierran

| Lo que reportaste | Contra lo diseñado |
|---|---|
| 20 fuentes | Correcto |
| 83 fragmentos vigentes | Correcto: son 84 en total, y uno está en `is_current = false` — el original del inciso t) del art. 48 de la Ley 24.449, superado en el Sprint 13 por sus dos reemplazos |
| 89 mapeos | Correcto |
| 84 embeddings, 0 fragmentos sin embedding | Correcto: hay un vector por fragmento, incluido el no vigente |
| 0 fuentes sin URL ni fecha | Correcto |

No hace falta revisar nada de la carga.

---

## 2. El `\r\n`: no es una hipótesis, y no es sólo del validador

Lo verifiqué de mi lado, y el dato cambia el diagnóstico:

- El archivo `.sql` del lote 1 tiene **cero CRLF**. Tiene 40 literales multilínea y todos usan `\n` limpio.
- Los 23 archivos `.md` de fuentes tienen **cero CRLF**.

Entonces los `\r` **se introdujeron en el camino de carga**, no en las fuentes: el editor con el que se ejecutó, `psql` en Windows, o el propio loader al leer los archivos.

**Por qué esto importa más de lo que parece.** Si el texto guardado tiene `\r\n` y la fuente oficial no, el fragmento ya dejó de ser copia literal de la norma. Eso es integridad del corpus, no una molestia del validador: lo único que hace citable a este corpus es que el texto coincida con el texto oficial. Normalizar sólo en la comparación deja el dato desalineado para siempre y nos quedamos sin forma de detectarlo.

**Orden que propongo, y es el inverso al del punto 4.2 de tu informe:**

1. **4.1 primero** — el logging, que además es lo que permite confirmarlo sin gastar llamadas a Gemini.
2. **Normalizar el dato en la base**: quitar `\r` de `knowledge_fragments.content` y **regenerar los embeddings de los fragmentos afectados**. Son **50** (49 vigentes + 1 no vigente), no 83 — la cifra corregida es de Matías: sólo los fragmentos de varias líneas tienen salto de línea, los de una sola no están afectados. El costo es despreciable y el vector queda calculado sobre el texto correcto. **El lote 2 ya trae esta normalización** (Parte 8 quater), así que el paso que queda de tu lado es el re-embedding de esos 50.
3. **Normalizar en la ingesta**, para que no vuelva a entrar.
4. **Recién entonces la normalización en el validador**, como cinturón de seguridad y no como arreglo. De acuerdo con tu criterio de que siga exigiendo texto literal: si además probás que rechaza una cita parafraseada, mejor.

El lote 2 trae una consulta de control (**W-6**) que cuenta fragmentos con retorno de carro. Después del paso 2 debe devolver cero, y conviene dejarla en el chequeo de cada carga.

---

## 3. Las decisiones de contenido

### 3.1 · Ley 5902 art. 7 para "vereda rota por raíces" — la cita es correcta; el recorte, no

El artículo **sí alcanza**, y de forma expresa. Su segundo párrafo dice, textual:

> "Si la vereda resultare destruida, parcial o totalmente, como consecuencia de obras ejecutadas por el Gobierno de la Ciudad Autónoma de Buenos Aires, por sí o por terceros, **o por raíces de árboles**, la reparación o reconstrucción corre por cuenta y cargo de aquél."

**Corregido el 29/09/2026:** en la primera versión de este documento supuse que el modelo había truncado la cita. **No hubo truncado.** Lo que estaba abreviado con puntos suspensivos era el informe técnico; la cita real guardada en `report_ai_evidence.quoted_text` trae el párrafo completo, incluidas las palabras "o por raíces de árboles". La premisa era mía y era falsa: la armé leyendo el informe en lugar de la base.

Queda entonces cerrado sin trabajo pendiente: **el modelo citó bien y la norma es la correcta.** Y se cae la sospecha de que el truncado fuera una causa de rechazos del validador.

**Conclusión práctica:** el caso "vereda rota por raíces de un árbol" en CABA se funda en la Ley 5902 art. 7, segundo párrafo, y el obligado es el Gobierno de la Ciudad, no el frentista.

### 3.2 · "Auto abandonado hace meses" — había norma específica y no la teníamos

Tenías razón en que abandonar no es obstruir. Existe norma propia en las dos jurisdicciones, y no estaba cargada:

| Jurisdicción | Norma | Por qué encaja |
|---|---|---|
| **CABA** | **Ley 451, art. 1.3.31 — "Vehículo abandonado en la vía pública"** | El hecho tipificado es el abandono. Y trae el procedimiento: intimación al titular por diez días hábiles y después remolque |
| **Avellaneda** | **Ley 24.449, art. 49 inc. b) punto 7** — "Por un período mayor de cinco días o del lapso que fije la autoridad local" | Es la prohibición de estacionar más de cinco días, y el art. 49 rige expresamente "en zona urbana" |

Las dos van en el lote 2. Con eso el sistema deja de estirar el inciso t) del art. 48, y de paso el vecino recibe información verdadera y útil: que hay un plazo de intimación y un remolque posible.

### 3.3 · Qué mostrarle al ciudadano cuando el validador rechaza la cita

Hoy `indeterminado` mezcla dos cosas que no son lo mismo:

| Causa real | Qué debería ver el ciudadano |
|---|---|
| **No hay norma cargada** para ese caso en su localidad | Que no encontramos norma aplicable **y el canal donde reclamar igual**. Es honesto y es útil |
| **La cita no pasó la validación** — un error técnico nuestro | Lo mismo que arriba **en cuanto a utilidad**, pero sin afirmar que no hay norma, porque eso sería mentirle sobre el estado del derecho |

**La decisión, entonces, tiene dos partes:**

1. **Internamente hay que distinguirlas.** Que el estado técnico registre "sin norma en el corpus" y "fallo de validación de cita" como cosas distintas, porque una se arregla cargando normas y la otra arreglando código. Si conviene hacerlo con un motivo dentro de `indeterminado` en lugar de un estado nuevo, decidilo vos: no quiero tocar la máquina de estados desde acá, y la lista de estados del reporte (`RECIBIDO`, `EN_ANALISIS`, `DERIVADO`, `RESUELTO`, `DESESTIMADO`) no cambia.
2. **Hacia el ciudadano, la regla es una: nunca se queda sin canal.** Para eso cargamos las fuentes de tipo `informacion`. Aunque el análisis no logre fundamentar, el reporte tiene categoría y localidad, y con eso alcanza para decir a dónde va. Un "no se pudo determinar" a secas es la peor salida posible: no informa y no deriva.

### 3.4 · Comercio en Avellaneda — y una corrección mía

**Acepto el hueco de la ordenanza municipal para el MVP.** Pero el diagnóstico cambió, en dos sentidos.

**Primero, ya no estamos tan desnudos.** El lote 2 trae el **Decreto-Ley 8751/77, Código de Faltas Municipales de la Provincia**, que es el marco de la Ordenanza 7180. Su art. 4° bis —incorporado por la Ley 11.723— dice que son **faltas de especial gravedad** las infracciones a las ordenanzas que regulan, entre otras, la "radicación, habilitación y funcionamiento de establecimientos comerciales e industriales". Con eso, más el art. 27 inc. 1 de la LOM, el fundamento de comercio irregular en Avellaneda deja de ser un hueco y pasa a ser **un fundamento de competencia**: no tenemos la conducta tipificada localmente, pero sí la materia, el organismo y el procedimiento.

**Segundo, y esto es un error mío que hay que revertir.** El lote 1 mapeó a comercio irregular el fragmento huérfano de la Ley 24.449 art. 48 inc. t) ("instalarse o realizar venta de productos en zona alguna del camino"). Lo hice porque era el único fragmento de la categoría y estaba sin mapeo. **Estaba mal:** el art. 5 de la propia Ley 24.449 define *"i) Camino: una vía rural de circulación"*. Ese inciso habla de caminos rurales, no de la vereda de Gerli. El modelo lo recuperó porque yo lo puse ahí.

El lote 2 lo corrige: el fragmento pasa a **tránsito**, que es su materia, se quita de comercio irregular, y se carga la definición del art. 5 para que el límite de alcance quede citable. Es el único `DELETE` de los dos lotes y toca una sola fila de `fragment_services`.

**Sobre la fecha de la Ordenanza 7180:** la vía es institucional (Secretaría Legal y Técnica o Juzgado de Faltas del municipio) y no la puedo garantizar para el MVP. La pido esta semana; si llega, entra en el Sprint 15 o 16 como lote chico. No bloquea nada.

### 3.5 · Alumbrado en CABA — la Ley 210 alcanza; el problema es la recuperación

Sí alcanza, y con los dos artículos juntos:

- **art. 2 inc. b)** — el alumbrado público y el señalamiento luminoso son servicios comprendidos, o sea que la materia está dentro de la competencia del Ente;
- **art. 3 inc. j)** — el Ente "recibe y tramita las quejas y reclamos que efectúen los usuarios en sede administrativa tendiente a resolver el conflicto planteado con el prestador".

Los dos están cargados desde el corpus original. Que el 3 inc. j) no entre entre los seis primeros recuperados —y sí entre en REP-3795— es un problema de **ranking**, no de cobertura, y por eso `sin_normativa` es hoy un resultado incorrecto para ese caso.

Dos cosas para mirar, en tu terreno: si el `k` de recuperación alcanza cuando la respuesta necesita dos fragmentos de la misma norma, y la búsqueda híbrida. **Sobre esto último ya respondiste:** `match_knowledge_fragments` ordena sólo por distancia vectorial y la columna `fts` —generada, con índice GIN— está sin uso. Para este caso puntual la búsqueda híbrida es probablemente el arreglo más barato, porque la palabra "alumbrado" está literal en el fragmento del art. 2 inc. b).

Y una tercera, de contenido: el lote 2 agrega el **103 de Emergencias** de CABA, que según la página oficial "actúa ante inundaciones, accidentes en la vía pública, derrame de sustancias tóxicas". Para un caso urgente de infraestructura, ése es el canal, y hasta ahora no lo teníamos.

### 3.6 · Vulnerabilidad social — pasa a mostrar canal y fundamento

**Decisión: sí.** Con 29 fragmentos cargados y los canales relevados, seguir respondiendo `asistencia` sin consultar el corpus deja sin usar lo que acabamos de construir.

Y hay que corregir el mensaje. "Derivado al área de asistencia social" **promete una derivación que no ocurre**, y eso es lo que menos podemos permitirnos en la categoría donde la persona del otro lado está peor. El mensaje tiene que decir qué canal corresponde y qué puede esperar:

| Jurisdicción | Canal a mostrar |
|---|---|
| **CABA** | **Línea 108**, 24 horas, opción 1 para informar sobre una persona en situación de calle. Deriva al Ministerio de Desarrollo Humano y Hábitat. Si hay niños, niñas o adolescentes: **102**, también 24 horas |
| **Avellaneda** | **Secretaría de Desarrollo Social** (San Martín 1351 piso 2, 6089-8315) y el **CAV** (0800-122-6323) en horario. Con niños, niñas o adolescentes: **guardia 24 h del Consejo de Niñez, 115 426-1618**. **No existe un equivalente del 108 para personas adultas**, y no hay que inventarlo ni sugerir el 108, que no atiende fuera de la Ciudad |

El fundamento que acompaña: Ley 27.654 (nacional, de orden público), Ley 15.625 en Avellaneda, Leyes 3706 y 4036 en CABA. Y el encuadre, que el prompt tiene que respetar: **no hay infractor**. Es un deber del Estado y una derivación asistencial, no una denuncia.

El corte del Punto 4 de REP-3795 es tuyo y de Iván en cuanto a implementación; lo que decido acá es que la respuesta deje de ser un mensaje fijo.

---

## 4. Los dos cambios de código: aprobados

**4.1 — Guardar modelo, tokens y cita rechazada cuando falla la validación.** Aprobado. Además de diagnóstico y costo, es la única forma de confirmar el `\r\n` y de entender el truncado de citas del punto 3.1. Rama aparte y test, como planteás.

**4.2 — Normalizar al validar.** Aprobado, con el orden del punto 2 de este documento: primero el dato y el re-embedding, después la normalización en la comparación. Y de acuerdo en exigir que la prueba incluya el caso negativo: una cita parafraseada tiene que seguir siendo rechazada.

---

## 5. Lo que te llega ahora: el lote 2

39 fragmentos nuevos, 6 fuentes nuevas, y tres correcciones. Lo que cierra:

| Qué | Para qué |
|---|---|
| **Decreto-Ley 8751/77** (PBA) — Código de Faltas Municipales | El marco de la Ordenanza 7180. Y su **art. 35**: "Toda falta da lugar a una acción pública, que puede ser promovida de oficio o por simple denuncia verbal o escrita ante la autoridad municipal". Es el respaldo legal del reporte ciudadano en Avellaneda |
| **Ley 1217** (CABA) — Procedimiento de Faltas | El mismo respaldo en CABA (art. 2 del Anexo, redacción casi idéntica). Y su art. 3, que enumera qué debe contener un acta: lugar, fecha, hora, descripción, norma presuntamente infringida. Es una especificación de nuestro propio formulario escrita en una ley |
| **Ley 5901** (CABA) — Aperturas y roturas | Cierra el pendiente P-13. El anexo que no se podía leer estaba en otro host: `boletinoficialpdf.buenosaires.gob.ar`, que sí responde |
| **Ley 1166** (CABA) — Permisos de uso en el Espacio Público | Cierra el P-14. Su 11.1.2 es la prohibición puntual de vender en el espacio público sin permiso, que es lo que faltaba para comercio irregular en CABA |
| **Ley 11.723** (PBA) — Ambiente | Su art. 2 inc. d) reconoce el derecho a denunciar el incumplimiento, y su art. 6 hace responsables a los municipios por sus **omisiones** |
| **Ley 451** arts. 1.3.31, 2.1.13, 2.1.15, 2.1.15.1 | Auto abandonado, apertura sin permiso, cierre defectuoso y reparación defectuosa de vereda |
| **Ley 24.449** art. 49 inc. b.7 y art. 5 incs. h, i, z | El auto estacionado más de cinco días, y las definiciones que marcan el límite del inciso t) |
| **Ley 2148** arts. 7.1.8 y 7.1.9 | **Corrección de chunking**: los dos fragmentos que ya estaban cargados son incisos sueltos sin el encabezado del artículo. Se recargan como encabezado + inciso, versionados, y se agregan cuatro incisos más (esquina, ciclovía, parada de colectivo, entrada de garage) |
| **Teléfonos oficiales de CABA** desde la página vigente | 147 con su horario real —que no es 24 horas—, 103 de emergencias y 108/102 |

**El lote 2 no genera embeddings**, igual que el 1. La consulta W-5 lista los que faltan y tiene que quedar vacía.

---

## 6. Sobre los límites que marcaste

Los comparto y conviene que queden escritos, porque van a volver a aparecer cuando se presente el avance:

- Los reportes se insertaron por SQL: **no se probó la foto, la cuarentena ni la pantalla de resultado**. Lo que está verificado es el pipeline de análisis, no el flujo del ciudadano.
- **La lectura de las citas es técnica, no jurídica.** Este documento tampoco es una validación jurídica: es la decisión del PO sobre qué norma se cita en cada caso, con la fuente oficial a la vista. Si en algún momento sumamos revisión legal externa, estos son los casos por los que empezaría.
- Una a tres corridas por caso alcanzan para ver un patrón, no para medir consistencia. Que comercio en Avellaneda diera `indeterminado` en tres de tres es un dato; que un caso ande una vez, no.

---

## 7. Qué necesito de vuelta

| # | Qué | Quién |
|---|---|---|
| 1 | Correr el lote 2 en staging, con su precheck de guardas | Matías |
| 2 | Normalizar `content` y regenerar embeddings de los fragmentos afectados; W-5 y W-6 en cero | Matías |
| 3 | 4.1 y luego 4.2, en rama aparte con test | Matías |
| 4 | ~~Revisar la `cita_textual` del caso de raíces~~ — **cerrado el 29/09**: la cita estaba completa en `report_ai_evidence`, el truncado era del informe, no del modelo | — |
| 5 | Ranking: si el art. 3 inc. j) de la Ley 210 sigue sin entrar, probar búsqueda híbrida con la columna `fts` | Matías |
| 6 | Rehacer los casos de auto abandonado, comercio Avellaneda y alumbrado CABA con el corpus completo | Iván ([REP-3784](https://unlz2026.atlassian.net/browse/REP-3784)) |
| 7 | El mensaje de vulnerabilidad social con canal y fundamento, según el punto 3.6 | Matías e Iván |

---

**Documentos relacionados:** [REP-3797](https://unlz2026.atlassian.net/browse/REP-3797) · [REP-3795](https://unlz2026.atlassian.net/browse/REP-3795) · [REP-3774](https://unlz2026.atlassian.net/browse/REP-3774) · [REP-3784](https://unlz2026.atlassian.net/browse/REP-3784) · [REP-2906](https://unlz2026.atlassian.net/browse/REP-2906)
