# REP-3774 — Loader y bucket del corpus RAG · evidencia de ejecución

**Sprint 13 · 20/09/2026 · rama `feat/REP-3774-loader-bucket-corpus-rag`**

Alcance reducido según el comentario de Leo en el ticket: lo de Sprint 12
(modelo de datos, estructura de fuentes/fragmentos, embeddings, vigencia y
versionado) queda reconocido como trabajo adelantado y no se rehace. Lo que se
hizo acá es sólo el remanente: **loader desde `.md` + bucket privado
`corpus-fuentes` + prueba reproducible de carga**.

## Qué se entrega

| Archivo | Qué es |
|---|---|
| `supabase/migrations/20260920210000_rep3774_corpus_fuentes_bucket_y_loader.sql` | Bucket privado `corpus-fuentes` + los RPC `upsert_knowledge_source` y `upsert_knowledge_fragment` |
| `scripts/corpus-loader/load-corpus.mjs` | El loader |
| `scripts/corpus-loader/parse-corpus-md.mjs` | Parser del formato `.md` verificado |
| `scripts/corpus-loader/README.md` | Formato del archivo, uso y reglas de idempotencia |
| `corpus/normativas/ley_210_caba_ente_regulador.md` | Norma de prueba, en el formato nuevo |
| `src/test/CorpusMdParser.test.js` | 18 tests del parser |

Por qué las reglas de escritura viven en RPC y no en JavaScript: el índice
`knowledge_fragments_current_uq` prohíbe dos fragmentos vigentes con el mismo
`(source_id, article, subsection)`, así que bajar el viejo y subir el nuevo tiene
que pasar en una sola transacción, y `supabase-js` no puede abrir una.

## Cómo se verificó

Postgres 17 local, en un directorio de datos descartable, con los scripts que ya
existen en `supabase/local-dev/sql/native-no-pgvector/` (esquema mínimo + árbol
geográfico + esquema RAG + el seed real de 8 normas y 15 fragmentos de
REP-3769). Encima de eso se aplicaron los dos RPC de la migración.

Las llamadas a los RPC se generaron con el **parser real del loader**, de modo
que lo que se probó es el camino `.md` → parser → argumentos → RPC, no SQL
escrito a mano.

### Resultado

| Corrida | Qué se cargó | Fuente | art. 2 b | art. 2 c | art. 3 j | art. 2 a |
|---|---|---|---|---|---|---|
| C1 | el `.md` de la Ley 210, ya presente en el corpus | `updated` | `unchanged` | `unchanged` | `unchanged` | — |
| C2 | lo mismo, otra vez | `updated` | `unchanged` | `unchanged` | `unchanged` | — |
| C3 | se agrega el art. 2 inc. a) al `.md` | `updated` | `unchanged` | `unchanged` | `unchanged` | `created` |
| C4 | cambia el texto del art. 2 inc. a) | `updated` | `unchanged` | `unchanged` | `unchanged` | `versioned` |

Estado final de la Ley 210 después de las cuatro corridas:

```
 article | subsection | is_current | reemplaza_a_otro | texto
---------+------------+------------+------------------+------------------------------------------
 2       | a          | f          | f                | a) Transporte público de pasajeros
 2       | a          | t          | t                | a) Transporte publico de pasajeros y de
 2       | b          | t          | f                | b) Alumbrado público y señalamiento lumi
 2       | c          | t          | f                | c) Higiene urbana, incluida la disposici
 3       | j          | t          | f                | j) Recibir y tramitar las quejas y recla

 vigentes | total
----------+-------
       16 |    17
```

Los 15 fragmentos del seed siguen intactos: cuatro corridas del loader sumaron
exactamente dos filas —el artículo nuevo y su versión posterior— y ninguna
duplicada. La versión vieja del art. 2 inc. a) queda con `is_current = false` y
la nueva apunta a ella, que es lo que permite que un análisis emitido antes siga
citando el texto que existía ese día.

`snapshot_path` quedó escrito en `knowledge_sources`.

### Tests del parser

```
npx vitest run src/test/CorpusMdParser.test.js   →  18 passed
npx vitest run                                    →  266 passed (37 archivos)
```

## Hallazgo: el nombre del municipio no alcanza para ubicar una norma

Al verificar contra el árbol geográfico real aparecieron **dos subdivisiones
llamadas "Avellaneda"**: una en Buenos Aires y otra en Santa Fe.

```
 a16fcb61-c1d4-4131-84cc-498e92a6cadd | Avellaneda | Buenos Aires
 4fca1689-b509-4f73-ae83-db8e8f7f256f | Avellaneda | Santa Fe
```

Una ordenanza municipal cargada contra la equivocada queda aplicándose a
ciudadanos de otra provincia, y eso no se nota hasta que el RAG le cita a un
vecino una norma ajena. El loader por eso:

- exige `scope_parent` (la provincia) cuando el ámbito es `subdivision`;
- trata cualquier coincidencia ambigua como error, nunca "agarrar la primera".

Queda cubierto por los tests UT-CRP-17 y UT-CRP-18.

## Qué falta para cerrar, y por qué

La corrida contra Supabase real —subida del snapshot al bucket y generación de
embeddings— **no se ejecutó**. Necesita `SUPABASE_SERVICE_ROLE_KEY`, que no está
en `.env` ni debe estarlo, y que no manejo yo.

Lo que quedó verificado sin esa clave es la lógica de carga y versionado, que es
la parte con riesgo. Lo que falta es mecánico:

```bash
# con SUPABASE_SERVICE_ROLE_KEY exportada en la shell
node scripts/corpus-loader/load-corpus.mjs corpus/normativas/ley_210_caba_ente_regulador.md --dry-run
node scripts/corpus-loader/load-corpus.mjs corpus/normativas/ley_210_caba_ente_regulador.md
```

Contra el corpus actual eso tiene que dar `updated` en la fuente y `unchanged`
en los tres fragmentos: no toca el texto de ninguna norma ya verificada, sólo
escribe el snapshot en el bucket y deja la ruta en `snapshot_path`.

Orden sugerido: aplicar primero la migración `20260920210000` (crea el bucket),
después la corrida con `--dry-run`, y recién entonces la real.

## Nota sobre el corpus

La norma que se usó de prueba es una que Hernán ya verificó en REP-2906 y que ya
estaba en el corpus. **No se incorporó ninguna norma nueva**: decidir qué entra
al corpus es contenido, no infraestructura, y va por la vía de REP-2908.

Las normas que hoy están en `.agents/docs/normativas/normativas/` (por ejemplo
la Ordenanza 27235 de Avellaneda) se pueden pasar a este formato cuando estén
verificadas. Dos cosas a tener en cuenta cuando llegue ese momento:

- `document_types` todavía no tiene el código `ordenanza`. Agregarlo es un
  `INSERT` en el catálogo, no una migración — el loader avisa con el código
  exacto que falta antes de escribir nada.
- Esa ordenanza viene de una fuente secundaria (`ecofield.net`, no el Boletín
  Oficial municipal), así que necesita verificación antes de cargarse.
