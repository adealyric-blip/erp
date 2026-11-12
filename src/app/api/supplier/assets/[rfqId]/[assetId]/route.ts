// Supplier asset proxy — T18, per plan/04 (security-critical).
//
// The ONLY way a supplier ever sees a preview byte: this route.
//  1. The supplier's own JWT calls supplier_authorize_asset_view
//     (invitation + NDA + grant + revocation + licence, server-side).
//     allowed=false → 403. The RPC logs the denial in ds_access_events.
//  2. Only then does the service-role client read the object. No storage
//     hostname, bucket or path ever reaches the page HTML or the network
//     log except through this route (zero-leak).
//  3. Images are re-encoded by sharp: max 1600 px, tiled watermark
//     overlay, webp q70. PDFs stream inline with no-store; the watermark
//     is an on-screen overlay in SecurePdfViewer (OPEN ITEM: burn a
//     diagonal tiled stamp into the PDF bytes — needs pdf-lib, which is
//     not installed in this repo).
// The authorize RPC returns ttl_seconds 120: that is the authorisation
// freshness window, not a signed URL — this route streams bytes and never
// mints or embeds a signed URL.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { createUserClient } from '@/server/supabase/server';
import { admin } from '@/server/supabase/admin';
import { supplierAuthorizeAssetView } from '@/lib/db';
import { watermarkSvg } from '@/features/supplier/releases/Watermark';

const NO_STORE = 'private, no-store, max-age=0';

function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

interface Authorize {
  allowed: boolean;
  reason?: string;
  bucket?: string;
  path?: string;
  mime_type?: string;
  watermark_text?: string;
}

async function authorize(req: Request, rfqId: string, assetId: string): Promise<{ user: unknown; auth: Authorize } | NextResponse> {
  let supabase;
  try {
    supabase = await createUserClient();
  } catch {
    return jsonError('auth not configured', 500);
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError('unauthenticated', 401);
  const { data, error } = await supplierAuthorizeAssetView(supabase, { p_rfq: rfqId, p_asset: assetId });
  if (error) return jsonError('forbidden', 403);
  const auth = data as unknown as Authorize;
  if (!auth?.allowed) return jsonError('forbidden', 403);
  return { user, auth };
}

function proxyHeaders(mime: string, watermarkText?: string): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': mime,
    'Cache-Control': NO_STORE,
    'Content-Disposition': 'inline',
    'X-Content-Type-Options': 'nosniff',
    'Cross-Origin-Resource-Policy': 'same-origin',
    ReferrerPolicy: 'no-referrer',
  };
  if (watermarkText) headers['X-Watermark'] = watermarkText;
  return headers;
}

export async function HEAD(_req: Request, { params }: { params: Promise<{ rfqId: string; assetId: string }> }) {
  const { rfqId, assetId } = await params;
  const res = await authorize(_req, rfqId, assetId);
  if (res instanceof NextResponse) return new NextResponse(null, { status: res.status });
  return new NextResponse(null, { status: 200, headers: proxyHeaders(res.auth.mime_type ?? 'application/octet-stream', res.auth.watermark_text) });
}

export async function GET(req: Request, { params }: { params: Promise<{ rfqId: string; assetId: string }> }) {
  const { rfqId, assetId } = await params;
  const authRes = await authorize(req, rfqId, assetId);
  if (authRes instanceof NextResponse) return authRes;
  const { auth } = authRes;
  if (!auth.bucket || !auth.path) return jsonError('not found', 404);

  const { data: blob, error: dlErr } = await admin.storage.from(auth.bucket).download(auth.path);
  if (dlErr || !blob) return jsonError('not found', 404);
  const bytes = Buffer.from(await blob.arrayBuffer());

  if (auth.mime_type === 'application/pdf') {
    // No pdf-lib in this repo: stream inline, viewer chrome stripped
    // client-side, watermark as overlay + header. See file header.
    return new NextResponse(new Uint8Array(bytes), {
      headers: proxyHeaders('application/pdf', auth.watermark_text),
    });
  }

  // Raster preview: max 1600 px, tiled watermark burned in, webp q70.
  try {
    const image = sharp(bytes, { failOnError: false }).rotate();
    const meta = await image.metadata();
    const width = Math.min(meta.width ?? 1600, 1600);
    const resized = await image.resize({ width, withoutEnlargement: true }).toBuffer();
    const outMeta = await sharp(resized).metadata();
    const overlay = Buffer.from(watermarkSvg(auth.watermark_text ?? 'Supplier preview', outMeta.width ?? width, outMeta.height ?? 800));
    const stamped = await sharp(resized)
      .composite([{ input: overlay, tile: false }])
      .webp({ quality: 70 })
      .toBuffer();
    return new NextResponse(new Uint8Array(stamped), {
      headers: proxyHeaders('image/webp', auth.watermark_text),
    });
  } catch {
    return jsonError('preview failed', 500);
  }
}
