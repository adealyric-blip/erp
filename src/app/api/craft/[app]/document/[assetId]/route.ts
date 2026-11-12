import { createHash } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { createUserClient } from '@/server/supabase/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { CraftAppSchema } from '@/lib/craft-bridge/protocol';
import { cleanCraftFileName } from '@/lib/craft-bridge/protocol';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/craft/[app]/document/[assetId] — T12. Staff-only document stream
 * for the Craft iframe: the bytes the app opens, never a signed URL and
 * never a storage path. The iframe fetches this with credentials; the app
 * itself never sees a URL it could leak.
 *
 * Security, per plan/04 + Muse.md rule 5/8:
 * - the proxy already 401s unauthenticated /api/* calls;
 * - here: signed-in + aal2 + active tenant membership, else 401 / 404
 *   (404, never 403, so a prober learns nothing);
 * - the asset row must belong to the caller's tenant AND its design must
 *   belong to the same tenant, else 404;
 * - the bytes are read with the service key (server only) and streamed
 *   with `Cache-Control: private, no-store` + `nosniff` + CORP same-origin;
 * - never mounted under /supplier/**; supplier code has no route here.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ app: string; assetId: string }> },
) {
  const { app, assetId } = await params;
  if (!CraftAppSchema.safeParse(app).success) {
    return NextResponse.json({ error: 'unknown craft app' }, { status: 404 });
  }

  const supabase = await createUserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== 'aal2') return NextResponse.json({ error: 'mfa required' }, { status: 401 });

  const { data: memberships } = await supabase
    .from('tenant_memberships')
    .select('tenant_id')
    .eq('user_id', user.id)
    .eq('active', true);
  if (!memberships || memberships.length === 0) return new Response('Not found', { status: 404 });
  const tenantIds = new Set(memberships.map((m) => m.tenant_id as string));

  const admin = supabaseAdmin();
  const { data: asset, error: assetErr } = await admin
    .from('design_assets')
    .select('id,tenant_id,design_id,bucket,storage_path,mime_type')
    .eq('id', assetId)
    .is('deleted_at', null)
    .single();
  if (assetErr || !asset) return new Response('Not found', { status: 404 });
  if (!tenantIds.has(String(asset.tenant_id))) return new Response('Not found', { status: 404 });

  if (asset.design_id) {
    const { data: design } = await admin
      .from('designs')
      .select('id,tenant_id')
      .eq('id', String(asset.design_id))
      .single();
    if (!design || !tenantIds.has(String(design.tenant_id))) {
      return new Response('Not found', { status: 404 });
    }
  }

  const bucket = String(asset.bucket ?? 'design-private');
  const path = String(asset.storage_path ?? '');
  if (!path) return new Response('Not found', { status: 404 });
  const { data: blob, error: dlErr } = await admin.storage.from(bucket).download(path);
  if (dlErr || !blob) return new Response('Not found', { status: 404 });

  const buf = Buffer.from(await blob.arrayBuffer());
  const sha256 = createHash('sha256').update(buf).digest('hex');
  return new Response(buf, {
    headers: {
      'Content-Type': String(asset.mime_type ?? 'application/octet-stream'),
      'Content-Length': String(buf.length),
      'Content-Disposition': `inline; filename="${cleanCraftFileName(String(asset.storage_path).split('/').pop(), 'document')}"`,
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Referrer-Policy': 'no-referrer',
      ETag: `"${sha256}"`,
    },
  });
}
