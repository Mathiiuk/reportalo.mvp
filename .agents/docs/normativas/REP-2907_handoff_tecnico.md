# Reportalo

*Plataforma de Auditoría Ciudadana*

## HANDOFF TÉCNICO — INSUMOS PARA EL VERTICAL SLICE RAG

**Versión 1.0 · 7 de septiembre de 2026 · Construcción · Proyecto RAR-2026**

**Jira:** [REP-2907](https://unlz2026.atlassian.net/browse/REP-2907) (T · Implementar vertical slice RAG: carga, embeddings y retrieval · Sprint 11)
**Entradas:** [REP-2906](https://unlz2026.atlassian.net/browse/REP-2906) (corpus + estructura) · [REP-3764](https://unlz2026.atlassian.net/browse/REP-3764) (casos esperados)
**Confluence:** espacio `Reportalo` — pendiente de publicar

**Equipo:** Hernán Gregorini (PO / Autor) · Leonel Nuñez (PM / Scrum Master) · Matías Krepchuk (Líder Técnico · UX/UI) · Iván Juárez (QA · UX/UI)

**Consultor Especialista:** Carlos Ruiz (auditor externo · asesoría metodológica)

> **Propósito.** Reunir en un solo lugar todo lo que hace falta para implementar REP-2907, sin tener que leer los tres documentos de investigación. Qué está listo, qué hay que crear, cómo cargar, cómo consultar y qué se espera que dé.

---

## 1. Qué recibís, ya listo

Ocho normas con **texto verbatim verificado contra el texto consolidado oficial**, cada una con URL de origen y fecha de verificación en su cabecera.

**Dónde están:** en el repositorio bajo `docs/fuentes/normativas/`, y publicadas también en [esta carpeta de Google Drive](https://drive.google.com/drive/folders/16XyigEXKergHidPxQjIDjlQeC2iPtmjk?usp=drive_link) (incluye la subcarpeta `pdf` con los textos consolidados originales).

| # | Archivo | Norma | Ámbito | Categoría | Fundamento |
|---|---|---|---|---|---|
| 1 | `constitucion_pba_arts_190_192.md` | Constitución PBA, art. 192 inc. 4 | Provincial — Buenos Aires | Infraestructura | Obligación |
| 2 | `LOM_decreto_ley_6769-58_arts_52_59.md` | Dec-Ley 6769/58, art. 52 | Provincial — Buenos Aires | Infraestructura | Obligación |
| 3 | `LOM_decreto_ley_6769-58_arts_52_59.md` | Dec-Ley 6769/58, art. 59 | Provincial — Buenos Aires | Infraestructura | Obligación |
| 4 | `ley_210_caba_ente_regulador.md` | Ley 210, arts. 2 y 3 | Municipal — CABA | Infraestructura | Competencia |
| 5 | `ley_24449_arts_48_49.md` | Ley 24.449, arts. 48 y 49 | Nacional | Tránsito | Conducta prohibida |
| 6 | `ley_2148_caba_arts_7.1.8_7.1.9.md` | Ley 2148, arts. 7.1.8 y 7.1.9 | Municipal — CABA | Tránsito | Conducta prohibida |
| 7 | `ley_451_caba_art_6.1.52_y_6.1.37.md` | Ley 451, art. 6.1.52 | Municipal — CABA | Tránsito | Sanción |
| 8 | `codigo_faltas_decreto_ley_8031-73_indice.md` | Dec-Ley 8031/73 (índice) | Provincial — Buenos Aires | *(ninguna)* | *(distractor)* |

Los archivos 2 y 3 salen del mismo archivo pero son **dos fragmentos distintos**, no uno.

## 2. Qué hay que crear en la base

Cinco tablas. El detalle completo de columnas está en `REP-2906_corpus_minimo_estructura.md` §6.2; acá va lo operativo.

| Tabla | Rol | Puntos de atención |
|---|---|---|
| `source_types` | Catálogo. Semillas: `corpus_legal`, `informacion` | Sumar un tipo nuevo es un INSERT, no una migración |
| `foundation_types` | Catálogo. Semillas: `obligacion`, `conducta_prohibida`, `sancion`, `competencia` | |
| `knowledge_sources` | Una fila por norma | `source_url` y `verified_at` **NOT NULL**. Arco exclusivo: exactamente una de `country_id` / `state_province_id` / `subdivision_id` |
| `knowledge_fragments` | Una fila por artículo/inciso. **Acá vive el `embedding vector(768)`** | UNIQUE(`source_id`, `article`, `subsection`). Índice `ivfflat` con similitud coseno |
| `fragment_services` | Puente M:N con `services` (Open311) | PK compuesta (`fragment_id`, `service_id`) |

**Tres cosas que no hay que olvidar:**

1. **RLS habilitada desde la creación.** Una tabla sin políticas es legible con la clave pública — advertencia explícita del Modelo de Datos v3. Se coordina con [REP-2507](https://unlz2026.atlassian.net/browse/REP-2507).
2. **Semillas previas necesarias:** `states_provinces` con Buenos Aires y CABA (hoy pendiente en [REP-2205](https://unlz2026.atlassian.net/browse/REP-2205)) — sin la provincia cargada no se pueden anclar las 4 normas provinciales del corpus.
3. **`services` necesita 5 categorías, no 4** — falta vulnerabilidad social. El Modelo de Datos v3 todavía dice 4.

## 3. Cómo cargar

El `embedding` se genera en la carga con Gemini `text-embedding-004` (768 dimensiones, confirmado en [REP-2903](https://unlz2026.atlassian.net/browse/REP-2903)). No viene precalculado.

Reglas de chunking a respetar:

- **Un fragmento = un artículo.** Si un artículo tiene incisos que responden preguntas distintas, cada inciso puede ser su propio fragmento. Nunca partir un artículo al medio por límite de tokens.
- **Nunca fusionar dos artículos** en un fragmento, aunque sean cortos y de la misma norma.
- **El distractor (ítem 8) se carga igual que el resto, sin marca especial.** Si se lo etiqueta como "no recuperar", deja de servir para probar el pipeline.

Formato de carga, con ejemplo real, en `REP-2906_corpus_minimo_estructura.md` §8.

## 4. Cómo consultar — patrón de recuperación

**La jurisdicción nunca va en el embedding.** El vector codifica qué dice la norma; la geografía es filtro estructurado. Durante la investigación un buscador semántico confundió Avellaneda de Buenos Aires con Avellaneda de Santa Fe: un embedding no distingue homónimos geográficos, una FK sí.

El patrón sugerido, en dos pasos, para no romper el índice vectorial:

1. Resolver la localidad del reporte hacia arriba (localidad → subdivisión → provincia → país) y obtener los `source_id` elegibles de los **tres niveles juntos** — no filtrar solo por el más local.
2. Buscar por similitud sobre `knowledge_fragments` acotando con `WHERE source_id = ANY(...)`.

El orden de la respuesta es por especificidad: la norma más local que aplique manda, la de rango superior queda como marco. Por eso, para un reclamo de infraestructura en Avellaneda, la Constitución PBA y la LOM se recuperan **juntas**, no compiten.

## 5. Qué se espera que dé — casos de prueba

Los seis casos están en `REP-3764_casos_esperados.md` con el detalle completo. Resumen:

| Caso | Consulta | Resultado esperado |
|---|---|---|
| A | Boca de tormenta rota en Avellaneda | Fragmentos 1, 2 y 3 |
| B | Auto sobre rampa en CABA | Fragmentos 6 **y** 7 (conducta + sanción, las dos) |
| C | Mismo texto, en Avellaneda | Fragmento 5. **No** debe traer 6 ni 7 (prueba el filtro jurisdiccional) |
| D | "No anda la luz de la calle", una vez en cada jurisdicción | Avellaneda → fragmento 2 · CABA → fragmento 4. Si devuelve lo mismo para ambas, no está distinguiendo la lógica jurídica |
| E | "Hay quilombo en la esquina, frenan el tránsito" (Avellaneda) | Fragmento 5. **No** debe traer el 8 (distractor) — prueba falso positivo por vocabulario compartido |
| F | Puesto que vende sin habilitación | **Nada del corpus.** Debe declarar que no tiene fundamento cargado, no inventar una cita ni rechazar el reporte |

**Criterio de resultado útil para Sprint 11:** que el pipeline recupere los fragmentos esperados con fuente, artículo y jurisdicción visibles, y trazabilidad al fragmento de origen. No se exige clasificación jurídica final, prompt productivo ni precisión objetivo definitiva.

## 6. Advertencias que ahorran tiempo

- **La sanción no se muestra al ciudadano.** El fragmento 7 (Ley 451) se carga para validar que el pipeline recupera normas vinculadas, pero Reportalo no emite multas — está confirmado en el Acta v3.0 y el Plan de Alcance v2.0. No construir salida de usuario con montos.
- **Los casos E y F son los más importantes del set.** Prueban que el sistema no inventa cuando no sabe. Si el RAG le fabrica un fundamento al caso F, la promesa central del producto se cae: pasa a ser peor que una app de quejas, porque aparenta un respaldo que no existe.
- **Dos categorías no tienen corpus:** comercio irregular y vulnerabilidad social. No es un bug del pipeline si no devuelve nada para ellas — es el estado real del corpus, y el caso F lo usa a propósito.
- **Ojo con los textos derogados.** Circulan versiones viejas del art. 6.1.52 de la Ley 451 con montos distintos. El texto del archivo está verificado contra el consolidado oficial; no reemplazarlo por lo que devuelva una búsqueda web.

## 7. Herramienta disponible

`tools/extraer_pdf.py` — extractor de texto de PDF con librería estándar de Python, sin dependencias. Uso: `python tools/extraer_pdf.py archivo.pdf salida.txt`. El texto sale fragmentado palabra por palabra; reagrupar con `re.sub(r'\s+', ' ', texto)`. No funciona con PDF de fuentes CID.

---

**Documentos relacionados:** [REP-2906_corpus_minimo_estructura.md](./REP-2906_corpus_minimo_estructura.md) · [REP-3764_casos_esperados.md](./REP-3764_casos_esperados.md) · [REP-2906_investigacion_corpus_legal.md](./REP-2906_investigacion_corpus_legal.md) · [REP-2907](https://unlz2026.atlassian.net/browse/REP-2907) · [REP-2507](https://unlz2026.atlassian.net/browse/REP-2507) · [REP-2205](https://unlz2026.atlassian.net/browse/REP-2205) · [Modelo de Datos v3](https://unlz2026.atlassian.net/wiki/spaces/Reportalo/pages/90406917)
