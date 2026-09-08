# Reportalo

*Plataforma de Auditoría Ciudadana*

## GUÍA DEL CORPUS DE CONOCIMIENTO DEL RAG — INVESTIGACIÓN, FUENTES Y ESTRUCTURA

**Versión 2.1 · 7 de septiembre de 2026 · Construcción · Proyecto RAR-2026**

**Jira:** [REP-2906](https://unlz2026.atlassian.net/browse/REP-2906) (T · Definir estructura de corpus legal · épica [REP-1009](https://unlz2026.atlassian.net/browse/REP-1009) EP | IA jurídica / RAG)
**Confluence:** espacio `Reportalo` — pendiente de publicar
**Referencia:** [Modelo de Datos v3](https://unlz2026.atlassian.net/wiki/spaces/Reportalo/pages/90406917) · [Plan de Alcance v2.0](https://unlz2026.atlassian.net/wiki/spaces/Reportalo/pages/37552129) · [Anexo C — Arquitectura v2.1](https://unlz2026.atlassian.net/wiki/spaces/Reportalo/pages/22904876)

**Equipo:** Hernán Gregorini (PO / Autor) · Leonel Nuñez (PM / Scrum Master) · Matías Krepchuk (Líder Técnico · UX/UI) · Iván Juárez (QA · UX/UI)

**Consultor Especialista:** Carlos Ruiz (auditor externo · asesoría metodológica)

> **Propósito.** Documento guía y entregable de REP-2906. Reúne en un solo lugar: qué se investigó y con qué herramientas, qué quedó afuera y por qué, cuáles son las fuentes y cómo interpretarlas, y la estructura de datos que permite cargarlas y recuperarlas. La estructura se diseña **universal**: el RAG es el corazón del sistema y debe poder leer no solo normativa, sino cualquier información que respalde un reporte.

> **Reemplaza la v1.0.** Aquella proponía campos sobre la tabla `normativas` que no pasan BCNF y que no contemplaban ámbito provincial. La v2.0 corrige el esquema tras leer el DER real.

---

## 1. Resumen de la investigación

La investigación se hizo entre el 05 y el 07/09/2026 sobre las dos jurisdicciones piloto (CABA y Avellaneda), en tres rondas, y con dos correcciones de rumbo importantes:

| Ronda | Qué se hizo | Resultado |
|---|---|---|
| 1 — descubrimiento | Búsqueda de normativa por categoría y jurisdicción | Se ubicaron las normas, pero solo por fragmentos de buscador: no citables |
| 2 — extracción | Descarga del texto verbatim desde la fuente primaria | 9 archivos con texto literal, fuente y fecha, en `docs/fuentes/normativas/` |
| 3 — verificación | Descarga de PDF consolidados y contraste contra documentación del proyecto | Se confirmó vigencia y se corrigieron dos errores propios |

**Las dos correcciones que conviene no perder:**

1. **El Código de Faltas 8031/73 no cubre tránsito.** La ronda 1 lo había asumido; al traer su índice completo se comprobó que cubre seguridad, patrimonio, moralidad, orden público, autoridad y fe pública — no vía pública. El tránsito en Avellaneda se rige por la Ley Nacional 24.449 vía adhesión provincial (Ley 13.927).
2. **La capa de sanción no es necesaria para el producto.** El Acta v3.0 y el Plan de Alcance v2.0 dicen que Reportalo *no emite multas ni sanciones*. Se investigó con más profundidad de la necesaria (montos, Unidades Fijas, actualizaciones semestrales). El detalle y la autocrítica están en `REP-2906_feedback_investigacion_2.md`.

## 2. Herramientas usadas y sus límites

| Herramienta | Para qué sirvió | Límite comprobado |
|---|---|---|
| **Firecrawl** (conector MCP, `firecrawl_search`) | Descubrir qué norma y qué artículo regulan cada caso | Devuelve fragmentos recortados y reordenados. **Nunca citar desde acá** — solo sirve para ubicar la fuente |
| **WebFetch** sobre la URL primaria | Traer el texto literal del artículo | Extracción asistida por modelo: puede equivocar la atribución. Caso real: dos extracciones dieron dos números de artículo distintos para el mismo texto de la Ley 451 |
| **`tools/extraer_pdf.py`** (creada en esta investigación) | Extraer texto de PDF consolidados sin instalar dependencias — solo librería estándar de Python | Falla con PDF de fuentes CID (los boletines de SIBOM salen ilegibles). Para esos, usar la versión HTML del boletín |
| **MCP de Confluence y Jira** | Contrastar los hallazgos contra el Acta, el Plan de Alcance y el Anexo C | Páginas muy largas se truncan; conviene entrar por el `pageId` de "Documentos relacionados" |

**Vías muertas comprobadas** (documentadas en `docs/fuentes/normativas/PENDIENTES_corpus.md` para no reintentarlas): `mda.gob.ar` con certificado SSL roto, `ciudadyderechos.org.ar` con protocolo obsoleto, `ligadelconsorcista.org` con HTTP 403, y los PDF de SIBOM por fuentes CID.

## 3. Qué quedó afuera — y por qué

| Qué | Por qué |
|---|---|
| **Comercio irregular** — sin ninguna norma investigada | Falta de tiempo en esta ronda. Es la categoría con hueco más urgente |
| **Vulnerabilidad social** — sin ninguna norma investigada | Naturaleza jurídica distinta: no hay conducta prohibida ni sanción, es un deber de asistencia del Estado. Requiere definir antes qué nivel de fundamento necesita |
| **Ambiente en CABA** | Solo se tiene la mención en Ley 210 art. 2 inc. c) (higiene urbana) |
| **Ordenanza 7180 de Avellaneda** (Código Municipal de Faltas) | Identificada pero no digitalizada; la vía es institucional, no web. Además bajó de prioridad al confirmarse que no se muestran sanciones |
| **Inseguridad, robos, delitos** | Excluido explícitamente por el Plan de Alcance §4 (van al 911/134). Registrado como oportunidad de mejora a futuro, requiere análisis previo de derechos, obligaciones y responsabilidad |
| **Profundidad municipal fuera de las 2 jurisdicciones piloto** | Fuera del alcance del MVP |

## 4. Las fuentes — corpus mínimo de 8 documentos

Dentro del rango 5–10 que pide el alcance de la tarea. Cubre ambas jurisdicciones, las dos categorías con investigación completa, e incluye **un distractor deliberado** (ítem 8) para poder probar falsos positivos en REP-3764.

Los archivos con el texto verbatim están en el repositorio (`docs/fuentes/normativas/`) y publicados en [esta carpeta de Google Drive](https://drive.google.com/drive/folders/16XyigEXKergHidPxQjIDjlQeC2iPtmjk?usp=drive_link), con la subcarpeta `pdf` que conserva los textos consolidados originales.

| # | Norma | Ámbito | Categoría | Tipo de fundamento | Archivo |
|---|---|---|---|---|---|
| 1 | Constitución de la Provincia de Buenos Aires, art. 192 inc. 4 | Provincial — Buenos Aires | Infraestructura | Obligación | `constitucion_pba_arts_190_192.md` |
| 2 | Decreto-Ley 6769/58 (LOM), art. 52 | Provincial — Buenos Aires | Infraestructura | Obligación | `LOM_decreto_ley_6769-58_arts_52_59.md` |
| 3 | Decreto-Ley 6769/58 (LOM), art. 59 | Provincial — Buenos Aires | Infraestructura | Obligación | `LOM_decreto_ley_6769-58_arts_52_59.md` |
| 4 | Ley 210 (CABA), arts. 2 y 3 | Municipal — CABA | Infraestructura | Competencia | `ley_210_caba_ente_regulador.md` |
| 5 | Ley 24.449, arts. 48 y 49 | Nacional (aplica en PBA por Ley 13.927) | Tránsito | Conducta prohibida | `ley_24449_arts_48_49.md` |
| 6 | Ley 2148 (CABA), arts. 7.1.8 y 7.1.9 | Municipal — CABA | Tránsito | Conducta prohibida | `ley_2148_caba_arts_7.1.8_7.1.9.md` |
| 7 | Ley 451 (CABA), art. 6.1.52 | Municipal — CABA | Tránsito | Sanción | `ley_451_caba_art_6.1.52_y_6.1.37.md` |
| 8 | Decreto-Ley 8031/73 (Código de Faltas PBA) — índice | Provincial — Buenos Aires | *(ninguna: distractor)* | — | `codigo_faltas_decreto_ley_8031-73_indice.md` |

## 5. Cómo interpretar las fuentes

**Regla general:** los archivos de `docs/fuentes/normativas/` son materia prima con texto verbatim, fuente y fecha en la cabecera. Antes de convertir cualquiera en un fragmento de producción, verificar que el texto provenga del **texto consolidado oficial** y no de un fragmento de buscador.

| Fuente | Cómo se lee |
|---|---|
| **Constitución PBA art. 192 inc. 4** | Norma de mayor jerarquía del corpus. Dice textualmente "la vialidad pública" — es el fundamento de rango constitucional para infraestructura en Avellaneda. **No** menciona alumbrado: eso viene de la LOM |
| **LOM arts. 52 y 59** | Dos chunks separados, no uno: el 52 dice qué servicios presta el municipio (incluye alumbrado y desagües pluviales), el 59 define qué es obra pública municipal (inciso d: pavimentación y veredas). Responden preguntas distintas |
| **Ley 210 (CABA)** | Muestra que **CABA y Avellaneda no se fundamentan igual**. En Avellaneda el argumento es "el municipio está obligado"; en CABA es "el Ente Único controla al prestador y tramita tu reclamo" (art. 3 inc. j). Si el RAG usa una sola plantilla de razonamiento para las dos, falla en una |
| **Ley 24.449 arts. 48-49** | Art. 48 inc. i) fundamenta doble fila. **Advertencia:** el art. 49 no menciona rampas de discapacidad de forma literal — no forzar esa cita como si lo dijera |
| **Ley 2148 (CABA)** | Es la norma de **conducta** (qué está prohibido), no de sanción. Sola no alcanza para una respuesta completa |
| **Ley 451 (CABA)** | Es la **sanción**. Se carga para poder probar que el pipeline recupera normas vinculadas (conducta + sanción), pero **no se muestra al ciudadano**: el producto no sanciona |
| **Código de Faltas 8031/73** | **Distractor deliberado.** Comparte vocabulario con tránsito ("falta", "infracción") pero no lo cubre. Si el RAG lo recupera para una consulta de tránsito, hay un falso positivo |

## 6. Diseño del corpus: universal, flexible y robusto

### 6.1 El principio: esquema cerrado, taxonomía abierta

El RAG es el corazón del sistema y va a tener que leer más que leyes: información de trámites, procedimientos, estándares, guías del organismo. Por eso la estructura **no se llama ni se limita a "normativas"**.

La regla de diseño es: **el esquema no cambia; la taxonomía crece por datos.** Sumar un tipo de conocimiento nuevo, una categoría nueva o una jurisdicción nueva es un `INSERT` en una tabla de catálogo, nunca una migración.

| Para agregar… | Hoy hay que… |
|---|---|
| Un tipo de conocimiento nuevo (ej. `procedimiento`) | INSERT en `source_types` |
| Una categoría de reclamo nueva | INSERT en `services` — ya es así por diseño del modelo v3 |
| Una jurisdicción nueva | INSERT en el árbol geográfico |
| Un tipo de fundamento nuevo | INSERT en `foundation_types` |

### 6.2 Estructura de tablas (BCNF)

La tabla `normativas` actual (`id`, `subdivision_id`, `tipo_documento`, `categoria`, `regla`, `embedding`) tiene tres problemas: no puede expresar ámbito **provincial**, duplica el catálogo de categorías que ya vive en `services`, y si se le agregan los campos de artículo y fuente aparece la dependencia transitiva `numero_norma → titulo, autoridad` — violación de BCNF, porque cada fila sería un artículo y ese determinante no es superclave.

La descomposición correcta son dos tablas, que además son la jerarquía Norma → Título/Capítulo → Artículo → Inciso que pide el alcance:

**`knowledge_sources`** — la fuente (una fila por norma o documento)

| Columna | Tipo | Nota |
|---|---|---|
| `id` | PK | |
| `source_type_code` | FK → `source_types` | `corpus_legal`, `informacion`, … |
| `document_type` | text | Constitución, Ley, Decreto-Ley, Ordenanza, Guía… |
| `document_number` | text, nullable | `6769/58` |
| `title` | text | "Ley Orgánica de las Municipalidades" |
| `issuing_authority` | text | Quién la dictó o publicó |
| `country_id` | FK, nullable | **Arco exclusivo:** exactamente una de las tres |
| `state_province_id` | FK, nullable | ← resuelve el ámbito provincial que hoy no existe |
| `subdivision_id` | FK, nullable | |
| `source_url` | text, **NOT NULL** | Trazabilidad obligatoria por esquema, no por convención |
| `is_current` | bool | Ver §6.5 |
| `verified_at` | timestamptz, **NOT NULL** | Cuándo se verificó contra texto consolidado |
| `last_amended_by` | text, nullable | Ej. "Ley N° 5905/17" |

**`knowledge_fragments`** — el chunk vectorizado (una fila por artículo o inciso)

| Columna | Tipo | Nota |
|---|---|---|
| `id` | PK | |
| `source_id` | FK → `knowledge_sources` | |
| `hierarchy_path` | text | `Ley Orgánica de las Municipalidades > Capítulo II > Artículo 52` |
| `article` | text, nullable | |
| `subsection` | text, nullable | Inciso |
| `content` | text | Lo que se vectoriza |
| `foundation_type_code` | FK → `foundation_types`, nullable | Nulo para contenido no normativo |
| `embedding` | vector(768) | El vector vive acá: se embebe el fragmento, no la ley entera |
| | UNIQUE(`source_id`, `article`, `subsection`) | Evita cargar dos veces el mismo artículo |

**`fragment_services`** — puente M:N con el catálogo Open311

| Columna | Nota |
|---|---|
| `fragment_id` + `service_id` | PK compuesta |

El vínculo con la categoría va a nivel **fragmento**, no de norma: la Ley 24.449 art. 48 cubre tránsito en su inciso i) y comercio irregular en el t) ("realizar venta de productos en zona alguna del camino"). Una columna sola no lo admite, separarlo por comas rompe 1NF y duplicar la fila rompe BCNF.

