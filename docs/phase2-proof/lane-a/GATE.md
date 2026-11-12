# Lane A — Gate 2 note (T06–T08)

## What shipped (commit 57a8fa5 + follow-up fix commit)
- T06: command registry (`src/lib/commands/` — 14 Lane A commands; the live
  registry also carries Lane B's 3 flat commands, merged by Lane B in 893fb5c),
  `runCommand` server action, `useCommand` (optimistic + toast), ⌘K palette.
- T07: Konva `CanvasStage` (per-view stage, dashed print areas from the
  template, mm↔px at 300 dpi, snapping, zustand undo/redo, Fontsource text,
  curated icon set, stock images via `/api/stock`), drawer panels
  (Uploads/Images/Graphics/Shapes/Text/AI) through the extended StudioDrawer.
- T08: `ds_create_design_version` save, 30 s autosave, realtime presence
  (`design:{id}`), `VersionTimeline` (lock + "Duplicate to edit", restore =
  new version from old canvas_state).

## Verification (this VM, 2026-11-12 ~04:35 CST)
- `npx tsc --noEmit` exit 0 · `eslint` (lane paths) 0 errors · `npm run test`
  93/93 green (10 files, all lanes) · Playwright guard test green.
- Screenshots in this folder: 01 guard → /login · 03 canvas (live shell) ·
  04 Shapes drawer · 05 Text drawer · 06 Konva stage (component-level render).

## NOT verified here — open items
- The full-page Playwright flow (T07/T08 Accept) needs the local Supabase +
  Mailpit stack; this VM has no Supabase CLI and no Docker, so
  `e2e/studio.spec.ts` serial tests skip (`PLAYWRIGHT_LOCAL_STACK` unset).
  The guard test runs and passes.
- `db:test` fails on this VM: the DB on :54322 lacks the S600 schema
  (`relation "ds_seasons" does not exist`). No SQL was added in this lane;
  the local DB needs its migrations applied (coordinator / Phase 1).
- Dev server ran on :3003 (another lane's), not :3001: a second `next dev`
  in this directory is refused by Next's dev lock, and `npm run dev`
  hard-codes `-p 3000`.
- Full @iconify/json self-hosted subset is a data-only swap (12-icon curated
  set ships now). Preview & Publish saves a version and lands on history;
  publish-to-listing is not in T06–T08. 360° turntable frames are T22.
