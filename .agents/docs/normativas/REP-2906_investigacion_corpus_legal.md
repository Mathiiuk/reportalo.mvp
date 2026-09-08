# Reportalo

*Plataforma de Auditoría Ciudadana*

## INVESTIGACIÓN DE CORPUS LEGAL — AVELLANEDA, PROVINCIA DE BUENOS AIRES Y CABA

**Versión 1.4 · 7 de septiembre de 2026 · Construcción · Proyecto RAR-2026**

**Jira:** [REP-2906](https://unlz2026.atlassian.net/browse/REP-2906) (T · Definir estructura de corpus legal · épica [REP-1009](https://unlz2026.atlassian.net/browse/REP-1009) EP | IA jurídica / RAG) — insumo también para [REP-3764](https://unlz2026.atlassian.net/browse/REP-3764) (T · Definir casos esperados para el vertical slice RAG · Sprint 11) y [REP-2907](https://unlz2026.atlassian.net/browse/REP-2907) (T · Implementar vertical slice RAG · Sprint 11)
**Confluence:** espacio `Reportalo` — pendiente de publicar

**Equipo:** Hernán Gregorini (PO / Autor) · Leonel Nuñez (PM / Scrum Master) · Matías Krepchuk (Líder Técnico · UX/UI) · Iván Juárez (QA · UX/UI)

**Consultor Especialista:** Carlos Ruiz (auditor externo · asesoría metodológica)

> **Propósito.** Dejar registradas las fuentes normativas reales, el método de búsqueda y los hallazgos de la primera investigación de corpus legal (tránsito, infraestructura vial y estacionamiento indebido) para Avellaneda, Provincia de Buenos Aires y CABA, de modo que quien retome REP-2906/REP-2907/REP-3764/REP-3767 no repita la búsqueda desde cero.

---

## 1. Alcance de esta investigación

**Las categorías del MVP son cinco, no cuatro** (Plan de Alcance §3.2 + incorporación al dataset de Sprint 10): **infraestructura, tránsito, ambiente, comercio irregular y vulnerabilidad social**. Esta investigación cubrió en profundidad dos:

1. **Infraestructura vial** — calle rota, boca de tormenta rota, falta de alumbrado: ¿qué norma obliga al municipio a mantenerlas?
2. **Tránsito — estacionamiento indebido** — auto en rampa para discapacidad, auto en doble fila: ¿qué norma lo prohíbe y qué sanción prevé?

En la ronda del 07/09/2026 se sumó el marco de servicios públicos de CABA (Ley 210), la capa sancionatoria de CABA (Ley 451) y una primera ordenanza ambiental de Avellaneda. Sigue **sin investigar**: comercio irregular y toda la normativa de vulnerabilidad social (ver §7, es un caso distinto al resto). La capa sancionatoria de Avellaneda (Ordenanza 7180) quedó identificada pero **bajó de prioridad** — ver nota en §5.

> **Corrección de encuadre (07/09/2026, ver `REP-2906_feedback_investigacion_2.md`).** Reportalo **no emite multas ni sanciones** — confirmado en el Acta de Inicio v3.0 y el Plan de Alcance v2.0. La investigación de la capa de sanción de CABA (Ley 451, valores de Unidad Fija) fue más profunda de lo que el producto necesita: sirve para acreditar que la conducta reportada es una infracción real, pero **no es la pieza crítica del corpus**. Lo que sí es crítico es el par **obligación/conducta + organismo competente**, que es lo que efectivamente usa el flujo de derivación (`REP-1008`).

## 2. Método

- Herramienta de descubrimiento: conector MCP **claude.ai Firecrawl** (`firecrawl_search`), ya autorizado a nivel de cuenta — no requiere instalar la CLI de Firecrawl ni usar API key propia. Sirve para ubicar la norma y el artículo, no para citarlos textualmente (los fragmentos vienen recortados y reordenados por el indexador).
- Herramienta de extracción: **WebFetch** sobre la URL primaria puntual, pidiendo explícitamente copia literal del artículo. Es una extracción asistida por un modelo, no el HTML/PDF crudo — puede tener errores de atribución (ver el caso de Ley 451 en §3.3, donde dos extracciones distintas dieron dos números de artículo contradictorios para el mismo texto). **Regla para la ingesta real al RAG:** todavía hace falta bajar el PDF/HTML oficial y verificar cada cita antes de convertirla en embedding de producción.
- Los textos verbatim recuperados en esta ronda están guardados en `docs/fuentes/normativas/` (un archivo por norma, con URL fuente y fecha de descarga en la cabecera), para no repetir la extracción.
- Riesgo de falso positivo detectado: existe una segunda "Avellaneda" (Santa Fe) con sitio propio (`avellaneda.gob.ar`) que aparece mezclada en los resultados. El dominio oficial de la Avellaneda del proyecto (Buenos Aires, partido del conurbano sur) es **`mda.gob.ar`** (Municipalidad de Avellaneda, sede Güemes 835).

## 3. Hallazgos — fuentes por norma

### 3.1 Infraestructura vial (calle, boca de tormenta, alumbrado)

| Norma | Qué establece | Fuente primaria | Estado |
|---|---|---|---|
| Constitución de la Provincia de Buenos Aires, art. 192 inc. 4 | Texto confirmado: el municipio tiene a su cargo *"el ornato y salubridad [...] y **la vialidad pública**"* | `infoleg.gob.ar/?page_id=173` | **Confirmado 07/09** — descargado a `constitucion_pba_arts_190_192.md`. No menciona "alumbrado": eso viene del Dec-Ley 6769/58 art. 52 |
| Decreto-Ley 6769/58 (Ley Orgánica de las Municipalidades), art. 52 | Texto confirmado: *"Corresponde al Concejo disponer la prestación de los servicios públicos de barrido, riego, limpieza, alumbrado, provisión de agua, obras sanitarias y **desagües pluviales**..."* | `normas.gba.gob.ar/documentos/OVG48SW0.html` | Confirmado, listo para ingesta (traer texto completo del artículo) |
| Decreto-Ley 6769/58, art. 59 | Define obras públicas municipales: "las de ornato, salubridad, vivienda y urbanismo" — respalda reclamos de calle/vereda como obra pública municipal | Misma fuente | Confirmado |
| CABA — Ley 210, arts. 2 y 3 | **Estructura distinta a PBA.** No hay "obligación del municipio": hay un Ente Único Regulador que controla la calidad de los servicios prestados por terceros. Art. 2 inc. b) alumbrado público y señalamiento luminoso, inc. c) higiene urbana, inc. e) conservación y mantenimiento vial. Art. 3 inc. j): el Ente *"recibe y tramita las quejas y reclamos que efectúen los usuarios"* | `boletinoficial.buenosaires.gob.ar/normativaba/norma/4623` | **Confirmado 07/09** — descargado a `ley_210_caba_ente_regulador.md`. Resuelve P-1 |

