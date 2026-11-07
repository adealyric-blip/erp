import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, DEFAULT_TENANT_ID } from '@/lib/supabaseAdmin';

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
        email: body.email ?? undefined,
        phone: body.phone ?? undefined,
        address_line1: body.address ?? undefined,
        city: body.city ?? undefined,
        state: body.state ?? undefined,
        postal_code: body.zip ?? undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', DEFAULT_TENANT_ID)
      .select('id')
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
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', DEFAULT_TENANT_ID)
      .select('id')
      .single();
    if (error) return NextResponse.json({ error: { code: 'VALIDATION', message: error.message } }, { status: 400 });
    return NextResponse.json({ data });
  }

  if (source === 'suppliers') {
    const { data, error } = await supabaseAdmin()
      .from('suppliers')
      .update({ name: body.name ?? undefined })
      .eq('id', id)
      .select('id')
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
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', DEFAULT_TENANT_ID)
      .select('id')
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
