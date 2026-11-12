#!/usr/bin/env bash
# scripts/reset-local-db.sh — rebuild the throwaway LOCAL test database used
# by `npm run db:test` (S600/S605/S610/S615) on this VM.
#
# There is no Docker / Supabase CLI here, so db:test runs against a local
# PostgreSQL 16 cluster (Debian package `postgresql-16`, cluster 16/main).
# The committed baseline is PG17-flavoured and Supabase-flavoured, so the
# reset applies a 1-line-neutralised copy in /tmp and stubs the Supabase
# surface the migrations/tests expect. The committed files are untouched.
#
#   PGHOST=127.0.0.1 PGPORT=5432 PGDATABASE=atelier_test bash scripts/reset-local-db.sh
#   SUPABASE_DB_URL="postgresql://postgres:postgres@127.0.0.1:5432/atelier_test" npm run db:test
#
# Neutralisations (all in the throwaway DB / /tmp copy only):
#   1. `SET transaction_timeout = 0` is PG17-only — stripped from the /tmp copy.
#   2. Baseline line 35 does `set_config('search_path', '', false)` — bare
#      `CREATE EXTENSION` then has no schema to install into, so all six
#      extensions are pre-installed in public first.
#   3. Roles `anon` / `authenticated` / `service_role` created (NOLOGIN;
#      service_role BYPASSRLS, mirroring Supabase).
#   4. `auth` schema stub: `auth.users(id uuid DEFAULT gen_random_uuid(),
#      email text)` + `auth.uid()` / `auth.role()` / `auth.jwt()` reading
#      `request.jwt.claim.sub` / `.role` — exactly how the S600 test harness
#      simulates Supabase (`t.act()` sets the claim and `SET ROLE`).
#   5. `storage` schema stub: minimal `storage.buckets` /
#      `storage.objects` tables (columns S600 + the tests touch) with RLS
#      enabled on objects, plus USAGE grants on auth/storage.
#   6. Schema `postgres` created so the default search_path `"$user", public`
#      resolves (bare CREATE EXTENSION otherwise fails even outside the
#      empty-search_path section).
set -euo pipefail
cd "$(dirname "$0")/.."

PGHOST="${PGHOST:-127.0.0.1}"
PGPORT="${PGPORT:-5432}"
PGDATABASE="${PGDATABASE:-atelier_test}"
PGUSER="${PGUSER:-postgres}"
export PGPASSWORD="${PGPASSWORD:-postgres}"
BASE_URL="postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT}"

# Start the Debian cluster if it is down.
if command -v pg_lsclusters >/dev/null 2>&1; then
  if ! pg_lsclusters -h | awk '$1==16 && $2=="main" {exit ($4=="online")?0:1}'; then
    echo "reset-local-db: starting postgresql cluster 16/main"
    pg_ctlcluster 16 main start || sudo pg_ctlcluster 16 main start
  fi
fi

psql "${BASE_URL}/postgres" -v ON_ERROR_STOP=1 -q \
  -c "DROP DATABASE IF EXISTS \"${PGDATABASE}\";" \
  -c "CREATE DATABASE \"${PGDATABASE}\";"

psql "${BASE_URL}/${PGDATABASE}" -v ON_ERROR_STOP=1 -q \
  -c "DO \$\$ BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
      END \$\$;" \
  -c "CREATE SCHEMA IF NOT EXISTS postgres;" \
  -c "CREATE SCHEMA IF NOT EXISTS auth;" \
  -c "CREATE SCHEMA IF NOT EXISTS storage;" \
  -c "CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text);" \
  -c "CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS \$\$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid \$\$;" \
  -c "CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS \$\$ SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), 'authenticated') \$\$;" \
  -c "CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS \$\$ SELECT jsonb_build_object('sub', NULLIF(current_setting('request.jwt.claim.sub', true), ''), 'role', COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), 'authenticated')) \$\$;" \
  -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\" WITH SCHEMA public;" \
  -c "CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;" \
  -c "CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;" \
  -c "CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;" \
  -c "CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;" \
  -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA public;" \
  -c "CREATE TABLE IF NOT EXISTS storage.buckets (id text PRIMARY KEY, name text NOT NULL, owner uuid, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), public boolean DEFAULT false, avif_autodetection boolean DEFAULT false, file_size_limit bigint, allowed_mime_types text[], owner_id uuid);" \
  -c "CREATE TABLE IF NOT EXISTS storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text REFERENCES storage.buckets(id), name text, owner uuid, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), last_accessed_at timestamptz DEFAULT now(), metadata jsonb, version text);" \
  -c "ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;" \
  -c "GRANT USAGE ON SCHEMA storage, auth TO authenticated, service_role, anon;" \
  -c "GRANT SELECT ON auth.users TO authenticated, service_role;"

# PG17-only line neutralised in a /tmp copy; the committed file is untouched.
sed '/SET transaction_timeout = 0;/d' supabase/migrations/20261107000000_baseline.sql > /tmp/baseline-pg16.sql

for f in \
  /tmp/baseline-pg16.sql \
  supabase/migrations/20261108000000_design_renders.sql \
  supabase/migrations/20261108010000_render_worker.sql \
  supabase/migrations/20261109200000_appointments_domain.sql \
  supabase/migrations/20261111000590_design_studio_prereq_fixes.sql \
  supabase/migrations/20261111000600_design_studio_production.sql \
  supabase/migrations/20261111000605_browser_runner.sql \
  supabase/migrations/20261111000610_flat_library.sql \
  supabase/migrations/20261112000615_tech_pack_template.sql
do
  echo "reset-local-db: applying $(basename "$f")"
  psql "${BASE_URL}/${PGDATABASE}" -v ON_ERROR_STOP=1 -q -f "$f"
done

echo "reset-local-db: done — ${BASE_URL}/${PGDATABASE}"
