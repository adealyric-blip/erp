// POST /api/studio/assets — staff-only upload (T09).
// Multipart form: file (required), designId?, versionNo?, kind?, bgRemove?.
// Validates with a MIME sniff, stores in design-private, records the row on
// design_assets (sha256, size, sniffed MIME) and enqueues a thumbnail job
// (and optionally bg_remove). Returns the asset id — never a signed URL.
import { NextResponse } from 'next/server';
import { requireStaff } from '@/server/auth/requireStaff';
import { uploadAsset } from '@/server/storage/upload';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { supabase, tenantId } = await requireStaff();
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: { code: 'invalid_state', message: 'Expected multipart form data' } }, { status: 400 });
  }
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: { code: 'invalid_state', message: 'No file attached (field "file")' } }, { status: 400 });
  }
  const kind = typeof form.get('kind') === 'string' ? (form.get('kind') as string) : 'upload';
  const designId = typeof form.get('designId') === 'string' ? (form.get('designId') as string) : undefined;
  const versionNo = form.get('versionNo') ? Number(form.get('versionNo')) : undefined;
  const bgRemove = form.get('bgRemove') === 'true' || form.get('bgRemove') === '1';
  const bytes = new Uint8Array(await file.arrayBuffer());
  const res = await uploadAsset(supabase, {
    tenantId,
    designId,
    versionNo: Number.isFinite(versionNo) ? versionNo : undefined,
    fileName: file.name,
    bytes,
    kind,
    declaredMime: file.type || undefined,
    bgRemove,
  });
  if (!res.ok) {
    const status = res.error.code === 'invalid_state' ? 400 : 500;
    return NextResponse.json(res, { status });
  }
  return NextResponse.json({ ok: true, data: res.data }, { status: 201 });
}
