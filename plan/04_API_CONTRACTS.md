# 04 — API contracts (TypeScript)

These are the reference shapes. Agents implement them exactly; names match the DB.

## Result and errors — `apps/web/src/server/result.ts`, `errors.ts`
```ts
export type Result<T> = { ok: true; data: T } | { ok: false; error: { code: AppErrorCode; message: string; hint?: string } };
export type AppErrorCode = 'forbidden' | 'not_found' | 'invalid_state' | 'missing_data' | 'conflict' | 'nda_required' | 'unknown';

const PG_MAP: Record<string, AppErrorCode> = {
  '42501': 'forbidden', P0002: 'not_found', '22023': 'invalid_state', '23502': 'missing_data',
  '23505': 'conflict', '23514': 'invalid_state', '23503': 'invalid_state',
};
export function mapPgError(e: { code?: string; message?: string; hint?: string }): Result<never> {
  if (e.message === 'NDA_REQUIRED') return { ok: false, error: { code: 'nda_required', message: 'Accept the NDA to continue', hint: e.hint } };
  return { ok: false, error: { code: PG_MAP[e.code ?? ''] ?? 'unknown', message: e.message ?? 'Something went wrong' } };
}
```

## Supabase clients — `apps/web/src/server/supabase/*`
```ts
// server.ts — user-scoped, RLS applies
export async function createUserClient() { /* @supabase/ssr createServerClient with next/headers cookies() */ }
// admin.ts
import 'server-only';
export const admin = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
// ESLint: no-restricted-imports forbids '@/server/supabase/admin' outside src/server/{watermark,storage}/ and api/supplier/** route handlers.
```

## Auth guards — `apps/web/proxy.ts` + `server/auth/*`
```ts
// proxy.ts (Next 16, Node runtime) — refresh session; coarse routing only. Real checks happen in requireStaff/requireSupplier.
export const config = { matcher: ['/studio/:path*', '/supplier/:path*', '/craft/:path*', '/api/:path*'] };
export async function proxy(req: NextRequest) {
  const { supabase, res } = createProxyClient(req);
  const { data: { user } } = await supabase.auth.getUser();
  const p = req.nextUrl.pathname;
  if (!user && !p.startsWith('/supplier/invite')) return redirectToLogin(req);
  if (p.startsWith('/studio') || p.startsWith('/craft')) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel !== 'aal2') return NextResponse.redirect(new URL('/mfa', req.url));
  }
  return res;
}
// requireStaff(tenantId): user + aal2 + platform_is_tenant_member(tenantId), else notFound()
// requireSupplier(): user + at least one active supplier_portal_members row (via supplier_my_rfqs or a tiny RPC)
```

## Command registry — `packages/commands/src/define.ts`
```ts
export type Permission = 'member' | 'admin';
export interface CommandContext { supabase: SupabaseClient<Database>; userId: string; tenantId: string; canvas?: CanvasApi; signal?: AbortSignal }
export interface Command<I extends z.ZodTypeAny, O> {
  id: string;                         // 'techpack.approve'
  title: string;                      // shown in UI menus and as MCP tool title
  description: string;                // used as MCP tool description — write it for an AI reader
  scope: 'studio' | 'techpack' | 'rfq' | 'media' | 'library';
  permission: Permission;
  input: I;
  clientOnly?: boolean;               // canvas-only commands (layer.align) run in the browser; MCP drives them via the canvas session
  run(ctx: CommandContext, input: z.infer<I>): Promise<Result<O>>;
}
export function defineCommand<I extends z.ZodTypeAny, O>(c: Command<I, O>) { return c; }
```
Example:
```ts
export const approveTechPack = defineCommand({
  id: 'techpack.approve', title: 'Approve tech pack', scope: 'techpack', permission: 'admin',
  description: 'Approve a tech pack that is in review. Locks the design version and renders the master and supplier-preview PDFs.',
  input: z.object({ techPackId: z.string().uuid(), note: z.string().max(2000).optional() }),
  async run(ctx, i) {
    const { data, error } = await ctx.supabase.rpc('ds_transition_tech_pack', { p_tp: i.techPackId, p_to: 'approved', p_note: i.note ?? null });
    return error ? mapPgError(error) : { ok: true, data };
  },
});
```
Server action wrapper (`server/actions/techpacks.ts`):
```ts
'use server';
export async function runCommand(id: string, raw: unknown): Promise<Result<unknown>> {
  const cmd = registry.get(id); if (!cmd || cmd.clientOnly) return { ok: false, error: { code: 'not_found', message: id } };
  const { supabase, user, tenantId } = await requireStaff();
  const parsed = cmd.input.safeParse(raw); if (!parsed.success) return { ok: false, error: { code: 'invalid_state', message: parsed.error.message } };
  const res = await cmd.run({ supabase, userId: user.id, tenantId }, parsed.data);
  if (res.ok) revalidateTag(`${cmd.scope}:${tenantId}`);
  return res;
}
```

