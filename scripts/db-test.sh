#!/usr/bin/env bash
# npm run db:test — run S600_tests.sql then S605_tests.sql against the LOCAL
# Supabase database and print the check counts.
# Expected: checks_passed = 82, s605_checks_passed = 17.
#
# Connection resolution (local-first, never the live project):
#   1. SUPABASE_DB_URL env var, if set (throwaway cloud project only).
#   2. The local db container's IP on its docker network
#      (host->container works without iptables port publishing).
#   3. localhost:54322 (works only when Docker port publishing is available).
# Requires: psql, Docker, `supabase start` already run.
set -euo pipefail
cd "$(dirname "$0")/.."

PSQL_URL="${SUPABASE_DB_URL:-}"
if [ -z "$PSQL_URL" ]; then
  if docker inspect supabase_db_erp >/dev/null 2>&1; then
    DB_IP="$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' supabase_db_erp)"
    if [ -n "$DB_IP" ]; then
      PSQL_URL="postgresql://postgres:postgres@${DB_IP}:5432/postgres"
    fi
  fi
fi
if [ -z "$PSQL_URL" ]; then
  PSQL_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
fi
export PGPASSWORD="${PGPASSWORD:-postgres}"

echo "db:test — running S600_tests.sql + S605_tests.sql"
psql "$PSQL_URL" -v ON_ERROR_STOP=1 -q -f supabase/tests/S600_tests.sql
psql "$PSQL_URL" -v ON_ERROR_STOP=1 -q -f supabase/tests/S605_tests.sql
