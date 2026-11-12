# 01 — Architecture

## Topology (WASM-first)
```
                 ┌──────────────────────── Vercel (now) ─► Lightsail Container Service (later, same image) ─────────────┐
 Staff browser ──┤ apps/web  (Next.js 16 App Router, Node runtime)                                                       │
 (Google SSO+MFA)│   /studio/**      staff UI (Konva canvas, tech packs, RFQ board)                                      │
   = editor AND  │   /craft/<app>/** self-hosted Craft WASM builds, all 8 apps (COOP/COEP only on these paths)           │
   render station│   /studio/render  render-station page: claims craft_jobs, runs them in Craft WASM, uploads output     │
 Supplier ───────┤   /supplier/**    supplier portal (magic link) — never loads Craft WASM or any master file            │
 browser         │   /api/supplier/assets/[rfq]/[asset]  watermark-and-stream proxy (no URLs ever leave)                 │
                 │   /api/studio/jobs/[id]/output  receives render output, writes the private bucket (service key)       │
                 │ apps/mcp-gateway (Streamable HTTP MCP, OAuth bearer = Supabase JWT)                                   │
                 └──────────────┬──────────────────────────────────────────────┬──────────────────────────────────────────┘
                                │ supabase-js (user JWT)  / service key (server only)
                     ┌──────────▼──────────┐                         ┌──────────▼───────────────────────────────┐
                     │ Supabase            │◄── ds_claim_jobs ───────│ scan-worker (small, server)               │
                     │ Postgres + RLS      │    (runner = server)    │  ClamAV for untrusted supplier uploads    │
                     │ Auth (Google, OTP)  │                         │  only. Optional later: Craft CLIs as a    │
                     │ Storage (4 private  │◄── ds_claim_browser_jobs│  fallback if a web build can't export a   │
                     │   buckets)          │    (runner = browser)   │  format (decided by the T11 spike)        │
                     │ Realtime (job/bid)  │                         └───────────────────────────────────────────┘
                     │ pg_cron (reaper)    │
                     └─────────────────────┘
```
Why WASM-first: all eight Craft apps (VectorCraft, PhotoCraft, TextureCraft, DesignCraft, PdfCraft, LightCraft,
EffectCraft, FilmCraft) ship web builds compiled from the same Rust engine. Rendering in a staff browser means design
masters are processed on your own machines and your own storage, there is no render server to run or pay for, and
Vercel's short function timeouts don't matter.

How a render runs: a button (or an MCP tool) calls `ds_enqueue_job` → a staff tab on `/studio/render` (any open studio
tab can act as one; a dedicated always-on studio computer is recommended for batches) claims it with
`ds_claim_browser_jobs`, loads the needed Craft app in a hidden cross-origin-isolated iframe, executes the command
through `craft-bridge`, heartbeats every 30 s, posts the file to `/api/studio/jobs/[id]/output`, then calls
`ds_finish_browser_job`. If the tab closes, `ds_reap_stale_jobs` puts the job back in the queue.

What stays on a server, and why:
- **Virus scanning of supplier uploads** (`virus_scan`, forced to `runner = server` by a trigger): files from outside
  are untrusted and must never be opened in a staff browser first.
- **Per-viewer watermark on supplier previews**: done in the Next.js proxy route at view time, so it can't be skipped.
- **Immersive Stream for XR packaging** (T22b): Unreal Engine builds can't run in a browser; done on a build machine.

Known limits to check, not assume (T11 spike, Gate 2): the Craft READMEs say each web build runs the full app, but
don't list which export formats work in the browser. Video export speed is the main risk (you flagged it yourself);
the spike times a 30 s 1080p FilmCraft/EffectCraft export on the render-station computer. If it fails the bar
(< 3× real time), only `promo_video` moves to the optional server runner — nothing else changes.

## Moving from Vercel to Lightsail
- Build with `output: 'standalone'`; one Dockerfile (`apps/web/Dockerfile`) is used for both.
- No Vercel-only APIs: no `@vercel/kv`, no Edge runtime (`proxy.ts` is Node in Next 16), images through `next/image`
  with `images.unoptimized` toggled by env when not on Vercel, cron through `pg_cron` (not Vercel Cron).
- Cutover: deploy the container to Lightsail, run smoke tests on the `*.lightsail` URL, flip DNS (low TTL set 24h before),
  keep Vercel warm for 48h for rollback.

