// Release access + token-check — T20.
//
// GET  /api/supplier/releases/[rfqId]
//   Token-check: re-authorizes every production pack on the RFQ through
//   supplier_authorize_release (supplier JWT). The release page polls this
//   every 30 s, so a revocation blocks ALL open tabs within one interval.
//   A supplier with no live invitation gets 403 (supplier_get_rfq raises).
// POST /api/supplier/releases/[rfqId]  { techPackId }
//   Download: re-authorizes that exact pack, then mints a FRESH signed URL
//   with ttlSeconds 900 (15 minutes) from the service-role client. The URL
//   is never persisted and never rendered in page HTML. The authorize RPC
//   records release_download_authorized / _denied in ds_access_events —
//   that is the download record (there is no ds_record_release RPC in
//   S600; see the lane-2 report).

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createUserClient } from '@/server/supabase/server';
import { admin } from '@/server/supabase/admin';
import { supplierAuthorizeRelease, supplierGetRfq } from '@/lib/db';

const SIGNED_URL_TTL_SECONDS = 900; // 15 minutes (T20 accept)

interface ReleaseAuth {
  allowed: boolean;
  reason?: string;
  bucket?: string;
  path?: string;
}

async function supplierContext(rfqId: string) {
  let supabase;
  try {
    supabase = await createUserClient();
  } catch {
    return { error: NextResponse.json({ error: 'auth not configured' }, { status: 500 }) };
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'unauthenticated' }, { status: 401 }) };
  // Proves invitation + NDA + not revoked, with the supplier's own JWT.
  const { data: rfq, error: rfqErr } = await supplierGetRfq(supabase, { p_rfq: rfqId });
  if (rfqErr || !rfq) return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) };
  const view = rfq as unknown as { lines: Array<{ tech_pack: { id: string } }> };
  return { supabase, techPackIds: view.lines.map((l) => l.tech_pack.id) };
}

export async function GET(_req: Request, { params }: { params: Promise<{ rfqId: string }> }) {
  const { rfqId } = await params;
  const ctx = await supplierContext(rfqId);
  if ('error' in ctx) return ctx.error;
  const packs: Array<{ tech_pack_id: string; allowed: boolean; reason?: string }> = [];
  for (const tpId of ctx.techPackIds) {
    const { data, error } = await supplierAuthorizeRelease(ctx.supabase, { p_tech_pack: tpId });
    const row = data as unknown as ReleaseAuth | null;
    packs.push({ tech_pack_id: tpId, allowed: !error && row?.allowed === true, reason: error ? error.message : row?.reason });
  }
  return NextResponse.json({ rfq_id: rfqId, packs });
}

export async function POST(req: Request, { params }: { params: Promise<{ rfqId: string }> }) {
  const { rfqId } = await params;
  const ctx = await supplierContext(rfqId);
  if ('error' in ctx) return ctx.error;

  let body: { techPackId?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }
  if (typeof body.techPackId !== 'string' || !ctx.techPackIds.includes(body.techPackId)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { data, error } = await supplierAuthorizeRelease(ctx.supabase, { p_tech_pack: body.techPackId });
  if (error) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const auth = data as unknown as ReleaseAuth;
  if (!auth?.allowed || !auth.bucket || !auth.path) {
    return NextResponse.json({ error: 'forbidden', reason: auth?.reason ?? 'not released to you' }, { status: 403 });
  }

  const { data: signed, error: signErr } = await admin.storage
    .from(auth.bucket)
    .createSignedUrl(auth.path, SIGNED_URL_TTL_SECONDS);
  if (signErr || !signed?.signedUrl) return NextResponse.json({ error: 'could not sign download URL' }, { status: 500 });
  return NextResponse.json({ url: signed.signedUrl, expiresIn: SIGNED_URL_TTL_SECONDS, techPackId: body.techPackId });
}
