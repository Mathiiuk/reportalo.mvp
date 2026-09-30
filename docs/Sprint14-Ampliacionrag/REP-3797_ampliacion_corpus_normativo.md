# Reportalo

*Plataforma de Auditoría Ciudadana*

## AMPLIACIÓN DEL CORPUS NORMATIVO A LAS CINCO CATEGORÍAS — RELEVAMIENTO Y LOTE DE CARGA

**Versión 1.0 · 28 de septiembre de 2026 · Construcción · Proyecto RAR-2026**

**Jira:** [REP-3797](https://unlz2026.atlassian.net/browse/REP-3797) (Tarea · épica [REP-1002](https://unlz2026.atlassian.net/browse/REP-1002) EP | Flujo de reporte ciudadano) · Sprint 14
**Bloquea:** [REP-3795](https://unlz2026.atlassian.net/browse/REP-3795) (pruebas del Líder Técnico) · **se integra con** [REP-3774](https://unlz2026.atlassian.net/browse/REP-3774) (loader) · **se valida con** [REP-3784](https://unlz2026.atlassian.net/browse/REP-3784)
**Confluence:** espacio `Reportalo` — pendiente de publicar
**Referencia:** [REP-2906 — Guía del corpus de conocimiento del RAG](https://unlz2026.atlassian.net/browse/REP-2906) · [Modelo de Datos v3](https://unlz2026.atlassian.net/wiki/spaces/Reportalo/pages/90406917) · [Plan de Alcance v2.0](https://unlz2026.atlassian.net/wiki/spaces/Reportalo/pages/37552129)

**Equipo:** Hernán Gregorini (PO · DBA · autor) · Leonel Nuñez (PM / Scrum Master) · Matías Krepchuk (Líder Técnico · UX/UI) · Iván Juárez (QA · UX/UI)

**Consultor Especialista:** Carlos Ruiz (auditor externo · asesoría metodológica)

> **Propósito.** Llevar el corpus del RAG de dos categorías y media a **las cinco categorías del MVP en las dos jurisdicciones piloto**, con normativa real, vigente y citable. El entregable son tres cosas: este informe, doce archivos de texto verbatim en el repositorio y un lote de carga reproducible y reversible.

> **Lo que este documento no hace.** No afirma que el RAG "ya responde bien" las cinco categorías. Un corpus cargado no es un corpus recuperado: hasta que corra el paso de embeddings, los fragmentos nuevos no se recuperan por similitud. Eso está explicitado en §7.

---

## 1. Punto de partida: qué había realmente cargado

Relevado sobre `docs/fuentes/basedatos/REP_estado_base_de_datos_28-09-2026.sql`, el estado del proyecto Supabase real al 28/09/2026 — no sobre los documentos ni sobre el seed.

| Tabla | Filas al 28/09/2026 |
|---|---|
| `knowledge_sources` | 8 |
| `knowledge_fragments` | 17 |
| `fragment_services` | 16 |
| `fragment_embeddings` | 17 |

**Cobertura por categoría y jurisdicción, antes del lote:**

| Categoría | CABA | Avellaneda | Diagnóstico |
|---|---|---|---|
| Tránsito | Ley 2148 (2 frag.) + Ley 451 (2, sanción) | Ley 24.449 (5 frag.) | Cubierta, pero la Ley 13.927 estaba cargada como fuente **sin un solo fragmento**: la adhesión no se podía citar |
| Infraestructura | Ley 210 (3 frag.) | Const. PBA 192.4 + LOM 52 y 59 | CABA sin norma de veredas. Nada que dijera quién repara |
| Ambiente | Ley 210 art. 2 inc. c) (1 frag.) | LOM art. 52 (1 frag.) | Sin conducta prohibida ni marco de residuos en ninguna de las dos |
| Comercio irregular | — | — | **Vacía** |
| Vulnerabilidad social | — | — | **Vacía** |

**Tres hallazgos del relevamiento que no estaban documentados:**

1. **Comercio irregular tenía un fragmento, invisible.** El art. 48 inc. t) de la Ley 24.449 fue partido en dos en el Sprint 13 ("obstrucción" y "venta de productos en el camino"). El de venta **no tiene fila en `fragment_services`**: existe, tiene embedding, y el filtro por categoría no lo alcanza. Es la diferencia entre las 17 filas de fragmentos y las 16 de mapeo. El lote lo corrige.
2. **El versionado funciona.** El fragmento original del inciso t) quedó con `is_current = false` y sus dos reemplazos apuntan a él por `replaces_fragment_id`. El mecanismo de vigencia del diseño de REP-2906 está operando en la base real.
3. **La Ley 13.927 estaba desactualizada en el dato, no en el texto.** Su `last_amended_by` estaba vacío y el texto actualizado oficial declara modificaciones hasta la **Ley 15.613**, posterior a la verificación del 13/09.

