// Supplier portal actions — T18 (Phase 4 Lane 2).
//
// SECURITY MODEL (read before changing anything here):
// - Every boundary is enforced server-side by the S600 SECURITY DEFINER
//   RPCs (supplier_accept_invite, supplier_get_nda, supplier_accept_nda,
//   supplier_my_rfqs, supplier_get_rfq, supplier_save_bid,
//   supplier_submit_bid, supplier_withdraw_bid, supplier_ask_question,
//   supplier_decline_rfq). This file never reads a supplier table directly
//   and NEVER trusts a client-supplied supplier_id / vendor_id: the vendor
//   is always derived inside the RPC from auth.uid().
// - The caller is proven by requireSupplier() (active
//   supplier_portal_members row via ds_my_vendor_ids) or, for invite
//   acceptance, by a signed-in session whose email matches the invite.
// - Supplier login is the EXISTING session system: Supabase SSR cookies +
//   the /login page (staff Google OAuth; suppliers email OTP / magic link).
//   There is no src/lib/auth header-session system in this repo and no
//   second auth system was built — this file extends the existing one by
//   linking the session to the vendor through supplier_accept_invite.
// - The invite token is single-use: supplier_accept_invite nulls the stored
//   hash on success (expire-on-success). The token is never logged.
'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createUserClient } from '@/server/supabase/server';
import { requireSupplier } from '@/server/auth/requireSupplier';
import { requireStaff } from '@/server/auth/requireStaff';
import { fail, ok, type Result } from '@/server/result';
import { mapPgError } from '@/server/errors';
import {
  AwardPayload,
  BidPayload,
  dsAwardRfq,
  dsRfqUnsealed,
  supplierAcceptInvite,
  supplierAcceptNda,
  supplierAskQuestion,
  supplierDeclineRfq,
  supplierGetNda,
  supplierGetRfq,
  supplierMyRfqs,
  supplierSaveBid,
  supplierSubmitBid,
  supplierWithdrawBid,
} from '@/lib/db';
import type { Database } from '@/lib/db';
import type { SupplierNda, SupplierRfqListItem, SupplierRfqView } from '@/features/supplier/types';
import type { BidBoardData, BoardAward, BoardBid, BoardLine, PurchaseOrderLink } from '@/features/supplier/bidBoardTypes';

function pg(e: { code?: string; message?: string; hint?: string } | null): Result<never> {
  return mapPgError(e ?? { message: 'Database error' });
}

// --- Page loaders (server components call these; RPC-guarded) -------------

/** The supplier's own current RFQs only — supplier_my_rfqs derives the
 *  vendor set from auth.uid(); nothing client-supplied reaches the query. */
export async function loadMyRfqs(): Promise<Result<SupplierRfqListItem[]>> {
  const { supabase } = await requireSupplier();
  const { data, error } = await supplierMyRfqs(supabase);
  if (error) return pg(error);
  return ok((data as unknown as SupplierRfqListItem[]) ?? []);
}

/** Minimised RFQ payload: no target cost, no internal notes, no other
 *  bids, no storage paths (the RPC guarantees that shape). */
export async function loadRfq(rfqId: string): Promise<Result<SupplierRfqView>> {
  const { supabase } = await requireSupplier();
  const { data, error } = await supplierGetRfq(supabase, { p_rfq: rfqId });
  if (error) return pg(error);
  if (!data) return fail('not_found', 'RFQ not found');
  return ok(data as unknown as SupplierRfqView);
}

export async function loadNda(rfqId: string): Promise<Result<SupplierNda>> {
  const { supabase } = await requireSupplier();
  const { data, error } = await supplierGetNda(supabase, { p_rfq: rfqId });
  if (error) return pg(error);
  if (!data) return fail('not_found', 'NDA not found');
  return ok(data as unknown as SupplierNda);
}

// --- Invite acceptance (T18) -----------------------------------------------

/** Accept an invite by token. The caller must already be signed in with
 *  the invited email (the RPC checks it); the token is single-use. */
