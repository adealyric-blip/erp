# 07 — Testing and release

## Test layers
| Layer | Tool | Lives in | Gate |
|---|---|---|---|
| Database security + workflow | `psql -f supabase/tests/S600_tests.sql && psql -f supabase/tests/S605_tests.sql` | `supabase/tests` | `checks_passed = 82`, `s605_checks_passed = 17` (grows as you add steps; S610 adds its own count in T10b) |
| Unit | Vitest | `**/*.test.ts` | every command, mapper, watermark function |
| Contract | Vitest + Playwright | `packages/craft-bridge/test`, `packages/db/test` | Craft protocol vs real build; RPC wrappers vs generated types |
| E2E | Playwright | `apps/web/e2e` | `auth`, `studio`, `techpack`, `rfq-e2e`, `zero-leak` |
| Load | k6 | `scripts/load` | 50 concurrent suppliers streaming previews: p95 < 800 ms, 0 errors |

## What the DB tests already prove (S600: 82 checks, S605: 17 checks, all passing)
- Versions auto-number; current version tracks the latest; members can't write versions directly; locked versions are immutable even for the service role.
- Cross-tenant child rows are rejected.
- Tech pack: staff can submit for review but not approve; status can't be set with a direct UPDATE; approval locks the version,
  snapshots a revision and queues both PDF jobs; BOM is frozen after approval; approved packs can't be deleted; revision log is append-only.
- Worker: claims with SKIP LOCKED, finishing a preview job wires `preview_pdf_asset_id`; regular users can't claim jobs; a supplier
  preview can't sit in a non-preview bucket.
- Browser runner (S605): only members of the tenant can claim, only browser jobs, only their own claim can heartbeat or finish,
  virus scans can't be moved to a browser, a closed tab's job is requeued.
- NDA: only owners/admins author; text is immutable; hash computed by the DB.
- Invites: token is 64 hex chars, stored only as a hash, single-use, bound to the invited email (case-insensitive).
- RFQ: picks up the active NDA; staff can't publish; another tenant can't publish or see anything; drafts invisible to suppliers;
  lines and header frozen after publish.
- Supplier: NDA required before RFQ details and before any asset; the NDA hash must match; payload contains no target cost and no
  storage paths; only watermarked previews are authorized and the watermark names the viewer; source assets are never authorized;
  suppliers read zero rows from designs, assets, tech packs, RFQ lines, vendors and storage.
- Bids: totals computed by the DB; suppliers can't write bids directly; a competitor can't submit or see another vendor's bid.
- Sealed: owner sees no bids or bid lines before close; award is impossible before close; after close all submitted bids are visible.
- Award: draft PO for the winner with the right total and lines; RFQ awarded; loser rejected; loser's preview access revoked;
  winner gets a production grant; loser can't download the production pack.
- Audit: events recorded, denials recorded (and survive, since they're returned rather than raised); the log can't be deleted
  by members or changed by the service role.
- Revocation: a revoked supplier sees nothing and loses production access. Anonymous users see nothing and can't call supplier RPCs.

## Zero-leak checklist (manual + `zero-leak.spec.ts`)
1. As a supplier, view page source and HAR for an RFQ: no `supabase.co/storage` URLs, no signed tokens, no `storage_path`, no `target_unit_cost`.
2. Copy an image request URL from devtools and open it in a private window → 401/403.
3. Revoke the supplier while their tab is open → next image fetch 403 within 120 s; `ds_access_events` shows `asset_view_denied`.
4. Supplier B can't load supplier A's RFQ id, bid id or asset id (IDs guessed from A's session) → 403/404, logged.
5. Tech pack preview PDF: watermark on every page, text not selectable, print disabled in pdf.js viewer, file not downloadable via the UI.
6. Before close: staff RFQ page shows the sealed banner; network tab has no bid amounts.
7. Every bucket in Supabase dashboard shows Public = off.
8. `grep -r "createSignedUrl" apps/web/src` shows only staff-side storage helpers and the upload route.

## Release checklist (go-live)
- [ ] Prod Supabase: PITR on, daily logical backup to S3 (Lightsail object storage), restore drill done and timed.
- [ ] pg_cron jobs scheduled (`ds_close_due_rfqs`, `ds_reap_stale_jobs`).
- [ ] Auth: Google provider prod credentials, redirect URLs for both domains, MFA enforced, email templates branded, SMTP set (not Supabase default).
- [ ] Rate limits: invite acceptance 5/min/IP, supplier asset proxy 120/min/user, bid save 30/min/user.
- [ ] CSP and security headers verified with securityheaders.com; COOP/COEP only on craft paths.
- [ ] Scan-worker: Lightsail instance hardened (SSH key only, ufw: outbound 443 only, no inbound except SSH from your IP), ClamAV signatures auto-update, disk alerts.
- [ ] Render station: dedicated studio computer, OS auto-updates, Chrome/Edge current, full-disk encryption, screen locks; `/studio/render` pinned tab; Sentry shows its heartbeats.
- [ ] `/supplier/**` pages load no `/craft/` assets (Playwright network assertion in `zero-leak.spec.ts`).
- [ ] Sentry releases + source maps; alert routes to your phone.
- [ ] Legal: NDA v1 reviewed by counsel and activated; supplier terms page; privacy notice covers access logging (IP/UA).
- [ ] Friendly-supplier UAT: one real RFQ end to end, including an upload, a question, a revision, award, production download.
- [ ] Rollback: previous Vercel deployment pinned; DB migrations are additive (no destructive step in this release).

## Operating runbooks (write in T29)
- **Leak suspected:** identify the watermark → `ds_revoke_supplier` → export `ds_access_events` for the vendor (CSV) → NDA
  acceptance row (hash, IP, time) → counsel.
- **Job backlog:** check `studio/jobs`; open `/studio/render` on a second studio computer (each tab claims independently); if video still lags, move `promo_video` to the server runner.
- **Supplier locked out:** re-invite (new token; old one is void); never share tokens over chat.
- **Tenant offboarding:** service-role script (export, legal hold check, replica-mode delete) — see plan/02 "Known edges".

## Flat licensing checks (T10b, before Gate 2)
- Every row in `ds_garment_templates` has a `license_scope`; zero `unlicensed` templates are active.
- Every Printful import shows `printful_only` and can't be put on an RFQ (`DS_LICENSE_BLOCKED`).
- Every generated flat SVG has the 7 layer ids and mm-accurate print areas for every size in its range.
- Split pieces: no piece is in the designer without a reviewer, category, view, and scale; every piece shares its bundle's license.
- Licensed imports (VecFashion, FashionDesign411) each have a proof file attached and `allow_redistribution = false`.

## Tech pack template checks (T13b, before Gate 3)
- Validator passes on the default template: every `data-field`, `data-slot`, `data-repeat` id from `09_TECH_PACK_TEMPLATE.md` exists.
- A filled boxy tee pack shows all 11 pages; overflow tables add continuation pages and the footer page count is right.
- Supplier copy: no UNIT COST column, watermark on every page, text not selectable, print disabled during bidding.
- Approved pack: labels, hang tag, packaging, colorway matrix, callouts, POM markers can't be edited (DB rejects it).