## Identity model
| Actor | How they sign in | What they are in the DB | What they can touch |
|---|---|---|---|
| Owner / admin | Google OAuth via Supabase, TOTP MFA (aal2 required for `/studio`) | `tenant_memberships.role in (owner, admin)` | everything in their tenant; approve, publish, award, NDAs, invites |
| Staff / manager | same | `tenant_memberships` (`staff`, `manager`, `viewer`) | design, tech pack drafts, RFQ drafts; no approve/publish/award |
| Supplier user | email magic link / OTP (invited address only) | `supplier_portal_members` (active) → `acct_vendors` | **only** `supplier_*` RPCs; zero tables, zero storage |
| Render station (staff tab) | the staff user's own session | the user's JWT (`ds_claim_browser_jobs`, only own tenant, only `runner='browser'`) | jobs of their tenant; outputs written by `/api/studio/jobs/[id]/output` after the claim is checked |
| scan-worker | service key (Lightsail secret) | `service_role` | `virus_scan` jobs + `supplier-uploads` objects |
| AI assistant (MCP) | OAuth → acts as the signed-in staff user | the user's JWT | the same commands as the UI, with the same RLS |

## Zero-leak model (what "never leaves my environment" means here)
1. **No file transfer to suppliers before award.** Suppliers get only watermarked, downsampled derivatives
   (`classification='supplier_preview'`, bucket `supplier-previews`), streamed through `/api/supplier/assets/...`.
   A database CHECK makes it impossible to label a source file as a preview (it must be in the previews bucket
   and point at the source via `derived_from_asset_id`).
2. **Per-viewer watermark** (vendor · email · UTC time) is stamped on every stream; PDFs are flattened, with copy and
   print permissions off (PdfCraft), and the viewer is a canvas renderer (pdf.js) instead of a download.
3. **Gates in order**: active portal member → live invitation → NDA accepted (hash of the exact text shown) →
   asset belongs to a tech pack on this RFQ → grant not revoked or expired. All of this is enforced in SQL, not in React.
4. **Sealed bids**: staff cannot read amounts until close or deadline (RLS policy `ds_bids_staff_read`). Suppliers
   never see each other.
5. **After award**: the winner gets a `production` grant and downloads a vendor-watermarked production pack via
   `supplier_authorize_release`; losers' preview grants are revoked the moment of award.
6. **Audit**: `ds_access_events` is append-only (even for service role); every view, denial, NDA, bid, upload,
   download and revocation is recorded with IP and user agent.
7. **Revocation is instant**: `ds_revoke_supplier` kills membership, invitations and grants in one transaction.
   Proxy TTL is 120 s and responses are `no-store`.

What it does not do, and you should know: nothing stops someone photographing a screen. The watermark makes a leak
traceable to a person and time, and the NDA (with stored hash, IP and timestamp) makes it enforceable. That is the
realistic standard; DRM-grade protection isn't available in a browser.

## Key data flows
**Design save**: canvas → command `design.save` → server action → `ds_create_design_version` → Realtime broadcast to
collaborators → enqueue `thumbnail` job.

**Craft edit**: user clicks "Open in VectorCraft" → `/craft/vectorcraft/?host=parent` iframe → `craft-bridge` sends the
document (bytes from `design-private` via short-lived server fetch, never a public URL) → user edits → bridge receives
the export → server action uploads to `design-private` → new design version with `source_app='vectorcraft'`.

**Tech pack approve**: owner → `ds_transition_tech_pack(approved)` → version locked, revision snapshot, two jobs queued →
render station runs DesignCraft (PDF/X-4 master) and PdfCraft (watermarked preview) in WASM → `ds_finish_browser_job` wires asset ids
→ Realtime notifies the editor.

**RFQ**: draft → lines (approved tech packs only) → invite vendors → `ds_publish_rfq` (checks NDA, deadline ≥1h, previews
exist) → suppliers notified (in-app + email + FCM web push) → bids → pg_cron `ds_close_due_rfqs` at the deadline → comparison
board → `ds_award_rfq` → draft `erp_purchase_orders` per vendor → production release.

## Non-functional targets
- p95 studio page TTFB < 400 ms; canvas save < 300 ms; proxy stream first byte < 500 ms for 2 MB previews.
- Job SLAs: thumbnail < 15 s, tech pack PDF < 120 s, 36-frame turntable < 10 min, 30 s promo MP4 < 15 min.
- RPO 5 min (Supabase PITR), RTO 1 h; restore drill before launch.
- Every table tenant-scoped; every RPC permission-checked; 0 public buckets for design data.
