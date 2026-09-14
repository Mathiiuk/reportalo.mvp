# Variante sin pgvector — Postgres 16 nativo

Docker Desktop no arranca en esta máquina (crash reproducible del instalador,
`0xE0434352`, con dos descargas distintas — no es corrupción del archivo).
Mientras eso se resuelve aparte, esta carpeta usa el **PostgreSQL 16 nativo
que ya estaba instalado**, corrido como proceso normal (no como servicio de
Windows, porque eso pide privilegios de administrador que esta sesión no
tiene) en un directorio de datos propio: `.pgdata-local-dev/` en la raíz del
repo (gitignored, nunca se versiona).

**Diferencia con la carpeta padre (`supabase/local-dev/sql/`):** no hay
extensión `pgvector` instalada (requiere compilar con Visual Studio Build
Tools en Windows, algo que se evitó por ahora). Estos scripts recrean el
mismo esquema y el mismo contrato del RPC `match_knowledge_fragments`, pero:

- `fragment_embeddings.embedding` es `double precision[]` en vez de `vector(768)`.
- La similitud coseno se calcula a mano en PL/pgSQL (`cosine_similarity_local_dev`),
  no con el operador `<=>` de pgvector.
- El resultado y el comportamiento (cascada jurisdiccional, orden, límite) son
  idénticos — solo cambia CÓMO se calcula la distancia, no el contrato.

Cuando Docker se resuelva, usar la carpeta padre (con pgvector real) en vez de esta.

## Levantar el Postgres local (ya hecho en esta sesión, para referencia futura)

```powershell
$pgBin = "C:\Program Files\PostgreSQL\16\bin"
$dataDir = "D:\Proyectos\reportalo.mvp\.pgdata-local-dev"

# Una sola vez:
& "$pgBin\initdb.exe" -D $dataDir -U postgres --auth=trust -E UTF8

# Cada vez que se necesite:
& "$pgBin\pg_ctl.exe" -D $dataDir -l "$dataDir\server.log" -o "-p 5433" start
& "$pgBin\createdb.exe" -h localhost -p 5433 -U postgres reportalo_rag_dev

# Para parar:
& "$pgBin\pg_ctl.exe" -D $dataDir stop
```

## Cargar el esquema y los datos, en orden

```powershell
$PSQL = "C:\Program Files\PostgreSQL\16\bin\psql.exe"
$CONN = "postgresql://postgres@localhost:5433/reportalo_rag_dev"

& $PSQL $CONN -v ON_ERROR_STOP=1 -f supabase/local-dev/sql/native-no-pgvector/01_minimal_schema.sql
& $PSQL $CONN -v ON_ERROR_STOP=1 -f supabase/local-dev/sql/native-no-pgvector/02_geo_and_services_seed.sql
& $PSQL $CONN -v ON_ERROR_STOP=1 -f supabase/local-dev/sql/native-no-pgvector/03_rag_schema_no_pgvector.sql
& $PSQL $CONN -v ON_ERROR_STOP=1 -f supabase/local-dev/sql/native-no-pgvector/04_rag_corpus_seed.sql
& $PSQL $CONN -v ON_ERROR_STOP=1 -f supabase/local-dev/sql/native-no-pgvector/05_dev_fake_embeddings_array.sql
```