### 3.2 Tránsito — estacionamiento indebido (rampa / doble fila)

| Jurisdicción | Norma | Qué establece | Fuente primaria |
|---|---|---|---|
| Nacional (aplica en Avellaneda vía adhesión provincial, Ley 13927) | Ley 24.449, art. 49 (Estacionamiento) | Prohíbe estacionar frente a rampas para discapacidad y senda peatonal | `servicios.infoleg.gob.ar/infolegInternet/anexos/0-4999/818/texact.htm` |
| Nacional | Ley 24.449, art. 48 inciso i) | "La detención irregular sobre la calzada" — encuadre para doble fila | Misma fuente |
| CABA | Ley 2148, art. 7.1.8 inciso a) | *"En doble fila, excepto como detención previa a la maniobra de estacionamiento"* → prohibido | `juristeca.jusbaires.gob.ar/compilacion-normativa-juristeca/ley-2148/` |
| CABA | Ley 2148, art. 7.1.9 inciso h) | *"Frente a los vados o rampas para personas con discapacidad"* → prohibido | Misma fuente |
| CABA | Ley 2148, art. 7.3.8 | Estacionar en espacio reservado para discapacidad sin ser el vehículo autorizado = infracción al art. 7.1.9 inciso m) | Misma fuente |
| CABA | **Ley 451, art. 6.1.52** (texto s/ Ley 5905, 2017) — Estacionamiento o detención prohibida | Estacionar en lugar prohibido = **100 UF**. En lugares reservados a emergencias, paradas, entradas, ciclovías, carriles exclusivos, Metrobus, Micro/Macrocentro = **el doble**. **En rampas para discapacidad o lugares reservados a personas con necesidades especiales = 300 UF** | `boletinoficial.buenosaires.gob.ar/normativaba/norma/391197` |
| CABA | **Ley 451, art. 6.1.37** (texto s/ Ley 5905) — Obstrucción | Obstruir vía transversal, ciclovías, veredas o estacionamientos reservados = 70 UF. **Obstruir rampas para discapacidad = 300 UF**. Encuadre distinto del 6.1.52: obstruir ≠ estacionar | Misma fuente |
| CABA | Valor de la Unidad Fija | **$1.173,08** vigente 02/09/2026 – 01/03/2027. Ej.: 300 UF = **$351.924**. Cambia cada 6 meses → no puede vivir dentro del corpus de embeddings | `estadisticaciudad.gob.ar/eyc/unidad-fija-uf/` |

