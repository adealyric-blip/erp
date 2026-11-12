// RFQ server actions — T17.
// Reads go through the staff user's own client (RLS applies); lifecycle
// goes through `ds_create_rfq` / `ds_invite_vendor_to_rfq` /
// `ds_publish_rfq` / `ds_close_rfq` (typed wrappers in src/lib/db/rpc).
// Lines are written as direct `rfq_lines` inserts while the RFQ is a
// draft (S600 `ds__rfq_child_guard` allows it; the RPCs own the rest).
//
// Tech-pack version pin: at publish time the action snapshots every
// line's pack (`ds_tech_pack_snapshot`), hashes the canonical JSON with
// sha256, and returns the pins with the publish result. S600 has no
// version-pin column on `rfqs`, so the pin is returned — not stored —
// and shown on the RFQ page (open item: a future step file could add
// `rfqs.spec_snapshot_pins jsonb`).
'use server';

import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/db';
import { dsCloseRfq, dsCreateRfq, dsInviteVendorToRfq, dsPublishRfq, dsTechPackSnapshot } from '@/lib/db/rpc';
import { requireStaff } from '@/server/auth/requireStaff';
import { fail, ok, type Result } from '@/server/result';
import { mapPgError } from '@/server/errors';
import {
  computePublishChecklist,
  pinTechPackVersion,
  validateRfqLine,
  type ChecklistItem,
  type RfqLineInput,
  type TechPackVersionPin,
} from '@/features/rfq/lib/validation';

type Row = Record<string, unknown>;
type RowResult = { data: Row | null; error: { message?: string; code?: string } | null };
type RowsResult = { data: Row[] | null; error: { message?: string; code?: string } | null };
type RpcResult = { data: unknown; error: { message?: string; code?: string } | null };

interface DbQuery {
  select: (cols: string) => DbQuery;
  eq: (col: string, v: unknown) => DbQuery;
  in: (col: string, v: unknown[]) => DbQuery;
  order: (col: string, opts?: { ascending?: boolean }) => DbQuery;
  limit: (n: number) => Promise<RowsResult>;
  single: () => Promise<RowResult>;
  insert: (rows: Row | Row[]) => DbQuery;
}

type AnyClient = {
  from: (table: string) => DbQuery;
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<RpcResult>;
};

const asAny = (c: SupabaseClient<Database>): AnyClient => c as unknown as AnyClient;

function err(e: { message?: string; code?: string } | null | undefined): Result<never> {
  if (e?.code) return mapPgError(e);
  return fail('unknown', e?.message ?? 'Database error');
}

function revalidate(rfqId?: string) {
  revalidatePath('/studio/rfqs');
  if (rfqId) revalidatePath(`/studio/rfqs/${rfqId}`);
}

// --- Reads -----------------------------------------------------------------

export interface RfqListRow {
  id: string;
  rfqNumber: string;
  title: string;
  status: string;
  bidDeadline: string | null;
  currency: string;
  createdAt: string;
}

