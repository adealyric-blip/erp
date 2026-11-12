// Supplier directory server actions — T16.
// Reads go through the staff user's own client (RLS applies); writes go
// through direct `acct_vendors` / `supplier_capabilities` upserts (the
// S600 tenant triggers are the enforcement) and through
// `ds_invite_supplier_user` / `ds_revoke_supplier` for lifecycle.
//
// NO finance ledger work here (paused): no posting, no new finance
// tables. The AP control account is picked/created in the existing
// Finance UI — `createSupplier` only consumes an `ap_account_id` the
// operator supplies, and returns guided help (not a failure) when no
// vendor row exists yet and none was supplied.
//
// Zones: there is no `suppliers.zones` column and no `ds_supplier_zones`
// RPC in S600. Zones live in `acct_vendors.metadata.zones` (ISO-3166
// codes) and are read back with `zonesFromMetadata`. No ad-hoc grants
// table is created anywhere.
'use server';

import { createHash, randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/db';
import { dsInviteSupplierUser, dsRevokeSupplier } from '@/lib/db/rpc';
import { requireStaff } from '@/server/auth/requireStaff';
import { fail, ok, type Result } from '@/server/result';
import { mapPgError } from '@/server/errors';
import { sendSupplierInviteEmail } from '@/server/email/invite';
import {
  canUnbanSupplier,
  findDuplicateWarnings,
  isApprovedSupplier,
  metadataWithZones,
  validateSupplierForm,
  whatsappFromMetadata,
  zonesFromMetadata,
  type ExistingVendorRef,
  type SupplierFormInput,
  type SupplierListRow,
} from '@/features/suppliers/lib/validation';

type Row = Record<string, unknown>;
type RowResult = { data: Row | null; error: { message?: string; code?: string } | null };
type RowsResult = { data: Row[] | null; error: { message?: string; code?: string } | null };
type RpcResult = { data: unknown; error: { message?: string; code?: string } | null };

interface DbQuery {
  select: (cols: string) => DbQuery;
  eq: (col: string, v: unknown) => DbQuery;
  ilike: (col: string, v: string) => DbQuery;
  is: (col: string, v: null) => DbQuery;
  order: (col: string, opts?: { ascending?: boolean }) => DbQuery;
  limit: (n: number) => Promise<RowsResult>;
  single: () => Promise<RowResult>;
  insert: (rows: Row | Row[]) => DbQuery;
  update: (patch: Row) => DbQuery;
  upsert: (rows: Row | Row[], opts?: { onConflict?: string }) => DbQuery;
  match: (obj: Record<string, unknown>) => DbQuery;
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

function revalidate() {
  revalidatePath('/studio/suppliers');
}

// --- Reads -----------------------------------------------------------------

export async function listSuppliers(): Promise<Result<SupplierListRow[]>> {
  const { supabase, tenantId } = await requireStaff();
  const client = asAny(supabase);
  const vendors = await client
    .from('acct_vendors')
    .select('id, legal_name, display_name, email, phone, website, is_active, metadata')
    .eq('tenant_id', tenantId)
    .order('legal_name')
    .limit(200);
  if (vendors.error || !vendors.data) return err(vendors.error);
  const [caps, members] = await Promise.all([
    client.from('supplier_capabilities').select('vendor_id, category, techniques, country_code').eq('tenant_id', tenantId).limit(500),
    client.from('supplier_portal_members').select('vendor_id, status').eq('tenant_id', tenantId).limit(500),
  ]);
  const capByVendor = new Map<string, Row[]>();
  for (const c of caps.data ?? []) {
    const list = capByVendor.get(String(c.vendor_id)) ?? [];
    list.push(c);
    capByVendor.set(String(c.vendor_id), list);
  }
  const statusByVendor = new Map<string, string>();
  for (const m of members.data ?? []) statusByVendor.set(String(m.vendor_id), String(m.status));
  const rows: SupplierListRow[] = vendors.data.map((v) => ({
    id: String(v.id),
    legalName: String(v.legal_name ?? v.display_name ?? ''),
    email: (v.email as string | null) ?? null,
    website: (v.website as string | null) ?? null,
    isActive: Boolean(v.is_active),
    zones: zonesFromMetadata(v.metadata),
    capabilities: (capByVendor.get(String(v.id)) ?? []).map((c) => ({
      category: String(c.category),
      techniques: Array.isArray(c.techniques) ? (c.techniques as string[]) : [],
      countryCode: (c.country_code as string | null) ?? null,
    })),
    memberStatus: statusByVendor.get(String(v.id)) ?? null,
  }));
  return ok(rows);
}

export async function listExistingVendorRefs(): Promise<Result<ExistingVendorRef[]>> {
  const { supabase, tenantId } = await requireStaff();
  const { data, error } = await asAny(supabase)
    .from('acct_vendors')
    .select('id, legal_name, email, website')
    .eq('tenant_id', tenantId)
    .limit(500);
  if (error || !data) return err(error);
  return ok(
    data.map((v) => ({
      id: String(v.id),
      legalName: String(v.legal_name ?? ''),
      email: (v.email as string | null) ?? null,
      website: (v.website as string | null) ?? null,
    })),
  );
}

export async function getSupplier(vendorId: string): Promise<Result<{ vendor: Row; members: Row[]; capabilities: Row[] }>> {
  const { supabase, tenantId } = await requireStaff();
  const client = asAny(supabase);
  const [vendor, members, caps] = await Promise.all([
    client.from('acct_vendors').select('*').eq('tenant_id', tenantId).eq('id', vendorId).single(),
    client.from('supplier_portal_members').select('*').eq('vendor_id', vendorId).order('created_at', { ascending: false }).limit(50),
    client.from('supplier_capabilities').select('*').eq('vendor_id', vendorId).order('category').limit(100),
  ]);
  if (vendor.error || !vendor.data) return err(vendor.error ?? { message: 'Supplier not found' });
  return ok({ vendor: vendor.data, members: members.data ?? [], capabilities: caps.data ?? [] });
}

// --- Create / update ---------------------------------------------------------

export interface CreateSupplierResult {
  vendorId: string;
  reusedExistingVendor: boolean;
  warnings: string[];
}

export async function createSupplier(input: SupplierFormInput): Promise<Result<CreateSupplierResult>> {
  const { supabase, tenantId } = await requireStaff();
  const errors = validateSupplierForm(input);
  if (Object.keys(errors).length > 0) {
    return fail('invalid_state', `Supplier form is invalid: ${Object.values(errors).join('; ')}`);
  }
  const client = asAny(supabase);
  const refs = await listExistingVendorRefs();
  const warnings = refs.ok ? findDuplicateWarnings(refs.data, input) : [];

  // Reuse an existing vendor row when one matches on email or website —
  // create must NOT fail (and must not duplicate) when acct_vendors
  // already holds this supplier.
  const email = (input.email ?? '').trim().toLowerCase();
  const website = (input.website ?? '').trim();
  let existingId: string | null = null;
  if (email) {
    const found = await client.from('acct_vendors').select('id').eq('tenant_id', tenantId).ilike('email', email).limit(1);
    if (found.data?.length) existingId = String(found.data[0].id);
  }
  if (!existingId && website) {
    const found = await client.from('acct_vendors').select('id').eq('tenant_id', tenantId).ilike('website', website).limit(1);
    if (found.data?.length) existingId = String(found.data[0].id);
  }

  if (!existingId && !input.apAccountId) {
    // Guided result, not a failure: the AP control account is created in
    // the existing Finance → Vendors UI (READ-ONLY use from here). The
    // operator creates it there, then re-saves with the account id — or
    // re-saves once the vendor row exists.
    return fail(
      'missing_data',
      'No vendor record exists yet and no AP control account was given.',
      'Create the vendor + its AP control account in the existing Finance → Vendors UI (GET /api/v1/finance/vendors lists vendors; the Parties drawer creates them), then save here with the AP account id — or save again once the vendor record exists.',
    );
  }

  const metadata = metadataWithZones(null, input.zones, input.whatsapp ?? null);
  let vendorId: string;
  if (existingId) {
    vendorId = existingId;
    const patch: Row = {
      legal_name: input.legalName.trim(),
      display_name: input.displayName?.trim() || null,
      email: email || null,
      phone: (input.phone ?? '').trim() || null,
      website: website || null,
      metadata,
      updated_at: new Date().toISOString(),
    };
    const updated = await client.from('acct_vendors').update(patch).eq('id', vendorId).eq('tenant_id', tenantId).select('id').single();
    if (updated.error) return err(updated.error);
  } else {
    vendorId = randomUUID();
    const vendorNumber = `SUP-${createHash('sha256').update(`${tenantId}:${input.legalName}:${Date.now()}`).digest('hex').slice(0, 6).toUpperCase()}`;
    const inserted = await client
      .from('acct_vendors')
      .insert({
        id: vendorId,
        tenant_id: tenantId,
        vendor_number: vendorNumber,
        legal_name: input.legalName.trim(),
        display_name: input.displayName?.trim() || null,
        email: email || null,
        phone: (input.phone ?? '').trim() || null,
        website: website || null,
        currency: 'USD',
        payment_terms_days: 30,
        ap_account_id: input.apAccountId,
        is_active: true,
        metadata,
      })
      .select('id')
      .single();
    if (inserted.error) return err(inserted.error);
  }

  // Capabilities replace the vendor's set (one row per category).
  if (input.capabilities.length > 0) {
    const rows = input.capabilities.map((c) => ({
      tenant_id: tenantId,
      vendor_id: vendorId,
      category: c.category.trim().toLowerCase(),
      techniques: c.techniques,
      moq: c.moq ?? null,
      lead_time_days: c.leadTimeDays ?? null,
      certifications: c.certifications,
      country_code: c.countryCode?.toUpperCase() ?? null,
    }));
    const caps = await client.from('supplier_capabilities').upsert(rows, { onConflict: 'vendor_id,category' }).select('id').limit(1);
    if (caps.error) return err(caps.error);
  }

  revalidate();
  return ok({ vendorId, reusedExistingVendor: !!existingId, warnings });
}

// --- Invite / revoke / unban --------------------------------------------------

export interface InviteSupplierResult {
  memberId: string;
  emailSent: boolean;
  emailStatus: string;
}

/**
 * Invite email is sent ONLY for an approved supplier (active vendor row,
 * portal member not revoked/suspended). The RPC returns the token once;
 * it is passed to the mailer in memory and never logged or stored.
 */
export async function inviteSupplier(
  vendorId: string,
  email: string,
  role: 'owner' | 'estimator' | 'viewer' = 'estimator',
  name?: string | null,
): Promise<Result<InviteSupplierResult>> {
  const ctx = await requireStaff();
  const { supabase, tenantId } = ctx;
  if (ctx.role !== 'admin' && ctx.role !== 'owner') {
    return fail('forbidden', 'Only a tenant admin or owner can invite a supplier user');
  }
  const detail = await getSupplier(vendorId);
  if (!detail.ok) return detail as unknown as Result<never>;
  const vendor = detail.data.vendor;
  const memberStatus = (detail.data.members[0]?.status as string | null) ?? null;
  if (!isApprovedSupplier({ isActive: Boolean(vendor.is_active), memberStatus })) {
    return fail(
      'invalid_state',
      'Supplier is not approved — invite email is only sent for an active, non-revoked supplier.',
      'Reactivate the vendor (or lift its suspension) before inviting.',
    );
  }
  const rpc = await dsInviteSupplierUser(supabase, {
    p_vendor: vendorId,
    p_email: email.trim().toLowerCase(),
    p_role: role,
    p_name: name?.trim() || null,
  });
  if (rpc.error || !rpc.data) return err(rpc.error);
  const { member_id, token } = rpc.data as { member_id: string; token: string };
  const mail = await sendSupplierInviteEmail({
    to: email.trim().toLowerCase(),
    vendorName: String(vendor.legal_name ?? vendor.display_name ?? 'Supplier'),
    inviterName: ctx.user.email ?? null,
    token,
  });
  revalidate();
  return ok({
    memberId: String(member_id),
    emailSent: mail.sent,
    emailStatus: mail.sent ? `sent via ${mail.provider}` : mail.message,
  });
}

/**
 * Revoke blocks the underlying access AND GCP / Calls / Assets / Download:
 * `ds_revoke_supplier` kills portal membership + invites (portal, GCP
 * Craft apps and Meet calls all gate on membership) and revokes every
 * asset release grant (preview + production assets and downloads gate
 * on live grants). The dialog on the detail page lists all four surfaces.
 */
export async function revokeSupplier(vendorId: string, reason?: string | null): Promise<Result<{ revoked: true }>> {
  const ctx = await requireStaff();
  if (ctx.role !== 'admin' && ctx.role !== 'owner') {
    return fail('forbidden', 'Only a tenant admin or owner can revoke a supplier');
  }
  const rpc = await dsRevokeSupplier(ctx.supabase, { p_vendor: vendorId, p_reason: reason?.trim() || null });
  if (rpc.error) return err(rpc.error);
  revalidate();
  return ok({ revoked: true });
}

/**
 * Unban (suspended → active) is owner-only. The RLS policy for staff
 * updates on `supplier_portal_members` is the live gate — verify against
 * the local stack (open item).
 */
export async function unbanSupplier(vendorId: string): Promise<Result<{ unbanned: true }>> {
  const ctx = await requireStaff();
  if (!canUnbanSupplier(ctx.role)) {
    return fail('forbidden', 'Only the tenant owner can unban a supplier');
  }
  const { error } = await (asAny(ctx.supabase)
    .from('supplier_portal_members')
    .update({ status: 'active' })
    .eq('vendor_id', vendorId)
    .eq('status', 'suspended') as unknown as Promise<RowsResult>);
  if (error) return err(error);
  revalidate();
  return ok({ unbanned: true });
}

// --- NDA versions --------------------------------------------------------------
// New version = new row; exactly one active. Text is immutable per
// S600 (ds__nda_immutable); deactivation is the only change to an old row.

export interface NdaRow {
  id: string;
  version: number;
  title: string;
  bodyMd: string;
  bodySha256: string;
  isActive: boolean;
  createdAt: string;
}

export async function listNdas(): Promise<Result<NdaRow[]>> {
  const { supabase, tenantId } = await requireStaff();
  const { data, error } = await asAny(supabase)
    .from('ds_ndas')
    .select('id, version, title, body_md, body_sha256, is_active, created_at')
    .eq('tenant_id', tenantId)
    .order('version', { ascending: false })
    .limit(50);
  if (error || !data) return err(error);
  return ok(
    data.map((r) => ({
      id: String(r.id),
      version: Number(r.version),
      title: String(r.title),
      bodyMd: String(r.body_md),
      bodySha256: String(r.body_sha256),
      isActive: Boolean(r.is_active),
      createdAt: String(r.created_at),
    })),
  );
}

export async function getActiveNda(): Promise<Result<NdaRow | null>> {
  const ndas = await listNdas();
  if (!ndas.ok) return ndas as unknown as Result<never>;
  return ok(ndas.data.find((n) => n.isActive) ?? null);
}

export async function createNdaVersion(title: string, bodyMd: string): Promise<Result<NdaRow>> {
  const { supabase, tenantId } = await requireStaff();
  if (!title.trim() || bodyMd.trim().length < 10) {
    return fail('invalid_state', 'NDA needs a title and body text (at least 10 characters)');
  }
  const existing = await listNdas();
  const nextVersion = (existing.ok ? Math.max(0, ...existing.data.map((n) => n.version)) : 0) + 1;
  const { data, error } = await asAny(supabase)
    .from('ds_ndas')
    .insert({ tenant_id: tenantId, version: nextVersion, title: title.trim(), body_md: bodyMd, is_active: false })
    .select('id, version, title, body_md, body_sha256, is_active, created_at')
    .single();
  if (error || !data) return err(error);
  revalidate();
  return ok({
    id: String(data.id),
    version: Number(data.version),
    title: String(data.title),
    bodyMd: String(data.body_md),
    bodySha256: String(data.body_sha256),
    isActive: Boolean(data.is_active),
    createdAt: String(data.created_at),
  });
}

export async function activateNda(ndaId: string): Promise<Result<{ activated: true }>> {
  const { supabase, tenantId } = await requireStaff();
  const client = asAny(supabase);
  const cleared = await (client.from('ds_ndas').update({ is_active: false }).eq('tenant_id', tenantId).eq('is_active', true) as unknown as Promise<RowsResult>);
  if (cleared.error) return err(cleared.error);
  const set = await (client.from('ds_ndas').update({ is_active: true }).eq('id', ndaId).eq('tenant_id', tenantId) as unknown as Promise<RowsResult>);
  if (set.error) return err(set.error);
  revalidate();
  return ok({ activated: true });
}

export { whatsappFromMetadata };