### 3.3 Marco de dos niveles — CORREGIDO en la ronda del 06/09/2026

> **Corrección.** Esta sección decía que los municipios bonaerenses aplican el Decreto-Ley 8031/73 (Código de Faltas provincial) como base para tránsito. Al traer el índice completo del 8031/73 (`docs/fuentes/normativas/codigo_faltas_decreto_ley_8031-73_indice.md`) se confirmó que **no tiene capítulo de tránsito**: cubre seguridad de las personas, patrimonio, moralidad pública, orden público, autoridad, fe pública y carnaval — no vía pública ni estacionamiento.

El marco real, confirmado con texto verbatim, es:

- **Tránsito en Avellaneda/PBA:** Ley Nacional 24.449, arts. 48 y 49, aplicable por adhesión provincial (Ley 13.927). El Código de Faltas 8031/73 sigue siendo el marco contravencional bonaerense, pero para **otras** categorías (seguridad, patrimonio, orden público), no tránsito.
- **Tránsito en CABA:** dos leyes separadas trabajando juntas — Ley 2148 define la conducta prohibida (arts. 7.1.8 doble fila, 7.1.9 rampas), y **Ley 451 (Régimen de Faltas) art. 6.1.52** fija la sanción (confirmado 07/09, ver `ley_451_caba_art_6.1.52_y_6.1.37.md`). La cifra "200 a 1.000 unidades fijas" de versiones anteriores de este documento correspondía a un **texto derogado** (Ley 4071, 2011) y no debe usarse.
- **Infraestructura en CABA:** ni obligación municipal ni código de faltas, sino **regulación de servicios** (Ley 210, Ente Único). El reclamo se dirige al Ente, que tramita quejas de usuarios contra el prestador.

Esta estructura de dos leyes en CABA (conducta + sanción) es, de hecho, un buen espejo del campo `report_ai_analysis` de "doble fundamentación" del modelo de datos: el dictamen necesita citar ambas.

### 3.4 Cuadro comparativo de la lógica jurídica por jurisdicción

Es el hallazgo estructural más importante de la investigación: **el mismo reclamo se funda de forma distinta según dónde ocurra.**

| Tipo de reclamo | Avellaneda / PBA | CABA |
|---|---|---|
| Infraestructura (calle, luz, desagüe) | Obligación directa del municipio: Const. PBA art. 192 inc. 4 + Dec-Ley 6769/58 arts. 52 y 59 | Control de calidad del servicio: Ley 210 arts. 2 y 3 — se reclama ante el Ente Único, no al "municipio" |
| Estacionamiento indebido — conducta | Ley Nacional 24.449 arts. 48-49 (por adhesión Ley 13.927) | Ley 2148 arts. 7.1.8 / 7.1.9 |
| Estacionamiento indebido — sanción | **Ordenanza 7180 = Código Municipal de Faltas de Avellaneda. Identificada, pero sin texto digitalizado (P-6)** | Ley 451 arts. 6.1.52 / 6.1.37 / 6.1.54 — confirmadas contra el texto consolidado, montos en UF |
| Organismo al que derivar | Juzgado de Faltas Municipal de Avellaneda | Ente Único Regulador / Controlador de Faltas |

**Implicancia directa:** hoy el corpus de CABA está mucho más completo que el de Avellaneda, justamente porque a Avellaneda le falta la capa sancionatoria (P-6). Para el piloto esto es asimétrico y conviene decirlo en REP-3767.

## 4. Fuentes relevadas en la ronda anterior (ambiente / comercio / general Avellaneda)

Quedan documentadas para no repetir la búsqueda:

