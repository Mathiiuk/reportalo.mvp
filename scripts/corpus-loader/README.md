# Loader del corpus RAG (REP-3774)

Carga una norma verificada desde un archivo `.md` hacia el corpus de producción,
de forma reproducible y auditable: sin escribir SQL a mano, sin duplicar filas si
se corre dos veces, y dejando el archivo cargado guardado como snapshot.

Sprint 12 dejó resuelto el modelo de datos (`knowledge_sources`,
`knowledge_fragments`, `fragment_embeddings`, vigencia y versionado). Esto es
solo el camino de entrada a esas estructuras; no las rediseña.

## Qué hace, en orden

1. Parsea el `.md` y valida la cabecera, los fragmentos y los catálogos
   (`source_types`, `document_types`, `foundation_types`, `services`). Si algo
   falta, corta **antes** de escribir nada.
2. Resuelve el ámbito contra el árbol geográfico real (`countries` /
   `states_provinces` / `subdivisions`). Nunca por texto libre.
3. Sube el archivo al bucket privado `corpus-fuentes` y guarda la ruta en
   `knowledge_sources.snapshot_path`.
4. Llama a `upsert_knowledge_source` y, por cada fragmento, a
   `upsert_knowledge_fragment` (migración `20260920210000`).
5. Genera el embedding con el `embedding_models` activo y lo guarda en
   `fragment_embeddings`, solo para los fragmentos nuevos o versionados.

## Uso

```bash
node scripts/corpus-loader/load-corpus.mjs corpus/normativas/ley_210_caba_ente_regulador.md
```

| Flag | Para qué |
|---|---|
| `--dry-run` | Valida el archivo, los catálogos y el ámbito, y muestra el plan. No escribe nada. Es lo que conviene correr primero. |
| `--skip-embeddings` | Carga texto y metadata sin llamar a Gemini. Útil sin `GEMINI_API_KEY`; los vectores quedan pendientes. |

Variables de entorno (se leen de `.env` o del ambiente, y el ambiente gana):

| Variable | Nota |
|---|---|
| `SUPABASE_URL` | O `VITE_SUPABASE_URL`. |
| `SUPABASE_SERVICE_ROLE_KEY` | **No está en `.env` ni se commitea.** Sin esto el loader no arranca. |
| `GEMINI_API_KEY` | Solo si no se usa `--skip-embeddings`. |

El corpus se escribe únicamente con clave de servicio: los dos RPC están
revocados para `anon` y `authenticated`, y el bucket `corpus-fuentes` no tiene
ninguna política de storage, así que ninguna sesión del navegador lo ve.

## Formato del archivo `.md`

Cabecera de metadata entre `---`, y después un bloque por fragmento. Todo lo que
esté fuera de un bloque `## fragmento` (títulos, notas de investigación) se
ignora: el archivo sigue siendo legible para quien verifica la norma.

````markdown
---
source_type: corpus_legal          # código de source_types
document_type: ley                 # código de document_types
document_number: 24.449            # opcional
title: Ley de Tránsito
issuing_authority: Congreso de la Nación Argentina
scope: country                     # country | state_province | subdivision
scope_name: AR                     # iso_code del país, o el nombre exacto de la jurisdicción
scope_parent:                      # obligatorio con scope: subdivision (la provincia)
requires_adhesion: true
source_url: https://servicios.infoleg.gob.ar/...
verified_at: 2026-09-06            # fecha en que se verificó contra la fuente
last_amended_by:                   # opcional
---

## fragmento
article: 48
subsection: i
hierarchy_path: Ley 24.449 > Artículo 48 > inciso i)
foundation_type: conducta_prohibida
services: TRANSITO                 # separados por coma; puede ir vacío

```texto
i) La detención irregular sobre la calzada...
```
````

El texto citable va **dentro** del bloque cercado ` ```texto `, verbatim y sin
reformatear: es exactamente lo que se va a poder citar en un dictamen, y lo que
se compara para decidir si una norma cambió.

## Por qué correrlo dos veces no rompe nada

La identidad de una norma es `(document_type, document_number, ámbito)` — no el
título, que cambia de redacción entre fuentes. La de un fragmento es
`(source_id, article, subsection)`.

Con eso, cada fragmento cae en uno de tres casos:

| Caso | Qué pasa |
|---|---|
| `unchanged` | Mismo texto que el vigente. No se toca la fila ni se re-embebe. Se refrescan solo `hierarchy_path` y `foundation_type`, que son metadata y no el texto citado. |
| `created` | Primera carga de ese artículo/inciso. |
| `versioned` | El texto cambió. El vigente pasa a `is_current = false` y entra una fila nueva con `replaces_fragment_id` apuntando a la vieja. |

Los fragmentos nunca se editan en el lugar. Un análisis emitido hace dos meses
tiene que seguir citando el texto que existía ese día, no el de hoy; por eso una
modificación es una fila nueva y no un `UPDATE`.

El `versioned` es también la razón por la que la escritura vive en un RPC y no en
JavaScript: el índice `knowledge_fragments_current_uq` prohíbe dos fragmentos
vigentes con el mismo artículo e inciso, así que bajar el viejo y subir el nuevo
tiene que ocurrir en una sola transacción, y `supabase-js` no puede abrir una.

## Snapshots

El objeto se guarda en `corpus-fuentes` como
`<document_type>/<nombre-archivo>/<fecha-verificación>--<hash>.md`, donde el hash
son los primeros 12 caracteres del SHA-256 del archivo. Dos cargas del mismo
texto escriben el mismo objeto; un texto distinto nunca pisa al anterior, así que
queda el historial de con qué versión del `.md` se cargó cada cosa.

## Tests

El parser —la parte que decide qué texto termina siendo citable— tiene tests:

```bash
npx vitest run src/test/CorpusMdParser.test.js
```
