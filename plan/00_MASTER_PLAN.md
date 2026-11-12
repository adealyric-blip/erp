# 00 — Master Plan: Design Studio, zero to production

Goal: a private design studio where you mock up garments, build tech packs, and run sealed supplier bids
for production. Design files never leave your environment (no WhatsApp, no email attachments).

Read order for Muse Code / Muse: `Muse.md` → this file → `01_ARCHITECTURE.md` → `02_DATABASE.md`
→ `03_FILE_STRUCTURE.md` → `04_API_CONTRACTS.md` → `05_INTEGRATIONS.md` → `06_Muse_CODE_RUNBOOK.md`
→ `07_TESTING_RELEASE.md` → `08_FLAT_LIBRARY.md` → `09_TECH_PACK_TEMPLATE.md`.

## What is already done (in this package)
| Item | File | Status |
|---|---|---|
| Baseline bug fixes (platform_admins FK, duplicate FKs, nullable tenant_id, updated_at triggers) | `db/S590_design_studio_prereq_fixes.sql` | Applied and re-run on a full copy of your schema |
| Design Studio data layer: 29 tables, 33 RPCs, triggers, RLS, storage buckets, grants | `db/S600_design_studio_production.sql` | Applied to the full schema, re-runnable, registry-compatible |
| End-to-end security and workflow tests (owner, staff, other tenant, 2 suppliers, intruder, anon) | `db/S600_tests.sql` | **82/82 checks pass** |

So the riskiest part (data model + zero-leak access rules) has been built and tested. What's left is application code
built on a contract that is already fixed, and that is the part Muse Code can do fast.

## How "hours, not weeks" is realistic
- The contracts are already fixed: tables, RPC signatures, file tree, route names, zod schemas, and acceptance tests.
  Each agent task has a single owner directory and a test that tells it when it's done.
- Tasks run in parallel lanes after Phase 1 (see the dependency graph). With 3–4 Muse Code sessions plus Muse
  for long-running jobs, Phases 1–4 take about 1–2 working days of wall-clock time. Phases 5–6 depend on outside
  steps (Google OAuth verification, Lightsail provisioning, DNS) that run on someone else's schedule.
- What can't be squeezed into hours: Google OAuth app verification for sensitive scopes, Merchant Center approval,
  and real supplier UAT. Start those on day 0.

## Phases and gates
Each phase ends with a gate. Don't start the next phase until the gate is green.

### Phase 0 — Accounts and secrets (you, ~1 hour, plus outside wait time)
- Supabase project (prod + staging); enable Google provider, email OTP/magic link, MFA (TOTP).
- Vercel project linked to the repo; env vars per `05_INTEGRATIONS.md §Env`.
- Google Cloud project: OAuth consent screen (internal staff), enable APIs listed in `05_INTEGRATIONS.md`.
  Submit for verification now if you need sensitive scopes (Meet, Docs).
- Lightsail: one small instance (2 GB RAM is enough for ClamAV) for the scan-worker, static IP.
- Render station: one always-on studio computer with a recent Chrome/Edge and a GPU (runs the Craft WASM batches).
- Domain: `studio.<yourdomain>` (staff) and `suppliers.<yourdomain>` (suppliers), both pointing at the same app.
- **Gate 0:** `.env.example` filled for staging, `supabase link` works, Lightsail SSH works.

### Phase 1 — Foundation (1 agent, ~2–3 h)
Runbook tasks T01–T05: monorepo, Supabase migrations (baseline + S590 + S600 + S605), type generation, auth (Google
for staff with MFA aal2, magic link for suppliers), `proxy.ts` route guards, tenant context, the error and
Result mapper, CI.
- **Gate 1:** `pnpm verify` green in CI; `pnpm db:test` prints `checks_passed = 82` and `s605_checks_passed = 17`; staff login with MFA works; supplier
  magic link lands on `/supplier`; a staff user without MFA is redirected to enroll.

### Phase 2 — Studio core (3 parallel lanes, ~4–6 h)
- Lane A (T06–T08): command registry + Studio shell (left rail: Uploads / Images / Graphics / Shapes / Text / AI),
  Konva canvas with dashed print areas from `ds_garment_templates.print_areas`, Save → `ds_create_design_version`.