---

## 2. Qué se agrega

**12 fuentes nuevas** (8 normativas + 4 de información institucional) y **67 fragmentos**, más 3 fuentes preexistentes que quedan completas.

### 2.1 Normativa

| Norma | Ámbito | Categoría | Fragmentos | Aporte |
|---|---|---|---|---|
| **Ley 5902** | CABA | Infraestructura | 6 | Quién repara la vereda: el frentista (art. 5), con eximiciones (art. 7) y competencia exclusiva del GCBA para vados y rampas (art. 8) |
| **Ley 1854** (Basura Cero) | CABA | Ambiente | 4 | Conducta prohibida: "Prohíbese la descarga de basura a cielo abierto y la creación de micro basurales" (art. 36) |
| **Ley 6101** | CABA | Comercio irregular | 4 | La obligación central: "No podrán ejercerse actividades económicas sin la clase de autorización correspondiente" (art. 8) |
| **Ley 3706** | CABA | Vulnerabilidad social | 7 | Definición de situación de calle y deberes del Estado porteño (el art. 4 entra por incisos: a, b, c y g) |
| **Ley 4036** | CABA | Vulnerabilidad social | 4 | **Definición legal de "vulnerabilidad social"** (art. 6), que es el nombre de nuestra categoría |
| **Ley 13.592** | Prov. Buenos Aires | Ambiente | 4 | "Las Autoridades Municipales quedan obligadas a clausurar dichos basurales" (art. 9) |
| **Ley 15.625** | Prov. Buenos Aires | Vulnerabilidad social | 7 | Ley provincial sancionada el **27/08/2026**; deroga la 13.956. Autoridad de aplicación, teléfono provincial y servicio móvil |
| **Ley 27.654** | Nacional | Vulnerabilidad social | 7 | De orden público en todo el país: cubre las dos jurisdicciones sin necesidad de adhesión |

### 2.2 Fuentes preexistentes que quedan completas

| Fuente | Qué se le agrega |
|---|---|
| **Ley 451** (CABA) | 8 artículos: 1.3.13 arrojar residuos, 1.3.10.1 escombros, 1.3.2.3.4 vuelco en sumideros, 2.1.14 mantenimiento de veredas, 2.1.8 depósito de materiales, 4.1.1 ausencia de habilitación, 4.1.2 venta en la vía pública sin autorización, 6.1.54 estacionamiento en aceras |
| **LOM 6769/58** | Art. 27 incs. 1, 2, 6, 8 y 17 — competencia municipal sobre habilitaciones, calles, mercados, higiene de baldíos y contaminación |
| **Ley 13.927** | Arts. 1, 2 y 2 bis, más la actualización de `last_amended_by` |

### 2.3 Información institucional — la respuesta a "¿a quién le reclamo?"

El esquema de REP-2906 previó `source_types` con el valor `informacion` justamente para esto, y hasta ahora estaba sin uso. Estas cuatro fuentes son páginas oficiales del propio organismo, con URL y fecha de verificación, igual que una ley:

| Fuente | Ámbito | Para qué |
|---|---|---|
| **Agencia Gubernamental de Control** (2 frag.) | CABA | Habilita y fiscaliza locales comerciales; denuncias por el 147 y por Gestión Colaborativa |
| **Línea 108 — Buenos Aires Presente** (1 frag.) | CABA | 24 horas, opción 1 para informar sobre una persona en situación de calle; deriva al Ministerio de Desarrollo Humano y Hábitat |
| **Municipalidad de Avellaneda** (4 frag.) | Avellaneda | Secretaría de Producción, Comercio y Ambiente (Subsecretaría de Habilitaciones), Centro de Atención al Vecino (0800-122-6323 y reclamosweb), Secretaría de Desarrollo Social y el Consejo de Niñez con guardia de 24 h |
| **SENAF — Ministerio de Capital Humano** (1 frag.) | Nacional | Autoridad de aplicación de la Ley 27.654 desde el Decreto 373/2025, con rol rector y subsidiario |

