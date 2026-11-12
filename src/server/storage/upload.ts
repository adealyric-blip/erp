// T09 asset upload helpers (server-only).
// Uploads go to design-private under the plan/02 path convention, with the
// sha256 + size + sniffed MIME recorded on design_assets, and a `thumbnail`
// job (plus optional `bg_remove`) enqueued on craft_jobs. Thumbnails appear
// in the UI via Realtime on craft_jobs / design_assets — the render station
// (Lane C, T14) claims thumbnail jobs; this module only enqueues them.
import 'server-only';
import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/db';
import { dsEnqueueJob } from '@/lib/db/rpc';
import { mapPgError } from '@/server/errors';
import type { Result } from '@/server/result';
import { DESIGN_PRIVATE_BUCKET, studioUploadPath } from './paths';
import { MAX_UPLOAD_BYTES, UPLOAD_MIME_ALLOWLIST, sniffMime } from './sniff';

export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export interface UploadAssetInput {
  tenantId: string;
  /** Optional design link; when given, the file lands under the design path. */
  designId?: string;
  versionNo?: number;
  fileName: string;
  bytes: Uint8Array;
  kind: string;
  /** Pass the browser-declared type for the error message only; sniff wins. */
  declaredMime?: string;
  licenseId?: string;
  /** Enqueue a thumbnail job (images only; skipped for PDF/GLB). Default true. */
  thumbnail?: boolean;
  /** Also enqueue bg_remove (images only). Default false. */
  bgRemove?: boolean;
}

export interface UploadAssetResult {
  assetId: string;
  storagePath: string;
  sha256: string;
  sizeBytes: number;
  mimeType: string;
  thumbnailJobId: string | null;
  bgRemoveJobId: string | null;
}

/**
 * Validate + store one asset in design-private and record it.
 * `client` is the staff user client (RLS policy ds_design_private_rw) or
 * the service-role client for worker / seed callers.
 */
export async function uploadAsset(
  client: SupabaseClient<Database>,
  input: UploadAssetInput,
): Promise<Result<UploadAssetResult>> {
  if (input.bytes.length === 0) {
    return { ok: false, error: { code: 'invalid_state', message: 'Empty file' } };
  }
  if (input.bytes.length > MAX_UPLOAD_BYTES) {
    return { ok: false, error: { code: 'invalid_state', message: `File is larger than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB` } };
  }
  const sniffed = sniffMime(input.bytes);
  if (!sniffed) {
    return { ok: false, error: { code: 'invalid_state', message: 'Unrecognised file type (MIME sniff failed)' } };
  }
  if (!UPLOAD_MIME_ALLOWLIST.has(sniffed.mime)) {
    return { ok: false, error: { code: 'invalid_state', message: `File type ${sniffed.mime} is not accepted for studio uploads` } };
  }
  const sha256 = sha256Hex(input.bytes);
  const storagePath =
    input.designId && input.versionNo
      ? `${input.tenantId}/designs/${input.designId}/${input.versionNo}/${input.fileName.replace(/[^\w.\-]+/g, '_')}`
      : studioUploadPath(input.tenantId, input.fileName);
  const { error: upErr } = await client.storage
    .from(DESIGN_PRIVATE_BUCKET)
    .upload(storagePath, new Blob([input.bytes as unknown as BlobPart], { type: sniffed.mime }), {
      upsert: false,
      contentType: sniffed.mime,
    });
  if (upErr) {
    return { ok: false, error: { code: 'unknown', message: `Storage upload failed: ${upErr.message}` } };
  }
  const isImage = sniffed.mime.startsWith('image/');
  const insert = await (client as unknown as {
    from: (t: string) => {
      insert: (r: Record<string, unknown>) => {
        select: (c: string) => {
          single: () => Promise<{ data: { id: string } | null; error: { code?: string; message?: string } | null }>;
        };
      };
    };
  })
    .from('design_assets')
    .insert({
      tenant_id: input.tenantId,
      design_id: input.designId ?? null,
      kind: input.kind,
      storage_path: storagePath,
      bucket: DESIGN_PRIVATE_BUCKET,
      classification: 'internal',
      mime_type: sniffed.mime,
      sha256,
      size_bytes: input.bytes.length,
      license_id: input.licenseId ?? null,
      metadata: { original_name: input.fileName, declared_mime: input.declaredMime ?? null },
    })
    .select('id')
    .single();
  if (insert.error || !insert.data) {
    // Roll the object back so a failed row never leaves an orphan file.
    await client.storage.from(DESIGN_PRIVATE_BUCKET).remove([storagePath]);
    return insert.error ? mapPgError(insert.error) : { ok: false, error: { code: 'unknown', message: 'Asset insert returned nothing' } };
  }
  const assetId = insert.data.id;
  let thumbnailJobId: string | null = null;
  let bgRemoveJobId: string | null = null;
  if (isImage && input.thumbnail !== false) {
    const { data, error } = await dsEnqueueJob(client, {
      p_tenant: input.tenantId,
      p_kind: 'thumbnail',
      p_app: 'internal',
      p_input: { asset_id: assetId } as never,
      p_subject_type: 'design_asset',
      p_subject: assetId,
      p_key: `thumbnail:${assetId}`,
    });
    if (!error && data) thumbnailJobId = data as string;
  }
  if (isImage && input.bgRemove) {
    const { data, error } = await dsEnqueueJob(client, {
      p_tenant: input.tenantId,
      p_kind: 'bg_remove',
      p_app: 'rembg',
      p_input: { asset_id: assetId } as never,
      p_subject_type: 'design_asset',
      p_subject: assetId,
      p_key: `bg_remove:${assetId}`,
    });
    if (!error && data) bgRemoveJobId = data as string;
  }
  return {
    ok: true,
    data: { assetId, storagePath, sha256, sizeBytes: input.bytes.length, mimeType: sniffed.mime, thumbnailJobId, bgRemoveJobId },
  };
}
