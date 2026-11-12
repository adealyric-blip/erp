# 06 — Muse / Muse runbook

## How to run this
- Put `Muse.md` at the repo root and this `plan/` folder in the repo. Every prompt below starts with
  "Read Muse.md and plan/0*.md first."
- One task = one branch = one PR. Paste the task block as-is. Don't merge until its **Accept** list is ticked and
  `pnpm verify` is green.
- Parallel lanes: after T05, run up to 3–4 sessions at once (lanes in `00_MASTER_PLAN.md`). Give long, mechanical tasks
  (T10 library CRUD, T14 render-station handlers, T21–T24 media pipelines, T26 observability) to **Muse** as long-running jobs;
  keep the security-critical ones (T04, T18, T20) in an interactive Muse session where you review each diff.
- If an agent wants to change SQL from S600, it must write a new step file (S610…) and add a matching `S610_tests.sql`.
  It must not edit S600/S605 in place after they ship.

Universal suffix for every prompt:
> Stay inside the listed paths. Use the RPC names and types in plan/02 and plan/04 exactly. Add tests. Run `pnpm verify`
> and paste the result. List anything you couldn't finish as open items, don't stub silently.

---

## Phase 1 — Foundation
**T01 Monorepo scaffold.** Paths: root, `packages/config`, `packages/ui`, `apps/web` (create-next-app 16, TS, Tailwind, App Router, src/).
Turborepo + pnpm workspaces, shared tsconfig strict, ESLint (incl. `no-restricted-imports` for `@/server/supabase/admin`),
Prettier, Vitest, Playwright, shadcn init, `lib/env.ts` with zod.
Accept: `pnpm dev` serves `/`; `pnpm verify` green; importing admin client from a client component fails lint.

**T02 Supabase migrations + seed.** Paths: `supabase/**`, `scripts/db-test.sh`. Build `baseline.sql` from schema.zip in
`unify.step_order` order (domain files by kind: 01_types → 10_tables → 11_constraints → 20_foreign_keys → 30_indexes →
40_functions → 50_triggers → 60_rls → 61_policies → 80_grants, then S100…S500). Note: `search_text` from
`26_reports_analytics/40_functions.sql` must load before tables that use it. Add S590, S600, S605, both test files, seed (dev tenant, owner,
size range, POMs, 3 garment templates with print areas: boxy tee, hoodie, 6-panel cap).
Accept: `supabase db reset` clean twice in a row; `pnpm db:test` prints `checks_passed = 82`.

**T03 Typed DB package.** Paths: `packages/db/**`, `scripts/gen-types.sh`. Generated types; `rpc.ts` with one typed
wrapper per RPC in plan/02; `schemas.ts` from plan/04; enums for every status CHECK.
Accept: wrappers compile against generated types; unit test asserts every RPC in plan/02 has a wrapper.

**T04 Auth, MFA, guards.** Paths: `apps/web/proxy.ts`, `src/app/(auth)/**`, `src/app/auth/callback`, `src/server/supabase/**`,
`src/server/auth/**`. Google for staff, email OTP/magic link for suppliers, TOTP enrollment page, aal2 for `/studio`,
`requireStaff`/`requireSupplier`, tenant switcher cookie validated against `tenant_memberships`.
Accept: e2e `auth.spec.ts`: staff without MFA → `/mfa`; supplier can't open `/studio` (404, not 403); staff can't open `/supplier/*` unless also a portal member.

**T05 CI.** Paths: `.github/workflows/**`. Jobs: install → typecheck → lint → unit → Supabase CLI `db start` + reset + db:test → Playwright (against a preview).
Accept: PR shows all checks; failing db test blocks merge.

## Phase 2 — Studio core
**T06 Command registry + Studio shell.** Paths: `packages/commands/**`, `src/features/studio/components/{StudioShell,LeftRail,Inspector}`,
`src/app/studio/layout.tsx`, `src/server/actions/*` (runCommand). Implement `defineCommand`, registry, `useCommand` hook (optimistic
+ toast on `Result` error), command palette (⌘K) listing all registered commands.
Accept: unit tests for registry + zod → JSON Schema; palette runs `design.create`.