**Regla de uso, que conviene fijar como decisión:** un fragmento `informacion` **no reemplaza el fundamento normativo, lo completa**. Si no hay norma que respalde el reclamo, el dictamen muestra sólo el canal y dice explícitamente que es una derivación, no una infracción acreditada.

---

## 3. Cobertura después del lote

| Categoría | CABA | Avellaneda |
|---|---|---|
| **Tránsito** | Ley 2148 (conducta) + Ley 451 6.1.37, 6.1.52, 6.1.54 (sanción) | Ley 24.449 arts. 48 y 49 (conducta) + Ley 13.927 arts. 1, 2 y 2 bis (adhesión y competencia) |
| **Infraestructura** | Ley 5902 (obligación del frentista y del GCBA) + Ley 210 (ente regulador) + Ley 451 2.1.14 y 2.1.8 | Const. PBA 192.4 + LOM 52, 59 y 27.2 |
| **Ambiente** | Ley 1854 arts. 14, 16, 36, 48 + Ley 210 art. 2 inc. c) + Ley 451 1.3.13, 1.3.10.1, 1.3.2.3.4 | Ley 13.592 arts. 6, 9, 17 y 3.12 + LOM 52, 27.8 y 27.17 |
| **Comercio irregular** | Ley 6101 arts. 4, 6, 8, 10 + Ley 451 4.1.1 y 4.1.2 + canal AGC/147 | LOM 27.1 y 27.6 + Ley 24.449 art. 48 inc. t) + canal Subsecretaría de Habilitaciones / CAV |
| **Vulnerabilidad social** | Ley 3706 + Ley 4036 + Ley 27.654 + Línea 108 | Ley 15.625 + Ley 27.654 + Secretaría de Desarrollo Social y guardia de Niñez |

Ninguna celda queda vacía. La consulta **V-3** del lote lo verifica en la base y debe devolver cinco categorías con conteo mayor que cero.

**Asimetría que el corpus ahora puede sostener.** El caso de veredas quedó especialmente nítido: en Avellaneda el obligado es el municipio (Const. PBA + LOM); en CABA el obligado es un vecino, el frentista, y el GCBA fiscaliza e intima — salvo que la vereda la haya roto una empresa de servicios, una obra del propio GCBA o la raíz de un árbol, o que se trate de un vado o una rampa de accesibilidad, casos en los que responde la Ciudad. Es la regla "vereda rota → Infraestructura" con fundamento, y con el matiz de que el destinatario del reclamo **no es el mismo en las dos jurisdicciones**.

---

## 4. Verificación: qué se hizo con cada norma

Todas las fuentes se leyeron con Firecrawl **sobre la página oficial de la jurisdicción que dictó la norma**, no sobre reproducciones de terceros. La única excepción es la Ley 451, que se tomó del PDF consolidado oficial ya descargado y conservado en el repositorio desde la ronda de REP-2906.

| Norma | Fuente consultada | Estado de vigencia verificado |
|---|---|---|
| Ley 5902 | Boletín Oficial CABA, norma 392993 | Texto consolidado en digesto 25903 |
| Ley 1854 | Boletín Oficial CABA, norma 81508 | Consolidada por Ley 6764; se contrastó artículo por artículo contra la Ley 5966 |
| Ley 6101 | Boletín Oficial CABA, norma 446784 | Texto vigente |
| Ley 3706 | Boletín Oficial CABA, norma 165158 | Consolidada por Ley 6764; texto actualizado al 29/02/2024; art. 5 vetado |
| Ley 4036 | Boletín Oficial CABA, norma 187812 | Texto vigente |
| Ley 13.592 | Normas GBA, texto actualizado | Con modificaciones de las Leyes 13.657 y 15.078 |
| Ley 15.625 | Normas GBA | Sancionada 27/08/2026; deroga la Ley 13.956 |
| Ley 27.654 | InfoLEG + Boletín Oficial de la Nación | Art. 3 sustituido, art. 10 sustituido y art. 12 inc. a) derogado por Decreto 373/2025 |
| Ley 13.927 | Normas GBA, texto actualizado | Modificaciones hasta la Ley 15.613 |
| LOM art. 27 | Normas GBA, texto actualizado | Texto según Decreto-Ley 9117/78 |
| Ley 451 | PDF consolidado oficial en el repositorio | Cada artículo conserva su cadena de modificaciones |

### 4.1 Cinco trampas de vigencia que se evitaron

Vale documentarlas porque cada una habría producido una cita falsa en un dictamen enviado a un organismo.

