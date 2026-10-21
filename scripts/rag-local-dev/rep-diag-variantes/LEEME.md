# Comparación de variantes de recuperación del RAG

Mide si tres cambios mejoran la posición de la norma correcta respecto de la recuperación actual, **sin desplegar ni
escribir en la base**. Informe con los resultados: `docs/RAG-S16_variantes_de_recuperacion.md`.

| Variante | Qué cambia |
|---|---|
| B | Actual: consulta «descripción (categoría: X)» y fragmento = `content`, sin instrucción de tarea |
| V1 | Instrucción de tarea en el texto (`task: search result \| query: …` y `title: none \| text: …`). `gemini-embedding-2` no usa `taskType` |
| V2 | Fragmento enriquecido: norma + `hierarchy_path` + `content` |
| V1+V2 | Las dos anteriores (la norma y la ruta van en `title:`) |
| V3 | Fusión por rango (RRF, k=60) del ranking vectorial actual con el de texto completo (`knowledge_fragments.fts`) |
| V3+V2, V3+V1+V2 | RRF sobre el ranking vectorial de V2 o V1+V2 |

## Cómo se corre
1. `node run.mjs --sql-fts > fts.sql` y correr `fts.sql` (solo `SELECT`) en staging; guardar el JSON que devuelve en `fts-ranks.json`.
   Solo hace falta rehacerlo si cambian los casos o el corpus.
2. `node run.mjs --env <ruta al .env>` (por defecto el `.env` de la raíz del repo). Necesita `GEMINI_API_KEY`,
   `VITE_SUPABASE_URL` (staging) y `SUPABASE_SERVICE_ROLE_KEY`.
3. `node resumen.mjs` imprime las tablas del informe a partir de la última salida.

Los vectores quedan en `salida/cache-embeddings.json` (no versionado): una segunda corrida no llama a la API salvo para
textos nuevos. La recuperación de candidatos usa el RPC `match_knowledge_fragments` con ventana 100, así que el filtro de
categoría y jurisdicción es exactamente el de producción; el script controla que la similitud recalculada en memoria
coincida con la de la base.

## Casos (`casos.json`)
- **D** (20): todos los textos distintos de D1 a D5 de `Entrega_Matias_RAG_Sprint15/casos/casos_D1_a_D8.csv`.
- **R** (20): reportes de `citizen_reports` de staging, con su localidad y categoría.
- **N** (8): controles sin norma aplicable (texto que no corresponde a la categoría elegida o sin hecho reclamable).
- Los esperados por escenario son los «aceptables» de la sección 5 del LEEME de Hernán.

## Batería de 81 casos y búsqueda híbrida (V3)
Informe: `docs/RAG-S16_busqueda_hibrida_bateria_81.md`. Migración propuesta (sin aplicar):
`docs/rag/PROPUESTA_REP-3860_busqueda_hibrida_rrf.sql`.

1. `node bateria.mjs --csv <ruta>/docs/Entrega_Matias_RAG_Sprint15/casos/bateria_completa_81.csv` arma
   `casos-bateria81.json` (81 filas → 47 consultas distintas; cada una guarda sus filas para ponderar).
2. `node run.mjs --casos casos-bateria81.json --fts fts-ranks-bateria81.json --sql-fts > fts-bateria81.sql`, correr el
   `SELECT` en staging y guardar el JSON en `fts-ranks-bateria81.json`.
3. `node run.mjs --env <.env> --casos casos-bateria81.json --fts fts-ranks-bateria81.json --sin-sonda` y
   `node resumen-bateria.mjs` (tablas B contra V3, ponderadas por reporte).
4. Control del SQL de la migración: `node verificar-rpc.mjs --sql <caso> …` arma un `SELECT` con el cuerpo de la función
   y los parámetros del caso (no crea nada); su resultado, guardado en JSON, se compara con
   `node verificar-rpc.mjs --comparar <resultado.json>`.
5. Generación con el contexto de cada variante:
   `node ../rep-diag-generacion/run.mjs --env <.env> --desde-variantes salida/variantes-bateria81-<fecha>.json --caso <id> --variante B|V3 --corridas 3`
   y `node resumen-generacion.mjs <id> …` para clasificar las citas con los aceptables de §5.
