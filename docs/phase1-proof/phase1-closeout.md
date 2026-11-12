# Phase 1 close-out — Gate 1 evidence (2026-11-12)

Close-out agent verification of T01–T05 (commits 7572c63, 365cb07, b9656d4,
75e8866, 2309590), with fixes applied on local main. No pushes. Nothing
written to the live database. Full command output is in the (gitignored)
`verify-closeout.log` / `dbtest-closeout.log` files next to this note.

## Verify (adapted: repo uses npm, not pnpm; single Next.js app, not a workspace)

| Step | Command | Result |
| --- | --- | --- |
| typecheck | `npm run typecheck` | FAIL (exit 2) — 35 pre-existing errors in `src/components/*`, `src/data/settingsAccess.ts`, `src/lib/blankIngest.ts`. Zero errors in any Phase 1 file (`src/lib/db`, `src/server`, `src/app/(auth)`, `src/app/studio`, `src/app/supplier`, `src/proxy.ts`, `e2e/`) |
| lint | `npm run lint` | FAIL (exit 1) — 4 pre-existing errors (`DocumentEngine.tsx`, `ScreenContent.tsx`, `DesignCanvasScreen.tsx`). Admin-import negative test PASSES: a temp client component importing `@/server/supabase/admin` fails lint with `no-restricted-imports` |
| unit tests | `npm run test` | PASS (exit 0) — 43/43 (`src/lib/db/rpc.test.ts`) |
| db:test | `npm run db:test` | PASS (exit 0) — `checks_passed = 82`, `s605_checks_passed = 17`, 0 failing checks |

`npm run verify` as a whole is therefore NOT green: typecheck + lint fail on
pre-existing repo debt outside Phase 1. See "Open items" below.

### How db:test was run (local-first, no live project)

No Docker / Supabase CLI on this VM, and the management token is scoped to
the existing project (project creation returns `Forbidden`), so the test ran
against a throwaway **local PostgreSQL 16.15 cluster** installed via apt on
`127.0.0.1:54322` in `/tmp/pgdata` (data discarded with the VM slice; the
cluster is not part of the repo). `SET transaction_timeout = 0` in the
baseline is PG17-only, so the run used a 1-line-neutralized copy in `/tmp`
(the committed file is untouched for that line). `auth`/`storage` schemas
and the `authenticated`/`service_role`/`anon` roles were stubbed in `/tmp`
(minimal GoTrue/Storage stand-ins — real Supabase provides them). Reset was
run clean **twice in a row** (RESET6 + RESET7, both exit 0, seeds applied:
3 garment templates, 1 demo design) and `db:test` printed 82/17 both times.

Live project ref NOT touched: `pcwwvfgxnrglmmpbfqhf` (Unsaid).

## Fixes applied in this close-out (local main, add-only except the baseline regen)

1. **`proxy.ts` → `src/proxy.ts` (T04 defect, blocking).** As root `proxy.ts`
   the file was compiled into `.next/dev/server/middleware.js` but never
   executed (empty middleware manifest): unauthenticated `/studio` returned
   500, `/api/*` returned HTML 404s. With a `src/` directory, Next 16.4.5
   (Turbopack) only registers `src/proxy.ts`. After the move, verified live:
   `/studio` → 307 `/login?next=%2Fstudio`, `/supplier` → 307
   `/login?next=%2Fsupplier`, `/api/*` (no env) → `{"error":"auth not configured"}`,
   `/` → 200, `/login` → 200, `/mfa` → 200.
2. **`vitest.config.ts` (new, T04 defect).** Vitest's default include matched
   `e2e/auth.spec.ts`, so `npm test` exited 1 even with 43/43 unit tests
   passing. The config excludes `e2e/**`; `npm test` now exits 0.