## Command list (v1)
| id | permission | RPC / effect |
|---|---|---|
| `design.create`, `design.save`, `design.duplicate` | member | insert `designs`; `ds_create_design_version` |
| `layer.add_text`, `layer.add_image`, `layer.add_shape`, `layer.align`, `layer.delete` | member (clientOnly) | canvas store |
| `colorway.create`, `colorway.recolor` | member | `design_colorways`; recolor = canvas fill swap per colorway |
| `print_area.fit` | member (clientOnly) | scale/center selection into the template print area |
| `asset.remove_bg`, `asset.upscale`, `mockup.render` | member | `ds_enqueue_job` (`bg_remove`, `mockup_render`) |
| `techpack.create`, `techpack.bom.upsert`, `techpack.measurements.upsert`, `techpack.measurements.grade`, `techpack.construction.upsert`, `techpack.artwork.place` | member | `ds_create_tech_pack`; child table writes |
| `techpack.submit_review` | member | `ds_transition_tech_pack(in_review)` |
| `techpack.approve`, `techpack.release`, `techpack.archive` | admin | `ds_transition_tech_pack` |
| `rfq.create`, `rfq.line.add`, `rfq.vendor.invite`, `rfq.answer` | member | `ds_create_rfq`, `rfq_lines`, `ds_invite_vendor_to_rfq`, `ds_answer_question` |
| `rfq.publish`, `rfq.close`, `rfq.award` | admin | `ds_publish_rfq`, `ds_close_rfq`, `ds_award_rfq` |
| `rfq.compare` | member | read unsealed bids + evaluations; weighted score |
| `supplier.invite`, `supplier.revoke` | admin | `ds_invite_supplier_user` (+ email), `ds_revoke_supplier` |
| `media.turntable.render`, `media.video.render`, `media.photos.grade`, `pattern.export` | member | `ds_enqueue_job` |

## Supplier asset proxy — `app/api/supplier/assets/[rfqId]/[assetId]/route.ts`
```ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(_req: Request, { params }: { params: Promise<{ rfqId: string; assetId: string }> }) {
  const { rfqId, assetId } = await params;
  const supabase = await createUserClient();                     // supplier JWT
  const { data, error } = await supabase.rpc('supplier_authorize_asset_view', { p_rfq: rfqId, p_asset: assetId });
  if (error || !data?.allowed) return new Response('Forbidden', { status: 403 });
  const { data: blob, error: dlErr } = await admin.storage.from(data.bucket).download(data.path);   // service role, server only
  if (dlErr || !blob) return new Response('Not found', { status: 404 });
  const body = data.mime_type === 'application/pdf'
    ? await stampPdf(await blob.arrayBuffer(), data.watermark_text)      // pdf-lib, diagonal tiled text, flatten
    : await stampImage(await blob.arrayBuffer(), data.watermark_text);   // sharp, tiled SVG overlay, max 1600 px, webp q70
  return new Response(body, { headers: {
    'Content-Type': data.mime_type === 'application/pdf' ? 'application/pdf' : 'image/webp',
    'Cache-Control': 'private, no-store, max-age=0', 'Content-Disposition': 'inline',
    'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'same-origin',
    'Referrer-Policy': 'no-referrer' } });
}
```
`SecurePreview` fetches the stream with `credentials: 'include'`, draws it on a `<canvas>` (no `<img src>` pointing at a URL
that can be copied), disables the context menu, and calls a tiny `ds_access_events` logger endpoint on `beforeprint` / copy
events (`print_attempt`, `copy_attempt`). That logging is advisory only.

## Supplier upload — `app/api/supplier/uploads/route.ts`
POST `{ rfqId, fileName, mime, size }` → `supplier_register_upload` (user JWT) → `admin.storage.from('supplier-uploads').createSignedUploadUrl(path)`
→ `{ uploadUrl, rfqFileId }`. The scan-worker's `virus_scan` job sets `scan_status`; staff UI shows files only when `clean`.

