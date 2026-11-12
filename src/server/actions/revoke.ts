// Release + revoke + audit actions — T20 (Phase 4 Lane 2).
//
// SECURITY MODEL (read before changing anything here):
// - Revocation has ONE source of truth: ds_revoke_supplier. It kills the
//   portal membership, open invitations and ALL asset release grants in a
//   single transaction. Nothing in this file revokes anything by hand.
// - Release submission is ds_transition_tech_pack(…, 'released') — the
//   existing S600 lifecycle RPC. The app-side gate below (≥1 APPROVED tech
//   pack WITH an attached production PDF) runs BEFORE the RPC is called;
//   the RPC itself re-checks admin + the approved→released transition.
// - Audit reads go through the staff user's own client (RLS applies);
//   ds_access_events is append-only in the DB, so this file never writes
//   it. Auditable copies (snapshot/vault/audit CSV) are NOT watermarked.
// - No client-supplied vendor/tenant id is trusted: requireStaff() proves
//   the tenant from the session, and the RPCs derive the rest.
'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/db';
import { requireStaff } from '@/server/auth/requireStaff';
import { fail, ok, type Result } from '@/server/result';
import { mapPgError } from '@/server/errors';
import { dsRevokeSupplier, dsTransitionTechPack } from '@/lib/db';
import { isReleasable } from '@/features/supplier/releases/releaseGate';
import type { AccessEventRow } from '@/features/supplier/types';

type Row = Record<string, unknown>;
type RowResult = { data: Row | null; error: { message?: string } | null };
type RowsResult = { data: Row[] | null; error: { message?: string } | null };

interface DbQuery {
  select: (cols: string) => DbQuery;
  eq: (col: string, v: unknown) => DbQuery;
  in: (col: string, vs: unknown[]) => DbQuery;
  gte: (col: string, v: unknown) => DbQuery;
  order: (col: string, opts?: { ascending?: boolean }) => DbQuery;
  limit: (n: number) => Promise<RowsResult>;
  single: () => Promise<RowResult>;
}

type AnyClient = { from: (table: string) => DbQuery };
const asAny = (c: SupabaseClient<Database>): AnyClient => c as unknown as AnyClient;

function pg(e: { code?: string; message?: string; hint?: string } | null): Result<never> {
  return mapPgError(e ?? { message: 'Database error' });
}

export interface ReleaseLineStatus {
  rfq_line_id: string;
  line_no: number;
  tech_pack_id: string;
  tech_pack_title: string;
  style_number: string | null;
  revision: number;
  status: string;
  pdf_asset_id: string | null;
  /** The T20 release gate: approved AND a production PDF attached. */
  releasable: boolean;
  production_granted: boolean;
  production_granted_vendor_id: string | null;
}

export interface ReleaseStatus {
  lines: ReleaseLineStatus[];
  /** True when at least one line passes the gate. */
  canRelease: boolean;
}

// --- Revoke (T20) ------------------------------------------------------------

/** One-click revocation. Single source of truth: ds_revoke_supplier.
 *  Blocks underlying access (portal, RFQ views, preview assets, production
 *  releases, downloads) because every authorize RPC re-checks the grants
 *  this RPC kills. The denial is visible in the audit trail (ds_access_events). */
export async function revokeSupplier(vendorId: string, reason: string | null): Promise<Result<void>> {
  const { supabase } = await requireStaff();
  const { error } = await dsRevokeSupplier(supabase, { p_vendor: vendorId, p_reason: reason });
  if (error) return pg(error);
  revalidatePath('/studio/supplier/releases');
  return ok(undefined);
}

// --- Release (T20) -----------------------------------------------------------

/** Release gate for an RFQ's lines — the staff view of T20's precondition:
 *  a line is releasable only when its tech pack is APPROVED and has an
 *  attached production PDF (pdf_asset_id). No approved pack + PDF, no release. */
