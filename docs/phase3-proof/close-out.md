# Close-out — final verify (2026-11-12 ~06:20 CST)

All lanes complete (Phase 1 T01–T05, Phase 2 A/B/C, Phase 3 Lane 1 + Lane 2,
Phase 4 Lane 1 + Lane 2, T10c). Local main only, no pushes.

## `npm run verify` — EXIT 0

| Step | Result |
|---|---|
| typecheck (`tsc --noEmit --skipLibCheck`) | 0 errors |
| lint (repo-wide) | **0 errors, 4 warnings** (unused eslint-disable directives in `Header.tsx`, `DesignCanvasScreen.tsx`, `DesignPreviewScreen.tsx`, `ReviewGrid.tsx`; cosmetic) |
| unit tests (`npm test`) | **234/234 pass, 28 files** |
| db:test | **82 / 17 / 48 / 42** (S600 / S605 / S610 / S615; S610 is 48 not 38 — T10c §10 added 10 checks) |

Close-out fix: `e81a51e` — hoisted `shapeName` above its use in
`GraphicsPanel` (`StudioDrawer.tsx:754`, the last lint error).

## How db:test was run (reproducible)

No Docker / Supabase CLI on this VM. The OS-intent replay installed
PostgreSQL 16 + Docker during this close-out (docker.io is now present but
was NOT used — the throwaway cluster path below is the proven one).

- Cluster: Debian `postgresql-16`, cluster 16/main on 5432 (started with
  `pg_ctlcluster 16 main start`).
- Database: `atelier_test`, user `postgres` / `postgres`.
- Reset: `bash scripts/reset-local-db.sh` (new, committed) — rebuilds the DB
  from scratch and applies baseline + all 9 migrations. Then:
  `SUPABASE_DB_URL="postgresql://postgres:postgres@127.0.0.1:5432/atelier_test" npm run db:test`
- Neutralisations (throwaway DB / /tmp copy only, committed files untouched):
  `transaction_timeout` line stripped (PG17-only); `auth`/`storage` schemas
  + `anon`/`authenticated`/`service_role` stubbed; `auth.uid()`/`role()`/`jwt()`
  read `request.jwt.claim.*` like real Supabase; extensions pre-installed in
  public (the baseline sets `search_path` to `''` at line 35, so bare
  `CREATE EXTENSION` has no schema otherwise); minimal `storage.buckets` /
  `storage.objects` tables.

Live project ref NOT touched: `pcwwvfgxnrglmmpbfqhf` (Unsaid).
