# RAG-P0 · Versión del motor de la línea base (REP-3859)

**Verificado el 21/10/2026**, con lectura sola, contra la base Reportalo y el fuente del repo. La versión para máquinas está en [`RAG-P0_version-motor.json`](RAG-P0_version-motor.json), y cada corrida de M1 y M2 repite este mismo encabezado (`motor`) en su JSON.

| Dato | Valor | De dónde sale |
|---|---|---|
| Despliegue | `analizar-reporte` **v44**, 13/10/2026 19:48 ART (`ezbr_sha256` `31a51552…e17e73`) | Supabase, `list_edge_functions` |
| Código medido | commit **`543fb6b`** (13/10 18:53 ART, anterior al despliegue) | `git log -1 -- supabase/functions/analizar-reporte` |
| Prompt | **v5** | `PROMPT_VERSION` |
| Generación | `gemini-3.8-flash`, temperature **0**, thinking `low`, `maxOutputTokens` 2048 | Fuente (`readGenerationSpec`) |
| Embeddings | `gemini-embedding-2@768` | Fuente |
| Recuperación | RPC `match_knowledge_fragments`, top-k **8**, umbral **0.45** | Fuente |
| Corpus | **127 vigentes** de 132, 29 fuentes vigentes, 127 con vector del modelo activo; último fragmento 13/10/2026 21:34 UTC | Consulta de lectura |
| Huella del corpus | `628486fc5a3f7f142892d87d59c38aad70fc87206df6b2fadfb60b12620e93a3` | `huellaCorpus` (SQL y JS dan lo mismo) |

**Corrección del 20/10.** En REP-3859 se informó el commit `3519c73` (prompt v5). El último commit que tocó la función es `543fb6b`, que respecto de `3519c73` **solo cambia un comentario** de `PROMPT_VERSION`. El código ejecutable es el mismo.

**Huella del corpus.** Es el SHA-256 de las líneas `id:sha256(content)` de cada fragmento vigente, ordenadas. Si cambia un solo fragmento (por ejemplo, al cargar REP-3837), cambia la huella. Cada corrida la vuelve a calcular. Si no coincide con esta, la corrida no es comparable con la línea base.

**Mientras se mide P0–P2 no se cambia** el corpus, el prompt, la búsqueda ni la configuración de staging (Leo, REP-3859).