3. **`scripts/build-baseline.sh` + regenerated `supabase/migrations/20261107000000_baseline.sql`
   (T02 defect, blocking).** The committed baseline could not apply under
   `ON_ERROR_STOP=1`: it emitted the extra source files before
   `11_constraints`, so 35 inline `REFERENCES` hit tables whose PKs were only
   added later (`ERROR: no unique constraint matching given keys for
   referenced table "tenants"` at line 16721, first of 35). The script now
   emits extras after `40_functions`, deduplicates the `search_text` prelude,
   extracts the platform-registry section from the Agnostic/LMS sources
   (06b/06c/06d/06e; `platform_outbox` DDL is hand-written — it exists nowhere
   in the zip), and defers the `platform__apply_app_security()` /
   `platform_classify_tables()` calls to a final refresh after `61_policies`.
   Regenerated from `upload/schema_target.zip`; the result differs from the
   (working) abandoned-tree baseline by 10 lines (2 header lines + 1 blank
   line). The script's OUT default was also fixed (it pointed at
   `~/workspace/atelier/...`).

## Screenshots (this folder)

- `t01-home-shell.png` (T01, pre-existing), `t04-home.png` — `/` 200
- `t04-login.png` — login (Google staff + OTP suppliers)
- `t04-mfa.png` — `/mfa` loading state (enrollment UI needs a session; see open items)
- `t04-studio-guard.png` — `/studio` → redirected to `/login?next=%2Fstudio`
- `t04-supplier-guard.png` — `/supplier` → redirected to `/login?next=%2Fsupplier`

## Open items (Accept items not met)

1. **T01 — `pnpm verify` green: NOT MET.** Typecheck (35 errors) and lint
   (4 errors) fail on pre-existing code outside Phase 1. Phase 1 code itself
   typechecks clean and lints clean; unit + db tests pass. Fixing the 35+4
   pre-existing errors is a separate cleanup of the live ERP app, not Phase 1.
2. **T04 — `auth.spec.ts` e2e: NOT RUN on this VM.** Needs the local Supabase
   stack (`supabase start` + Mailpit); no Docker / Supabase CLI here. Only
   runnable in CI (GitHub-hosted runners). Live-checked instead: unauthenticated
   `/studio`/`/supplier` redirect to `/login` (case 1 of 6). The other five
   cases (staff without MFA → `/mfa`; staff with MFA → `/studio`; supplier
   `/studio` → 404; supplier `/supplier` → OK; staff `/supplier` → 404) are
   code-verified only (proxy aal2 gate + `requireStaff`/`requireSupplier`
   `notFound()` paths read and consistent with the spec).
3. **T05 — "PR shows all checks; failing db test blocks merge": NOT VERIFIABLE
   locally.** Workflows parse as valid YAML; jobs chain build → db-test → e2e.
   No pushes happened (remote hold), so no CI run exists; branch protection
   requiring the db-test check is an owner setup step (noted in the workflow).
4. **T03 — `gen:types` not re-run on this VM** (needs `supabase gen types
   --local`). `database.types.ts` is committed and the 36 RPC wrappers compile
   against it; the wrapper↔SQL cross-check is exact (36 = 36, see report).
5. **T02 — `supabase db reset` itself not run** (no Supabase CLI/Docker).
   Its equivalent (stubs + migrations + seeds, twice) ran clean; see above.

## Phase 0 (Jaizon-only, unchanged — does not block Phases 1–3)

Supabase prod + staging projects; enable Google provider, email OTP/magic
link, MFA (TOTP); Vercel project linked to the repo with env per
`plan/05_INTEGRATIONS.md` §Env; Google Cloud project + OAuth consent screen
(internal staff), APIs enabled, verification submitted for sensitive scopes
(Meet, Docs); Lightsail instance for the scan-worker (+ static IP); an
always-on studio computer (Chrome/Edge + GPU) as the render station; domains
`studio.<domain>` and `suppliers.<domain>`.

**Verdict carried to the coordinator: GATE 1 RED — T01 Accept "pnpm verify
green" is not met (typecheck + lint fail on pre-existing code). Everything
else in Phase 1 verifies or is fixed above.**
