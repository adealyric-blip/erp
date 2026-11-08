import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, DEFAULT_TENANT_ID } from '@/lib/supabaseAdmin';

/**
 * GET /api/parties/[id]?source=crm_customers|acct_vendors|suppliers|crm_leads
 * Returns the full source-table row + related notes/tasks/activity (for
 * customers) in ONE unified shape. This is the single read behind the
 * PartyProfile page — every party type opens the same profile.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(_req.url);
  const source = searchParams.get('source');

  const base = {
    id, source: source || '', name: '', email: null as string | null, phone: null as string | null,
    company: null as string | null, roles: [] as string[],
    first_name: null as string | null, last_name: null as string | null,
    balance: 0, lifetimeValue: 0, lifecycleStage: null as string | null,
    address_line1: null as string | null, address_line2: null as string | null,
    city: null as string | null,
    state: null as string | null, postal_code: null as string | null,
    country: null as string | null,
    preferred_name: null as string | null, mobile_phone: null as string | null,
    marketing_email_opt_in: null as boolean | null, marketing_sms_opt_in: null as boolean | null,
    customer_type: null as string | null, lifecycle_status: null as string | null,
    total_visits: null as number | null, total_spend_30d: null as number | null,
    last_activity_at: null as string | null, outstanding_balance: null as number | null,
    payment_terms_days: null as number | null, is_1099_vendor: null as boolean | null,
    w9_received_at: null as string | null, vendor_number: null as string | null,
    tax_number: null as string | null, currency: null as string | null,
    ap_account_id: null as string | null, tax_form_type: null as string | null,
    kind: null as string | null, ordering_status: null as string | null,
    api_base_url: null as string | null, catalog_source: null as string | null,
    lead_source: null as string | null, lead_type: null as string | null,
    status: null as string | null, first_contact_at: null as string | null,
    next_follow_up_at: null as string | null, lead_notes: null as string | null,
    notes: [] as any[], tasks: [] as any[], activity: [] as any[],
    created_at: '', updated_at: '',
  };

  if (source === 'crm_customers') {
    const { data: c, error } = await supabaseAdmin()
      .from('crm_customers').select('*')
      .eq('id', id).eq('tenant_id', DEFAULT_TENANT_ID).single();
    if (error) return NextResponse.json({ error: { code: 'NOT_FOUND', message: error.message } }, { status: 404 });
    const [notesRes, tasksRes, activityRes] = await Promise.all([
      supabaseAdmin().from('crm_notes').select('*').eq('customer_id', id).order('created_at', { ascending: false }).limit(20),
      supabaseAdmin().from('crm_tasks').select('*').eq('customer_id', id).order('due_at', { ascending: true }).limit(20),
      supabaseAdmin().from('crm_activity').select('*').eq('customer_id', id).order('created_at', { ascending: false }).limit(20),
    ]);
    return NextResponse.json({ data: {
      ...base,
      source: 'crm_customers', roles: ['customer'],
      name: [c.first_name, c.last_name].filter(Boolean).join(' ') || c.company_name || c.email || 'Unnamed',
      first_name: c.first_name, last_name: c.last_name,
      email: c.email, phone: c.phone, company: c.company_name,
      balance: Number(c.outstanding_balance) || 0, lifetimeValue: Number(c.lifetime_value) || 0,
      lifecycleStage: c.lifecycle_stage,
      address_line1: c.address_line1, address_line2: c.address_line2, city: c.city, state: c.state, postal_code: c.postal_code, country: c.country,
      preferred_name: c.preferred_name, mobile_phone: c.mobile_phone,
      marketing_email_opt_in: c.marketing_email_opt_in, marketing_sms_opt_in: c.marketing_sms_opt_in,
      customer_type: c.customer_type, lifecycle_status: c.lifecycle_status,
      total_visits: c.total_visits, total_spend_30d: c.total_spend_30d,
      last_activity_at: c.last_activity_at, outstanding_balance: c.outstanding_balance,
      notes: notesRes.data || [], tasks: tasksRes.data || [], activity: activityRes.data || [],
      created_at: c.created_at, updated_at: c.updated_at,
    } });
  }

  if (source === 'acct_vendors') {
    const { data: v, error } = await supabaseAdmin()
      .from('acct_vendors').select('*')
      .eq('id', id).eq('tenant_id', DEFAULT_TENANT_ID).single();
    if (error) return NextResponse.json({ error: { code: 'NOT_FOUND', message: error.message } }, { status: 404 });
    return NextResponse.json({ data: {
      ...base,
      source: 'acct_vendors', roles: ['vendor'],
      name: v.legal_name || 'Unnamed vendor', email: v.email, phone: v.phone, company: v.legal_name,
      payment_terms_days: v.payment_terms_days, is_1099_vendor: v.is_1099_vendor,
      w9_received_at: v.w9_received_at, vendor_number: v.vendor_number,
      tax_number: v.tax_number, currency: v.currency,
      ap_account_id: v.ap_account_id, tax_form_type: v.tax_form_type,
      lifecycle_status: v.is_active ? 'active' : 'inactive',
      created_at: v.created_at, updated_at: v.updated_at,
    } });
  }

  if (source === 'suppliers') {
    const { data: s, error } = await supabaseAdmin()
      .from('suppliers').select('*').eq('id', id).single();
    if (error) return NextResponse.json({ error: { code: 'NOT_FOUND', message: error.message } }, { status: 404 });
    return NextResponse.json({ data: {
      ...base,
      source: 'suppliers', roles: ['supplier'],
      name: s.name, company: s.name, kind: s.kind, ordering_status: s.ordering_status,
      api_base_url: s.api_base_url, catalog_source: s.catalog_source,
      lifecycle_status: s.ordering_status,
      created_at: s.created_at, updated_at: s.created_at,
    } });
  }

  if (source === 'crm_leads') {
    const { data: l, error } = await supabaseAdmin()
      .from('crm_leads').select('*')
      .eq('id', id).eq('tenant_id', DEFAULT_TENANT_ID).single();
    if (error) return NextResponse.json({ error: { code: 'NOT_FOUND', message: error.message } }, { status: 404 });
    return NextResponse.json({ data: {
      ...base,
      source: 'crm_leads', roles: ['lead'],
      name: l.contact_name || l.email || 'Unnamed lead', email: l.email, phone: l.phone,
      lead_source: l.lead_source, lead_type: l.lead_type, status: l.status,
      first_contact_at: l.first_contact_at, next_follow_up_at: l.next_follow_up_at,
      lead_notes: l.notes,
      lifecycleStage: l.status,
      created_at: l.created_at, updated_at: l.updated_at,
    } });
  }

  return NextResponse.json({ error: { code: 'VALIDATION', message: 'Unknown source table' } }, { status: 400 });
}

/**
 * PATCH /api/parties/[id]?source=crm_customers — update a party in its
 * source table. `source` routes the update (from the unified list).
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const source = searchParams.get('source');
  const body = await req.json();

  if (source === 'crm_customers') {
    const { data, error } = await supabaseAdmin()
      .from('crm_customers')
      .update({
        first_name: body.first_name ?? undefined,
        last_name: body.last_name ?? undefined,
        company_name: body.company_name ?? undefined,
        preferred_name: body.preferred_name ?? (body.display !== undefined ? body.display : undefined),
        email: body.email ?? undefined,
        phone: body.phone ?? undefined,
        mobile_phone: body.mobile_phone ?? undefined,
        address_line1: body.address ?? undefined,
        address_line2: body.address2 ?? (body.street2 !== undefined ? body.street2 : undefined),
        city: body.city ?? undefined,
        state: body.state ?? undefined,
        postal_code: body.zip ?? undefined,
        country: body.country ?? undefined,
        customer_type: body.customer_type ?? undefined,
        marketing_email_opt_in: body.marketing_email_opt_in ?? undefined,
        marketing_sms_opt_in: body.marketing_sms_opt_in ?? undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', DEFAULT_TENANT_ID)
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: { code: 'VALIDATION', message: error.message } }, { status: 400 });
    return NextResponse.json({ data });
  }

  if (source === 'acct_vendors') {
    const { data, error } = await supabaseAdmin()
      .from('acct_vendors')
      .update({
        legal_name: body.name ?? undefined,
        email: body.email ?? undefined,
        phone: body.phone ?? undefined,
        payment_terms_days: body.terms ?? undefined,
        is_1099_vendor: body.is1099 ?? undefined,
        tax_number: body.tax_number ?? undefined,
        tax_form_type: body.tax_form_type ?? undefined,
        w9_received_at: body.w9_received !== undefined
          ? (body.w9_received ? new Date().toISOString() : null)
          : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', DEFAULT_TENANT_ID)
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: { code: 'VALIDATION', message: error.message } }, { status: 400 });
    return NextResponse.json({ data });
  }

  if (source === 'suppliers') {
    const { data, error } = await supabaseAdmin()
      .from('suppliers')
      .update({
        name: body.name ?? undefined,
        kind: body.kind ?? undefined,
        api_base_url: body.api_base_url ?? (body.api_url !== undefined ? body.api_url : undefined),
      })
      .eq('id', id)
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: { code: 'VALIDATION', message: error.message } }, { status: 400 });
    return NextResponse.json({ data });
  }

  if (source === 'crm_leads') {
    const { data, error } = await supabaseAdmin()
      .from('crm_leads')
      .update({
        contact_name: body.name ?? undefined,
        email: body.email ?? undefined,
        phone: body.phone ?? undefined,
        lead_source: body.lead_source ?? undefined,
        lead_type: body.lead_type ?? undefined,
        status: body.status ?? undefined,
        next_follow_up_at: body.next_follow_up_at ?? undefined,
        notes: body.notes ?? undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', DEFAULT_TENANT_ID)
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: { code: 'VALIDATION', message: error.message } }, { status: 400 });
    return NextResponse.json({ data });
  }

  return NextResponse.json({ error: { code: 'VALIDATION', message: 'Unknown source table' } }, { status: 400 });
}

/** DELETE /api/parties/[id]?source=… — archive or delete by source table. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const source = searchParams.get('source');

  if (source === 'crm_customers') {
    const { error } = await supabaseAdmin()
      .from('crm_customers')
      .update({ archived_at: new Date().toISOString(), is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', DEFAULT_TENANT_ID);
    if (error) return NextResponse.json({ error: { code: 'INTERNAL', message: error.message } }, { status: 500 });
    return NextResponse.json({ data: { id, archived: true } });
  }

  if (source === 'acct_vendors') {
    const { error } = await supabaseAdmin()
      .from('acct_vendors')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', DEFAULT_TENANT_ID);
    if (error) return NextResponse.json({ error: { code: 'INTERNAL', message: error.message } }, { status: 500 });
    return NextResponse.json({ data: { id, archived: true } });
  }

  if (source === 'suppliers') {
    const { error } = await supabaseAdmin().from('suppliers').delete().eq('id', id);
    if (error) return NextResponse.json({ error: { code: 'INTERNAL', message: error.message } }, { status: 500 });
    return NextResponse.json({ data: { id, deleted: true } });
  }

  if (source === 'crm_leads') {
    const { error } = await supabaseAdmin()
      .from('crm_leads')
      .delete()
      .eq('id', id)
      .eq('tenant_id', DEFAULT_TENANT_ID);
    if (error) return NextResponse.json({ error: { code: 'INTERNAL', message: error.message } }, { status: 500 });
    return NextResponse.json({ data: { id, deleted: true } });
  }

  return NextResponse.json({ error: { code: 'VALIDATION', message: 'Unknown source table' } }, { status: 400 });
}
