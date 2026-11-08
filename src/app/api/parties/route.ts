import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, DEFAULT_TENANT_ID } from '@/lib/supabaseAdmin';

/**
 * GET /api/parties — the unified party list (§1.1: one person/company record).
 * Merges crm_customers (customers), acct_vendors (vendors), suppliers
 * (fulfillment suppliers), and crm_leads (leads) into one shape.
 * Query: ?role=customer|vendor|supplier|lead & ?q=search
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const role = searchParams.get('role');
  const q = searchParams.get('q')?.trim().toLowerCase();

  const needCustomers = !role || role === 'customer' || role === 'all';
  const needVendors = !role || role === 'vendor' || role === 'all';
  const needSuppliers = !role || role === 'supplier' || role === 'all';
  const needLeads = !role || role === 'lead' || role === 'all';

  const [custRes, vendRes, supRes, leadRes] = await Promise.all([
    needCustomers
      ? supabaseAdmin().from('crm_customers')
          .select('id, first_name, last_name, company_name, email, phone, city, state, outstanding_balance, lifetime_value, lifecycle_stage, lifecycle_status, created_at, updated_at, last_activity_at, archived_at')
          .eq('tenant_id', DEFAULT_TENANT_ID)
          .is('archived_at', null)
          .order('updated_at', { ascending: false })
          .limit(500)
      : Promise.resolve({ data: [] as never[], error: null }),
    needVendors
      ? supabaseAdmin().from('acct_vendors')
          .select('id, vendor_number, legal_name, email, phone, payment_terms_days, is_1099_vendor, is_active, w9_received_at, created_at, updated_at')
          .eq('tenant_id', DEFAULT_TENANT_ID)
          .eq('is_active', true)
          .order('updated_at', { ascending: false })
          .limit(500)
      : Promise.resolve({ data: [] as never[], error: null }),
    needSuppliers
      ? supabaseAdmin().from('suppliers')
          .select('id, name, slug, kind, ordering_status, created_at')
          .order('created_at', { ascending: false })
          .limit(500)
      : Promise.resolve({ data: [] as never[], error: null }),
    needLeads
      ? supabaseAdmin().from('crm_leads')
          .select('id, contact_name, email, phone, status, lead_source, created_at, updated_at')
          .eq('tenant_id', DEFAULT_TENANT_ID)
          .order('updated_at', { ascending: false })
          .limit(500)
      : Promise.resolve({ data: [] as never[], error: null }),
  ]);

  if (custRes.error || vendRes.error || supRes.error || leadRes.error) {
    const err = custRes.error || vendRes.error || supRes.error || leadRes.error;
    return NextResponse.json({ error: { code: 'INTERNAL', message: err!.message } }, { status: 500 });
  }

  type Party = {
    id: string;
    source: string;
    name: string;
    email: string | null;
    phone: string | null;
    roles: string[];
    company: string | null;
    city: string | null;
    state: string | null;
    balance: number;
    lifetimeValue: number;
    lifecycleStage: string | null;
    terms: number | null;
    is1099: boolean;
    w9Received: boolean;
    isActive: boolean;
    orderingStatus: string | null;
    addedAt: string;
    lastActivity: string | null;
  };

  const parties: Party[] = [];

  for (const c of custRes.data || []) {
    parties.push({
      id: c.id,
      source: 'crm_customers',
      name: [c.first_name, c.last_name].filter(Boolean).join(' ') || c.company_name || c.email || 'Unnamed',
      email: c.email,
      phone: c.phone,
      roles: ['customer'],
      company: c.company_name,
      city: c.city,
      state: c.state,
      balance: Number(c.outstanding_balance) || 0,
      lifetimeValue: Number(c.lifetime_value) || 0,
      lifecycleStage: c.lifecycle_stage,
      terms: null,
      is1099: false,
      w9Received: false,
      isActive: !c.archived_at && c.lifecycle_status !== 'inactive',
      orderingStatus: null,
      addedAt: c.created_at,
      lastActivity: c.last_activity_at || c.updated_at,
    });
  }

  for (const v of vendRes.data || []) {
    parties.push({
      id: v.id,
      source: 'acct_vendors',
      name: v.legal_name || 'Unnamed vendor',
      email: v.email,
      phone: v.phone,
      roles: ['vendor'],
      company: v.legal_name,
      city: null,
      state: null,
      balance: 0,
      lifetimeValue: 0,
      lifecycleStage: null,
      terms: v.payment_terms_days,
      is1099: v.is_1099_vendor ?? false,
      w9Received: !!v.w9_received_at,
      isActive: v.is_active ?? true,
      orderingStatus: null,
      addedAt: v.created_at,
      lastActivity: v.updated_at,
    });
  }

  for (const s of supRes.data || []) {
    parties.push({
      id: s.id,
      source: 'suppliers',
      name: s.name,
      email: null,
      phone: null,
      roles: ['supplier'],
      company: s.name,
      city: null,
      state: null,
      balance: 0,
      lifetimeValue: 0,
      lifecycleStage: null,
      terms: null,
      is1099: false,
      w9Received: false,
      isActive: true,
      orderingStatus: s.ordering_status,
      addedAt: s.created_at,
      lastActivity: s.created_at,
    });
  }

  for (const l of leadRes.data || []) {
    parties.push({
      id: l.id,
      source: 'crm_leads',
      name: l.contact_name || l.email || 'Unnamed lead',
      email: l.email,
      phone: l.phone,
      roles: ['lead'],
      company: null,
      city: null,
      state: null,
      balance: 0,
      lifetimeValue: 0,
      lifecycleStage: l.status,
      terms: null,
      is1099: false,
      w9Received: false,
      isActive: !['lost', 'converted'].includes(l.status),
      orderingStatus: null,
      addedAt: l.created_at,
      lastActivity: l.updated_at,
    });
  }

  const filtered = q
    ? parties.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.email || '').toLowerCase().includes(q) ||
        (p.company || '').toLowerCase().includes(q) ||
        (p.phone || '').includes(q))
    : parties;

  const counts = {
    all: parties.length,
    customer: parties.filter(p => p.roles.includes('customer')).length,
    vendor: parties.filter(p => p.roles.includes('vendor')).length,
    supplier: parties.filter(p => p.roles.includes('supplier')).length,
    lead: parties.filter(p => p.roles.includes('lead')).length,
  };

  return NextResponse.json({ data: filtered, meta: { total: filtered.length, counts } });
}

/**
 * POST /api/parties — create a party. `role` routes the insert to the
 * correct Supabase table: customer → crm_customers, vendor → acct_vendors,
 * supplier → suppliers, lead → crm_leads.
 *
 * Field contract: EVERY field the PartyFormDrawer collects is written to a
 * real column here. Columns that are REQUIRED in the schema but have no
 * form input (acct_vendors.vendor_number / ap_account_id / currency,
 * suppliers.slug / catalog_source) are auto-resolved server-side so a
 * create never 400s on a column the user was never shown.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const role = body.role || 'customer';

  if (role === 'customer') {
    const { data, error } = await supabaseAdmin()
      .from('crm_customers')
      .insert({
        tenant_id: DEFAULT_TENANT_ID,
        first_name: body.first_name || null,
        last_name: body.last_name || null,
        // Display name → preferred_name (real column), never stuffed into company.
        preferred_name: body.preferred_name || body.display || null,
        company_name: body.company_name || null,
        email: body.email || null,
        phone: body.phone || null,
        mobile_phone: body.mobile_phone || null,
        address_line1: body.address || null,
        address_line2: body.address2 || body.street2 || null,
        city: body.city || null,
        state: body.state || null,
        postal_code: body.zip || null,
        country: body.country || 'US',
        // Real form select — falls back to the old company-derived default.
        customer_type: body.customer_type || (body.company_name ? 'Wholesale' : 'Retail'),
        marketing_email_opt_in: !!body.marketing_email_opt_in,
        marketing_sms_opt_in: !!body.marketing_sms_opt_in,
        lifecycle_stage: 'new_customer',
        lifecycle_status: 'active',
        lead_status: 'converted',
        first_contact_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
        is_active: true,
      })
      .select('id, first_name, last_name, company_name, email, phone, city, state, outstanding_balance, lifetime_value, lifecycle_stage, created_at')
      .single();
    if (error) return NextResponse.json({ error: { code: 'VALIDATION', message: error.message } }, { status: 400 });
    // The create-form notes box lands in crm_notes — same store the Notes
    // tab reads, so it round-trips into the profile immediately.
    if (body.notes && String(body.notes).trim()) {
      await supabaseAdmin().from('crm_notes').insert({
        tenant_id: DEFAULT_TENANT_ID,
        customer_id: data.id,
        note_type: 'general',
        body: String(body.notes).trim(),
      });
    }
    return NextResponse.json({ data: { ...data, source: 'crm_customers', roles: ['customer'] } }, { status: 201 });
  }

  if (role === 'vendor') {
    // Auto-resolve the REQUIRED bookkeeping columns the form doesn't show:
    // vendor_number continues the tenant's VND-#### sequence, ap_account_id
    // points at the tenant's Accounts Payable (subtype accounts_payable).
    const [numRes, apRes] = await Promise.all([
      supabaseAdmin()
        .from('acct_vendors')
        .select('vendor_number')
        .eq('tenant_id', DEFAULT_TENANT_ID)
        .like('vendor_number', 'VND-%'),
      supabaseAdmin()
        .from('acct_chart_of_accounts')
        .select('id')
        .eq('tenant_id', DEFAULT_TENANT_ID)
        .eq('is_active', true)
        .eq('subtype', 'accounts_payable')
        .limit(1),
    ]);
    let nextNum = 1;
    for (const row of numRes.data || []) {
      const m = /^VND-(\d+)$/.exec(row.vendor_number || '');
      if (m) nextNum = Math.max(nextNum, parseInt(m[1], 10) + 1);
    }
    const vendorNumber = `VND-${String(nextNum).padStart(4, '0')}`;
    const apAccountId = apRes.data?.[0]?.id;
    if (!apAccountId) {
      return NextResponse.json({ error: { code: 'CONFIG', message: 'No Accounts Payable account found in acct_chart_of_accounts — cannot create vendor' } }, { status: 500 });
    }

    const is1099 = !!body.is1099;
    const { data, error } = await supabaseAdmin()
      .from('acct_vendors')
      .insert({
        tenant_id: DEFAULT_TENANT_ID,
        vendor_number: vendorNumber,
        legal_name: body.name || body.company_name,
        email: body.email || null,
        phone: body.phone || null,
        currency: 'USD',
        ap_account_id: apAccountId,
        payment_terms_days: body.terms ?? 30,
        is_1099_vendor: is1099,
        tax_number: body.tax_number || null,
        tax_form_type: is1099 ? (body.tax_form_type || 'W-9') : null,
        w9_received_at: body.w9_received ? new Date().toISOString() : null,
        is_active: true,
        metadata: {},
      })
      .select('id, legal_name, email, phone, payment_terms_days, is_1099_vendor, is_active, created_at')
      .single();
    if (error) return NextResponse.json({ error: { code: 'VALIDATION', message: error.message } }, { status: 400 });
    return NextResponse.json({ data: { ...data, source: 'acct_vendors', roles: ['vendor'] } }, { status: 201 });
  }

  if (role === 'supplier') {
    const baseName = body.name || body.company_name || 'Supplier';
    const baseSlug = baseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'supplier';
    // Slug is REQUIRED + unique — dedupe against existing rows.
    const { data: existing } = await supabaseAdmin()
      .from('suppliers')
      .select('slug')
      .like('slug', `${baseSlug}%`);
    const taken = new Set((existing || []).map((r: { slug: string }) => r.slug));
    let slug = baseSlug;
    for (let i = 2; taken.has(slug); i++) slug = `${baseSlug}-${i}`;

    const apiBaseUrl = body.api_base_url || body.api_url || null;
    const { data, error } = await supabaseAdmin()
      .from('suppliers')
      .insert({
        name: baseName,
        slug,
        kind: body.kind || 'pod',
        // Manual form entries are 'manual'; an API URL implies 'api'.
        catalog_source: apiBaseUrl ? 'api' : 'manual',
        api_base_url: apiBaseUrl,
        ordering_status: body.ordering_status || 'catalog_only',
      })
      .select('id, name, kind, ordering_status, created_at')
      .single();
    if (error) return NextResponse.json({ error: { code: 'VALIDATION', message: error.message } }, { status: 400 });
    return NextResponse.json({ data: { ...data, source: 'suppliers', roles: ['supplier'] } }, { status: 201 });
  }

  if (role === 'lead') {
    const statusVocab = ['new', 'contacted', 'qualified', 'pending', 'working', 'converted', 'lost'];
    const rawStatus = String(body.status || 'new').toLowerCase().replace(/\s+/g, '_');
    const { data, error } = await supabaseAdmin()
      .from('crm_leads')
      .insert({
        tenant_id: DEFAULT_TENANT_ID,
        contact_name: body.name || [body.first_name, body.last_name].filter(Boolean).join(' ') || null,
        email: body.email || null,
        phone: body.phone || null,
        lead_source: body.lead_source || 'manual',
        lead_type: body.lead_type || 'general',
        status: statusVocab.includes(rawStatus) ? rawStatus : 'new',
        first_contact_at: new Date().toISOString(),
        next_follow_up_at: body.next_follow_up_at || null,
        notes: body.notes || null,
      })
      .select('id, contact_name, email, phone, status, created_at')
      .single();
    if (error) return NextResponse.json({ error: { code: 'VALIDATION', message: error.message } }, { status: 400 });
    return NextResponse.json({ data: { ...data, source: 'crm_leads', roles: ['lead'] } }, { status: 201 });
  }

  return NextResponse.json({ error: { code: 'VALIDATION', message: `Unknown role: ${role}` } }, { status: 400 });
}