> **Denormalización consciente:** `hierarchy_path` es una ruta materializada, derivable de la estructura. Se guarda igual porque es lo que se cita en el dictamen y porque no tiene riesgo de anomalía: se fija en la carga y, si la norma se modifica, se crea un fragmento nuevo en vez de actualizar el viejo (§6.5).

### 6.3 Alineación con Open311

El corpus **no crea una taxonomía paralela**: se cuelga del catálogo `services`, que ya implementa Open311 (`service_code`, `service_name`, `group_name`). Open311 no define fundamento legal, así que esta capa de conocimiento lo extiende por referencia sin modificar la entidad estándar — el día que un municipio consuma la API Open311 de Reportalo, ve sus categorías intactas.

### 6.4 Cascada jurisdiccional

Para un reporte en la localidad L no se filtra "solo lo de L": se resuelve L → subdivisión → provincia → país y se recuperan **los tres niveles juntos**, ordenados por especificidad (la más local manda, la de arriba queda como marco). Es lo que hace que la Constitución PBA y la LOM se recuperen juntas para un mismo reclamo de Avellaneda.

**La jurisdicción nunca forma parte del texto vectorizado.** Es un filtro estructurado sobre las FK, aplicado junto con la búsqueda por similitud. Motivo verificado en esta investigación: un buscador semántico confundió Avellaneda de Buenos Aires con Avellaneda de Santa Fe. Un embedding no distingue homónimos geográficos; una clave foránea sí.

