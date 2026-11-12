// GET /api/studio/assets/[assetId] — staff-only image stream (T09).
// Staff images are streamed, not linked: the route loads the asset row with
// the staff user's JWT (RLS = own tenant only), then downloads the object
// with the service-role client and streams the bytes. No signed URL is ever
// embedded in HTML. Unknown / foreign-tenant ids return 404, never 403,
// so a prober learns nothing.
import { NextResponse } from 'next/server';
import { requireStaff } from '@/server/auth/requireStaff';
import { admin } from '@/server/supabase/admin';
import { DESIGN_PRIVATE_BUCKET } from '@/server/storage/paths';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const { supabase } = await requireStaff();
  const { data: asset, error } = await (supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, v: string) => {
          maybeSingle: () => Promise<{
            data: { id: string; bucket: string; storage_path: string; mime_type: string | null; classification: string } | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  })
    .from('design_assets')
    .select('id,bucket,storage_path,mime_type,classification')
    .eq('id', assetId)
    .maybeSingle();
  if (error || !asset) return new Response('Not found', { status: 404 });
  // This route serves internal staff assets only. Supplier previews and
  // production releases go through their own proxy routes.
  if (asset.bucket !== DESIGN_PRIVATE_BUCKET || asset.classification !== 'internal') {
    return new Response('Not found', { status: 404 });
  }
  const { data: blob, error: dlErr } = await admin.storage.from(asset.bucket).download(asset.storage_path);
  if (dlErr || !blob) return new Response('Not found', { status: 404 });
  return new Response(blob, {
    headers: {
      'Content-Type': asset.mime_type ?? 'application/octet-stream',
      'Cache-Control': 'private, no-store, max-age=0',
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Referrer-Policy': 'no-referrer',
    },
  });
}