**T07 Canvas editor.** Paths: `src/features/studio/**` (CanvasStage, PrintAreaOverlay, LayerList, panels: Uploads/Images/Graphics/Shapes/Text/AI,
ColorwayBar, ViewSwitcher), `src/app/studio/designs/**`. Konva stage per view (front/back/sleeves), dashed print areas from template
(mm ↔ px at 300 dpi preview scale), snapping, undo/redo (zustand history), text with Fontsource fonts, Iconify graphics, stock images via
`/api/stock`. Buttons: [Save], [Preview & Publish], [360 Rotate Product].
Accept: Playwright: create design from template → add text + icon → outside-print-area warning shows → save → reload restores the scene.

**T08 Versions + autosave + realtime.** Paths: `useAutosave`, `useRealtimeDesign`, `VersionTimeline`, `designs/[id]/history`.
Save = `ds_create_design_version`; autosave every 30 s when dirty; presence avatars; restore = new version from old `canvas_state`.
Accept: two browser contexts see each other's cursor; locked versions show a lock and "Duplicate to edit".

**T09 Asset pipeline.** Paths: `src/server/storage/**`, `api/studio/assets/[assetId]`, `UploadsPanel`. Upload to `design-private`
(path convention in plan/02), sha256, size, MIME sniff, `thumbnail` + optional `bg_remove` jobs. Staff images are streamed via the
staff route (no signed URLs embedded in HTML). Migration script for existing `design-assets` objects that should be private.
Accept: upload 20 MB PNG → thumbnail appears via Realtime; direct public URL to the object returns 400/404.

**T10 Libraries (Muse).** Paths: `src/app/studio/library/**`, `src/server/actions/library.ts`. CRUD for seasons, size ranges,
POM library (with diagram upload), materials (certifications, nominated vendor), garment templates (print-area editor drawing
rectangles on the flat; GLB upload; turntable frame count).
Accept: table + form per entity with zod validation; constraint errors are shown inline (e.g. base size not in sizes).

**T10b Flat library + license guard.** Spec: `plan/08_FLAT_LIBRARY.md` (read it in full). Paths: `packages/flat-gen/**`,
`packages/commands/src/flat/**`, `src/app/studio/library/flats/**`, `supabase/migrations/*_flat_library.sql`, `plan/db/S610_flat_library.sql`,
`plan/db/S610_tests.sql`, `supabase/tests/S610_tests.sql`, `scripts/seed-flats.ts`.
Write S610 + tests exactly as specified in plan/08 §S610 (new step file, never edit S600/S605). Build `flat-gen`: block + style
options → mm-unit SVG per view with the fixed layer ids (`silhouette`, `seams`, `stitches`, `trims`, `print_areas`, `callouts`,
`shading`); grade across the size range. Register commands `flat.generate`, `flat.grade`, `flat.import`. Seed the 12 core blanks
as `owned` templates and write each `print_areas` rect back to `ds_garment_templates.print_areas`. Library UI: Flats grid with a
license badge (Owned / Licensed / Printful only / Unlicensed), "Import licensed flat" (AI/EPS/PDF/SVG → VectorCraft converts to
SVG, license record required), "Generate flat" form. Back-fill the Printful imports as `printful_only`.
Accept: `pnpm db:test` prints 82 / 17 / all S610 checks; unit tests show every generated SVG has all 7 layer ids, a single
closed silhouette path, and print-area rects inside the silhouette for every size; Playwright: generate a hoodie → open it in
the canvas → print areas match → open in VectorCraft → save; an RFQ on a Printful-only template shows `DS_LICENSE_BLOCKED`.