### 6.5 Vigencia y versionado

- Un fragmento solo se marca `is_current = true` si su texto fue verificado contra el **texto consolidado oficial**, con `verified_at` cargado.
- Cuando aparece una versión nueva de una norma ya cargada, **el fragmento viejo no se borra**: se marca `is_current = false` y se inserta el nuevo. El historial queda trazable y ninguna consulta mezcla texto derogado con vigente.
- Riesgo real comprobado: circulan versiones derogadas del art. 6.1.52 de la Ley 451 con montos viejos. Una cita derogada enviada a un organismo desacredita la plataforma entera.

### 6.6 Robustez

| Mecanismo | Qué previene |
|---|---|
| CHECK de arco exclusivo sobre las 3 FK geográficas | Que una fuente quede sin ámbito o con dos ámbitos contradictorios |
| `source_url` y `verified_at` NOT NULL | Que entre un fragmento sin trazabilidad — cumple el criterio de aceptación de REP-2906 a nivel de base, no de convención |
| UNIQUE(`source_id`, `article`, `subsection`) | Cargar dos veces el mismo artículo |
| `is_current` en lugar de DELETE | Perder el historial de versiones |
| RLS habilitada desde la creación | Que la tabla quede legible con la clave pública — advertencia explícita del Modelo de Datos v3 |
| Índice `ivfflat` sobre `embedding` (coseno) | Degradación de performance al crecer el corpus |