| Trampa | Qué habría pasado |
|---|---|
| **Ley 27.654 art. 10** | Se iba a cargar el texto original, que pone la obligación de planes de vivienda en cabeza del Estado nacional. El Decreto 373/2025 lo sustituyó: hoy la obligación es de las jurisdicciones locales. Se habría reclamado al organismo equivocado |
| **Ley 13.956 (PBA)** | El propio Decreto nacional 373/2025 la cita como vigente en sus considerandos. **Está derogada** por el art. 23 de la Ley 15.625. Una norma que habla de otra no acredita la vigencia de esa otra |
| **Ley 2634 (CABA)** | La Ley 5902 art. 7 remite a ella. Está abrogada por el art. 2 de la Ley 5901 (2017) |
| **Ley 1854 art. 6** | El texto original fija metas para 2010, 2012 y 2017. La Ley 5966 las reemplazó por 2021, 2025 y 2030 |
| **`avellaneda.gob.ar`** | No es Avellaneda de Buenos Aires: es **Avellaneda de Santa Fe**. El dominio del partido bonaerense es `mda.gob.ar`. Es el mismo homónimo que ya nos había confundido un buscador semántico, ahora en versión dominio web |

### 4.2 Auditoría de chunking contra las reglas de REP-2906

Las reglas son: un fragmento = un artículo; si un artículo tiene incisos que responden preguntas distintas, cada inciso relevante puede ser su propio fragmento; **nunca partir un artículo al medio**; nunca fusionar dos artículos.

La primera versión del lote violaba la tercera regla en **ocho fragmentos**: traían un artículo recortado, con los párrafos que no hacían falta para el caso simplemente omitidos. Eso es exactamente lo que la regla prohíbe, y es peor que verboso: un dictamen que cita "Ley 6101 art. 8" mostrando la mitad del artículo le está mostrando al organismo un texto que no coincide con el oficial.

| Fragmento | Qué estaba mal | Cómo quedó |
|---|---|---|
| Ley 6101 art. 4 | Faltaban dos párrafos (procedimientos especiales y aplicación supletoria) | Artículo completo |
| Ley 6101 art. 8 | Faltaba la enumeración de las tres clases de autorización | Artículo completo |
| Ley 6101 art. 10 | Faltaba el segundo párrafo | Artículo completo |
| Ley 3706 art. 4 | Cuatro incisos (a, b, c, g) **fusionados en un solo chunk**, con los otros ocho omitidos | **Cuatro fragmentos, uno por inciso.** Los incisos d) a l) no se cargan, pero tampoco quedan partidos: cada uno es un chunk posible más adelante |
| Ley 13.592 art. 6 | Sólo el primer párrafo, con `subsection = 'parrafo-1'` | Artículo completo, `subsection` nulo |
| Ley 27.654 art. 3 | Faltaban dos oraciones del texto sustituido por el Decreto 373/2025 | Artículo completo |
| Ley 451 art. 4.1.1 | Faltaban los últimos tres párrafos (reincidencia, rubros complementarios) | Artículo completo |
| Ley 13.927 art. 2 | Faltaba el segundo párrafo (convenios con Gendarmería y ANSV) | Artículo completo |

Eso subió el lote de 64 a **67 fragmentos**. El resto ya cumplía: los incisos sueltos que se cargan (LOM art. 27 incs. 1, 2, 6, 8 y 17; Ley 13.592 art. 3 inc. 12; Ley 27.654 y Ley 15.625 art. 11 inc. 6) llevan el encabezado del artículo más su inciso, que es el patrón que ya usaban los fragmentos de la Constitución PBA art. 192 inc. 4 y de la Ley 210 art. 2.

Ningún fragmento fusiona dos artículos, y el distractor del Código de Faltas 8031/73 sigue cargado sin marca especial, como pide la regla 3.

### 4.3 Una mejora sobre lo registrado

`mda.gob.ar` estaba anotado como vía muerta por certificado SSL inválido desde el 07/09/2026. **Ya funciona**: fue la fuente de todos los datos institucionales de Avellaneda. `PENDIENTES_corpus.md` quedó actualizado.

---

## 5. Entregables

Los archivos de `docs/fuentes/normativas/` suelen transcribir **más artículos de los que el lote carga**: se relevó todo lo verificable de cada norma y se cargó lo que responde a un caso ciudadano del MVP. La columna "cargados" es lo que entra a la base.