**T10c Flat splitter (bundle → single pieces).** Spec: `plan/08_FLAT_LIBRARY.md §Splitting bundles`. Needs T10b and the T11 spike.
Paths: `packages/flat-gen/src/split/**`, `src/features/studio/flats/import/**`, `src/app/studio/library/flats/import/[batchId]/**`,
render-station handler `flat_split`, `packages/commands/src/flat/split.ts`. Commands: `flat.split`, `flat.piece.accept`,
`flat.piece.merge`, `flat.piece.cut`, `flat.piece.pair`, `flat.piece.scale`. Implement the four strategies in order (artboard →
layer → group → cluster), the silhouette rebuild with a raster-trace fallback, stitch/seam/trim sorting, scale calibration, and
the review screen. Uses the S610 import tables (already specified; add any missing checks to S610_tests).
Accept: fixtures in `packages/flat-gen/test/fixtures/` — (1) one garment front+back on one artboard, (2) two artboards,
(3) a 3-garment set as top-level groups, (4) a flattened file with no groups — each splits into the right number of pieces with
correct front/back pairs; every accepted piece passes the 7-layer validator; Playwright: upload a 3-garment set → review →
accept all → three templates appear and each opens in the canvas with print areas; a supplier request for a raw piece is denied.
Get 3–5 real VecFashion PDFs (bought ones) as private fixtures before starting; keep them out of git (`.fixtures-private/`).

**T11 Craft bridge.** Paths: `packages/craft-bridge/**`, `scripts/fetch-craft.ts`, `apps/web/public/craft/**` (gitignored), `next.config.ts` headers.
First read `storytold/craft-libs` `crates/web-host` and `crates/web-api` sources at the pinned SHA and write `protocol.ts` (zod) from
them. Fetch all eight web builds (VectorCraft, PhotoCraft, TextureCraft, DesignCraft, PdfCraft, LightCraft, EffectCraft, FilmCraft —
release `*-web-<version>.zip`, or `trunk build --release` at the pinned SHA) into `public/craft/<app>/`. `useCraftApp(app)` gives
`open(bytes, name)`, `execute(cmd, params)`, `export(format)`, `onDirty`; `runHeadless(app, job)` loads the app in a hidden
iframe for the render station.
**WASM capability spike (do this first, write results to `plan/wasm-spike.md`):** for each app, export every format the plan
needs from the web build: VectorCraft PDF/SVG/DXF, PhotoCraft PSD+PNG, TextureCraft GLB, DesignCraft PDF/X-4, PdfCraft
stamp+flatten, LightCraft JPEG, EffectCraft+FilmCraft 30 s 1080p H.264 MP4 (time it). Anything that fails gets
`runner = 'server'` for that job kind and a note in the spike file — nothing else in the plan changes.
Accept: contract test loads the real builds in Playwright, opens an SVG, runs one command, exports PDF bytes; spike table complete.

**T12 Open-in-Craft flow.** Paths: `src/app/studio/designs/[designId]/craft/[app]/page.tsx`, `api/craft/[app]/document/[assetId]`.
Staff-only document stream → iframe → save back → upload → `ds_create_design_version(source_app=app)`.
Accept: round-trip VectorCraft and PhotoCraft; COOP/COEP present only on craft paths (header test).

## Phase 3 — Tech packs
**T13 Tech pack editor.** Paths: `src/features/techpack/**`, `src/app/studio/techpacks/**`, `server/actions/techpacks.ts`.
Header (style no, season, size range, base size), BomTable (materials picker), MeasurementGrid (POM × sizes, tolerance, grade rule
dialog: base + increment per size), ConstructionList, ArtworkPlacements (pick asset, technique, mm size, offset ref), StatusBar.
Accept: grid rejects sizes outside the range (DB error mapped to cell error); in-review → "Request changes" returns to draft.

**T13b Tech pack template (11 pages) + S615.** Spec: `plan/09_TECH_PACK_TEMPLATE.md` (read it in full). Paths:
`packages/techpack-render/**`, `src/features/techpack/components/{HeaderPanel,ConstructionCallouts,PomMarkerEditor,
ColorwayMatrix,LabelEditor,HangTagEditor,PackagingEditor,TemplatePreview}`, `src/app/studio/library/techpack-templates/**`,
`plan/db/S615_tech_pack_template.sql`, `plan/db/S615_tests.sql`, `supabase/tests/S615_tests.sql`, seed of `plan/templates/techpack/svg/*`.
Write S615 + tests exactly as specified. Add the editor tabs so the 11 pages map 1:1 to tabs: Sketch, Construction (click on the
flat to drop a numbered callout), Measurement guide (drag POM arrows), Measurement chart, BOM, Materials, Colorways, Artwork,
Labels (ISO 3758 care-symbol picker, fibre % that must total 100), Hang tag (UPC check digit), Packaging (fold steps, polybag,
carton with size ratio). Build `techpack-render` (`fill()` with continuation pages) and a template validator that lists missing
`data-field` / `data-slot` / `data-repeat` ids. Live preview renders the filled SVG pages next to the editor.
Accept: `pnpm db:test` passes S600/S605/S610/S615; unit tests fill every page from a fixture snapshot and every required id is
populated; a 30-POM chart produces "MEASUREMENT CHART (2/2)"; supplier mode has no UNIT COST column; Playwright: build a
boxy tee pack across all 11 tabs → approve → internal PDF has 11+ pages and the supplier preview has the watermark.