export async function listRfqs(): Promise<Result<RfqListRow[]>> {
  const { supabase, tenantId } = await requireStaff();
  const { data, error } = await asAny(supabase)
    .from('rfqs')
    .select('id, rfq_number, title, status, bid_deadline, currency, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error || !data) return err(error);
  return ok(
    data.map((r) => ({
      id: String(r.id),
      rfqNumber: String(r.rfq_number ?? ''),
      title: String(r.title ?? ''),
      status: String(r.status ?? ''),
      bidDeadline: (r.bid_deadline as string | null) ?? null,
      currency: String(r.currency ?? 'USD'),
      createdAt: String(r.created_at ?? ''),
    })),
  );
}

export interface RfqDetail {
  rfq: Row;
  lines: Row[];
  invitations: Row[];
  ndaAcceptances: Row[];
}

export async function getRfq(rfqId: string): Promise<Result<RfqDetail>> {
  const { supabase, tenantId } = await requireStaff();
  const client = asAny(supabase);
  const rfq = await client.from('rfqs').select('*').eq('tenant_id', tenantId).eq('id', rfqId).single();
  if (rfq.error || !rfq.data) return err(rfq.error ?? { message: 'RFQ not found' });
  const [lines, invitations] = await Promise.all([
    client.from('rfq_lines').select('*, tech_packs!inner(id, title, style_number, status, revision, preview_pdf_asset_id)').eq('rfq_id', rfqId).order('line_no').limit(200),
    client.from('rfq_invitations').select('*, acct_vendors!inner(id, legal_name)').eq('rfq_id', rfqId).order('invited_at').limit(200),
  ]);
  const vendorIds = (invitations.data ?? []).map((i) => String(i.vendor_id));
  const acceptances =
    vendorIds.length > 0
      ? await client.from('ds_nda_acceptances').select('vendor_id, nda_id, signer_name, accepted_at').in('vendor_id', vendorIds).limit(200)
      : { data: [] as Row[], error: null };
  return ok({
    rfq: rfq.data,
    lines: lines.data ?? [],
    invitations: invitations.data ?? [],
    ndaAcceptances: acceptances.data ?? [],
  });
}

export interface ApprovedPackRow {
  id: string;
  title: string;
  styleNumber: string | null;
  status: string;
  revision: number;
  sizes: string[];
  designId: string;
}

/**
 * Lines only come from approved/released packs WITH a watermarked
 * preview — the same filter `ds_publish_rfq` enforces. `designId`
 * narrows to one design (rfqs/new?designId=xx).
 */
export async function listApprovedTechPacks(designId?: string | null): Promise<Result<ApprovedPackRow[]>> {
  const { supabase, tenantId } = await requireStaff();
  const client = asAny(supabase);
  let q = client
    .from('tech_packs')
    .select('id, title, style_number, status, revision, design_id, size_range_id, preview_pdf_asset_id')
    .eq('tenant_id', tenantId)
    .in('status', ['approved', 'released']);
  if (designId) q = q.eq('design_id', designId);
  const { data, error } = await q.order('updated_at', { ascending: false }).limit(200);
  if (error || !data) return err(error);
  const withPreview = data.filter((r) => r.preview_pdf_asset_id != null);
  // Sizes come from the pack's size range (best effort; empty = free breakdown).
  const rangeIds = [...new Set(withPreview.map((r) => String(r.size_range_id)).filter(Boolean))];
  let sizesByRange = new Map<string, string[]>();
  if (rangeIds.length > 0) {
    const ranges = await client.from('ds_size_ranges').select('id, sizes').in('id', rangeIds).limit(100);
    for (const r of ranges.data ?? []) {
      if (Array.isArray(r.sizes)) sizesByRange.set(String(r.id), r.sizes as string[]);
    }
  }
  return ok(
    withPreview.map((r) => ({
      id: String(r.id),
      title: String(r.title ?? ''),
      styleNumber: (r.style_number as string | null) ?? null,
      status: String(r.status),
      revision: Number(r.revision ?? 1),
      sizes: sizesByRange.get(String(r.size_range_id ?? '')) ?? [],
      designId: String(r.design_id ?? ''),
    })),
  );
}

// --- Create ------------------------------------------------------------------

export interface CreateRfqArgs {
  title: string;
  bidDeadline: string | null;
  currency: string;
  incoterm: string | null;
  sealed: boolean;
  shipToCountry: string | null;
  lines: RfqLineInput[];
  vendorIds: string[];
}

export async function createRfq(args: CreateRfqArgs): Promise<Result<{ rfqId: string }>> {
  const { supabase, tenantId } = await requireStaff();
  if (!args.title.trim()) return fail('invalid_state', 'RFQ title is required');
  if (args.lines.length === 0) return fail('invalid_state', 'Add at least one line');
  for (const line of args.lines) {
    const errs = validateRfqLine(line);
    if (errs.length > 0) return fail('invalid_state', `Line is invalid: ${errs.join('; ')}`);
  }
  // Re-check pack status server-side: lines only from approved/released packs.
  const packs = await listApprovedTechPacks();
  if (!packs.ok) return packs as unknown as Result<never>;
  const allowed = new Set(packs.data.map((p) => p.id));
  for (const line of args.lines) {
    if (!allowed.has(line.techPackId)) {
      return fail('invalid_state', `Tech pack ${line.techPackId} is not approved/released with a preview — lines only come from approved or released packs`);
    }
  }
  const id = await dsCreateRfq(supabase, {
    p_tenant: tenantId,
    p_title: args.title.trim(),
    p_bid_deadline: args.bidDeadline,
    p_currency: args.currency,
    p_incoterm: args.incoterm,
    p_sealed: args.sealed,
  });
  if (id.error || !id.data) return err(id.error);
  const rfqId = String(id.data);
  const client = asAny(supabase);
  const rows = args.lines.map((line, i) => ({
    tenant_id: tenantId,
    rfq_id: rfqId,
    line_no: i + 1,
    tech_pack_id: line.techPackId,
    quantity: line.quantity,
    size_breakdown: line.sizeBreakdown,
    target_unit_cost: line.targetUnitCost ?? null,
    notes: line.notes ?? null,
  }));
  const inserted = await (client.from('rfq_lines').insert(rows) as unknown as Promise<RowsResult>);
  if (inserted.error) return err(inserted.error);
  for (const vendorId of args.vendorIds) {
    const inv = await dsInviteVendorToRfq(supabase, { p_rfq: rfqId, p_vendor: vendorId });
    if (inv.error) return err(inv.error);
  }
  revalidate(rfqId);
  return ok({ rfqId });
}

// --- Publish (checklist + version pin) ----------------------------------------

export interface PublishPreview {
  checklist: ChecklistItem[];
  pins: TechPackVersionPin[];
  allMet: boolean;
}

/** Snapshot every line's pack and hash it — the version pin for the dialog. */
async function pinForLine(
  supabase: SupabaseClient<Database>,
  techPackId: string,
  revision: number,
): Promise<TechPackVersionPin> {
  const snap = await dsTechPackSnapshot(supabase, { p_tp: techPackId });
  const json = snap.data ? JSON.stringify(snap.data) : `{"tech_pack_id":"${techPackId}","revision":${revision}}`;
  const sha = createHash('sha256').update(json).digest('hex');
  return pinTechPackVersion(techPackId, revision, sha);
}

export async function getRfqPublishPreview(rfqId: string): Promise<Result<PublishPreview>> {
  const detail = await getRfq(rfqId);
  if (!detail.ok) return detail as unknown as Result<never>;
  const { supabase } = await requireStaff();
  const { rfq, lines, invitations } = detail.data;
  const pins: TechPackVersionPin[] = [];
  for (const line of lines) {
    const tp = (line.tech_packs ?? line.tech_pack ?? {}) as Row;
    pins.push(await pinForLine(supabase, String(line.tech_pack_id), Number(tp.revision ?? 1)));
  }
  const checklist = computePublishChecklist({
    status: String(rfq.status ?? ''),
    bidDeadline: (rfq.bid_deadline as string | null) ?? null,
    ndaId: (rfq.nda_id as string | null) ?? null,
    lines: lines.map((l) => {
      const tp = (l.tech_packs ?? l.tech_pack ?? {}) as Row;
      return {
        techPackId: String(l.tech_pack_id),
        techPackStatus: String(tp.status ?? ''),
        hasPreview: (tp.preview_pdf_asset_id as string | null) != null,
      };
    }),
    inviteCount: invitations.filter((i) => String(i.status) !== 'revoked').length,
    pins,
  });
  return ok({ checklist, pins, allMet: checklist.every((i) => i.met) });
}

export interface PublishRfqResult {
  status: string;
  pins: TechPackVersionPin[];
}

/**
 * Publish only after the checklist passes locally — the dialog disables
 * the button otherwise, and this re-checks so the RPC is never called
 * with a precondition unmet. NDA acceptance is a separate gate: an award
 * or release additionally requires each awarded vendor's NDA acceptance
 * (shown on the RFQ page; enforced by T19 award / T20 release).
 */
export async function publishRfq(rfqId: string): Promise<Result<PublishRfqResult>> {
  const { supabase } = await requireStaff();
  const preview = await getRfqPublishPreview(rfqId);
  if (!preview.ok) return preview as unknown as Result<never>;
  if (!preview.data.allMet) {
    const unmet = preview.data.checklist.filter((i) => !i.met).map((i) => i.label);
    return fail('invalid_state', `Publish checklist is not met: ${unmet.join('; ')}`);
  }
  const rpc = await dsPublishRfq(supabase, { p_rfq: rfqId });
  if (rpc.error || !rpc.data) return err(rpc.error);
  revalidate(rfqId);
  return ok({ status: String((rpc.data as Row).status ?? 'published'), pins: preview.data.pins });
}

export async function closeRfq(rfqId: string): Promise<Result<{ status: string }>> {
  const { supabase } = await requireStaff();
  const rpc = await dsCloseRfq(supabase, { p_rfq: rfqId });
  if (rpc.error || !rpc.data) return err(rpc.error);
  revalidate(rfqId);
  return ok({ status: String((rpc.data as Row).status ?? 'closed') });
}

export { type ChecklistItem, type TechPackVersionPin };