| Archivo | Artículos relevados | Cargados |
|---|---|---|
| `ley_5902_caba_veredas.md` | 5, 6, 7, 8, 10, 11 | 6 |
| `ley_1854_caba_basura_cero.md` | 14, 16, 36, 48 (+ verificación contra la Ley 5966) | 4 |
| `ley_6101_caba_actividades_economicas.md` | 4, 6, 8, 10 | 4 |
| `ley_3706_caba_situacion_de_calle.md` | 2, 4 (incs. a a l), 6, 7 | 7 — el art. 4 se parte en un chunk por inciso: a, b, c y g |
| `ley_4036_caba_derechos_sociales.md` | 1, 5, 6, 18, 23 | 4 (sin el 5) |
| `ley_13592_pba_residuos.md` | 3.12, 6, 9, 17 | 4 |
| `ley_15625_pba_situacion_de_calle.md` | 1, 3, 4, 6, 11.6, 14, 16, 17, 23 | 7 (sin 17 ni 23) |
| `ley_27654_nacional_situacion_de_calle.md` | 2, 3, 4, 5, 8, 9, 11.6, 17, 18 + qué modificó el Decreto 373/2025 | 7 (sin 17 ni 18) |
| `ley_13927_pba_transito_arts_1_2.md` | 1, 2, 2 bis | 3 |
| `LOM_decreto_ley_6769-58_art_27.md` | art. 27 incs. 1, 2, 6, 8, 15, 17 | 5 (sin el 15) |
| `ley_451_caba_faltas_lote_s14.md` | 8 artículos + la lista de relevados y descartados | 8 |
| `canales_oficiales_derivacion.md` | CABA, Avellaneda, Provincia y Nación | 8 |
| `PENDIENTES_corpus.md` | actualizado: resueltos, nuevos pendientes y vías muertas | — |
| `docs/outputs/REP-3797_lote_corpus_S14.sql` | el lote: 9 partes, idempotente, con verificación y reversión | — |

---

## 6. Cómo se carga

El lote está escrito contra el esquema real del 28/09/2026 y sigue las reglas del proyecto:

- **IDs deterministas** (`30000000-…` para fuentes, `40000000-…` para fragmentos): se puede correr dos veces sin duplicar nada.
- **Ningún id escrito a mano**: la geografía y las categorías se resuelven por nombre y por `service_code`.
- **Arco exclusivo geográfico** respetado en las 12 fuentes nuevas.
- **Un tipo de documento nuevo** (`guia`) entra como `INSERT` en el catálogo, sin migración — es exactamente el caso de uso que el diseño de REP-2906 previó.
- **Seis transacciones separadas**, para que una falla no deje el lote a medias en estado ambiguo.
- **Reversión escrita** (Parte 9), con la advertencia de que si ya hubo análisis usando estos fragmentos conviene marcar `is_current = false` en lugar de borrar, para no perder `report_ai_evidence`.