### 6.7 Semillas

| Catálogo | Semillas iniciales |
|---|---|
| `source_types` | `corpus_legal`, `informacion` — extensible sin migración |
| `foundation_types` | `obligacion`, `conducta_prohibida`, `sancion`, `competencia` |
| `services` | **5 categorías, no 4**: infraestructura, tránsito, ambiente, comercio irregular y vulnerabilidad social. El Modelo de Datos v3 todavía dice 4 |
| `states_provinces` | Buenos Aires y CABA — sin la provincia cargada no se pueden anclar las 4 normas provinciales del corpus |

## 7. Reglas de chunking

1. **Un fragmento = un artículo.** Si un artículo tiene incisos que responden preguntas distintas, cada inciso relevante puede ser su propio fragmento. **Nunca partir un artículo al medio** por límite de tokens.
2. **Nunca fusionar dos artículos** en un fragmento, aunque sean cortos y de la misma norma (los ítems 2 y 3 del corpus son dos fragmentos, no uno).
3. **El distractor se carga sin marca especial.** Si se lo etiqueta de antemano como "no recuperar", deja de servir como prueba real del pipeline.
4. **La norma de sanción se carga pero no se expone al ciudadano.** Entra para validar recuperación de normas vinculadas, no para mostrar montos.

## 8. Formato de carga (compatible con REP-2907 / pgvector)

