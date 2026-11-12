# 05 — Integrations

## Craft apps (storytold) — what each one does in the studio
All are Rust with web (WASM) builds and headless CLIs; several expose a stdio MCP server via `<app>-cli mcp`.
**This plan runs every app as its web build**: interactively in the editor, and headlessly on the `/studio/render`
render station (a staff tab that claims `craft_jobs`). Org: https://github.com/storytold. Pin each web build to a
commit SHA in `scripts/fetch-craft.ts` (downloads the release `*-web-<version>.zip` into `apps/web/public/craft/<app>/`);
never track `main`.

| # | Your need | App | Editor (interactive, WASM) | Render station job (WASM) | Output stored as |
|---|---|---|---|---|---|
| 1 | Garment flats & flat patterns | **VectorCraft** — SVG/PDF/AI/EPS/DXF ([repo](https://github.com/storytold/vectorcraft)) | edit flats, logos, pattern pieces in `/craft/vectorcraft/` | `vector_export`, `pattern_export` (PDF, SVG, DXF) | `design_assets` kind `flat_sketch` / `pattern`; blanks come from `packages/flat-gen` (see `08_FLAT_LIBRARY.md`) |
| 2 | Mockups | **PhotoCraft** — PSD/PSB, 500+ command registry ([repo](https://github.com/storytold/photocraft)) | smart-object style mockup editing | `mockup_render`: place artwork into mockup PSDs per colorway/view; `thumbnail` | `mockup` (internal) + `supplier_preview` derivative |
| 3 | 3D garments | **TextureCraft** — 3D garment painting, glTF/GLB in, textured GLB/OBJ/USD out (+ **MaterialCraft** fabrics) ([TextureCraft](https://github.com/storytold/texturecraft), [MaterialCraft](https://github.com/storytold/materialcraft)) | paint artwork and fabric onto the 3D garment | `texture_bake` (export textured GLB), `turntable_render` (24/36 frames via Three.js in the same tab) | `model_glb` (internal), turntable frames |
| 4 | Tech packs & spec sheets | **DesignCraft** (layout, PDF/X-4) + **PdfCraft** (watermark/flatten) ([DesignCraft](https://github.com/storytold/designcraft), [PdfCraft](https://github.com/storytold/pdfcraft)) | tech pack template editing | `techpack_pdf` (DesignCraft fills the template from `ds_tech_pack_snapshot()` JSON); `techpack_preview_pdf` (PdfCraft stamps + flattens the supplier copy) | `techpack_pdf` (internal), `supplier_preview` PDF, production release PDFs |
| 5 | Product promo video | **EffectCraft** (motion, Lottie) + **FilmCraft** (edit, 650+ commands) ([EffectCraft](https://github.com/storytold/effectcraft), [FilmCraft](https://github.com/storytold/filmcraft)) | timeline editing | `promo_video`: EffectCraft motion → FilmCraft assembly → MP4 export from the web build | `promo_video` |
| 6 | Model & catalog photos | **LightCraft** (RAW develop) + PhotoCraft retouch ([repo](https://github.com/storytold/lightcraft)) | grading presets (library in OPFS/IndexedDB) | batch apply preset to a shoot folder | `catalog_photo` |
| 7 | AI control (MCP + JSON command registry) | our `packages/commands` + each app's command registry | — | MCP gateway enqueues jobs or relays canvas commands to the open tab (see below) | — |
| 8 | 3D painting with an outside 3D/AI pipeline | **TextureCraft** + external model generation | — | external model (server call, returns a GLB) → `texture_bake` in TextureCraft | `model_glb` |
| 9 | Video rendering | FilmCraft/EffectCraft web builds on the render station | — | T11 spike times it; if a 30 s 1080p export takes > 3× real time, only `promo_video` moves to the optional server runner (`runner = 'server'`, Craft CLIs + FFmpeg) | — |

Background removal: **in the browser** with `onnxruntime-web` and an open segmentation model (BiRefNet or U²-Net ONNX;
confirm the model license is MIT/Apache before shipping). Files never leave your environment, and no Python server.

Embedding: the Craft host contract is in `craft-libs` (`craft-web-host`: `?host=parent` / `data-host="page"`; `craft-web-api`
exposes `window.<app>` with `request/execute/commands/docInspect/uiInspect/screenshot`) — see
[craft-libs README](https://raw.githubusercontent.com/storytold/craft-libs/main/README.md). The exact postMessage schema isn't
documented in the README, so **T11 starts by reading `crates/web-host` source and writing `packages/craft-bridge/src/protocol.ts`
from it**, with a contract test against a real build.

Headers: WASM threads need cross-origin isolation, so `next.config.ts` sets `Cross-Origin-Opener-Policy: same-origin` and
`Cross-Origin-Embedder-Policy: require-corp` **only** for `/craft/:path*`, the `studio/designs/[id]/craft/[app]` page and `/studio/render` (a cross-origin-isolated
iframe needs an isolated top-level page).
Applying them site-wide would break Google sign-in popups and Maps.

## Studio MCP gateway (`apps/mcp-gateway`)
- Transport: MCP Streamable HTTP; auth: `Authorization: Bearer <Supabase access token>` (OAuth flow through Supabase
  for desktop AI clients). Every tool call runs with that user's JWT, so RLS and the permission level of the command apply.
- Tools = `registry.toMcpTools()` from `packages/commands` (zod → JSON Schema). Examples an assistant can call:
  `design.create`, `layer.add_text` ("generate a logo"), `colorway.recolor` ("recolor the hoodie in bone and olive"),
  `techpack.measurements.grade` ("resize the pattern to a 2 cm grade"), `pattern.export`, `mockup.render`.
- Craft tools: long-running work becomes a job (`ds_enqueue_job`) that the render station runs in WASM; the tool
  returns the job id and the assistant polls `job.status`. Each app's own command registry (PhotoCraft 500+,
  FilmCraft 650+) is reachable through `craft-bridge` `execute`, filtered by an allow-list in `packages/commands`.
- Canvas commands (`clientOnly`) are relayed to the open studio tab over a Realtime broadcast channel `assist:{userId}`;
  if no tab is open, the tool returns "open the design to use canvas tools".
- Every tool call is written to `ds_access_events`-style audit (`apps/mcp-gateway/src/audit.ts` → `platform_audit` or a
  new `mcp_tool_calls` table in S610).

## Front-end libraries (your list, with the decision)
| Library | Use | Decision |
|---|---|---|
| Fabric.js **or** Konva.js | studio canvas | **Konva** (`react-konva`) — your `designs.source` already defaults to `konva`; better React integration. Fabric not used. |
| Paper.js | vector booleans for pattern pieces | optional; prefer VectorCraft for real vector work. Use `paper` only for in-canvas path ops if needed. |
| Unsplash / Pexels API | Images panel | server route `/api/stock` (keys server-side), store `provider` + attribution in `design_assets.metadata` |
| Iconify | Graphics panel | `@iconify/json` subsets self-hosted (no runtime CDN calls from the studio) |
| Rembg / Cloudinary / Imgix | background removal | **in the browser** (`onnxruntime-web` + open ONNX model) — Cloudinary/Imgix would send design files to a third party, which breaks your rule |
| Fontsource + Google Web Fonts Developer API | fonts | Fontsource npm packages for the fonts you use (self-hosted); the Web Fonts API only to list and preview the catalogue |
| Canvas-Txt | multi-line text on canvas | not needed with Konva `Text` (wrapping built in); skip |
| Three.js (GLTF, 360) **or** pre-rendered frames | 360 Rotate | both: `@google/model-viewer` (Three.js under the hood) for interactive GLB; pre-rendered 24/36-frame turntable for low-end devices and supplier previews (suppliers never get the GLB) |
| jsPDF / pdfmake | quick exports | jsPDF for "export current view"; real tech pack PDFs come from DesignCraft on the render station |
| Canvas2Image / FileSaver.js | downloads | `stage.toDataURL` + `file-saver` for staff only; suppliers get no download buttons |
| Also | | `sharp` + `pdf-lib` (watermarking), `pdfjs-dist` (secure viewer), `zustand`, `@tanstack/react-query`, `zod`, `react-hook-form`, `@tanstack/react-table`, `react-email` + Resend or SES, `firebase-admin`, `googleapis`, `@sentry/nextjs`, `@modelcontextprotocol/sdk` |

## Google APIs — each one's job
| API | Purpose in this build | Phase | Notes |
|---|---|---|---|
| Google OAuth | staff sign-in via Supabase Google provider; separate incremental consent for Workspace scopes (Meet, Docs) stored encrypted per user | 1 | keep sign-in scopes to `openid email profile`; request more only when a feature needs it |
| Google People API | import supplier contacts from your Google contacts into the invite dialog | 4 | read-only `contacts.readonly`, on demand |
| Web Fonts Developer API | font catalogue in the Text panel | 2 | API key server-side; fonts themselves served from Fontsource |
| Google Meet REST API | "Schedule supplier briefing" on an RFQ: `spaces.create` returns a `meetingUri` stored in `rfqs.meet_space_uri` and shown in the supplier portal ([Meet REST spaces.create](https://developers.google.com/workspace/meet/api/reference/rest/v2/spaces/create)) | 4–6 | scope `meetings.space.created`; never screen-share masters, share the watermarked portal view |
| Google Docs API | **internal only**: generate supplier-facing *text* (RFQ terms, NDA drafts) from templates | 6 | never put design imagery or tech packs into Google Docs — that would put files outside your environment |
| Maps JavaScript API | supplier map (`supplier_capabilities.latitude/longitude`), distance to your warehouse | 4 | browser key restricted by HTTP referrer |
| Firebase Cloud Messaging | web push to staff and suppliers (RFQ published, bid received, award) as a `platform_notify` channel ([FCM web](https://firebase.google.com/docs/cloud-messaging/web/receive-messages)) | 4 | service worker at `/firebase-messaging-sw.js`; tokens in a `push_tokens` table (S610) |
| Firebase In-App Messaging | not used for the web studio: it supports iOS, Android and Flutter only ([Firebase docs](https://firebase.google.com/docs/in-app-messaging/)) | later | use it when you ship a mobile app; on web, use the existing in-app notifications |
| Merchant API | push approved/released styles (title, images, variants) to Merchant Center for launch | 6 | Merchant API v1 (`merchantapi.googleapis.com`); your `google_merchant_sync_*` tables already exist |
| Google Analytics Admin API | create/link the GA4 property + data streams for launch pages | 6 | writes to `google_property_sync_runs` |
| Google Analytics Data API | campaign and launch-page stats on the studio dashboard | 6 | `google_ga4_daily`, `google_ga4_landing_pages` |
| Google Search Console API | sitemap submit + search performance for launch pages | 6 | `google_search_console_daily/sitemaps` |
| Web Search Indexing API | notify Google when a launch / lookbook page is published, updated or removed (`URL_UPDATED` / `URL_DELETED`), the same way you index pages today | 6 | server-side service account; every call logged to `google_indexing_submissions`; sitemap submit via Search Console runs alongside as the backup path ([Indexing API quickstart](https://developers.google.com/search/apis/indexing-api/v3/quickstart)) |
| Immersive Stream for XR | premium 3D/AR lane: photoreal garment experiences rendered on Google GPUs and streamed into the studio and supplier portal by iframe ([Google docs](https://docs.cloud.google.com/immersive-stream/xr/docs)) | 5 | content is an Unreal Engine build packaged on a build machine (Unreal can't run in a browser) from the TextureCraft GLB; embedding needs Google to allowlist your domain (request on day 0, like OAuth verification). Fits the security model: suppliers see a video stream, the GLB never leaves your environment. `<model-viewer>` stays as the fallback when the stream is unavailable |

## Env (`.env.example`)
```
NEXT_PUBLIC_SUPABASE_URL=            NEXT_PUBLIC_SUPABASE_ANON_KEY=        SUPABASE_SERVICE_ROLE_KEY=   # server only
NEXT_PUBLIC_SITE_URL=https://studio.example.com     SUPPLIER_SITE_URL=https://suppliers.example.com
WORKER_WEBHOOK_SECRET=               MCP_GATEWAY_URL=                       SENTRY_DSN=
RESEND_API_KEY= (or AWS_SES_*)       EMAIL_FROM="Atelier Sourcing <sourcing@example.com>"
UNSPLASH_ACCESS_KEY=                 PEXELS_API_KEY=                        GOOGLE_FONTS_API_KEY=
GOOGLE_OAUTH_CLIENT_ID=              GOOGLE_OAUTH_CLIENT_SECRET=           GOOGLE_TOKEN_ENC_KEY=  # 32-byte, encrypts stored refresh tokens
NEXT_PUBLIC_GOOGLE_MAPS_KEY=         GOOGLE_MERCHANT_ID=                    GA4_PROPERTY_ID=   GSC_SITE_URL=
GOOGLE_INDEXING_SA_JSON=             ISXR_PROJECT_ID=                       ISXR_REGION=       ISXR_SERVICE_INSTANCE=
FIREBASE_PROJECT_ID=  FIREBASE_CLIENT_EMAIL=  FIREBASE_PRIVATE_KEY=         NEXT_PUBLIC_FIREBASE_CONFIG=   NEXT_PUBLIC_FIREBASE_VAPID_KEY=
# scan-worker (Lightsail secrets, not in Vercel)
SUPABASE_URL=  SUPABASE_SERVICE_ROLE_KEY=  WORKER_ID=scan-1  WORKER_KINDS=virus_scan  JOB_TMP=/var/jobs
```
`apps/web/src/lib/env.ts` validates all of these with zod at boot and fails fast.