- Lane B (T09–T10b): asset pipeline (upload → `design-private`, thumbnails, background removal job), libraries
  (seasons, size ranges, POM library, materials, garment templates), then the **flat library** (T10b, `08_FLAT_LIBRARY.md`):
  12 parametric blanks you own, licensed flat import with the bundle splitter (T10c: one VecFashion file → single designable pieces), and the S610 license guard that keeps Printful-only mockups away from suppliers.
- Lane C (T11–T12): Craft embedding (`/craft/<app>/` with COOP/COEP, `craft-bridge` package) for all eight web builds,
  starting with the WASM capability spike; open document → edit → save back as a new design version.
- **Gate 2:** the 12 core blanks exist as owned flats with print areas; a designer can open a template, place a logo, recolor a colorway, open the flat in VectorCraft, save,
  and see version 2 in history. Playwright `studio.spec.ts` green. `plan/wasm-spike.md` filled in.

### Phase 3 — Tech packs (2 lanes, ~3–4 h)
- T13–T15 (+ T13b): tech pack editor with one tab per page of the 11-page template in `09_TECH_PACK_TEMPLATE.md` (technical sketch,
  construction callouts, measurement guide, measurement chart, BOM, materials & trims, colorways, artwork, labels, hang tag, packaging),
  review/approve flow with `ds_transition_tech_pack`, revision history/diff, render-station jobs `techpack_pdf`
  (DesignCraft → PDF/X-4) and `techpack_preview_pdf` (PdfCraft, watermarked, flattened).
- **Gate 3:** all 11 template pages fill from real data; approving a tech pack locks the version, produces both PDFs within 2 minutes, `preview_pdf_asset_id`
  set; editing an approved pack is impossible from the UI and the DB.

### Phase 4 — Supplier portal and bidding (2 lanes, ~4–6 h)
- T16–T20: vendor directory + supplier invites, NDA management, RFQ builder + publish, supplier portal (my RFQs, NDA
  gate, RFQ view, streamed watermarked previews, bid form, Q&A, uploads with virus scan), sealed-bid comparison
  board, award → draft POs, production release downloads, revoke supplier, audit log viewer.
- **Gate 4:** Playwright `rfq-e2e.spec.ts` covers the full cycle with two suppliers; the zero-leak checklist in
  `07_TESTING_RELEASE.md §Zero-leak` passes by hand and by script.

### Phase 5 — Media, 3D, video, AI (parallel, ~1 day, can ship after launch)
- T21–T25: mockup renders (PhotoCraft batch), 360 turntable (TextureCraft → GLB → pre-rendered 24/36 frames +
  `<model-viewer>`), promo video (EffectCraft/FilmCraft web builds on the render station), LightCraft batch grading for
  model and catalog photos, Studio MCP gateway exposing the command registry to AI assistants.
- **Gate 5:** each job type runs end-to-end from a UI button and from an MCP tool call, with the same command.

### Phase 6 — Production hardening and launch (~0.5–1 day, plus outside wait time)
- T26–T29: observability (Sentry, structured logs, job dashboards), backups and PITR, rate limits, CSP, pen-test checklist,
  Lightsail container deploy of the same image, runbooks, Google integrations (Analytics, Search Console, Merchant API,
  FCM web push, Meet briefings, Maps supplier map).
- **Gate 6 (go-live):** all of `07_TESTING_RELEASE.md` green; restore drill done; first real RFQ sent to a friendly supplier.

## Dependency graph (what can run in parallel)
```
T01 ─┬─ T02 ─ T03 ─ T04 ─ T05 ──┬── T06 ─ T07 ─ T08 ───────────┐
     │                          ├── T09 ─ T10 ─ T10b ─ T10c ───┼── T13 ─ T13b ─ T14 ─ T15 ┬── T16 ─ T17 ─ T18 ─ T19 ─ T20 ── T26 … T29
     │                          └── T11 ─ T12 ─────────────────┘                     └── T21 … T25 (any time after T15)
```

## Out of scope for this release (on purpose)
Storefront, marketplace listings, and XR commerce. Merchant API, Indexing API, Search Console and Analytics are
wired only as far as the studio needs them (product data export, launch-page indexing, campaign stats). Immersive
Stream for XR is in as the premium 3D lane (T22b) with `<model-viewer>` as fallback — see `05_INTEGRATIONS.md`.