export async function acceptInvite(token: string): Promise<Result<{ vendor_id: string; tenant_id: string }>> {
  const supabase = await createUserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail('forbidden', 'Sign in with the invited email address first.');
  if (!token || token.trim().length < 8) return fail('invalid_state', 'Invite token is invalid or expired.');
  const { data, error } = await supplierAcceptInvite(supabase, { p_token: token.trim() });
  if (error) return pg(error);
  const row = data as unknown as { vendor_id: string; tenant_id: string } | null;
  if (!row?.vendor_id) return fail('invalid_state', 'Invite token is invalid or expired.');
  revalidatePath('/supplier');
  return ok(row);
}

// --- NDA (T18) ---------------------------------------------------------------

/** Accept the NDA. p_body_sha256 MUST be the hash of the text the supplier
 *  was shown (the NdaGate component sends nda.body_sha256 verbatim); the
 *  RPC rejects any other hash. */
export async function acceptNda(
  rfqId: string,
  bodySha256: string,
  signerName: string,
  signerTitle: string | null,
): Promise<Result<void>> {
  const { supabase } = await requireSupplier();
  if (signerName.trim().length < 2) return fail('invalid_state', 'Type your full name to sign.');
  const { error } = await supplierAcceptNda(supabase, {
    p_rfq: rfqId,
    p_body_sha256: bodySha256,
    p_signer_name: signerName.trim(),
    p_signer_title: signerTitle,
  });
  if (error) return pg(error);
  revalidatePath(`/supplier/rfqs/${rfqId}`);
  return ok(undefined);
}

// --- Bids (T18) ---------------------------------------------------------------

/** Autosave a draft bid. Payload is validated against the shared
 *  BidPayload zod schema (plan/04) before it reaches the RPC. */
export async function saveBid(rfqId: string, payload: unknown): Promise<Result<string>> {
  const { supabase } = await requireSupplier();
  const parsed = BidPayload.safeParse(payload);
  if (!parsed.success) return fail('invalid_state', parsed.error.issues[0]?.message ?? 'Invalid bid.');
  const { data, error } = await supplierSaveBid(supabase, { p_rfq: rfqId, p_payload: parsed.data as never });
  if (error) return pg(error);
  revalidatePath(`/supplier/rfqs/${rfqId}`);
  return ok(data as unknown as string);
}

export async function submitBid(bidId: string): Promise<Result<void>> {
  const { supabase } = await requireSupplier();
  const { error } = await supplierSubmitBid(supabase, { p_bid: bidId });
  if (error) return pg(error);
  return ok(undefined);
}

export async function withdrawBid(bidId: string): Promise<Result<void>> {
  const { supabase } = await requireSupplier();
  const { error } = await supplierWithdrawBid(supabase, { p_bid: bidId });
  if (error) return pg(error);
  return ok(undefined);
}

// --- Questions / decline (T18) -----------------------------------------------

export async function askQuestion(rfqId: string, question: string): Promise<Result<void>> {
  const { supabase } = await requireSupplier();
  const text = question.trim();
  if (text.length < 3 || text.length > 4000) return fail('invalid_state', 'Question must be 3–4000 characters.');
  const { error } = await supplierAskQuestion(supabase, { p_rfq: rfqId, p_question: text });
  if (error) return pg(error);
  revalidatePath(`/supplier/rfqs/${rfqId}`);
  return ok(undefined);
}

// --- Staff bid board + award (T19) -------------------------------------------------
// The bid board is staff-only. Sealed state comes from ds_rfq_unsealed;
// while sealed, bids are NEVER read — the loader returns an empty bids
// array and only the invitation-status count. Awards go through
// ds_award_rfq (which creates draft erp_purchase_orders + production
// grants and revokes the losers); this file posts nothing to any ledger
// and creates no finance tables — finance ledger work is PAUSED.

type Row = Record<string, unknown>;
type RowResult = { data: Row | null; error: { message?: string } | null };
type RowsResult = { data: Row[] | null; error: { message?: string } | null };

interface StaffDbQuery {
  select: (cols: string) => StaffDbQuery;
  eq: (col: string, v: unknown) => StaffDbQuery;
  in: (col: string, vs: unknown[]) => StaffDbQuery;
  order: (col: string, opts?: { ascending?: boolean }) => StaffDbQuery;
  limit: (n: number) => Promise<RowsResult>;
  single: () => Promise<RowResult>;
}