El `embedding` lo genera Matías en la carga con Gemini `text-embedding-004`; no se precalcula acá.

```json
{
  "source": {
    "source_type_code": "corpus_legal",
    "document_type": "Decreto-Ley",
    "document_number": "6769/58",
    "title": "Ley Orgánica de las Municipalidades",
    "issuing_authority": "Legislatura de la Provincia de Buenos Aires",
    "state_province_id": "<id de Buenos Aires>",
    "source_url": "https://normas.gba.gob.ar/documentos/OVG48SW0.html",
    "is_current": true,
    "verified_at": "2026-09-07",
    "last_amended_by": null
  },
  "fragment": {
    "hierarchy_path": "Ley Orgánica de las Municipalidades > Capítulo II > Artículo 52",
    "article": "52",
    "subsection": null,
    "foundation_type_code": "obligacion",
    "services": ["infraestructura"],
    "content": "Corresponde al Concejo disponer la prestación de los servicios públicos de barrido, riego, limpieza, alumbrado, provisión de agua, obras sanitarias y desagües pluviales, inspecciones, registro de guías, transporte y todo otro tendiente a satisfacer necesidades colectivas de carácter local, siempre que su ejecución no se encuentre a cargo de la Provincia o de la Nación."
  }
}
```

Los 8 registros se vuelcan directo desde los archivos de `docs/fuentes/normativas/` listados en §4.

