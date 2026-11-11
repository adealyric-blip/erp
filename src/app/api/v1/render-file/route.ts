import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { apiError } from '@/lib/podServer';

/**
 * GET /api/v1/render-file?path=renders/r/<hash>/<file>.webp
 *
 * Same-origin proxy for render outputs stored in the private `renders`
 * bucket. The renders list API returns this URL (not a Supabase signed
 * URL) so the studio <img> loads from the app origin — signed storage
 * URLs are external and do not load in restricted browser environments
 * (e.g. headless verification, corporate proxies). The server downloads
 * the bytes from storage and streams them back.
 *
 * Path is restricted to the `renders/` prefix; nothing else in storage
 * is reachable through this route.
 */
const BUCKET = 'renders';

function contentTypeFor(path: string): string {
  const p = path.toLowerCase();
  if (p.endsWith('.webp')) return 'image/webp';
  if (p.endsWith('.png')) return 'image/png';
  if (p.endsWith('.jpg') || p.endsWith('.jpeg')) return 'image/jpeg';
  if (p.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
}

export async function GET(req: NextRequest) {
  try {
    const storagePath = new URL(req.url).searchParams.get('path') ?? '';
    if (!storagePath.startsWith('renders/') || storagePath.includes('..')) {
      return apiError('path must be a renders/ storage path.', 400);
    }
    const slash = storagePath.indexOf('/');
    const bucket = storagePath.slice(0, slash);
    const path = storagePath.slice(slash + 1);
    if (bucket !== BUCKET || !path) {
      return apiError('path must be a renders/ storage path.', 400);
    }
    const { data, error } = await supabaseAdmin().storage.from(bucket).download(path);
    if (error || !data) {
      return apiError(`render unreadable: ${error?.message ?? 'no data'}`, 404);
    }
    const buf = Buffer.from(await data.arrayBuffer());
    return new NextResponse(buf, {
      headers: {
        'Content-Type': contentTypeFor(storagePath),
        'Cache-Control': 'private, max-age=3600',
        'Content-Length': String(buf.length),
      },
    });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to serve render.');
  }
}