**T14 Render station + PDFs (Muse).** Paths: `src/app/studio/render/**`, `src/features/render/**`, `api/studio/jobs/[jobId]/output`,
`apps/scan-worker/**`. Render station: tab session id (`crypto.randomUUID` without dashes), loop `ds_claim_browser_jobs` → `runHeadless`
→ heartbeat every 30 s with `ds_heartbeat_browser_job` (stop if it returns false) → POST output to `/api/studio/jobs/[jobId]/output`
(route checks `claimed_by` starts with `browser:<uid>:`, writes the bucket + `design_assets` row with the service key) →
`ds_finish_browser_job`. Handlers `thumbnail`, `bg_remove` (`onnxruntime-web`), `techpack_pdf` (`techpack-render` fills the 11-page template from
`ds_tech_pack_snapshot` JSON → DesignCraft → PDF/X-4), `techpack_preview_pdf` (supplier-mode fill from `ds_tech_pack_supplier_snapshot`, PdfCraft: per-viewer watermark, flatten, no copy/print, low-res
images → `supplier-previews`). Scan-worker: small Node + ClamAV container that claims only `virus_scan` with `ds_claim_jobs`.
Accept: approving a pack yields both PDFs < 120 s with one studio tab open; closing the tab mid-job → reaper requeues → next tab
finishes it once (idempotent); a supplier upload stays hidden until the scan-worker marks it clean.

**T15 Approval UX + revisions.** Paths: `ApproveDialog`, `RevisionDiff`, `PdfStatus`, `techpacks/[tpId]/revisions`. Diff two
`tech_pack_revisions.snapshot` JSONs (BOM/measurement changes highlighted). "New revision" = `ds_create_tech_pack`.
Accept: staff sees Approve disabled with reason; owner approves; version lock visible in the studio.

## Phase 4 — Suppliers and bidding
**T16 Suppliers + NDAs.** Paths: `src/features/suppliers/**`, `studio/suppliers/**`, `studio/ndas`, `server/email/**`. Vendor list from
`acct_vendors` (create vendor needs an AP control account — reuse your accounting UI or a picker), capabilities form, map (Maps JS API),
People API contact import, invite dialog → `ds_invite_supplier_user` → email with `/supplier/invite/{token}` (token never stored or logged
by us), NDA versions (new version = new row; activate one).
Accept: invite email arrives in Mailpit locally; the token appears in no log line (grep test).

**T17 RFQ builder.** Paths: `src/features/rfq/{RfqBuilder,LineEditor,VendorPicker,PublishChecklist,QaThread}`, `studio/rfqs/{page,new,[rfqId]}`.
Lines only from approved/released packs; size breakdown sums to quantity; target cost marked "internal"; PublishChecklist mirrors
`ds_publish_rfq` checks before calling it; optional Meet briefing (`api/meet/briefing`).
Accept: each publish precondition, when unmet, shows the exact checklist item; publish succeeds when all are met.

**T18 Supplier portal (interactive session, security-critical).** Paths: `src/app/supplier/**`, `src/features/supplier/**`,
`api/supplier/assets/**`, `api/supplier/uploads`, `server/watermark/**`. Invite acceptance, my RFQs, NDA gate (shows text, signer
name, sends the hash it displayed), RFQ view, SecurePreview (canvas), SecurePdfViewer (pdf.js from the proxy stream, no download
button), BidForm (autosave draft via `supplier_save_bid`, submit), questions, uploads (signed upload URL), decline.
Accept: `zero-leak.spec.ts` (see plan/07) passes; Lighthouse shows no storage hostnames in the page HTML or network log other than through `/api/supplier/*`.

