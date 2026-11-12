// split/handler.ts — render-station handler for job kind `flat_split`
// (plan/08 §Splitting bundles, pipeline steps 1–2 + 7).
//
// SEAM (T14 owns the station loop; this file is the handler it calls):
//   1. Station claims a `flat_split` browser job (ds_claim_browser_jobs,
//      kinds filter must include 'flat_split' — the loop is Phase 3's;
//      this handler does not claim).
//   2. Station downloads the bundle bytes from design-private and calls
//      normalizeBundleToSvg (VectorCraft headless: document.open + export
//      SVG — browser-verified in the T11 spike; EPS that fails in WASM
//      goes to runner='server' with Ghostscript, per plan/08 step 2).
//   3. Station calls runFlatSplitJob with the normalized pages + a store.
//      The handler splits, uploads each piece SVG to design-private
//      (classification internal, batch license inherited — never a raw
//      piece to a supplier), inserts ds_flat_pieces rows (proposed), and
//      moves the batch to 'review'. Staff then approve on
//      /studio/library/flats/import/[batchId]; flat.piece.accept creates
//      the template.
//
// The store is injected so unit tests can use a fake; the Supabase store
// (createSupabaseFlatSplitStore) is the production one. The handler never
// touches the live database directly — only through the store.

import { splitBundle } from './split';
import type { SplitPiece, SvgPage } from './types';

export const FLAT_SPLIT_JOB_KIND = 'flat_split';

export interface FlatSplitJobInput {
  batchId: string;
  tenantId: string;
  /** Bundle asset id — pieces link derived_from_asset_id at it. */
  sourceAssetId: string;
  /** License id of the batch — every piece asset inherits it (S610 guard). */
  licenseId: string;
  sourceCategory?: string;
  fileName?: string;
  /** Normalized SVG pages (one per PDF page / artboard). */
  pages: SvgPage[];
}

export interface FlatSplitJobOutput {
  batchId: string;
  strategy: string;
  pieceCount: number;
  pieces: { id: string; sourceRef: string; view: string; pairKey: string | null; assetId: string }[];
  warnings: string[];
}

export interface PieceRow {
  batch_id: string;
  source_ref: string;
  bbox: { x: number; y: number; w: number; h: number };
  view: string;
  category: string;
  pair_key: string | null;
  svg_asset_id: string;
  status: 'proposed';
}

export interface FlatSplitStore {
  /** Upload one piece SVG to design-private; returns the design_asset id. */
  uploadPieceSvg(
    tenantId: string,
    batchId: string,
    piece: SplitPiece,
    licenseId: string,
    sourceAssetId: string,
  ): Promise<string>;
  insertPiece(row: PieceRow & { tenant_id: string }): Promise<void>;
  updateBatch(batchId: string, patch: Record<string, unknown>): Promise<void>;
}

/**
 * Normalize a bundle (PDF preferred, or AI / EPS / SVG) to SVG pages in
 * VectorCraft, headless. BROWSER ONLY — the render-station tab calls it.
 * One page per PDF page; VectorCraft's SVG export returns the whole
 * document, so multi-page PDFs are converted page-by-page by the caller
 * (PdfCraft split first, or one document per page — see open items).
 */
export async function normalizeBundleToSvg(bundle: ArrayBuffer, fileName: string): Promise<SvgPage[]> {
  // Dynamic import: this module must stay importable in Node unit tests,
  // where `document` does not exist; the Craft bridge is browser-only.
  const { runHeadless } = await import('@/lib/craft-bridge/runHeadless');
  const craft = await runHeadless('vectorcraft');
  try {
    craft.open(bundle, fileName);
    const saved = await craft.exportViaCommand('document.export', { format: 'svg' }, 120_000);
    const text = new TextDecoder().decode(saved.bytes);
    if (!text.includes('<svg')) throw new Error('VectorCraft SVG export did not return an SVG document');
    return [{ pageIndex: 0, svg: text }];
  } finally {
    craft.dispose();
  }
}

/**
 * Rasterize one normalized SVG page to the ink mask the cluster strategy
 * needs. BROWSER ONLY — the render-station tab draws the SVG into a
 * canvas (raster/at 72 dpi: 1 px = 1 pt, matching the gap model) and
 * reads back every non-white pixel. The mask is what distinguishes a
 * raster-inside VecFashion PDF (pdftocairo SVG with ~1 path and a big
 * feImage) from a vector file; without it the cluster strategy sees no
 * geometry at all.
 *
 * The station calls this per page (after normalizeBundleToSvg) and hands
 * the pages to runFlatSplitJob. Size cap: 2000 px per side so a poster-size
 * artboard cannot blow out the station tab.
 */
export async function attachRasterToPage(page: SvgPage, viewBox?: { w: number; h: number }): Promise<SvgPage> {
  const { parseSvg } = await import('./svg');
  const parsed = parseSvg(page.svg);
  const w = Math.min(2000, Math.max(1, Math.round(viewBox?.w ?? parsed.viewBox.w)));
  const h = Math.min(2000, Math.max(1, Math.round(viewBox?.h ?? parsed.viewBox.h)));
  const blob = new Blob([page.svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = 'sync';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('SVG page could not be decoded for rasterization'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('2d canvas context unavailable');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    const ink = new Uint8Array(w * h);
    for (let i = 0; i < ink.length; i++) {
      // Non-white = ink (the flats are black line art on white; the
      // threshold tolerates JPEG-ish grey anti-aliasing).
      ink[i] = data[i * 4] < 250 || data[i * 4 + 1] < 250 || data[i * 4 + 2] < 250 ? 1 : 0;
    }
    return { ...page, raster: { width: w, height: h, ink } };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function runFlatSplitJob(
  input: FlatSplitJobInput,
  store: FlatSplitStore,
): Promise<FlatSplitJobOutput> {
  await store.updateBatch(input.batchId, { status: 'splitting' });
  try {
    const result = splitBundle(input.pages, {
      sourceCategory: input.sourceCategory,
      fileName: input.fileName,
    });
    const pieces: FlatSplitJobOutput['pieces'] = [];
    for (const piece of result.pieces) {
      const assetId = await store.uploadPieceSvg(
        input.tenantId,
        input.batchId,
        piece,
        input.licenseId,
        input.sourceAssetId,
      );
      await store.insertPiece({
        tenant_id: input.tenantId,
        batch_id: input.batchId,
        source_ref: piece.sourceRef,
        bbox: piece.bbox,
        view: piece.view,
        category: piece.category,
        pair_key: piece.pairKey,
        svg_asset_id: assetId,
        status: 'proposed',
      });
      pieces.push({ id: piece.id, sourceRef: piece.sourceRef, view: piece.view, pairKey: piece.pairKey, assetId });
    }
    await store.updateBatch(input.batchId, {
      status: 'review',
      strategy: result.strategy,
      piece_count: pieces.length,
    });
    return { batchId: input.batchId, strategy: result.strategy, pieceCount: pieces.length, pieces, warnings: result.warnings };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'flat_split failed';
    await store.updateBatch(input.batchId, { status: 'failed', error: message });
    throw e;
  }
}
