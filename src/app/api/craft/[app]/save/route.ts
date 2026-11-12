import { createHash } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createUserClient } from '@/server/supabase/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { dsCreateDesignVersion } from '@/lib/db/rpc';
import { CRAFT_APP_TABLE } from '@/lib/craft-bridge/apps';
import { CraftAppSchema, cleanCraftFileName } from '@/lib/craft-bridge/protocol';
import { mapPgError } from '@/server/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** PdfCraft's documented host-open limit (512 MiB) — the save-back cap. */
export const CRAFT_SAVE_MAX_BYTES = 512 * 1024 * 1024;

const SaveFormSchema = z.object({
  designId: z.string().uuid(),
  name: z.string().min(1).max(255),
});

/**
 * POST /api/craft/[app]/save — T12. Save-back from the Craft iframe:
 * multipart form `{ designId, name, file }` → upload to `design-private`
 * → `design_assets` row (classification `internal`) → new design version
 * with `source_app = app` via `ds_create_design_version`.
 *
 * Security: same gate as the document stream (signed-in + aal2 + tenant
 * member; the design and the asset must belong to the caller's tenant).
 * The version write goes through the user's own JWT (the RPC enforces
 * membership itself); the storage upload + asset row use the service key
 * server-side only, after the tenant check. Never under /supplier/**.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ app: string }> },
) {
  const { app } = await params;
  const parsedApp = CraftAppSchema.safeParse(app);
  if (!parsedApp.success) {
    return NextResponse.json({ ok: false, error: { code: 'not_found', message: 'unknown craft app' } }, { status: 404 });
  }
  const craftApp = parsedApp.data;

  const supabase = await createUserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: { code: 'forbidden', message: 'unauthenticated' } }, { status: 401 });

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== 'aal2') {
    return NextResponse.json({ ok: false, error: { code: 'forbidden', message: 'mfa required' } }, { status: 401 });
  }

  const { data: memberships } = await supabase
    .from('tenant_memberships')
    .select('tenant_id')
    .eq('user_id', user.id)
    .eq('active', true);
  if (!memberships || memberships.length === 0) {
    return NextResponse.json({ ok: false, error: { code: 'not_found', message: 'design not found' } }, { status: 404 });
  }
  const tenantIds = new Set(memberships.map((m) => m.tenant_id as string));

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: { code: 'invalid_state', message: 'expected multipart form data' } }, { status: 400 });
  }
  const fields = SaveFormSchema.safeParse({ designId: form.get('designId'), name: form.get('name') });
  if (!fields.success) {
    return NextResponse.json({ ok: false, error: { code: 'invalid_state', message: fields.error.message } }, { status: 400 });
  }
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: { code: 'invalid_state', message: 'file is required' } }, { status: 400 });
  }
  if (file.size === 0 || file.size > CRAFT_SAVE_MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: { code: 'invalid_state', message: `file must be 1–${CRAFT_SAVE_MAX_BYTES} bytes` } },
      { status: 400 },
    );
  }

  const { designId, name } = fields.data;
  const admin = supabaseAdmin();
  const { data: design, error: designErr } = await admin
    .from('designs')
    .select('id,tenant_id,name')
    .eq('id', designId)
    .is('deleted_at', null)
    .single();
  if (designErr || !design || !tenantIds.has(String(design.tenant_id))) {
    return NextResponse.json({ ok: false, error: { code: 'not_found', message: 'design not found' } }, { status: 404 });
  }
  const tenantId = String(design.tenant_id);

  const safeName = cleanCraftFileName(name, 'document');
  const bytes = Buffer.from(await file.arrayBuffer());
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const storagePath = `designs/${designId}/craft/${craftApp}/${crypto.randomUUID()}-${safeName}`;

  const { error: upErr } = await admin.storage.from('design-private').upload(storagePath, bytes, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });
  if (upErr) {
    return NextResponse.json({ ok: false, error: { code: 'unknown', message: `upload failed: ${upErr.message}` } }, { status: 500 });
  }

  const { data: asset, error: assetErr } = await admin
    .from('design_assets')
    .insert({
      tenant_id: tenantId,
      design_id: designId,
      kind: CRAFT_APP_TABLE[craftApp].assetKind,
      storage_path: storagePath,
      bucket: 'design-private',
      mime_type: file.type || 'application/octet-stream',
      classification: 'internal',
      sha256,
      size_bytes: bytes.length,
      metadata: { source_app: craftApp, saved_via: 'craft', original_name: safeName },
    })
    .select('id')
    .single();
  if (assetErr || !asset) {
    await admin.storage.from('design-private').remove([storagePath]);
    return NextResponse.json(
      { ok: false, error: { code: 'unknown', message: `asset record failed: ${assetErr?.message ?? 'no row'}` } },
      { status: 500 },
    );
  }

  const { data: versionId, error: rpcErr } = await dsCreateDesignVersion(supabase, {
    p_design: designId,
    p_source_app: craftApp,
    p_document_asset: String(asset.id),
    p_message: `Edited in ${craftApp}`,
    p_sha256: sha256,
  });
  if (rpcErr) {
    return NextResponse.json(mapPgError(rpcErr), { status: 500 });
  }
  return NextResponse.json({ ok: true, data: { version_id: versionId, asset_id: String(asset.id), sha256 } });
}