## 9. Cambios al Modelo de Datos y su clasificación

| Cambio | Tipo |
|---|---|
| `normativas` se reemplaza por `knowledge_sources` + `knowledge_fragments` | Estructural |
| Nuevas tablas de catálogo `source_types` y `foundation_types` con semillas | Aditivo |
| Nueva tabla puente `fragment_services` | Aditivo |
| Ámbito geográfico por arco exclusivo (3 FK) en lugar de solo `subdivision_id` | Correctivo — hoy no se puede expresar el nivel provincial |

**Clasificación propuesta: cambio menor sin impacto en líneas base.** El fundamento es objetivo: el Modelo de Datos v3 declara las semillas como *pendientes* y la ingesta del corpus como *próximo paso*, es decir **la tabla está creada pero vacía y ningún componente la consume todavía** (REP-2907 no arrancó). No hay migración de datos, backfill ni ruptura de código. No agrega alcance funcional ni SP, no mueve fechas y no contradice ningún ADR: sigue siendo Supabase + pgvector.

**Dos consecuencias a registrar igual:**

1. **Modelo de Datos v3 → v3.1** — es el único documento con línea base a re-versionar.
2. **RLS sobre las tablas nuevas** — nacen sin políticas; se suma al trabajo pendiente de [REP-2507](https://unlz2026.atlassian.net/browse/REP-2507).

### 9.1 Justificación del diseño de dos tablas — impacto evaluado

La decisión de separar fuente y fragmento no es gratuita y se evaluó su costo antes de proponerla.

**Qué cuesta**

| Dimensión | Impacto |
|---|---|
| Consulta | El vector vive en `knowledge_fragments`, pero el filtro jurisdiccional y los datos de la cita viven en `knowledge_sources`: cada búsqueda necesita un JOIN sobre PK/FK indexada |
| Carga (REP-2907) | Dos INSERT dentro de una transacción en lugar de uno, más la lógica de reutilizar la fuente si ya existe |
| Superficie del modelo | Cinco tablas en vez de una: `knowledge_sources`, `knowledge_fragments`, `source_types`, `foundation_types`, `fragment_services` |

**La única consideración técnica de fondo** es que filtrar por jurisdicción antes de la búsqueda vectorial puede impedir que el índice `ivfflat` trabaje eficientemente — el problema conocido de *filtered vector search*. Se resuelve resolviendo primero los `source_id` elegibles en un CTE (consulta barata sobre el árbol geográfico, conjunto chico) y buscando después los vectores con `WHERE source_id = ANY(...)`.

**A la escala del proyecto no es un problema medible:** el corpus inicial son 8 fuentes y ~11 fragmentos; proyectado a cobertura nacional (unas 25 jurisdicciones por las categorías del catálogo) queda en el orden de los pocos miles de fragmentos, holgadamente dentro de lo que `pgvector` resuelve sin degradación.

**Qué se gana**

- **Una modificación de norma se actualiza en un solo lugar.** Si mañana se modifica la Ley 451, se actualiza una fila de `knowledge_sources` y quedan cubiertos todos sus artículos. En una tabla plana habría que actualizar cada fila de cada artículo, con el riesgo de dejar alguna sin actualizar.
- **Imposibilita la deriva de citas.** En una tabla plana, el título, la autoridad y la URL se repiten en cada artículo. El día que alguien corrige una URL en una fila y no en las otras, el sistema le envía a un organismo dos citas de la misma ley con datos distintos. **En un producto cuyo diferencial es la cita, ese es el peor error posible — peor que no citar.** No es hipotético: durante esta misma investigación se encontró el mismo artículo de la Ley 451 atribuido a dos números distintos por dos fuentes secundarias, y por eso hubo que verificar todo contra el texto consolidado.

**Alternativas evaluadas y descartadas**

| Alternativa | Por qué se descartó |
|---|---|
| Tabla plana (agregar columnas a `normativas`) | Viola BCNF por la dependencia `numero_norma → titulo, autoridad`, y habilita la deriva de citas descrita arriba |
| Diferir `fragment_services` al post-spike | Era viable —el vertical slice solo usa tránsito e infraestructura, donde cada fragmento mapea a una sola categoría— pero se optó por la versión completa: la tabla está vacía hoy y el costo de agregarla después, con corpus cargado y pipeline construido encima, es mayor |

**Momento de hacerlo.** El argumento decisivo no es de diseño sino de oportunidad: cambiar una tabla vacía que nadie consume es escribir una migración. Hacer el mismo cambio en el Sprint 14, con el corpus cargado y el pipeline de REP-2907 funcionando encima, es una migración de datos más rehacer código que ya andaba.

## 10. Cumplimiento de los criterios de aceptación de REP-2906

| Criterio | Dónde se cumple |
|---|---|
| Existe una estructura de documento/chunk reutilizable por el pipeline | §6.2 (tablas) + §8 (formato de carga) |
| Cada chunk conserva referencia inequívoca a su norma/artículo/fuente | `source_url` y `verified_at` NOT NULL + `hierarchy_path` (§6.2, §6.6) |
| Se documenta el criterio de jurisdicción y vigencia | §6.4 (cascada jurisdiccional) + §6.5 (vigencia y versionado) |
| El corpus inicial es pequeño y testeable | 8 normas (§4), dentro del rango 5–10 |

## Nota de versión

**v2.1 — 07/09/2026**

| Qué cambió | Por qué |
|---|---|
| Se agregó §9.1 con la justificación del diseño de dos tablas | A pedido del PO, para que el informe sirva como evidencia y fuente ante pares y el Consultor Especialista: qué cuesta, qué se gana, qué alternativas se evaluaron y por qué se hace ahora |
| Se confirma la versión **completa** (sin diferir `fragment_services`) | Decisión del PO: la tabla está vacía, el costo de agregarla después es mayor |

**v2.0 — 07/09/2026**

| Qué cambió | Por qué |
|---|---|
| Reemplaza el esquema propuesto en la v1.0 | La v1.0 proponía campos sobre `normativas` que no pasan BCNF y no podían expresar ámbito provincial. Se corrigió tras leer el DER real del Modelo de Datos v3 |
| El corpus deja de ser exclusivamente legal | El RAG es el corazón del sistema y debe poder leer también información no normativa: se introduce `source_types` como catálogo extensible |

---

**Documentos relacionados:** [REP-2906](https://unlz2026.atlassian.net/browse/REP-2906) · [REP-2907](https://unlz2026.atlassian.net/browse/REP-2907) · [REP-3764](https://unlz2026.atlassian.net/browse/REP-3764) · [REP-2507](https://unlz2026.atlassian.net/browse/REP-2507) · [REP-2205](https://unlz2026.atlassian.net/browse/REP-2205) · [REP-3764_casos_esperados.md](./REP-3764_casos_esperados.md) · [REP-2906_investigacion_corpus_legal.md](./REP-2906_investigacion_corpus_legal.md) · [Modelo de Datos v3](https://unlz2026.atlassian.net/wiki/spaces/Reportalo/pages/90406917)