type StaffAnyClient = { from: (table: string) => StaffDbQuery };
const asStaffAny = (c: SupabaseClient<Database>): StaffAnyClient => c as unknown as StaffAnyClient;

export async function loadBidBoard(rfqId: string): Promise<Result<BidBoardData>> {
  const { supabase, tenantId } = await requireStaff();
  const db = asStaffAny(supabase);

  const { data: rfqRow, error: rfqErr } = await db.from('rfqs').select('*').eq('id', rfqId).eq('tenant_id', tenantId).single();
  if (rfqErr || !rfqRow) return fail('not_found', 'RFQ not found.');

  const { data: unsealed } = await dsRfqUnsealed(supabase, { p_rfq: rfqId });
  const isUnsealed = unsealed === true;

  const { data: invitations } = await db
    .from('rfq_invitations')
    .select('status')
    .eq('rfq_id', rfqId)
    .eq('tenant_id', tenantId)
    .limit(500);
  // The ONLY number shown while sealed: bids received, from invitation status.
  const receivedCount = (invitations ?? []).filter((i) => i.status === 'bid_submitted' || i.status === 'awarded').length;

  const { data: lineRows } = await db
    .from('rfq_lines')
    .select('id,line_no,quantity,tech_pack_id')
    .eq('rfq_id', rfqId)
    .eq('tenant_id', tenantId)
    .order('line_no', { ascending: true })
    .limit(200);
  const tpIds = (lineRows ?? []).map((l) => String(l.tech_pack_id));
  const { data: packs } = tpIds.length
    ? await db.from('tech_packs').select('id,title,style_number').in('id', tpIds).limit(200)
    : { data: [] as Row[] };
  const packById = new Map((packs ?? []).map((p) => [String(p.id), p]));
  const lines: BoardLine[] = (lineRows ?? []).map((l) => ({
    rfq_line_id: String(l.id),
    line_no: Number(l.line_no),
    quantity: Number(l.quantity),
    tech_pack_title: String(packById.get(String(l.tech_pack_id))?.title ?? '—'),
    style_number: (packById.get(String(l.tech_pack_id))?.style_number as string | null) ?? null,
  }));

  // NDA acceptance per vendor (award gate): a vendor counts as accepted
  // when a ds_nda_acceptances row exists for this RFQ's NDA + vendor.
  const { data: ndaRows } = rfqRow.nda_id
    ? await db.from('ds_nda_acceptances').select('vendor_id').eq('nda_id', String(rfqRow.nda_id)).eq('tenant_id', tenantId).limit(500)
    : { data: [] as Row[] };
  const ndaAcceptedByVendor: Record<string, boolean> = {};
  for (const r of ndaRows ?? []) ndaAcceptedByVendor[String(r.vendor_id)] = true;

  // Awards + draft POs (if awarded already).
  const { data: awardRows } = await db
    .from('rfq_awards')
    .select('rfq_line_id,bid_id,vendor_id,quantity,unit_price,purchase_order_id')
    .eq('rfq_id', rfqId)
    .eq('tenant_id', tenantId)
    .limit(200);
  const poIds = [...new Set((awardRows ?? []).map((a) => String(a.purchase_order_id)).filter(Boolean))];
  const { data: poRows } = poIds.length
    ? await db.from('erp_purchase_orders').select('id,po_number,status,total,vendor_id').in('id', poIds).limit(200)
    : { data: [] as Row[] };
  const poById = new Map((poRows ?? []).map((p) => [String(p.id), p]));
  const { data: vendorRows } = await db.from('acct_vendors').select('id,display_name,company_name,legal_name').eq('tenant_id', tenantId).limit(500);
  const vendorName = (id: string) => {
    const v = (vendorRows ?? []).find((x) => String(x.id) === id);
    return String(v?.display_name ?? v?.company_name ?? v?.legal_name ?? id);
  };
  const awards: BoardAward[] = (awardRows ?? []).map((a) => ({
    rfq_line_id: String(a.rfq_line_id),
    bid_id: String(a.bid_id),
    vendor_id: String(a.vendor_id),
    vendor_name: vendorName(String(a.vendor_id)),
    quantity: Number(a.quantity),
    unit_price: Number(a.unit_price),
    purchase_order_id: a.purchase_order_id ? String(a.purchase_order_id) : null,
    po_number: a.purchase_order_id ? String(poById.get(String(a.purchase_order_id))?.po_number ?? '') : null,
  }));
  const purchaseOrders: PurchaseOrderLink[] = (poRows ?? []).map((p) => ({
    vendor_id: String(p.vendor_id),
    po_id: String(p.id),
    po_number: String(p.po_number),
    status: String(p.status),
    total: p.total == null ? null : Number(p.total),
  }));

  // Bids are read ONLY when unsealed. While sealed the array stays empty
  // — no prices, no names, no scores reach the page.
  let bids: BoardBid[] = [];
  if (isUnsealed) {
    const { data: bidRows } = await db
      .from('bids')
      .select('id,vendor_id,status,revision,currency,valid_until,lead_time_days,total_amount')
      .eq('rfq_id', rfqId)
      .eq('tenant_id', tenantId)
      .in('status', ['submitted', 'shortlisted', 'awarded', 'rejected'])
      .order('created_at', { ascending: false })
      .limit(200);
    const bidIds = (bidRows ?? []).map((b) => String(b.id));
    const { data: bidLineRows } = bidIds.length
      ? await db.from('bid_lines').select('bid_id,rfq_line_id,unit_price,moq,lead_time_days,sample_cost,tooling_cost').in('bid_id', bidIds).limit(1000)
      : { data: [] as Row[] };
    const { data: evalRows } = bidIds.length
      ? await db.from('bid_evaluations').select('bid_id,scores,created_at').in('bid_id', bidIds).order('created_at', { ascending: false }).limit(500)
      : { data: [] as Row[] };
    const linesByBid = new Map<string, Row[]>();
    for (const bl of bidLineRows ?? []) {
      const arr = linesByBid.get(String(bl.bid_id)) ?? [];
      arr.push(bl);
      linesByBid.set(String(bl.bid_id), arr);
    }
    // Latest evaluation per bid (rows are newest-first).
    const evalByBid = new Map<string, Row>();
    for (const ev of evalRows ?? []) {
      if (!evalByBid.has(String(ev.bid_id))) evalByBid.set(String(ev.bid_id), ev);
    }
    const lineQty = new Map(lines.map((l) => [l.rfq_line_id, l.quantity]));
    bids = (bidRows ?? []).map((b) => {
      const bls = (linesByBid.get(String(b.id)) ?? []).map((bl) => ({
        rfq_line_id: String(bl.rfq_line_id),
        unit_price: Number(bl.unit_price),
        moq: bl.moq == null ? null : Number(bl.moq),
        lead_time_days: bl.lead_time_days == null ? null : Number(bl.lead_time_days),
        sample_cost: bl.sample_cost == null ? null : Number(bl.sample_cost),
        tooling_cost: bl.tooling_cost == null ? null : Number(bl.tooling_cost),
      }));
      const landed = bls.reduce(
        (s, bl) => s + bl.unit_price * (lineQty.get(bl.rfq_line_id) ?? 0) + (bl.tooling_cost ?? 0) + (bl.sample_cost ?? 0),
        0,
      );
      const scores = (evalByBid.get(String(b.id))?.scores ?? {}) as Record<string, unknown>;
      return {
        bid_id: String(b.id),
        vendor_id: String(b.vendor_id),
        vendor_name: vendorName(String(b.vendor_id)),
        status: String(b.status),
        revision: Number(b.revision),
        currency: String(b.currency),
        valid_until: (b.valid_until as string | null) ?? null,
        lead_time_days: b.lead_time_days == null ? null : Number(b.lead_time_days),
        landed_total: landed,
        lines: bls,
        quality: typeof scores.quality === 'number' ? scores.quality : null,
        compliance: typeof scores.compliance === 'number' ? scores.compliance : null,
      };
    });
  }

  return ok({
    rfq: {
      id: String(rfqRow.id),
      rfq_number: String(rfqRow.rfq_number),
      title: String(rfqRow.title),
      status: String(rfqRow.status),
      sealed: Boolean(rfqRow.sealed),
      currency: String(rfqRow.currency),
      bid_deadline: (rfqRow.bid_deadline as string | null) ?? null,
      target_delivery_date: (rfqRow.target_delivery_date as string | null) ?? null,
      evaluation_weights: (rfqRow.evaluation_weights as Record<string, unknown> | null) ?? null,
    },
    lines,
    sealed: !isUnsealed,
    receivedCount,
    bids,
    ndaAcceptedByVendor,
    awards,
    purchaseOrders,
  });
}

