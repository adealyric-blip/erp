// Import review — plan/08 §Splitting bundles, review screen.
// Staff-only. Shows the batch's proposed pieces over their source SVGs;
// accepting a piece (or its pair) creates the garment template.
// Lives in the existing shell — no rail, no sidebar.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStaff } from '@/server/auth/requireStaff';
import { getRow, listRows, str } from '../../../_lib';
import { ImportReview, type ReviewBatch, type ReviewPiece } from '@/features/studio/flats/import/ImportReview';

const BATCH_COLS = 'id,source_category,source_asset_id,status,strategy,piece_count,error,created_at';
const PIECE_COLS = 'id,batch_id,source_ref,bbox,view,category,pair_key,scale_mm_per_unit,svg_asset_id,status,template_id,created_at';

function bboxNum(bbox: unknown, key: 'w' | 'h'): number {
  if (bbox && typeof bbox === 'object') {
    const v = (bbox as Record<string, unknown>)[key];
    return typeof v === 'number' ? v : 0;
  }
  return 0;
}

export default async function ImportReviewPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  const { supabase, tenantId } = await requireStaff();
  const batch = await getRow(supabase, 'ds_flat_import_batches', BATCH_COLS, tenantId, batchId);
  if (!batch) notFound();
  const allPieces = await listRows(supabase, 'ds_flat_pieces', PIECE_COLS, tenantId);
  const pieces: ReviewPiece[] = allPieces
    .filter((p) => str(p, 'batch_id') === batchId)
    .map((p) => ({
      id: str(p, 'id'),
      sourceRef: str(p, 'source_ref'),
      view: str(p, 'view') || 'front',
      category: str(p, 'category'),
      pairKey: typeof p.pair_key === 'string' ? p.pair_key : null,
      scaleMmPerUnit: typeof p.scale_mm_per_unit === 'number' ? p.scale_mm_per_unit : null,
      svgAssetId: typeof p.svg_asset_id === 'string' ? p.svg_asset_id : null,
      status: str(p, 'status'),
      templateId: typeof p.template_id === 'string' ? p.template_id : null,
      bboxW: bboxNum(p.bbox, 'w'),
      bboxH: bboxNum(p.bbox, 'h'),
    }));

  const reviewBatch: ReviewBatch = {
    id: str(batch, 'id'),
    sourceCategory: str(batch, 'source_category'),
    status: str(batch, 'status'),
    strategy: str(batch, 'strategy'),
    pieceCount: typeof batch.piece_count === 'number' ? batch.piece_count : pieces.length,
    error: str(batch, 'error'),
    sourceAssetId: typeof batch.source_asset_id === 'string' ? batch.source_asset_id : null,
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <p className="text-sm text-neutral-500">
        <Link href="/studio/library" className="underline">
          Library
        </Link>{' '}
        /{' '}
        <Link href="/studio/library/flats" className="underline">
          Flats
        </Link>{' '}
        / Import {reviewBatch.id.slice(0, 8)}
      </p>
      <h1 className="mt-1 text-2xl font-bold">Review import</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Nothing is auto-accepted. Check each piece&apos;s view, category and scale, then accept — a front/back pair
        becomes one garment template when both sides are accepted. Pieces keep the bundle&apos;s license and are
        never supplier-viewable.
      </p>
      <ImportReview batch={reviewBatch} pieces={pieces} />
    </main>
  );
}
