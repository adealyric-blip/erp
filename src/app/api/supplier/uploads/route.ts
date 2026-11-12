// Supplier upload registration — T18, per plan/04.
//
// POST { rfqId, fileName, mime, size } → supplier_register_upload (user
// JWT: invitation + NDA + deadline + MIME allow-list + 100 MB cap, and the
// virus_scan job is queued by the RPC) → service-role signed upload URL.
// The supplier never touches storage directly; staff see the file only
// after the scan-worker marks it clean.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createUserClient } from '@/server/supabase/server';
import { admin } from '@/server/supabase/admin';
import { supplierRegisterUpload } from '@/lib/db';

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

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

  let body: { rfqId?: unknown; fileName?: unknown; mime?: unknown; size?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }
  const { rfqId, fileName, mime, size } = body;
  if (typeof rfqId !== 'string' || typeof fileName !== 'string' || typeof mime !== 'string' || typeof size !== 'number') {
    return NextResponse.json({ error: 'rfqId, fileName, mime and size are required' }, { status: 400 });
  }
  if (!ALLOWED_MIME.has(mime)) return NextResponse.json({ error: 'file type not allowed' }, { status: 400 });
  if (size <= 0 || size > 104_857_600) return NextResponse.json({ error: 'file too large (100 MB max)' }, { status: 400 });

  const { data, error } = await supplierRegisterUpload(supabase, { p_rfq: rfqId, p_file_name: fileName, p_mime: mime, p_size: size });
  if (error || !data) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const reg = data as unknown as { rfq_file_id: string; bucket: string; path: string };

  const { data: signed, error: signErr } = await admin.storage.from(reg.bucket).createSignedUploadUrl(reg.path);
  if (signErr || !signed?.signedUrl) return NextResponse.json({ error: 'could not sign upload URL' }, { status: 500 });
  return NextResponse.json({ uploadUrl: signed.signedUrl, rfqFileId: reg.rfq_file_id, bucket: reg.bucket, path: reg.path });
}