## Zod schemas (shared, `packages/db/src/schemas.ts`)
```ts
export const BidPayload = z.object({
  valid_until: z.string().date().optional(), lead_time_days: z.number().int().positive().optional(),
  payment_terms: z.string().max(200).optional(), incoterm: z.enum(['EXW','FCA','FOB','CFR','CIF','CPT','CIP','DAP','DPU','DDP']).optional(),
  notes: z.string().max(4000).optional(),
  lines: z.array(z.object({ rfq_line_id: z.string().uuid(), unit_price: z.number().nonnegative(), moq: z.number().int().positive().optional(),
    lead_time_days: z.number().int().positive().optional(), sample_cost: z.number().nonnegative().optional(),
    tooling_cost: z.number().nonnegative().optional(), size_price_overrides: z.record(z.string(), z.number().nonnegative()).optional(),
    notes: z.string().max(2000).optional() })).max(200),
});
export const AwardPayload = z.array(z.object({ rfq_line_id: z.string().uuid(), bid_id: z.string().uuid() })).min(1);
export const PrintArea = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), w: z.number().min(0).max(1), h: z.number().min(0).max(1),
  width_mm: z.number().positive(), height_mm: z.number().positive() });
export const GarmentPrintAreas = z.record(z.enum(['front','back','left_sleeve','right_sleeve','hood','crown','visor','side']), PrintArea);
```

## Realtime channels
| Channel | Payload | Subscribers |
|---|---|---|
| `design:{designId}` (broadcast + presence) | cursor, selection, `version_saved` | studio editors |
| Postgres changes on `craft_jobs` filtered by `subject_id` | status, output | `useJobStatus` |
| Postgres changes on `rfq_invitations` / `rfq_questions` filtered by `rfq_id` | status, new question | staff RFQ page |
Suppliers do not subscribe to Postgres changes (RLS would return nothing anyway); they poll `supplier_get_rfq` every 30 s
or get FCM pushes.

## Render station contract — `src/features/render` (WASM, staff browser)
```ts
type JobKind = 'mockup_render'|'supplier_preview'|'techpack_pdf'|'techpack_preview_pdf'|'vector_export'|'pattern_export'|
               'texture_bake'|'turntable_render'|'promo_video'|'bg_remove'|'virus_scan'|'thumbnail';
type BrowserJobKind = Exclude<JobKind, 'virus_scan'>;           // virus_scan is forced to runner='server' by the DB
interface BrowserHandler { kind: BrowserJobKind; app: CraftApp; timeoutSec: number;
  run(job: CraftJob, io: { craft: HeadlessCraft; input(assetId: string): Promise<Blob>; signal: AbortSignal })
    : Promise<{ file: Blob; name: string; kind: AssetKind; classification: 'internal'|'supplier_preview'; derivedFrom?: string }> }
// loop (useRenderStation): sessionId = crypto.randomUUID().replaceAll('-', '')
//   ds_claim_browser_jobs(tenantId, sessionId, kinds, 1) → handler.run (hidden COOP/COEP iframe via craft-bridge)
//   every 30 s ds_heartbeat_browser_job(jobId, sessionId) — false => abort
//   POST /api/studio/jobs/[jobId]/output (multipart) → { asset_id }
//   ds_finish_browser_job(jobId, sessionId, true, { asset_id })   |  on error: (…, false, null, message)
```
`/api/studio/jobs/[jobId]/output`: user JWT required; reads the job with the service key and rejects unless
`status='running'` and `claimed_by` starts with `browser:<auth uid>:`; writes the file to `design-private` (internal) or
`supplier-previews` (`classification='supplier_preview'`, `derived_from_asset_id` required); inserts `design_assets`;
returns `{ asset_id }`. The DB still rejects a preview in the wrong bucket and an asset from another tenant.

## Scan-worker contract — `apps/scan-worker`
`ds_claim_jobs('scan-1', ['virus_scan'], 2)` → download from `supplier-uploads` → `clamscan` → `ds_finish_job(ok, { clean, sha256 })`
(sets `rfq_files.scan_status`). Heartbeat `ds_heartbeat_job` every 20 s; SIGTERM → finish current, stop claiming.

## Webhook — `api/webhooks/jobs/route.ts`
The scan-worker POSTs `{ jobId, tenantId, kind, subjectId }` with `Authorization: Bearer ${WORKER_WEBHOOK_SECRET}` after
`ds_finish_job`. The route verifies the secret (timing-safe) and calls `revalidateTag`. Realtime covers the live UI;
the webhook only refreshes cached server components.
