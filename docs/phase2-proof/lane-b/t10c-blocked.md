# T10c — BLOCKED on the T11 WASM capability spike (Lane C)

Per the Lane B brief: T10c starts ONLY after Lane C's WASM spike exists at
`plan/wasm-spike.md`. As of this writing that file does not exist.
Lane C has landed `src/lib/craft-bridge/` (protocol, apps, host, runHeadless,
useCraftApp) but no spike file, so no T10c code was started — the splitter
needs the spike's verdict on VectorCraft AI/EPS/PDF import in WASM
(normalise-to-SVG is step 2 of the §Splitting bundles pipeline).

## What is ready for T10c

- S610 import tables + guards: `ds_flat_import_batches`,
  `ds_flat_pieces` (license-match trigger, accept-requires-fields trigger),
  `ds__asset_license_viewable` denies raw pieces — 38 S610 checks green.
- `flat.import` command registers a batch row (status `queued`) and returns
  it with `conversion: 'pending'` — the seam the splitter will consume.
- Private fixtures (kept OUT of git via `**/.fixtures-private/`):
  5 real VecFashion PDFs in
  `src/lib/flat-gen/test/fixtures/.fixtures-private/`:
  - MBS003 Nautical Themed Swim Shorts (981 KB)
  - MBS010 Mens Swimming Trunks (891 KB)
  - MBS016 Mens Pedal Pushers Board Shorts (533 KB)
  - MBS018 Mens Short Length Swim Shorts (1.76 MB)
  - MBS021 Men Beach Summer Sweatsuit (4.05 MB)
  Source: `~/workspace/vecfashion-11006/extracted/` (130 real PDFs, one per
  product; `__MACOSX` resource forks excluded).
- Prior VecFashion split output (input/fixtures for the splitter):
  `~/workspace/vecfashion-11006/split/` — 389 view SVGs, 130 products,
  `manifest.json`. Note: split SVGs use an feImage filter chain — they
  render correctly in a browser and black in sharp; prove splitter/viewer
  work in the browser, never with a sharp render.
- Synthetic fixtures (1 garment front+back on one artboard; 2 artboards;
  3-garment set as top-level groups; flattened file) are NOT written yet —
  they belong to the T10c task itself. Place them under
  `src/lib/flat-gen/test-fixtures/` (the repo `.gitignore` has a bare
  `test` entry that ignores any path segment named `test`, so do NOT put
  them under `src/lib/flat-gen/test/`).

## Exact file waited on

`~/workspace/erp-2026-11-07/plan/wasm-spike.md` (Lane C, T11 spike).