- Boletín Oficial Municipal de Avellaneda: `mda.gob.ar/gobierno/secretaria-legal-y-tecnica/boletin-oficial-municipal/` — **el listado indexado llega solo hasta 2020**. Verificar en el sitio si hay ediciones más recientes antes de asumir que el corpus queda con un vacío 2021-2026.
- Habilitaciones comerciales/industriales de Avellaneda: `mda.gob.ar/tramites/habilitaciones-comerciales/` y `/habilitaciones-industriales/`.
- Ordenanza N° 7180 (Avellaneda) — prohíbe arrojar residuos en boulevares y parquizados.
- Ordenanzas N° 27235 y 30945 (Avellaneda) — actividades comerciales en zona de reserva ambiental, vía SIBOM.
- Repositorio SIBOM (`sibom.slyt.gba.gob.ar`) — repositorio oficial de boletines municipales de la Provincia, más confiable que el sitio propio del municipio para buscar por número de ordenanza.
- Decreto-Ley 8031/73 (Código de Faltas provincial) — texto ordenado en `normas.gba.gob.ar` e `intranet.hcdiputados-ba.gov.ar`.
- Ley 2148 CABA, texto consolidado por Ley 6017 — versión articulada más citable en `juristeca.jusbaires.gob.ar` (mejor para trocear que el PDF del Boletín Oficial).

## 5. Pendiente para la próxima ronda

**Reordenado el 07/09/2026** para reflejar que la capa de sanción no es crítica (ver corrección en §1). Los pendientes de comercio irregular y vulnerabilidad social (categorías completas, no solo un artículo) pasan a ser más prioritarios que cerrar el detalle sancionatorio de Avellaneda.

| Ref. | Pendiente | Prioridad | A quién corresponde |
|---|---|---|---|
| ~~P-1~~ | ~~Marco legal de CABA para alumbrado y desagües~~ | Resuelto | **RESUELTO 07/09** — Ley 210, Ente Único Regulador |
| ~~P-2~~ | ~~Confirmar texto de Constitución PBA arts. 190/192~~ | Resuelto | **RESUELTO 07/09** — art. 192 inc. 4 dice "la vialidad pública" |
| ~~P-3~~ | ~~Boletín Oficial de Avellaneda posterior a 2020~~ | Resuelto | **RESUELTO 07/09 por otra vía** — el sitio municipal está roto, pero **SIBOM tiene Avellaneda al día** (boletín 136º del 02/09/2026). La fuente viva es SIBOM, no `mda.gob.ar` |
| P-4 | Casos de prueba armados con estas fuentes (ver detalle abajo) | Alta | Hernán Gregorini — REP-3764 |
| ~~P-5~~ | ~~Artículo exacto de Ley 451 con la multa de tránsito en CABA~~ | Resuelto, **de utilidad menor a la prevista** | Confirmado 07/09 (art. 6.1.52), pero la capa de sanción no es crítica para el producto — ver corrección §1 |
| **P-6** | Texto de la Ordenanza 7180 de Avellaneda | **Baja** (era "crítica" en la v1.3; dejó de serlo) | Identificada: es el Código Municipal de Faltas de Avellaneda. Su texto no está digitalizado. No bloquea REP-2906 — Avellaneda igual tiene obligación + conducta prohibida, que es lo que se deriva |
| ~~P-7~~ | ~~¿Hay modificación del 6.1.52 posterior a Ley 5905?~~ | Resuelto, de utilidad menor | No la hay. Mismo comentario que P-5 |
| P-8 | Unidad Fija bonaerense | **Baja** — solo relevante si algún día se muestran montos, que hoy no se muestran | Ver `PENDIENTES_corpus.md` |
| **P-9** | Normativa de **comercio irregular** (las dos jurisdicciones) | **Alta** — categoría completa del MVP sin ninguna norma investigada | Ver `PENDIENTES_corpus.md` |
| P-10 | Ordenanza 30945 de Avellaneda (nicho, ambiente) | Baja | Ver `PENDIENTES_corpus.md` |
| P-11 | Ambiente en CABA más allá de la mención en Ley 210 | Media | Ver `PENDIENTES_corpus.md` |
| **P-12** | Normativa de **vulnerabilidad social** (las dos jurisdicciones) | **Alta — sin ninguna investigación todavía** | Ver §7. Es un caso distinto: no hay "conducta prohibida" del lado del ciudadano ni sanción; el fundamento es la obligación de asistencia del Estado |