/** Award selected lines. Gates (also enforced by the RPC): RFQ must be
 *  closed, and every awarded vendor must have accepted the RFQ's NDA.
 *  Returns the draft-PO links ds_award_rfq created — links only, no
 *  ledger posting. */
export async function awardRfq(
  rfqId: string,
  awards: unknown,
): Promise<Result<PurchaseOrderLink[]>> {
  const { supabase, tenantId } = await requireStaff();
  const parsed = AwardPayload.safeParse(awards);
  if (!parsed.success) return fail('invalid_state', parsed.error.issues[0]?.message ?? 'Invalid award.');
  const db = asStaffAny(supabase);
  const { data: rfqRow, error: rfqErr } = await db.from('rfqs').select('id,status,nda_id').eq('id', rfqId).eq('tenant_id', tenantId).single();
  if (rfqErr || !rfqRow) return fail('not_found', 'RFQ not found.');
  if (String(rfqRow.status) !== 'closed') {
    return fail('invalid_state', `Close the RFQ before awarding (status is ${String(rfqRow.status)}).`);
  }
  // NDA gate: every awarded vendor must have accepted this RFQ's NDA.
  const { data: bidRows } = await db
    .from('bids')
    .select('id,vendor_id')
    .in('id', parsed.data.map((a) => a.bid_id))
    .eq('tenant_id', tenantId)
    .limit(200);
  const awardedVendors = [...new Set((bidRows ?? []).map((b) => String(b.vendor_id)))];
  if (rfqRow.nda_id) {
    const { data: ndaRows } = await db
      .from('ds_nda_acceptances')
      .select('vendor_id')
      .eq('nda_id', String(rfqRow.nda_id))
      .in('vendor_id', awardedVendors)
      .eq('tenant_id', tenantId)
      .limit(200);
    const accepted = new Set((ndaRows ?? []).map((r) => String(r.vendor_id)));
    const missing = awardedVendors.filter((v) => !accepted.has(v));
    if (missing.length > 0) {
      return fail(
        'nda_required',
        `Award blocked: ${missing.length} awarded vendor${missing.length === 1 ? '' : 's'} ha${missing.length === 1 ? 's' : 've'} not accepted the NDA for this RFQ.`,
      );
    }
  }
  const { data, error } = await dsAwardRfq(supabase, { p_rfq: rfqId, p_awards: parsed.data as never });
  if (error) return mapPgError(error);
  const out = data as unknown as { purchase_orders?: Record<string, string> } | null;
  const poIds = Object.values(out?.purchase_orders ?? {});
  const { data: poRows } = poIds.length
    ? await db.from('erp_purchase_orders').select('id,po_number,status,total,vendor_id').in('id', poIds).limit(200)
    : { data: [] as Row[] };
  revalidatePath(`/studio/rfqs/${rfqId}/compare`);
  return ok(
    (poRows ?? []).map((p) => ({
      vendor_id: String(p.vendor_id),
      po_id: String(p.id),
      po_number: String(p.po_number),
      status: String(p.status),
      total: p.total == null ? null : Number(p.total),
    })),
  );
}

export async function declineRfq(rfqId: string, reason: string | null): Promise<Result<void>> {
  const { supabase } = await requireSupplier();
  const { error } = await supplierDeclineRfq(supabase, { p_rfq: rfqId, p_reason: reason });
  if (error) return pg(error);
  revalidatePath('/supplier');
  return ok(undefined);
}
