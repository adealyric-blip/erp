# WASM capability spike — T11 (Phase 2, Lane C)

Date: 2026-11-12 (run 22:15–00:30 CST). Runner: headless Chromium (Playwright
1.65, SwiftShader WebGL2, `?webgl` flag) on this VM. Harness: a same-origin
static server sending the production isolation headers (COOP `same-origin` +
COEP `require-corp` + CORP `same-origin`), one iframe per app at
`/craft/<app>/index.html?host=parent&control&webgl`, speaking the
craft-web-host postMessage contract and the craft-web-api `window.<app>`
control channel. Fixtures: `fixture.svg` (400×400 tee flat), `fixture.png`
(200×200), `fixture.pdf` (1-page "SPIKE"), `fixture.glb` (triangle).

Pinned builds (scripts/fetch-craft.ts): VectorCraft 0.24.0, PhotoCraft 0.23.0,
TextureCraft 0.6.1, DesignCraft 0.20.1, PdfCraft 0.21.1, LightCraft 0.21.0,
EffectCraft 0.24.1, FilmCraft 0.20.1. Protocol source: storytold/craft-libs @
`09dcbc225b95232998498a40ca56e24716571d53`.

## Headline finding (changes the plan's assumption, not the plan)

The plan assumes all eight web builds speak the `craft-web-host` host bridge
(`?host=parent` → `<app>:ready` / `<app>:open` / `<app>:save`). **Only three
do in the shipped releases.** Verified two ways — behaviour (90 s wait for
`<app>:ready`) and source (each app's `apps/<app>-web/Cargo.toml` on main):

| App | `<app>:ready` | `window.<app>` control API | Drive surface in this release |
|---|---|---|---|
| VectorCraft 0.24.0 | NO (90 s) | YES — full (`request/execute/commands/docInspect/uiInspect/screenshot` + `openFile/captureDownloads/files/readFile`) | `execute()` only. `document.open {name, dataBase64}` opens; exports return bytes inline |
| PhotoCraft 0.23.0 | NO (90 s) | NO (`window.photocraft` undefined) | none in the web build |
| TextureCraft 0.6.1 | NO (90 s) | NO | none in the web build |
| DesignCraft 0.20.1 | NO (90 s) | NO | none in the web build |
| PdfCraft 0.21.1 | YES — 1.8–4.5 s, `version:"1"`, `appVersion:"0.21.1"`, `file:false` | YES — full | host bridge (`<app>:open` / `<app>:save`) + `execute()` |
| LightCraft 0.21.0 | YES (legacy) — 7.9 s, `version:"0.21.0"` (release in `version`, no `appVersion` — pre-crate bridge) | LEGACY — `window.lightcraft` exposes only `command` | legacy bridge + `command()` |
| EffectCraft 0.24.1 | NO (90 s) | YES — full except `docInspect`/`uiInspect` | `execute()` only |
| FilmCraft 0.20.1 | YES — 5.3 s, `version:"1"`, `appVersion:"0.20.1"`, `file:false` | YES — full | host bridge + `execute()` |

Source check: `photocraft-web`, `texturecraft-web`, `designcraft-web`
`Cargo.toml` files carry **no** `craft-web-*` dependency; `vectorcraft-web`
depends on `craft-web-api` only (rev `fd5e2fef…`); `pdfcraft-web` and
`filmcraft-web` depend on `craft-web-api` (+ host messages); `effectcraft-web`
wires its API through its own `effectcraft-host` crate. LightCraft's bridge
predates the crate (`window.lightcraft.command`, `version` = release).
All eight apps render (canvas present, wgpu → SwiftShader WebGL2) — they are
usable interactively; only the programmatic drive surface differs.

Consequence for the bridge (`src/lib/craft-bridge`): `CraftHost` (postMessage
open/save) works for PdfCraft, LightCraft (legacy) and FilmCraft today.
VectorCraft and EffectCraft are driven through `execute()` (open via
`document.open` / `addFile`, exports return bytes inline) — the bridge's
`execute`/`exportViaCommand` path covers them; `open()` via postMessage
silently does nothing there, so the T12 page must use the per-app open
command for those two. PhotoCraft, TextureCraft and DesignCraft cannot be
driven from the web build at all in these releases.

## Export results (the spike table)

| App | Format wanted | Result | Bytes / timing | Runner |
|---|---|---|---|---|
| VectorCraft | PDF | ✅ exported — `document.exportPdf {}` (also `document.export {format:'pdf'}`), `%PDF-1.7` magic, 9,514 B | 6.8 s first call / 4.8 s repeat (from opened `fixture.svg`, via `execute`) | **browser** |
| VectorCraft | SVG | ✅ exported — `document.export {format:'svg'}`, `<?xml` magic, 738 B | 2.4 s | **browser** |
| VectorCraft | DXF | ✅ exported — `document.exportDxf {}`, DXF `SECTION/HEADER` (AC1032), 17,886 B | 7.1 s | **browser** |
| PhotoCraft | PSD | ❌ no drive surface in web build 0.23.0 (no host bridge, no control API) | — | **server** |
| PhotoCraft | PNG | ❌ same | — | **server** |
| TextureCraft | GLB | ❌ no drive surface in web build 0.6.1 | — | **server** |
| DesignCraft | PDF/X-4 | ❌ no drive surface in web build 0.20.1 | — | **server** |
| PdfCraft | PDF (stamp+flatten) | ⚠️ PARTIAL — `file.save` round-trips through the host bridge: `<app>:save` with 615 B, `%PDF-1.4`, 0.5 s. `edit.watermark` executes but **opens the Watermark dialog** (widget count 159→249) — the stamp is not applied until the dialog is driven (`ui.set` + OK). `comment.flatten` / `form.flatten` exist but are **disabled** on a plain PDF (nothing flattenable). Flatten is N/A on this fixture, not failed. | save 0.5 s | **browser** (save); stamp needs dialog driving — see open items |
| LightCraft | JPEG | ✅ exported — `app.export {path:'spike-out.jpg', longEdge:200}` via legacy `window.lightcraft.command('app.export', JSON)` → `<lightcraft:save>` 10,671 B, magic `ff d8 ff e0`, `file(1)` confirms JFIF 133×200, LightCraft EXIF. `develop.set {values:{'light.exposure':0.7}}` works first. Note: `command()` takes (commandId, JSON-string params); `command('engine.commands', …)` is "unknown command". One earlier probe crashed the renderer target right after `command('engine.commands', {})` — not reproduced since. | 0.9 s | **browser** |
| EffectCraft | MP4 (30 s 1080p H.264) | ✅ exported, too slow — demo project "EffectCraft Intro" (300 frames, 1080p, H.264 Main @15 Mbps) → `/spike-30s.mp4`, 11,170,598 B, `ftyp`/`isom` magic verified via `readFile`. Wall 332.1 s (second run; first run 306.5 s) on CPU-only SwiftShader. 300 frames at 24–30 fps ⇒ 10–12.5 s of video ⇒ **27–33× real time**, far over the plan's 3× threshold. The plan asked for a 30 s export; the demo comp is 300 frames, so the timing is for 10–12.5 s, extrapolated against the same threshold. | 332.1 s | **server** (plan/05 §9) |
| FilmCraft | MP4 (30 s 1080p H.264) | ❌ encode fails at start — full pipeline works (newProject → `importDemoFootage {scene:'OceanSunset'}` → `newSequence {1920×1080, fps:30}` → `timeline.place` → 540-frame sequence → `export.queue.add {format:'h264'}` status ready), then `export.queue.start {wait:true}` fails in ~2 s: `encode: invalid configuration: cannot build the 1-thread pool: operation not supported on this platform`. Same error with `crossOriginIsolated=true` (COOP/COEP on top page + iframe, `SharedArrayBuffer` present) and with it false — isolation is not the cause. First attempt also showed the empty-timeline case (1 frame) fails identically. `export.formats`: h264 available, hevc/av1 not, prores available (not cleanly exercised — a param-edit mistake left the format at h264). | 2 s to fail | **server** |

`runner = 'server'` assignments above (PhotoCraft PSD+PNG, TextureCraft GLB,
DesignCraft PDF/X-4) follow plan/05 §9 exactly: the job kind moves to the
optional server runner (Craft CLIs + FFmpeg); nothing else in the plan
changes. The render station must NOT claim those job kinds in the browser
(`browserJobKinds()` in `src/lib/craft-bridge/apps.ts` reflects this file).

## What was actually verified (evidence)

- VectorCraft: `document.open {name:'fixture.svg', dataBase64}` → doc opens
  (`docInspect` shows 1 artboard, the SPIKE text layer, bounds 280×320);
  `commands()` = 1,422 commands. Exports above are real bytes, magic-checked.
- PdfCraft: `?host=parent` ready in 1.8 s (cold) / 4.5 s; fixture PDF opens
  via `<app>:open` (`docInspect` shows `doc:1`, 1 page on screen);
  `commands()` = 224 commands; `file.save` → `<app>:save` bytes identical
  to the opened file (615 B, `%PDF-1.4`) — the bridge round-trips.
- FilmCraft: ready in 5.3 s; control API present (incl. `importFiles`,
  `openProject`). Export probe pending at file time.
- LightCraft: ready in 7.9 s with legacy `version:"0.21.0"`; `window.lightcraft`
  = `["command"]`. Export probe pending at file time.
- EffectCraft: `commands()` = 763 commands (incl. render-queue and
  `comp.saveFrameAs*`); no ready in 90 s. Export probe pending at file time.
- PhotoCraft / TextureCraft / DesignCraft: app renders, canvas present, but
  no `<app>:ready` in 90 s and no `window.<app>` API; source confirms no
  `craft-web-*` dependency in their web shells.

## Open items (spike)

1. ~~LightCraft JPEG, EffectCraft MP4, FilmCraft MP4 export probes~~ — DONE
   2026-11-12 ~01:00–01:40 CST; table above is final. Browser runners:
   VectorCraft PDF/SVG/DXF, PdfCraft save, LightCraft JPEG. Server runners:
   PhotoCraft PSD+PNG, TextureCraft GLB, DesignCraft PDF/X-4,
   EffectCraft MP4, FilmCraft MP4.
2. PdfCraft stamp: drive the Watermark dialog via `uiInspect`/`ui.set` +
   click, then `file.save`, and verify the watermark text is in the bytes.
   Flatten: re-test on a PDF with comments/forms (flatten commands are
   disabled on a plain PDF).
3. The three bridgeless apps (PhotoCraft/TextureCraft/DesignCraft) need either
   a newer release that wires `craft-web-host`/`craft-web-api`, or a
   `trunk build --release` from a commit that does (plan's fallback) — or
   their jobs stay `runner='server'`. That is Jaizon's call, not Lane C's:
   never fork the apps.
4. VectorCraft/EffectCraft `open()` in the T12 page must go through the
   control channel (`document.open` / `addFile` + `file.open`), not
   postMessage — see `src/lib/craft-bridge/apps.ts` (`openCommand` per app,
   to be filled from the probes).
