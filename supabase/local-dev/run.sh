#!/usr/bin/env bash
# Corre todo el setup del Postgres local de desarrollo del RAG, en orden.
# Requiere: Docker Desktop corriendo y el docker-compose.yml de esta carpeta ya levantado
# (docker compose -f supabase/local-dev/docker-compose.yml up -d).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

PSQL="${PSQL_BIN:-/c/Program Files/PostgreSQL/16/bin/psql.exe}"
CONN="${RAG_DEV_DB_URL:-postgresql://postgres:postgres_dev_local@localhost:5433/reportalo_rag_dev}"

WITH_FAKE_EMBEDDINGS="${1:-}"

echo "==> 01_minimal_schema.sql"
"$PSQL" "$CONN" -v ON_ERROR_STOP=1 -f "$SCRIPT_DIR/sql/01_minimal_schema.sql"

echo "==> 02_geo_and_services_seed.sql"
"$PSQL" "$CONN" -v ON_ERROR_STOP=1 -f "$SCRIPT_DIR/sql/02_geo_and_services_seed.sql"

echo "==> 03_rag_schema.sql"
"$PSQL" "$CONN" -v ON_ERROR_STOP=1 -f "$SCRIPT_DIR/sql/03_rag_schema.sql"

echo "==> 04_rag_corpus_seed.sql"
"$PSQL" "$CONN" -v ON_ERROR_STOP=1 -f "$SCRIPT_DIR/sql/04_rag_corpus_seed.sql"

if [ "$WITH_FAKE_EMBEDDINGS" = "--with-fake-embeddings" ]; then
  echo "==> 05_dev_fake_embeddings.sql (vectores sintéticos, SOLO para probar el RPC)"
  "$PSQL" "$CONN" -v ON_ERROR_STOP=1 -f "$SCRIPT_DIR/sql/05_dev_fake_embeddings.sql"
fi

echo "OK. Base local de desarrollo lista en $CONN"