> El registro vivo y completo de pendientes, con vías muertas ya comprobadas, está en `docs/fuentes/normativas/PENDIENTES_corpus.md`. Esta tabla es solo el resumen.

## 7. Vulnerabilidad social — categoría no investigada, con naturaleza jurídica distinta

Esta categoría se sumó al dataset en el Sprint 10, después de haber estado diferida a "Versión 2" en el Acta v3 — es una decisión ya tomada por el PO, no algo a discutir, pero **el corpus legal para esta categoría no existe todavía** y no puede construirse con la misma lógica que las otras cuatro.

**Por qué es distinta:**

- Las otras cuatro categorías fundan el reclamo en que **alguien incumplió** algo (el municipio no arregló la calle, el conductor estacionó mal, el comercio no tiene habilitación). Acá no hay un incumplimiento que perseguir: hay una persona en situación de vulnerabilidad (situación de calle, niños en riesgo) y el reclamo es una **derivación de asistencia**, no una denuncia.
- No aplica el par "conducta prohibida + sanción" en absoluto. El fundamento legal es el **deber de asistencia del Estado** (por ejemplo, Ley 26.061 de Protección Integral de los Derechos de Niñas, Niños y Adolescentes a nivel nacional — no verificada todavía, marcarla como hipótesis a confirmar).
- El organismo de derivación ya está definido en el Acta: **Ministerio de Capital Humano** — a nivel nacional, no municipal ni provincial. Esto simplifica el problema de jurisdicción (no hay asimetría CABA/Avellaneda como en las otras categorías) pero exige mucho más cuidado en privacidad y en cómo se redacta el fundamento, dado que involucra personas y no infraestructura.
- Al no investigarse todavía, **no hay ningún caso de prueba de esta categoría en REP-3764** — es un hueco, no solo en el corpus sino en el dataset de casos esperados.

**Siguiente paso sugerido:** antes de investigar normativa específica, confirmar con el PO qué nivel de fundamentación legal necesita esta categoría — puede que el estándar de "amparo legal" de las otras cuatro no aplique de la misma manera acá, y que alcance con identificar el organismo sin una cita normativa tan elaborada.

## 6. Casos propuestos para REP-3764 (a partir de estos hallazgos)

| Caso | Reclamo | Debe recuperar | Debe descartar |
|---|---|---|---|
| A | Boca de tormenta rota en Avellaneda | LOM (Dec-Ley 6769/58) art. 52 y 59-d, Constitución PBA art. 192 inc. 4 | Código de Faltas 8031/73 (no cubre esto, ver corrección §3.3) |
| B | Auto estacionado sobre la rampa en CABA | Ley 2148 art. 7.1.9 (conducta) **+ Ley 451 art. 6.1.52 (sanción, 300 UF)** — las dos, no una | Ley 24.449; y el art. 6.1.37, que es para obstrucción sin estacionar |
| C (control negativo) | Auto estacionado sobre la rampa en Avellaneda | Ley 24.449 art. 49 | Ley 2148 / Ley 451 (probar que el `subdivision_id` no CABA-centriza la respuesta) |
| D (nuevo) | "No anda la luz de la calle" — mismo texto, una vez en Avellaneda y otra en CABA | Avellaneda → Dec-Ley 6769/58 art. 52 (obligación municipal). CABA → Ley 210 art. 2 inc. b + art. 3 inc. j (Ente Único tramita el reclamo) | Que devuelva la misma norma para las dos: probaría que no distingue la lógica jurídica según jurisdicción |
| E (nuevo) | Auto **obstruyendo** una rampa en CABA sin estar estacionado | Ley 451 art. 6.1.37 (300 UF) | Art. 6.1.52 — probar que discrimina obstruir de estacionar |

## Nota de versión

**v1.4 — 07/09/2026 (corrección de alcance)**

| Qué cambió | Por qué |
|---|---|
| Se corrigió que son **5 categorías, no 4**: se agregó vulnerabilidad social | Sumada al dataset en Sprint 10 por decisión del PO, aunque el Acta la difiere a "Versión 2" |
| Se agregó §7 completo sobre vulnerabilidad social | Categoría de naturaleza jurídica distinta (deber de asistencia, no incumplimiento) — no investigada todavía, sin casos de prueba en REP-3764 |
| Se bajó la prioridad de P-5, P-6, P-7, P-8 (todos relacionados a la capa de sanción) | Confirmado en Acta v3.0 y Plan de Alcance v2.0: Reportalo no emite multas ni sanciones. Ver `REP-2906_feedback_investigacion_2.md` |
| Se subió la prioridad de comercio irregular (P-9, nuevo) y vulnerabilidad social (P-12, nuevo) | Son categorías completas del MVP sin ninguna norma investigada — más urgente que el detalle sancionatorio de una categoría que ya tiene su obligación/conducta cubierta |

