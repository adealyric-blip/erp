import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, DEFAULT_TENANT_ID } from '@/lib/supabaseAdmin';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { id: _id, tenant_id: _tid, created_at: _ca, ...updates } = body;
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin()
    .from('crm_segments')
    .update(updates)
    .eq('id', id)
    .eq('tenant_id', DEFAULT_TENANT_ID)
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: { code: 'VALIDATION', message: error.message, requestId: crypto.randomUUID() } }, { status: 400 });
  }
  return NextResponse.json({ data });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await supabaseAdmin().from('crm_segment_memberships').delete().eq('segment_id', id);
  const { error } = await supabaseAdmin()
    .from('crm_segments')
    .delete()
    .eq('id', id)
    .eq('tenant_id', DEFAULT_TENANT_ID);

  if (error) {
    return NextResponse.json({ error: { code: 'INTERNAL', message: error.message, requestId: crypto.randomUUID() } }, { status: 500 });
  }
  return NextResponse.json({ data: { id, deleted: true } });
}
