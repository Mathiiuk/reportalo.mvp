# Postgres local para desarrollar el RAG (sin tocar Supabase)

> **Estado 2026-09-14:** Docker Desktop no pudo instalarse en esta máquina (el
> instalador se crashea al arrancar, reproducido con dos descargas distintas —
> no es un archivo corrupto). Mientras eso se resuelve, hay una variante
> funcionando **ahora mismo** con el PostgreSQL 16 nativo que ya estaba
> instalado, sin pgvector: ver [`sql/native-no-pgvector/README.md`](sql/native-no-pgvector/README.md).
> Validada de punta a punta: cascada jurisdiccional (Avellaneda vs. CABA, con
> adhesión de la Ley 24.449) y el RPC `match_knowledge_fragments` respondiendo
> correctamente contra los 15 fragmentos reales del corpus. Cuando Docker
> funcione, migrar a la variante con pgvector real de este documento.

Esto levanta **solo el motor Postgres + pgvector** en Docker, en tu máquina, para poder
probar el esquema RAG (`knowledge_sources` / `knowledge_fragments` / `fragment_embeddings`
y el RPC `match_knowledge_fragments`) con `psql`, sin tocar el proyecto Supabase real ni
necesitar sus credenciales.

**Qué NO es esto:** no es un mirror de Supabase. No levanta Auth, Storage ni PostgREST, así
que la app (`@supabase/supabase-js`) no puede apuntar acá directamente — para eso haría
falta la CLI de Supabase + `supabase start` (que si algún día se necesita, se agrega aparte).
Este Postgres sirve para desarrollo y pruebas del **esquema y las consultas SQL**.

## 1. Requisitos

- Docker Desktop instalado y corriendo.
- El cliente `psql` de PostgreSQL (ya lo tenés en `C:\Program Files\PostgreSQL\16\bin\psql.exe`).

## 2. Levantar la base

```bash
docker compose -f supabase/local-dev/docker-compose.yml up -d
```

Esto crea un contenedor `reportalo_rag_local_dev` con Postgres 16 + pgvector, escuchando en
`localhost:5433` (no 5432, para no chocar con un Postgres nativo que ya tengas corriendo).

- Base: `reportalo_rag_dev`
- Usuario: `postgres`
- Contraseña: `postgres_dev_local` (solo para desarrollo local, no es un secreto real)

## 3. Cargar el esquema y los datos, en orden

Desde la raíz del repo, con el `psql` de PostgreSQL 16:

```bash
PSQL="/c/Program Files/PostgreSQL/16/bin/psql.exe"
CONN="postgresql://postgres:postgres_dev_local@localhost:5433/reportalo_rag_dev"

"$PSQL" "$CONN" -v ON_ERROR_STOP=1 -f supabase/local-dev/sql/01_minimal_schema.sql
"$PSQL" "$CONN" -v ON_ERROR_STOP=1 -f supabase/local-dev/sql/02_geo_and_services_seed.sql
"$PSQL" "$CONN" -v ON_ERROR_STOP=1 -f supabase/local-dev/sql/03_rag_schema.sql
"$PSQL" "$CONN" -v ON_ERROR_STOP=1 -f supabase/local-dev/sql/04_rag_corpus_seed.sql

# Opcional: vectores sintéticos SOLO para probar el RPC de punta a punta sin GEMINI_API_KEY.
# Nunca usar esto para medir calidad de recuperación real (ver el encabezado del archivo).
"$PSQL" "$CONN" -v ON_ERROR_STOP=1 -f supabase/local-dev/sql/05_dev_fake_embeddings.sql
```

O todo junto con el script de conveniencia:

```bash
bash supabase/local-dev/run.sh
```

## 4. Probar la cascada jurisdiccional y el RPC

```sql
-- Localidad de prueba: Piñeyro (Avellaneda)
select id, name from public.localities where name = 'Piñeyro';

-- Fuentes elegibles para esa localidad (cascada: municipio -> PBA -> nación con adhesión)
select ks.title, e.scope_level
from public.eligible_knowledge_sources('<id de Piñeyro>') e
join public.knowledge_sources ks on ks.id = e.source_id;

-- Búsqueda semántica (con los vectores sintéticos del paso opcional 5, o con vectores
-- reales de gemini-embedding-2 si los cargaste vos con el script de vectores del docx §4)
select fragment_id, hierarchy_path, similarity
from public.match_knowledge_fragments(
  (select embedding from public.fragment_embeddings limit 1),  -- cualquier vector de 768 dims como ejemplo
  '<id de Piñeyro>',
  'gemini-embedding-2@768',
  6
);
```

## 5. Parar / limpiar

```bash
docker compose -f supabase/local-dev/docker-compose.yml down       # detener, conserva los datos
docker compose -f supabase/local-dev/docker-compose.yml down -v    # detener y borrar todo
```

## 6. Qué archivo es cada cosa

| Archivo | Qué hace | Fuente |
|---|---|---|
| `docker-compose.yml` | Levanta Postgres 16 + pgvector en el puerto 5433 | — |
| `sql/01_minimal_schema.sql` | Geografía + `services` + stub de `report_ai_analysis` + roles `anon`/`authenticated`/`service_role` | Escrito para este dev local (no existe en el repo un DER completo fuera de Supabase) |
| `sql/02_geo_and_services_seed.sql` | 1 país, 3 provincias, 17 subdivisiones, 57 localidades, 5 categorías | Copiado verbatim de la PARTE 2 de `docs/REP-3769_seed_y_RAG.sql` |
| `sql/03_rag_schema.sql` | Incluye `supabase/rag_knowledge_schema.sql` (no lo duplica) | — |
| `sql/04_rag_corpus_seed.sql` | 8 normas, 1 adhesión, 15 fragmentos verificados | Copiado verbatim de la PARTE 7 de `docs/REP-3769_seed_y_RAG.sql` |
| `sql/05_dev_fake_embeddings.sql` | Vectores sintéticos de 768 dims, **solo para probar el RPC sin red** | Escrito para este dev local — nunca representa calidad real |

`docs/REP-3769_seed_y_RAG.sql` (la guía de Hernán) sigue siendo la única fuente de verdad
para lo que se carga en el Supabase real. Este directorio no lo reemplaza ni lo edita.
