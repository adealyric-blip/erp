// Advisory access-event logging — T18/T20.
//
// The browser reports print/copy attempts from the preview guard. This is
// advisory only: the real audit entries (asset_view_authorized/_denied,
// release_download_authorized/_denied, bid_saved, …) are written by the
// S600 RPCs themselves via ds__log. There is no supplier-callable RPC that
// logs an arbitrary event, so this route re-checks the supplier's RFQ
// access with their own JWT first (supplier_get_rfq — invitation + NDA),
// then inserts the row with the service key. A failed check → 403, nothing
// is written. Only the three client-reportable events are accepted.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createUserClient } from '@/server/supabase/server';
import { admin } from '@/server/supabase/admin';
import { supplierGetRfq } from '@/lib/db';

const REPORTABLE = new Set(['print_attempt', 'copy_attempt', 'devtools_hint']);

export async function POST(req: Request) {
  let supabase;
  try {
    supabase = await createUserClient();
  } catch {
    return NextResponse.json({ error: 'auth not configured' }, { status: 500 });
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  let body: { rfqId?: unknown; assetId?: unknown; event?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }
  if (typeof body.rfqId !== 'string' || typeof body.event !== 'string' || !REPORTABLE.has(body.event)) {
    return NextResponse.json({ error: 'invalid event' }, { status: 400 });
  }

  // Prove RFQ access with the supplier's own JWT before writing anything.
  const { data: rfq, error: rfqErr } = await supplierGetRfq(supabase, { p_rfq: body.rfqId });
  if (rfqErr || !rfq) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const view = rfq as unknown as { vendor_id: string; rfq: { id: string } };

  // supplier_get_rfq never returns the tenant id (minimised payload), and
  // ds_access_events.tenant_id is NOT NULL — resolve it server-side with
  // the service key. The supplier never supplies or sees it.
  type AdminDb = {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (col: string, v: unknown) => {
          single: () => Promise<{ data: Record<string, unknown> | null; error: { message?: string } | null }>;
        };
      };
      insert: (row: Record<string, unknown>) => Promise<{ error: { message?: string } | null }>;
    };
  };
  const adb = admin as unknown as AdminDb;
  const { data: rfqRow } = await adb.from('rfqs').select('tenant_id').eq('id', body.rfqId).single();
  const tenantId = rfqRow?.tenant_id;
  if (typeof tenantId !== 'string') return NextResponse.json({ error: 'could not log event' }, { status: 500 });

  const { error } = await adb.from('ds_access_events').insert({
    tenant_id: tenantId,
    actor_user_id: user.id,
    actor_vendor_id: view.vendor_id,
    event: body.event,
    subject_type: 'design_asset',
    subject_id: typeof body.assetId === 'string' ? body.assetId : null,
    rfq_id: body.rfqId,
    asset_id: typeof body.assetId === 'string' ? body.assetId : null,
    metadata: {},
  });
  if (error) return NextResponse.json({ error: 'could not log event' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
