# Lane 2 — Gate note (T15 Approval UX + revisions)

## What shipped (commit 05321ce + this proof commit)
- `src/features/techpack/components/ApproveDialog.tsx` — full transition
  matrix (submit / request changes / approve / release / archive), each
  disabled with the exact reason. Approve requires status `in_review` AND
  role owner/admin/administrator (`platform_is_tenant_admin`).
- `src/features/techpack/components/RevisionDiff.tsx` — field-level diff of
  two `tech_pack_revisions.snapshot` JSONs (header, BOM, measurements,
  construction, artwork, colorways; unknown S615 sections reported as
  generic section changes, never dropped).
- `src/features/techpack/components/PdfStatus.tsx` — `techpack_pdf` +
  `techpack_preview_pdf` states from `craft_jobs` (not queued / queued /
  rendering / ready / failed / cancelled, with error text and asset id).
- `src/app/studio/techpacks/[tpId]/revisions/page.tsx` (+ `RevisionsClient.tsx`)
  — version-lock banner, Review/Approve dialog trigger, "New revision"
  (`ds_create_tech_pack`, blocked with reason while the pack is
  draft/in_review), PdfStatus, append-only revision log with a per-revision
  diff. Server actions in the page call the typed `ds_transition_tech_pack` /
  `ds_create_tech_pack` wrappers; reads go through the staff user's client
  (RLS). `demo-*` ids render fixture data (same pattern as designs/[id]).
- `src/features/techpack/test-fixtures/revision-snapshots.ts` — rev1/rev2
  snapshots in the exact S600 `ds_tech_pack_snapshot` shape (no invented fields).
- `e2e/techpack-revisions.spec.ts` — guard test green; full flow skipped
  (needs local Supabase stack).

## Verification (this VM, 2026-11-12 ~05:15 CST)
- `npx tsc --noEmit` exit 0.
- `npx eslint "src/features/techpack/**" "src/app/studio/techpacks/**"` 0 errors.
  (Repo-wide `npx eslint .` currently crashes on a T10c file that vanished
  mid-run — `ENOENT src/lib/flat-gen/src/split/dbg2.test.ts` — shared-tree
  churn by the parallel T10c agent, not this lane.)
- `npx vitest run src/features/techpack/ "src/app/studio/techpacks"` —
  5 files, 39/39 green (31 Lane 2 + 8 Lane 1 `validation.test.ts`).
- Full `npm run test`: 150 passed; failures confined to T10c
  `src/lib/flat-gen/src/split/real-pdfs.test.ts` (splitter views
  `['front']` vs expected `['front','side','back']`) — other lane's
  in-progress work, not this lane's paths.
- `db:test` NOT run: no SQL in this task; the throwaway PG cluster is
  Lane 1's (brief: do not touch it).
- Live route check: `curl :3003/studio/techpacks/demo-boxy-tee/revisions`
  → 307 to `/login?next=…` (guard intact, route resolves).
- Dev server reused on :3003 (another lane's); no second server started.

## Screenshots (this folder)
- 01 guard → /login (live :3003, unauthenticated).
- 02 ApproveDialog, role=member: Approve disabled, reason
  "Only an owner or admin can approve — your role is member."
- 03 ApproveDialog, role=owner: Approve enabled + lock-consequence note.
- 04 RevisionDiff rev1→rev2: 8 changes — header (title, base_size),
  BOM (+rib trim, −neck tape, qty 1.8→2.1), CW/M 58→59, construction note,
  +Sage colorway.
- 05 PdfStatus: both PDFs Ready (with asset ids) + queued/failed pair.
- 06 Revisions page (in_review): New revision disabled with reason,
  design-version lock badge, history with open diff.
- 07 Revisions page (approved): "Version locked — approved packs cannot
  be edited" banner + design-version lock badge.

02–07 are component-level renders of the real components (esbuild bundle +
Tailwind v4 build, `proof/` harness — same pattern as Lane A's konva-proof),
because /studio is behind the staff+MFA guard and this VM has no local
Supabase stack for an authenticated session. Regeneration is in
`proof/README.md`; bundle.js/css are build outputs, not committed.

## Accept items — verdicts
- Staff sees Approve disabled with reason: **PASS** (unit matrix 18 tests
  + screenshot 02).
- Owner approves: **NOT VERIFIED LIVE** — Approve is enabled for owner
  (unit + screenshot 03) and the action calls the real S600 RPC, but no
  approval was executed against a database on this VM (no local Supabase
  stack, no authenticated session). The e2e flow test is written and skipped
  pending the stack.
- Version lock visible in the studio: **PASS at component level**
  (screenshot 07) — the DB-side lock (`ds__tp_child_guard`, design version
  `is_locked` set by `ds_transition_tech_pack`) is S600 behavior, not
  re-proven live here.

## Open items / cross-lane seams
1. **Lane 1 — `runCommand` swap (seam defined in page.tsx header):** once
   `src/server/actions/techpacks.ts` lands with `techpack.approve`,
   `techpack.submit_review`, `techpack.release`, `techpack.archive`,
   `techpack.create`, the page's two inline server actions should call
   `runCommand` instead of the RPC wrappers directly. No duplicate action
   file was created here.
2. **Lane 1 — tech-pack editor + seed:** no editor route exists yet, so the
   revisions page links only to /studio. A seeded in-review pack + member/
   owner users are needed for the live e2e flow (test is written, skipped).
3. **S615 (Lane 1):** the diff tolerates S615 snapshot keys as generic
   section summaries; once S615 lands, extend `diffTechPackSnapshots` with
   field-level labels/hangtags/packaging diffs.
4. **T14 render station:** PdfStatus reads `craft_jobs`; the jobs are only
   produced when a pack is approved on a live stack. No download route was
   invented — the asset id is shown when a job succeeds.
5. **Local Supabase stack (coordinator):** no Docker/CLI on this VM, so the
   authenticated end-to-end (owner approves a real pack, lock enforced by
   the DB, PDFs queued) is unverified — see verdicts above.
