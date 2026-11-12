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
import { createUserClient } from '@/server/supabase/server';
import { requireSupplier } from '@/server/auth/requireSupplier';
import { fail, ok, type Result } from '@/server/result';
import { mapPgError } from '@/server/errors';
import {
  BidPayload,
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
import type { SupplierNda, SupplierRfqListItem, SupplierRfqView } from '@/features/supplier/types';

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

export async function declineRfq(rfqId: string, reason: string | null): Promise<Result<void>> {
  const { supabase } = await requireSupplier();
  const { error } = await supplierDeclineRfq(supabase, { p_rfq: rfqId, p_reason: reason });
  if (error) return pg(error);
  revalidatePath('/supplier');
  return ok(undefined);
}