Nota para Matías: el lote se puede ejecutar tal cual, o usarse como entrada del loader de [REP-3774](https://unlz2026.atlassian.net/browse/REP-3774) leyendo los `.md` de `docs/fuentes/normativas/`, que es el camino previsto. Cualquiera de los dos deja las mismas filas. La consulta V-7 depende de la función `eligible_knowledge_sources`, que el volcado del 28/09 no incluye; si no existe en el entorno, se saltea esa verificación y no afecta al resto.

---

## 7. Lo que falta para que esto sirva en una prueba

**El lote no genera embeddings.** `fragment_embeddings` queda sin filas para los 67 fragmentos nuevos, así que la búsqueda por similitud **no los recupera**. Hay que correr el paso de embeddings del loader con el modelo activo, que en el volcado del 28/09 es **`gemini-embedding-2@768`** (768 dimensiones) — no `text-embedding-004`, que es lo que todavía dicen algunos documentos del proyecto. El precheck imprime el modelo activo real. La consulta **V-5** del lote lista los fragmentos sin vector y tiene que quedar vacía antes de dar por cerrada la tarea.

Sin ese paso, un análisis sobre comercio irregular o vulnerabilidad social va a seguir devolviendo lo mismo que hoy, y la conclusión equivocada sería "el corpus no alcanza".

**Secuencia sugerida:**

| Paso | Quién | Qué |
|---|---|---|
| 1 | Hernán | Relevamiento y verificación — **hecho**, este documento |
| 2 | Matías | Correr el lote en staging y verificar V-1 a V-4 y V-6 |
| 3 | Matías | Generar embeddings de los 67 fragmentos y verificar que V-5 queda vacía |
| 4 | Iván | Validar recuperación y respuesta final de los casos esperados ([REP-3784](https://unlz2026.atlassian.net/browse/REP-3784)) |
| 5 | Matías | Retomar las pruebas de [REP-3795](https://unlz2026.atlassian.net/browse/REP-3795) con el RAG completo |

---

## 8. Cobertura pendiente — dicho sin adornos

El ticket pide registrar la cobertura pendiente sin prometer cobertura universal. Esto es lo que falta:

| Pendiente | Impacto | Ref. |
|---|---|---|
| Ordenanzas propias de Avellaneda (higiene urbana, residuos, habilitaciones, Ord. 7180 de faltas). Hoy Avellaneda se funda en normativa provincial: es válido y suficiente para el MVP, pero menos específico | Medio | P-12 |
| Articulado de la Ley 5901 (CABA, aperturas y roturas en la vía pública). Su Anexo I está sólo en una separata PDF del BOCBA que no responde a la lectura automatizada | Medio | P-13 |
| Código de Habilitaciones y Verificaciones de CABA (Ordenanza 34.421), régimen de permisos de venta en la vía pública | Bajo | P-14 |
| Número del Sistema Provincial de Atención Telefónica de la Ley 15.625 y su reglamentación. Sin ese dato, un caso de vulnerabilidad social en Avellaneda se deriva al canal municipal, que no tiene guardia de 24 h para personas adultas | Medio | P-15 |
| Leyes ambientales de respaldo: 11.723 (PBA), 25.675 y 25.916 (nacionales) | Bajo | P-16 |
| Texto completo de los arts. 7.1.8 y 7.1.9 de la Ley 2148 (CABA): los dos fragmentos cargados son incisos sueltos, sin el encabezado del artículo | Bajo | — |
| Canal general de CABA para infraestructura, ambiente y tránsito. El 147 y Gestión Colaborativa atienden todas las categorías, pero el fragmento cargado está redactado desde la AGC y sólo mapea a comercio irregular. Falta una ficha del canal 147 en sí, mapeada a las cinco | Medio | — |

**Y una limitación de fondo, que no se resuelve cargando más normas:** vulnerabilidad social no tiene conducta prohibida ni infractor. El corpus hoy puede fundamentar el deber del Estado y dar el canal correcto. No puede —ni debe— producir un dictamen con la misma forma que uno de tránsito. Si el análisis usa una sola plantilla de razonamiento para las cinco categorías, esta es la que va a sonar falsa.

---

## 9. Decisiones que quedan para el PO

| Decisión | Opciones |
|---|---|
| **Fragmentos `informacion` en el dictamen** | Mostrarlos siempre junto al fundamento, o sólo cuando no haya norma aplicable. La propuesta de este documento es la primera: el ciudadano necesita el canal incluso cuando hay norma |
| **Sanciones de comercio irregular** | La Ley 451 art. 4.1.2 tiene un mínimo de diez unidades fijas. Se carga como norma vinculada y no se muestra, igual que las de tránsito. Conviene ratificarlo |
| **Definiciones sin tipo de fundamento** | Ocho fragmentos son definiciones legales (qué es "vulnerabilidad social", qué es "persona en situación de calle") y quedaron con `foundation_type_code` nulo, porque no son obligación ni conducta ni sanción ni competencia. La alternativa es sumar un código `definicion` al catálogo, que es un `INSERT` |

---

## Nota de versión

**v1.0 — 28/09/2026**

| Qué | Por qué |
|---|---|
| Primera versión | Relevamiento de REP-3797 sobre el estado real de la base del 28/09/2026, con el pedido explícito del PO de cubrir las cinco categorías y de resolver, para comercio irregular y vulnerabilidad social, a quién reclamar cuando no hay una conducta prohibida clara |

---

**Documentos relacionados:** [REP-3797](https://unlz2026.atlassian.net/browse/REP-3797) · [REP-3795](https://unlz2026.atlassian.net/browse/REP-3795) · [REP-3774](https://unlz2026.atlassian.net/browse/REP-3774) · [REP-3784](https://unlz2026.atlassian.net/browse/REP-3784) · [REP-2906](https://unlz2026.atlassian.net/browse/REP-2906) · [REP-2907](https://unlz2026.atlassian.net/browse/REP-2907) · [REP-3764](https://unlz2026.atlassian.net/browse/REP-3764) · [Modelo de Datos v3](https://unlz2026.atlassian.net/wiki/spaces/Reportalo/pages/90406917)