export async function getReleaseStatus(rfqId: string): Promise<Result<ReleaseStatus>> {
  const { supabase, tenantId } = await requireStaff();
  const db = asAny(supabase);
  const { data: lines, error: linesErr } = await db
    .from('rfq_lines')
    .select('id,line_no,tech_pack_id')
    .eq('rfq_id', rfqId)
    .eq('tenant_id', tenantId)
    .order('line_no', { ascending: true })
    .limit(200);
  if (linesErr || !lines) return pg(linesErr);
  const tpIds = lines.map((l) => String(l.tech_pack_id));
  const { data: packs } = tpIds.length
    ? await db.from('tech_packs').select('id,title,style_number,revision,status,pdf_asset_id').in('id', tpIds).limit(200)
    : { data: [] as Row[] };
  const { data: grants } = await db
    .from('asset_release_grants')
    .select('tech_pack_id,vendor_id,level,revoked_at')
    .eq('rfq_id', rfqId)
    .eq('tenant_id', tenantId)
    .eq('level', 'production')
    .limit(200);
  const packById = new Map((packs ?? []).map((p) => [String(p.id), p]));
  const grantByTp = new Map(
    (grants ?? []).filter((g) => g.revoked_at == null).map((g) => [String(g.tech_pack_id), g]),
  );
  const out: ReleaseLineStatus[] = lines.map((l) => {
    const p = packById.get(String(l.tech_pack_id));
    const g = grantByTp.get(String(l.tech_pack_id));
    const releasable = isReleasable(typeof p?.status === 'string' ? p.status : undefined, (p?.pdf_asset_id as string | null) ?? null);
    return {
      rfq_line_id: String(l.id),
      line_no: Number(l.line_no),
      tech_pack_id: String(l.tech_pack_id),
      tech_pack_title: String(p?.title ?? '—'),
      style_number: (p?.style_number as string | null) ?? null,
      revision: Number(p?.revision ?? 1),
      status: String(p?.status ?? 'unknown'),
      pdf_asset_id: (p?.pdf_asset_id as string | null) ?? null,
      releasable,
      production_granted: g != null,
      production_granted_vendor_id: g ? String(g.vendor_id) : null,
    };
  });
  return ok({ lines: out, canRelease: out.some((l) => l.releasable) });
}

/** Submit a release: approve-gate first, then the S600 lifecycle RPC.
 *  Requires the pack to be APPROVED with an attached PDF
 *  (pdf_asset_id); anything else fails with invalid_state and nothing is
 *  written. The production grant itself is created by ds_award_rfq at
 *  award time — this action releases the pack; it does not invent grants. */
export async function submitRelease(techPackId: string): Promise<Result<{ tech_pack_id: string; status: string }>> {
  const { supabase } = await requireStaff();
  const db = asAny(supabase);
  const { data: pack, error: packErr } = await db
    .from('tech_packs')
    .select('id,status,pdf_asset_id')
    .eq('id', techPackId)
    .single();
  if (packErr || !pack) return fail('not_found', 'Tech pack not found.');
  if (pack.status !== 'approved') {
    return fail('invalid_state', `Release requires an APPROVED tech pack (this one is ${String(pack.status)}).`);
  }
  if (pack.pdf_asset_id == null) {
    return fail('invalid_state', 'Release requires an APPROVED tech pack with an attached production PDF.');
  }
  const { data, error } = await dsTransitionTechPack(supabase, { p_tp: techPackId, p_to: 'released' });
  if (error) return pg(error);
  const row = data as unknown as { id: string; status: string } | null;
  revalidatePath(`/studio/techpacks/${techPackId}`);
  return ok({ tech_pack_id: row?.id ?? techPackId, status: row?.status ?? 'released' });
}

// --- Audit (T20) ---------------------------------------------------------------

export interface AuditFilters {
  vendorId?: string;
  rfqId?: string;
  event?: string;
  /** Wall-clock day, YYYY-MM-DD. */
  date?: string;
}

/** Staff audit read: ds_access_events for this tenant, newest first.
 *  Filters are applied server-side; the caller never sees other tenants'
 *  rows (RLS) and can never write to this table (append-only trigger). */
export async function listAccessEvents(filters: AuditFilters = {}): Promise<
  Result<{
    events: AccessEventRow[];
    vendors: Array<{ id: string; name: string }>;
    rfqs: Array<{ id: string; number: string }>;
  }>
> {
  const { supabase, tenantId } = await requireStaff();
  const db = asAny(supabase);
  let q = db.from('ds_access_events').select('*').eq('tenant_id', tenantId);
  if (filters.vendorId) q = q.eq('actor_vendor_id', filters.vendorId);
  if (filters.rfqId) q = q.eq('rfq_id', filters.rfqId);
  if (filters.event) q = q.eq('event', filters.event);
  if (filters.date) {
    q = q.gte('occurred_at', `${filters.date}T00:00:00Z`);
  }
  const { data, error } = await q.order('occurred_at', { ascending: false }).limit(500);
  if (error || !data) return pg(error);
  let rows = data as unknown as AccessEventRow[];
  if (filters.date) rows = rows.filter((r) => (r.occurred_at ?? '').slice(0, 10) === filters.date);
  const { data: vendors } = await db.from('acct_vendors').select('id,display_name,company_name,legal_name').eq('tenant_id', tenantId).limit(500);
  const { data: rfqs } = await db.from('rfqs').select('id,rfq_number').eq('tenant_id', tenantId).limit(500);
  return ok({
    events: rows,
    vendors: (vendors ?? []).map((v) => ({
      id: String(v.id),
      name: String(v.display_name ?? v.company_name ?? v.legal_name ?? v.id),
    })),
    rfqs: (rfqs ?? []).map((r) => ({ id: String(r.id), number: String(r.rfq_number) })),
  });
}
