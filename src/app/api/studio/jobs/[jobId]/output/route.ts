// POST /api/studio/jobs/[jobId]/output — render-station output upload (T14).
//
// The station tab claims a browser job (claimed_by =
// 'browser:<uid>:<tab session>'), runs it, then POSTs the bytes here.
// This route:
//   1. verifies the caller is the staff user who claimed the job
//      (claimed_by must equal browser:<uid>:<session> exactly — the
//      session comes from the signed-in tab, never from the job row);
//   2. writes the bucket + design_assets row WITH THE SERVICE KEY
//      (storage policies do not let a browser tab write here);
//   3. returns { asset_id } for ds_finish_browser_job.
//
// A supplier-facing preview needs derived_from_asset_id (S600 check), so
// for techpack_preview_pdf the source is the pack's internal PDF asset.
import { NextResponse, type NextRequest } from 'next/server';
import { createHash } from 'node:crypto';
import { createUserClient } from '@/server/supabase/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { outputTarget } from '@/features/render/jobs';

export async function POST(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const userClient = await createUserClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 });

  let body: { session?: string; filename?: string; mime_type?: string; data_base64?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }
  const { session, filename, mime_type: mimeType, data_base64: dataBase64 } = body;
  if (!session || !filename || !mimeType || !dataBase64) {
    return NextResponse.json({ error: 'session, filename, mime_type and data_base64 are required' }, { status: 400 });
  }
  const bytes = Buffer.from(dataBase64, 'base64');
  if (bytes.length === 0 || bytes.length > 500 * 1024 * 1024) {
    return NextResponse.json({ error: 'empty or oversize payload' }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data: job, error: jobErr } = await admin
    .from('craft_jobs')
    .select('id, tenant_id, kind, status, runner, claimed_by, subject_id, subject_type, input')
    .eq('id', jobId)
    .single();
  if (jobErr || !job) return NextResponse.json({ error: 'job not found' }, { status: 404 });
  const expectedClaim = `browser:${user.id}:${session}`;
  if (job.status !== 'running' || job.runner !== 'browser' || job.claimed_by !== expectedClaim) {
    return NextResponse.json({ error: 'job is not claimed by this browser session' }, { status: 403 });
  }

  const { bucket, classification } = outputTarget(String(job.kind));
  const path = `${String(job.tenant_id)}/${jobId}/${filename}`;
  const { error: upErr } = await admin.storage.from(bucket).upload(path, bytes, {
    contentType: mimeType,
    upsert: false,
  });
  if (upErr) return NextResponse.json({ error: `storage upload failed: ${upErr.message}` }, { status: 500 });

  // Resolve design + version for the asset row; supplier previews derive
  // from the pack's internal PDF (S600 derivative check).
  let designId: string | null = null;
  let versionId: string | null = null;
  let derivedFrom: string | null = null;
  if (job.subject_type === 'tech_pack' && job.subject_id) {
    const { data: tp } = await admin
      .from('tech_packs')
      .select('design_id, version_id, pdf_asset_id')
      .eq('id', String(job.subject_id))
      .single();
    if (tp) {
      designId = String(tp.design_id ?? '');
      versionId = tp.version_id ? String(tp.version_id) : null;
      derivedFrom = tp.pdf_asset_id ? String(tp.pdf_asset_id) : null;
    }
  } else if (job.subject_type === 'design' && job.subject_id) {
    designId = String(job.subject_id);
  }

  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (classification === 'supplier_preview' && !derivedFrom) {
    // The internal master PDF is not ready yet (the techpack_pdf job runs
    // first by priority). Tell the station to fail this attempt so
    // ds_finish_job requeues it with backoff — it must not mint a
    // supplier preview with no source asset (S600 derivative check).
    return NextResponse.json({ error: 'internal PDF not ready yet — retry after the techpack_pdf job finishes' }, { status: 409 });
  }
  const { data: asset, error: assetErr } = await admin
    .from('design_assets')
    .insert({
      tenant_id: job.tenant_id,
      design_id: designId,
      version_id: versionId,
      kind: String(job.kind),
      bucket,
      storage_path: path,
      mime_type: mimeType,
      size_bytes: bytes.length,
      sha256,
      classification,
      derived_from_asset_id: classification === 'supplier_preview' ? derivedFrom : null,
    })
    .select('id')
    .single();
  if (assetErr || !asset) {
    return NextResponse.json({ error: `asset row failed: ${assetErr?.message ?? 'unknown'}` }, { status: 500 });
  }
  return NextResponse.json({ asset_id: String(asset.id), bucket, path, size_bytes: bytes.length });
}