**T19 Bid board + award.** Paths: `BidBoard`, `BidCompareTable`, `ScoreCard`, `AwardDialog`, `rfqs/[rfqId]/compare`. Sealed state banner
until close; after close: per-line price matrix, landed-cost estimate (price + tooling + samples), lead time, scores, weighted total using
`rfqs.evaluation_weights`; split awards per line; award → link to draft POs.
Accept: before close the board shows "Sealed — n bids received" and no numbers (count from `rfq_invitations.status`); after award, PO links open the existing ERP PO page.

**T20 Release, revoke, audit (interactive session).** Paths: `supplier/releases/**`, `api/supplier/releases/**`, `RevokeDialog`, `studio/audit`.
Production pack per vendor (render-station job stamps vendor name on every page with PdfCraft), revoke supplier, access log table with filters (vendor, RFQ, event, date) and CSV export for legal.
Accept: after revoke, an open supplier tab gets 403 on its next image fetch within 120 s; audit shows the denial.

## Phase 5 — Media, 3D, video, AI
**T21 Mockup renders (Muse).** Handler `mockup_render` (PhotoCraft batch: artwork → mockup PSD smart layer per colorway/view) + `supplier_preview` derivative (downsample + tiled watermark).
**T22 3D + 360 (Muse).** Handlers `texture_bake`, `turntable_render` (TextureCraft web build → GLB → Three.js render of 24/36 frames in the same tab); `ModelViewer3D` (`<model-viewer>`, AR) and `TurntableViewer` (drag-to-rotate frames). Suppliers get frames only, never the GLB.
**T22b Immersive Stream for XR (Muse).** Paths: `src/server/integrations/isxr/**`, `components/studio/three/XrStream.tsx`. Handler `xr_package` runs on a build machine, not the browser (GLB → Unreal template project → packaged build uploaded to your Cloud Storage bucket → content + version created on the service instance). `XrStream` embeds the stream iframe on the 3D page and in the supplier portal (signed, per-viewer session; same NDA + access check as image previews). Falls back to `ModelViewer3D` if the instance is down or the domain is not yet allowlisted.
Accept: a released style opens as a live stream for an approved supplier; network tab shows no GLB download; with the instance stopped the page shows `<model-viewer>` instead of an error.
**T23 Promo video (Muse).** Handler `promo_video`: EffectCraft template (Lottie/motion) + FilmCraft assembly, H.264/AAC 1080p export from the web builds (server runner only if the T11 spike says so); `VideoJobPanel` with progress from heartbeats.
**T24 Catalog photos (Muse).** Handler for LightCraft preset batch on a shoot folder; PhotoCraft retouch commands; contact-sheet view.
**T25 MCP gateway.** Paths: `apps/mcp-gateway/**`. Streamable HTTP server; Supabase JWT auth; tools from registry; Craft tools enqueue render-station jobs or call `craft-bridge` `execute` through an allow-list; `assist:{userId}` relay for canvas commands; audit.
Accept (each): job runs from the UI button **and** from an MCP tool call with the same command id; outputs are internal unless explicitly derived as previews.

## Phase 6 — Hardening and launch
**T26 Observability (Muse).** Sentry (web, render station, gateway, scan-worker), pino logs with request id, `studio/jobs` dashboard (queue depth, failures, p95 duration), alert on failed jobs > 3 in 10 min.
**T27 Google + notifications.** FCM web push channel for `platform_notify`, Merchant API product push for released styles, GA4 Admin/Data, Search Console sitemaps, Meet briefing route; settings page to connect Google per tenant with encrypted refresh tokens.
**T28 Lightsail deploy.** `apps/web/Dockerfile` (standalone), Lightsail container service deployment, health checks, env parity script, DNS cutover runbook, 48 h rollback window.
**T29 Security review.** CSP (no inline scripts except Next nonce; `frame-src 'self'`; `img-src 'self' blob: data:`), rate limits on `/api/supplier/*` and invite acceptance, dependency audit, `pnpm db:test` + zero-leak spec in CI, restore drill from PITR, written incident runbook (leak suspected → revoke → export audit → NDA claim).
