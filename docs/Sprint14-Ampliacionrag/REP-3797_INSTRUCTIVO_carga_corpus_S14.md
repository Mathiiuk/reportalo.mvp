# Reportalo

*Plataforma de Auditoría Ciudadana*

## INSTRUCTIVO DE CARGA DEL LOTE DE CORPUS — SPRINT 14

**Versión 1.0 · 28 de septiembre de 2026 · Construcción · Proyecto RAR-2026**

**Jira:** [REP-3797](https://unlz2026.atlassian.net/browse/REP-3797) (Tarea · épica [REP-1002](https://unlz2026.atlassian.net/browse/REP-1002) EP | Flujo de reporte ciudadano) · Sprint 14
**Para:** Matías Krepchuk (Líder Técnico) — ejecución en staging
**Desbloquea:** [REP-3795](https://unlz2026.atlassian.net/browse/REP-3795) · **se integra con** [REP-3774](https://unlz2026.atlassian.net/browse/REP-3774) · **se valida con** [REP-3784](https://unlz2026.atlassian.net/browse/REP-3784)
**Confluence:** espacio `Reportalo` — pendiente de publicar

> **Qué es esto.** El corpus del RAG pasa de 2 categorías y media a las 5 completas en CABA y Avellaneda. Este documento dice qué archivos hay, en qué orden se corren, qué verificar y cómo volver atrás. El lote **no borra ni altera nada existente**, salvo un `UPDATE` de un dato en una fila, señalizado más abajo.

---

## 1. Los archivos

| Archivo | Qué es | Se corre |
|---|---|---|
| `REP-3797_precheck_corpus_S14.sql` | Solo lectura. Estado actual + precondiciones | **Primero**, y se guarda la salida |
| `REP-3797_lote_corpus_S14.sql` | El lote. 9 partes, idempotente | Segundo |
| `REP-3797_ampliacion_corpus_normativo.md` | El informe: qué se relevó, cómo se verificó, qué falta | Lectura |
| 12 archivos de fuentes (ver §6) | Texto verbatim de cada norma, con URL oficial y fecha de verificación | Entrada del loader de REP-3774 |

Todo queda en la carpeta de Drive del proyecto, en la subcarpeta del corpus normativo, junto a los archivos de la ronda de REP-2906.

---

## 2. Qué cambia en la base

| Tabla | Antes | Después | Operación |
|---|---|---|---|
| `document_types` | 3 | 4 | `INSERT` de `guia`, para las fuentes de información institucional |
| `knowledge_sources` | 8 | 20 | `INSERT` de 12 fuentes |
| `knowledge_fragments` | 17 | 84 | `INSERT` de 67 fragmentos |
| `fragment_services` | 16 | 89 | `INSERT` de 73 filas (72 del lote + 1 corrección) |
| `fragment_embeddings` | 17 | 17 | **No se toca** — ver §4 |

**Nada de DDL sobre tablas existentes.** No hay `ALTER`, no hay `DROP`, no hay `DELETE`. El único `INSERT` de catálogo es una fila en `document_types`, que es exactamente el mecanismo previsto por el diseño de REP-2906: taxonomía abierta, esquema cerrado.

**Un solo `UPDATE` sobre una fila preexistente**, y conviene que lo mires antes de aplicar:

> `knowledge_sources` id `10000000-0000-4000-8000-000000000008` (Ley 13.927). Se le corrigen `title`, `last_amended_by` y `verified_at`. El texto actualizado oficial declara modificaciones hasta la **Ley 15.613**, que no estaba registrada. Los valores anteriores están comentados en el propio lote para poder deshacerlo.

**Una corrección de datos que no es parte del lote nuevo**, pero va en el mismo script:

> El fragmento `b6717f77-c30e-4cca-985a-6346d741fe38` — Ley 24.449 art. 48 inc. t), "venta de productos en el camino" — existe y tiene embedding, pero **no tiene fila en `fragment_services`**. Es la diferencia entre los 17 fragmentos y los 16 mapeos del estado actual. Era el único fragmento de comercio irregular cargado y el filtro por categoría no lo alcanzaba. El lote le agrega el mapeo a `COMERCIO_IRREGULAR`.

---

## 3. Cómo se aplica

### Paso 1 — Precheck (solo lectura)

Correr `REP-3797_precheck_corpus_S14.sql` y guardar la salida. Tiene que dar:

- **P-1:** 8 fuentes, 17 fragmentos, 16 mapeos, 17 embeddings, 3 tipos de documento, 5 categorías.
- **P-2:** `COMERCIO_IRREGULAR` y `VULNERABILIDAD_SOCIAL` en cero. Son el motivo del lote.
- **P-3:** todas las precondiciones en `OK`, y el nombre del modelo de embeddings activo.
- **P-4:** una sola fila — el fragmento sin categoría descrito arriba.

Si P-1 no coincide, la base se movió respecto del volcado del 28/09 con el que se escribió el lote. **Pará ahí y avisá**: no es que el lote esté mal, es que hay que revisar contra qué se está aplicando.

### Paso 2 — El lote

Correr `REP-3797_lote_corpus_S14.sql`. Dos cosas a tener en cuenta:

- **Arranca con una guarda.** Si falta una categoría, la geografía o alguna de las tres fuentes preexistentes que usa, aborta con `raise exception` **antes de escribir una sola fila**.
- **Son 6 transacciones separadas**, no una sola. Es deliberado: si una parte falla, las anteriores quedan aplicadas y completas, y el lote se puede volver a correr sin duplicar nada porque todos los ids son deterministas y cada `INSERT` lleva `ON CONFLICT DO NOTHING`. Correrlo dos veces es seguro.

### Paso 3 — Verificación

El lote trae las consultas V-1 a V-7 al final. Las que importan:

| Consulta | Qué tiene que dar |
|---|---|
| **V-1** | 20 fuentes, 84 fragmentos, 89 mapeos |
| **V-3** | las 5 categorías con conteo mayor que cero |
| **V-4** | vacío, salvo el distractor deliberado del Código de Faltas 8031/73 |
| **V-5** | **los 67 fragmentos nuevos, todos sin embedding** — ver §4 |
| **V-6** | vacío: no puede haber fuente sin URL ni sin fecha de verificación |
| **V-7** | requiere la función `eligible_knowledge_sources`. Si no existe en el entorno, se saltea |

---

## 4. El paso que falta y sin el que esto no sirve

**El lote no genera embeddings.** `fragment_embeddings` queda igual que antes, así que los 67 fragmentos nuevos **no se recuperan por búsqueda vectorial**. Hay que correr el paso de embeddings del loader de [REP-3774](https://unlz2026.atlassian.net/browse/REP-3774) con el modelo activo (el precheck P-3 lo imprime; en el volcado del 28/09 es `gemini-embedding-2@768`).

La consulta **V-5** lista los fragmentos sin vector y tiene que quedar **vacía** antes de dar la carga por terminada.

Si se prueba el RAG antes de ese paso, va a responder igual que hoy, y la conclusión equivocada sería "el corpus no alcanza".

---

## 5. Cómo volver atrás

La Parte 9 del lote trae el rollback completo y comentado. Resumen:

- **Si todavía no se generaron embeddings ni hubo análisis:** borrar por patrón de id, en orden — `fragment_services`, `knowledge_fragments`, `knowledge_sources`. Los ids del lote son `40000000-…` (fragmentos) y `30000000-…` (fuentes), así que no hay riesgo de tocar nada previo.
- **Si ya hubo análisis usando estos fragmentos:** no borrar. Marcar `is_current = false` en los fragmentos del lote. Borrarlos se lleva puesta la evidencia de esos análisis en `report_ai_evidence`.
- **El `UPDATE` de la Ley 13.927 y el mapeo del fragmento huérfano se dejan** en cualquiera de los dos casos: son correcciones de datos preexistentes, no parte del lote nuevo.

---

## 6. Las fuentes, completas y verificables

Cada archivo trae el texto verbatim, la URL oficial y la fecha de verificación en su cabecera. Todas se leyeron sobre la página oficial de la jurisdicción que dictó la norma; la única excepción es la Ley 451, que viene del PDF consolidado oficial ya conservado desde la ronda de REP-2906.

| Archivo | Norma | Ámbito | Categoría | Fuente oficial |
|---|---|---|---|---|
| `ley_5902_caba_veredas.md` | Ley 5902 — veredas | CABA | Infraestructura | https://boletinoficial.buenosaires.gob.ar/normativaba/norma/392993 |
| `ley_1854_caba_basura_cero.md` | Ley 1854 — Basura Cero | CABA | Ambiente | https://boletinoficial.buenosaires.gob.ar/normativaba/norma/81508 |
| `ley_6101_caba_actividades_economicas.md` | Ley 6101 — actividades económicas | CABA | Comercio irregular | https://boletinoficial.buenosaires.gob.ar/normativaba/norma/446784 |
| `ley_3706_caba_situacion_de_calle.md` | Ley 3706 — situación de calle | CABA | Vulnerabilidad social | https://boletinoficial.buenosaires.gob.ar/normativaba/norma/165158 |
| `ley_4036_caba_derechos_sociales.md` | Ley 4036 — derechos sociales | CABA | Vulnerabilidad social | https://boletinoficial.buenosaires.gob.ar/normativaba/norma/187812 |
| `ley_451_caba_faltas_lote_s14.md` | Ley 451 — 8 artículos nuevos | CABA | Ambiente, infraestructura, comercio, tránsito | https://boletinoficial.buenosaires.gob.ar/normativaba/norma/391197 |
| `ley_13592_pba_residuos.md` | Ley 13.592 — GIRSU | Prov. Buenos Aires | Ambiente | https://normas.gba.gob.ar/documentos/BK871coV.html |
| `ley_15625_pba_situacion_de_calle.md` | Ley 15.625 — situación de calle | Prov. Buenos Aires | Vulnerabilidad social | https://normas.gba.gob.ar/documentos/Vr7gJrsO.html |
| `ley_13927_pba_transito_arts_1_2.md` | Ley 13.927 — adhesión y competencia | Prov. Buenos Aires | Tránsito | https://normas.gba.gob.ar/documentos/0YqDnfd0.html |
| `LOM_decreto_ley_6769-58_art_27.md` | LOM art. 27 | Prov. Buenos Aires | Comercio, ambiente, infraestructura | https://normas.gba.gob.ar/documentos/OVG48SW0.html |
| `ley_27654_nacional_situacion_de_calle.md` | Ley 27.654 + Decreto 373/2025 | Nacional | Vulnerabilidad social | https://servicios.infoleg.gob.ar/infolegInternet/anexos/355000-359999/358622/norma.htm y https://www.boletinoficial.gob.ar/detalleAviso/primera/326250/20250602 |
| `canales_oficiales_derivacion.md` | Canales oficiales de derivación | CABA, Avellaneda, Provincia, Nación | Las 5 | Ver cada ficha; una URL por organismo |

### 6.1 Cómo están cortados los fragmentos

Se respeta la regla de chunking de REP-2906: **un fragmento = un artículo**; si un artículo tiene incisos que responden preguntas distintas, cada inciso relevante es su propio fragmento, con el encabezado del artículo adelante; **nunca se parte un artículo al medio** ni se fusionan dos artículos.

Dos consecuencias prácticas al revisar:

- Los artículos van **completos**, aunque tengan párrafos que no aplican al caso. Un artículo recortado sería una cita que no coincide con el texto oficial.
- Los que van por inciso son: Ley 3706 art. 4 (incisos a, b, c y g, cuatro fragmentos), LOM art. 27 (incisos 1, 2, 6, 8 y 17), Ley 13.592 art. 3 inciso 12, y el art. 11 inciso 6 de la Ley 27.654 y de la Ley 15.625. En todos, el chunk trae el encabezado del artículo más su inciso — el mismo patrón de los fragmentos ya cargados de la Constitución PBA art. 192 inc. 4 y de la Ley 210 art. 2.

### 6.2 Fuentes de tipo `informacion`: para qué están

Cuatro fuentes no son normativa sino información institucional oficial (`source_type_code = 'informacion'`, tipo de documento `guia`): la Agencia Gubernamental de Control y la Línea 108 en CABA, las áreas y canales de la Municipalidad de Avellaneda, y la SENAF a nivel nacional. Responden "a quién le reclamo" en los casos donde no hay una conducta prohibida clara, que es la situación típica de vulnerabilidad social.

**Regla de uso, importante para el prompt del dictamen:** un fragmento `informacion` **no reemplaza el fundamento normativo, lo completa**. Si no hay norma aplicable, el dictamen muestra sólo el canal y tiene que decir explícitamente que es una derivación, no una infracción acreditada.

---

## 7. Dos advertencias de contenido que afectan al prompt

1. **La misma categoría no se fundamenta igual en las dos jurisdicciones.** El caso más nítido quedó en veredas: en Avellaneda el obligado es el municipio; en CABA es el propietario frentista (Ley 5902 art. 5), salvo que la haya roto una prestadora de servicios, una obra del GCBA o la raíz de un árbol, o que se trate de un vado o rampa de accesibilidad, casos en que responde la Ciudad. Si el análisis usa una sola plantilla de razonamiento, en una de las dos se equivoca de destinatario.
2. **Vulnerabilidad social no tiene conducta prohibida ni infractor.** El corpus puede fundamentar el deber del Estado y dar el canal correcto, y nada más. Un dictamen con la misma forma que uno de tránsito va a sonar falso.

---

## 8. Qué queda pendiente (para que no se prometa cobertura universal)

| Pendiente | Impacto |
|---|---|
| Ordenanzas propias de Avellaneda (higiene urbana, residuos, habilitaciones, Ord. 7180 de faltas). Hoy Avellaneda se funda en norma provincial: válido, menos específico | Medio |
| Anexo I de la Ley 5901 (CABA, aperturas y roturas en la vía pública): existe sólo en una separata PDF del boletín que no se puede leer automáticamente | Medio |
| Número del sistema telefónico provincial que crea la Ley 15.625 art. 14: no está publicado. **Por eso no hay ningún 0-800 en el corpus** y Avellaneda no tiene guardia de 24 h para personas adultas | Medio |
| Ficha propia del canal 147 de CABA, mapeada a las 5 categorías. Hoy el fragmento de canal porteño está redactado desde la AGC y sólo mapea a comercio irregular | Medio |
| Código de Habilitaciones de CABA (Ordenanza 34.421) y las ambientales de respaldo (Ley 11.723 provincial, 25.675 y 25.916 nacionales) | Bajo |
| Los fragmentos **ya cargados** de la Ley 2148 arts. 7.1.8 y 7.1.9 son incisos sueltos sin el encabezado del artículo. Mismo problema de chunking, pero en filas preexistentes con embeddings y evidencia asociada: se corrige aparte, con versionado, no en este lote | Bajo |

---

**Documentos relacionados:** [REP-3797](https://unlz2026.atlassian.net/browse/REP-3797) · [REP-3795](https://unlz2026.atlassian.net/browse/REP-3795) · [REP-3774](https://unlz2026.atlassian.net/browse/REP-3774) · [REP-3784](https://unlz2026.atlassian.net/browse/REP-3784) · [REP-2906](https://unlz2026.atlassian.net/browse/REP-2906) · [Modelo de Datos v3](https://unlz2026.atlassian.net/wiki/spaces/Reportalo/pages/90406917)
