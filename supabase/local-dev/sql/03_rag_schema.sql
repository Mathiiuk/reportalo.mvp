-- ==============================================================================
-- 03_rag_schema.sql — incluye el esquema RAG real (no se copia dos veces)
-- ==============================================================================
-- \ir es relativo a la ubicación de ESTE archivo (a diferencia de \i, que es
-- relativo al directorio desde donde se invocó psql). Apunta directo a
-- supabase/rag_knowledge_schema.sql: la misma migración que se documentó y
-- versionó en REP-2908, sin duplicar su contenido acá.
-- ==============================================================================
\ir ../../rag_knowledge_schema.sql