**v1.3 — 07/09/2026 (segunda ronda de descarga)**

| Qué cambió | Por qué |
|---|---|
| Resueltos P-3 y P-7; P-6 identificado | Se descargaron los PDF dentro del proyecto y se extrajo su texto con una herramienta nueva sin instalar dependencias |
| **P-3:** la fuente viva de ordenanzas de Avellaneda es **SIBOM**, no `mda.gob.ar` | El sitio municipal tiene el certificado SSL roto y publica hasta 2020; SIBOM está al día (boletín 136º del 02/09/2026) |
| **P-6:** la Ordenanza 7180 es el **Código Municipal de Faltas de Avellaneda** | Confirmado por dos fuentes oficiales del propio municipio. Su texto no está digitalizado: la vía que queda es institucional |
| **P-7:** Ley 5905/17 es la última modificación del art. 6.1.52 | Verificado sobre el texto consolidado oficial, que cierra la cadena de "Conf. Ley N°..." ahí |
| Se agregó el art. 6.1.54 (estacionar sobre la vereda, 300 UF) | Apareció al leer el texto completo; cubre un reclamo frecuente que no estaba contemplado |
| Se verificó que "doble fila" **no aparece** en ningún artículo de la Ley 451 | Ya no es una inferencia: se buscó en el texto íntegro. Confirma que se encuadra por el 6.1.52 genérico |

**v1.2 — 07/09/2026**

| Qué cambió | Por qué |
|---|---|
| Resueltos P-1, P-2 y P-5 | Se descargaron Ley 210 (CABA, Ente Único), Constitución PBA art. 192 inc. 4 y Ley 451 art. 6.1.52 con texto verbatim |
| Se agregó §3.4, cuadro comparativo de lógica jurídica por jurisdicción | Hallazgo estructural: el mismo reclamo se funda distinto en Avellaneda que en CABA — afecta el diseño del RAG, no solo el contenido del corpus |
| Se corrigió el monto de la multa de CABA: 300 UF (rampas), no "200 a 1.000" | La cifra anterior era de un texto derogado de 2011 (Ley 4071); el vigente es el de Ley 5905 (2017) |
| Se agregó el valor de la Unidad Fija y su implicancia de arquitectura | Las multas de CABA están en UF, que cambia cada 6 meses: no puede quedar congelada dentro del embedding |
| Se agregaron los casos D y E a §6 | Cubren la asimetría jurisdiccional y la distinción obstruir/estacionar |
| Nuevos pendientes P-6 a P-8, con registro vivo en `PENDIENTES_corpus.md` | P-6 (Ordenanza 7180 de Avellaneda) pasó a ser el hueco crítico del corpus |

**v1.1 — 06/09/2026**

| Qué cambió | Por qué |
|---|---|
| Se corrigió §3.2 y §3.3: el Código de Faltas 8031/73 no cubre tránsito | Al traer el índice completo del decreto-ley se comprobó que no tiene capítulo de tránsito — la hipótesis de v1.0 estaba mal fundada |
| Se marcó como no confirmada la multa de CABA (200-1.000 unidades fijas) | Dos extracciones automáticas atribuyeron el mismo texto a artículos distintos (Ley 2148 art. 12 vs. 6.1.52) — contradictorio, no citar sin verificar |
| Se agregó P-5 | Falta el artículo exacto de Ley 451 que fija la sanción de tránsito en CABA |
| Se descargó el texto verbatim de las normas citadas a `docs/fuentes/normativas/` | A pedido del PO, para no depender de fragmentos de búsqueda en la próxima ronda |

---

**Documentos relacionados:** [REP-2906](https://unlz2026.atlassian.net/browse/REP-2906) · [REP-2907](https://unlz2026.atlassian.net/browse/REP-2907) · [REP-3764](https://unlz2026.atlassian.net/browse/REP-3764) · [REP-3767](https://unlz2026.atlassian.net/browse/REP-3767)
