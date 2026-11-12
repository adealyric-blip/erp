# Muse.md — Atelier Design Studio (put this file at the repo root)

You are building the **Design Studio** of a fashion-house ERP: designers mock up garments, build tech packs,
and invite suppliers to bid on production **without any design file ever leaving our environment**.
Read this whole file before every task. It is the contract. If a task conflicts with it, stop and say so.

## Stack (pinned)
- Next.js 16.4.x App Router, React 19.3, TypeScript 5 strict, Node 22 LTS, pnpm 9, Turborepo.
- Supabase (Postgres 15+, Auth, Storage, Realtime). `@supabase/ssr` for cookies. No Prisma, no second ORM.
- Hosting: Vercel now (web + MCP gateway), AWS Lightsail container service later (same Docker image).
  **WASM-first rendering:** all Craft apps run as web builds in staff browsers (editor + `/studio/render`
  render station). The only server process is a small **scan-worker** (ClamAV for supplier uploads).
- UI: Tailwind 4 + shadcn/ui, Konva (studio canvas), Three.js / `@google/model-viewer` (3D + 360), `onnxruntime-web` (in-browser background removal), TanStack Query, zod.

## Non-negotiable rules
1. **Database first.** Schema lives in `supabase/migrations`. Never change tables from app code. New SQL = new
   numbered step file (S610, S620 …) that is idempotent and re-runnable, ends with `platform__apply_app_security()`
   and `unify.done('<step>')`. Run `pnpm db:test` (S600_tests.sql, S605_tests.sql, then S610_tests.sql and S615_tests.sql once T10b / T13b land) after every DB change; all checks must pass.
2. **Every new public table has `tenant_id uuid NOT NULL`**, a parent-tenant trigger (`ds__match_parent_tenant`)
   and is classified by the registry. If writes must go through RPCs, add a `platform_table_access_overrides`
   row (`tenant_read`). Never hand-write `app_*` policies; the registry owns them.
3. **Status columns change only inside RPCs** (`tech_packs.status`, `rfqs.status`, `bids.status`,
   `rfq_invitations.status`). Do not `update({status})` from TypeScript — call the RPC.
4. **Suppliers are not tenant members.** Supplier pages call only `supplier_*` RPCs with the supplier's JWT.
   Never give supplier code a service-role client. Never return storage paths, signed URLs, `target_unit_cost`,
   other vendors' data or internal notes to a supplier.
5. **Images to suppliers are streamed, not linked.** `/api/supplier/assets/[rfqId]/[assetId]` calls
   `supplier_authorize_asset_view` with the user's JWT, and only if `allowed=true` reads the object with the
   service key, stamps the per-viewer watermark and streams it with `Cache-Control: private, no-store`.
   Never create a signed URL for the `supplier-previews`, `design-private` or `production-releases` buckets in
   code reachable by suppliers.
6. **Service role key** is only imported from `src/server/supabase/admin.ts` (`import 'server-only'`). ESLint
   rule `no-restricted-imports` enforces it. The scan-worker has its own key in Lightsail secrets.
7. **One command registry.** Every studio action (UI button, keyboard shortcut, AI/MCP tool) is a `defineCommand`
   in `packages/commands` with a zod input schema. UI and MCP call the same handler. No duplicate logic.
8. **Craft apps are external engines, run as WASM.** We self-host their web builds under `/craft/<app>/` and drive
   them only through `packages/craft-bridge` (the `craft-web-host` protocol). We do not fork them. Render jobs
   run in a staff browser via `ds_claim_browser_jobs` / `ds_heartbeat_browser_job` / `ds_finish_browser_job`.
   Never load Craft WASM or a master file on `/supplier/**`. Never open supplier uploads before `scan_status = 'clean'`.
9. Server Actions and Route Handlers validate input with zod, return `Result<T>` (`{ ok: true, data } | { ok: false, error }`),
   never throw raw Postgres errors to the client (map via `src/server/errors.ts`).
10. Tests are part of the task: unit (Vitest), DB (`S600_tests.sql` + `S605_tests.sql`), E2E (Playwright) for any user flow you touch.
    A task is not done until `pnpm verify` (typecheck + lint + test + db:test) is green.

## Commands
- `pnpm dev` — web on :3000 (Supabase local via `supabase start`)
- `pnpm db:reset` — `supabase db reset` (applies baseline + S590 + S600)
- `pnpm db:test` — runs `supabase/tests/S600_tests.sql` against the local DB; prints `checks_passed`
- `pnpm gen:types` — `supabase gen types typescript --local > packages/db/src/database.types.ts`
- `pnpm verify` — CI gate
- `pnpm scan:dev` — scan-worker against local Supabase (Docker)

## Where things live
See `plan/03_FILE_STRUCTURE.md`. Short version: `apps/web` (Next.js), `apps/mcp-gateway`, `apps/scan-worker`,
`packages/{db,commands,ui,craft-bridge,config}`, `supabase/{migrations,tests,seed}`.

## Done means
Typecheck clean, lint clean, tests added and green, `pnpm db:test` green, no new `any`, no `console.log`,
no TODO without an issue link, screenshots attached for UI changes, and the task's acceptance list ticked in the PR body.

## Flats and mockup licensing
Never put a flat, mockup base, or 3D model in front of a supplier unless its `ds_asset_licenses` row allows it. Printful
mockups are Printful-only. New blanks come from `packages/flat-gen` (see `plan/08_FLAT_LIBRARY.md`), not from the web.

## Tech pack template
The 11-page template in `plan/templates/techpack/svg/` is the contract between the editor, the snapshot, and the PDFs.
Never rename a `data-field` / `data-slot` / `data-repeat` id; add new ones only with a matching snapshot key and test.
