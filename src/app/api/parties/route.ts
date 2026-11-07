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
      : Promise.resolve({ data: [] }),
    needVendors
      ? supabaseAdmin().from('acct_vendors')
          .select('id, vendor_number, legal_name, email, phone, payment_terms_days, is_1099_vendor, is_active, w9_received_at, created_at, updated_at')
          .eq('tenant_id', DEFAULT_TENANT_ID)
          .eq('is_active', true)
          .order('updated_at', { ascending: false })
          .limit(500)
      : Promise.resolve({ data: [] }),
    needSuppliers
      ? supabaseAdmin().from('suppliers')
          .select('id, name, slug, kind, ordering_status, created_at')
          .order('created_at', { ascending: false })
          .limit(500)
      : Promise.resolve({ data: [] }),
    needLeads
      ? supabaseAdmin().from('crm_leads')
          .select('id, contact_name, email, phone, status, lead_source, created_at, updated_at')
          .eq('tenant_id', DEFAULT_TENANT_ID)
          .order('updated_at', { ascending: false })
          .limit(500)
      : Promise.resolve({ data: [] }),
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
        company_name: body.company_name || null,
        email: body.email || null,
        phone: body.phone || null,
        address_line1: body.address || null,
        city: body.city || null,
        state: body.state || null,
        postal_code: body.zip || null,
        country: 'US',
        customer_type: body.company_name ? 'Wholesale' : 'Retail',
        lifecycle_stage: 'new_customer',
        lifecycle_status: 'active',
        lead_status: 'converted',
        is_active: true,
      })
      .select('id, first_name, last_name, company_name, email, phone, city, state, outstanding_balance, lifetime_value, lifecycle_stage, created_at')
      .single();
    if (error) return NextResponse.json({ error: { code: 'VALIDATION', message: error.message } }, { status: 400 });
    return NextResponse.json({ data: { ...data, source: 'crm_customers', roles: ['customer'] } }, { status: 201 });
  }

  if (role === 'vendor') {
    const { data, error } = await supabaseAdmin()
      .from('acct_vendors')
      .insert({
        tenant_id: DEFAULT_TENANT_ID,
        legal_name: body.name || body.company_name,
        email: body.email || null,
        phone: body.phone || null,
        payment_terms_days: body.terms ?? 30,
        is_1099_vendor: body.is1099 ?? false,
        is_active: true,
      })
      .select('id, legal_name, email, phone, payment_terms_days, is_1099_vendor, is_active, created_at')
      .single();
    if (error) return NextResponse.json({ error: { code: 'VALIDATION', message: error.message } }, { status: 400 });
    return NextResponse.json({ data: { ...data, source: 'acct_vendors', roles: ['vendor'] } }, { status: 201 });
  }

  if (role === 'supplier') {
    const { data, error } = await supabaseAdmin()
      .from('suppliers')
      .insert({
        name: body.name || body.company_name,
        slug: (body.name || 'supplier').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        kind: body.kind || 'print_on_demand',
        ordering_status: 'connected',
      })
      .select('id, name, kind, ordering_status, created_at')
      .single();
    if (error) return NextResponse.json({ error: { code: 'VALIDATION', message: error.message } }, { status: 400 });
    return NextResponse.json({ data: { ...data, source: 'suppliers', roles: ['supplier'] } }, { status: 201 });
  }

  if (role === 'lead') {
    const { data, error } = await supabaseAdmin()
      .from('crm_leads')
      .insert({
        tenant_id: DEFAULT_TENANT_ID,
        contact_name: body.name || [body.first_name, body.last_name].filter(Boolean).join(' ') || null,
        email: body.email || null,
        phone: body.phone || null,
        lead_source: body.lead_source || 'manual',
        lead_type: 'retail',
        status: 'new',
        first_contact_at: new Date().toISOString(),
      })
      .select('id, contact_name, email, phone, status, created_at')
      .single();
    if (error) return NextResponse.json({ error: { code: 'VALIDATION', message: error.message } }, { status: 400 });
    return NextResponse.json({ data: { ...data, source: 'crm_leads', roles: ['lead'] } }, { status: 201 });
  }

  return NextResponse.json({ error: { code: 'VALIDATION', message: `Unknown role: ${role}` } }, { status: 400 });
}
