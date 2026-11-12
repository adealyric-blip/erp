// split/split.ts — orchestrator (plan/08 §Splitting bundles, pipeline
// steps 2–5). Tries the four strategies in order and keeps the first that
// gives a clean answer; view-splits each candidate; classifies views and
// front/back pairs; rebuilds every piece into the 7-layer standard.
// Normalization (PDF/AI/EPS → SVG) happens before this, in VectorCraft
// (T11 spike: document.export {format:'svg'} is browser-verified; EPS
// falls back to runner='server' with Ghostscript) — the render-station
// handler calls splitBundle with the normalized pages.

import type { BBox, PageRaster, SplitPiece, SplitResult, SplitStrategy, SvgPage } from './types';
import { parseSvg } from './svg';
import type { DrawItem } from './svg';
import {
  artboardStrategy,
  clusterStrategy,
  groupStrategy,
  layerStrategy,
  viewSplit,
  itemsBbox,
  type Candidate,
} from './strategies';
import { classifyCategory, classifyRows, classifyView, pairPieces, splitTextItems } from './classify';
import { rebuildPiece } from './rebuild';

export interface SplitOptions {
  /** Source category from the import batch (e.g. 'tops'). */
  sourceCategory?: string;
  /** Bundle file name, used for the category fallback. */
  fileName?: string;
}

/**
 * Split a normalized bundle into single designable pieces.
 * Returns the first clean strategy's pieces; never an empty list — a
 * bundle with no clean strategy yields one piece (the whole page) with a
 * warning, so staff still see it on the review screen.
 */
export function splitBundle(pages: SvgPage[], opts: SplitOptions = {}): SplitResult {
  const warnings: string[] = [];
  if (pages.length === 0) throw new Error('splitBundle: no pages');
  const parsedPages = pages.map((p) => ({ pageIndex: p.pageIndex, parsed: parseSvg(p.svg), raster: p.raster }));
  const pageSize = { w: parsedPages[0].parsed.viewBox.w, h: parsedPages[0].parsed.viewBox.h };

  let strategy: SplitStrategy | null = null;
  let candidates: Candidate[] | null = null;

  const art = artboardStrategy(parsedPages);
  if (art) {
    strategy = 'artboard';
    candidates = art;
  } else {
    const first = parsedPages[0];
    const lay = layerStrategy(first.parsed, first.pageIndex);
    if (lay) {
      strategy = 'layer';
      candidates = lay;
    } else {
      const grp = groupStrategy(first.parsed, first.pageIndex);
      if (grp) {
        strategy = 'group';
        candidates = grp;
      } else {
        const clu = clusterStrategy(first.parsed, first.pageIndex, undefined, 0.02, first.raster);
        if (clu) {
          strategy = 'cluster';
          candidates = clu;
        }
      }
    }
  }

  if (!strategy || !candidates) {
    // No clean strategy: one piece = the whole first page, flagged.
    const first = parsedPages[0];
    const items = first.parsed.items.filter((it) => it.kind !== 'text');
    const bbox = itemsBbox(items) ?? first.parsed.viewBox;
    warnings.push(
      'No clean split strategy (artboard/layer/group/cluster all inconclusive) — ' +
        'the whole page is one piece for manual review. Use Cut on the review screen to split it by hand.',
    );
    return {
      strategy: 'cluster',
      pieces: [
        buildPiece('cluster-0', 'page-1', first.pageIndex, bbox, items, first.parsed, 'cluster', opts, warnings, [bbox], undefined, null, {
          raster: first.raster,
          pageBbox: first.parsed.viewBox,
        }),
      ],
      pageSize,
      warnings,
    };
  }

  // View-split each candidate (a garment group holding front+back becomes
  // two pieces), then classify and pair within each candidate group.
  const pieces: SplitPiece[] = [];
  let n = 0;
  for (const cand of candidates) {
    const parsed = parsedPages.find((p) => p.pageIndex === cand.pageIndex)?.parsed ?? parsedPages[0].parsed;
    const views = viewSplit(cand, parsed);
    // Label hints are page-wide: classify within this candidate's views.
    const { hints, watermark } = splitTextItems(parsed.items);
    if (watermark.length) {
      warnings.push(
        `${watermark.length} watermark/label text element(s) dropped from pieces (kept as hints only): ` +
          watermark.map((w) => w.text).filter(Boolean).slice(0, 3).join(', '),
      );
    }
    const bboxes = views.map((v) => v.bbox);
    // Views within one candidate share pair numbering: pair front/back of
    // this garment; a side stands alone.
    const candPieces: SplitPiece[] = [];
    const candViews = views.map((v) => classifyView(v.bbox, hints, bboxes));
    for (let i = 0; i < views.length; i++) {
      const v = views[i];
      const piece = buildPiece(
        `${strategy}-${++n}`,
        v.sourceRef,
        v.pageIndex,
        v.bbox,
        v.items,
        parsed,
        strategy,
        opts,
        warnings,
        bboxes,
        candViews[i],
        null,
        { raster: v.raster, pageBbox: v.pageBbox },
      );
      candPieces.push(piece);
    }
    pieces.push(...candPieces);
  }

  // Views are a property of a ROW, not of one candidate (a cluster
  // candidate is a single view, so per-candidate position classification
  // always says "front"). Classify rows first, then pair globally.
  classifyRows(pieces);
  const pairKeys = pairPieces(
    pieces.map((p) => p.bbox),
    pieces.map((p) => p.view),
  );
  pieces.forEach((p, i) => {
    p.pairKey = pairKeys[i];
  });

  // Pieces keep candidate order (garment 1 front/back, garment 2 …) so the
  // review grid reads as garments, not a global view sort.
  return { strategy, pieces, pageSize, warnings };
}

function buildPiece(
  id: string,
  sourceRef: string,
  pageIndex: number,
  bbox: { x: number; y: number; w: number; h: number },
  items: DrawItem[],
  parsed: ReturnType<typeof parseSvg>,
  strategy: SplitStrategy,
  opts: SplitOptions,
  warnings: string[],
  siblings: { x: number; y: number; w: number; h: number }[],
  viewOverride?: { view: SplitPiece['view']; fromLabel: boolean },
  pairKeyOverride?: string | null,
  rasterCtx?: { raster?: PageRaster; pageBbox?: BBox },
): SplitPiece {
  const { hints } = splitTextItems(parsed.items);
  const classified = viewOverride ?? classifyView(bbox, hints, siblings);
  const view = classified.view;
  const category = classifyCategory(opts.sourceCategory, opts.fileName);
  const rebuilt = rebuildPiece(items, bbox, view, category, rasterCtx ?? {});
  const notes: string[] = [];
  if (rebuilt.silhouetteSource === 'bbox-fallback') {
    notes.push('Silhouette fell back to the piece bbox (raster trace degenerated) — check the outline on review.');
    warnings.push(`Piece ${id}: silhouette bbox-fallback.`);
  }
  return {
    id,
    sourceRef,
    pageIndex,
    bbox: { x: Math.round(bbox.x * 10) / 10, y: Math.round(bbox.y * 10) / 10, w: Math.round(bbox.w * 10) / 10, h: Math.round(bbox.h * 10) / 10 },
    view,
    viewFromLabel: classified.fromLabel,
    pairKey: pairKeyOverride ?? null,
    category,
    svg: rebuilt.svg,
    svgMm: null,
    scaleMmPerUnit: null,
    silhouetteSource: rebuilt.silhouetteSource,
    strategy,
    notes,
  };
}

/** Merge two pieces' geometry into one proposed piece (flat.piece.merge). */
export function mergePieces(a: SplitPiece, b: SplitPiece): SplitPiece {
  const svgA = parseSvg(a.svg);
  const svgB = parseSvg(b.svg);
  // Both SVGs are local-coordinate rebuilds; shift B's items by A's width
  // plus a gap so the merged piece keeps both outlines side by side.
  const gap = 20;
  const shiftX = a.bbox.w + gap;
  const shiftedB = svgB.items.map((it) => ({
    ...it,
    points: it.points.map(([x, y]): [number, number] => [x + shiftX, y]),
  }));
  const items = [...svgA.items, ...shiftedB];
  const bbox = {
    x: 0,
    y: 0,
    w: a.bbox.w + gap + b.bbox.w,
    h: Math.max(a.bbox.h, b.bbox.h),
  };
  const rebuilt = rebuildPiece(items, bbox, a.view, a.category);
  return {
    id: `${a.id}+${b.id}`,
    sourceRef: `${a.sourceRef}+${b.sourceRef}`,
    pageIndex: a.pageIndex,
    bbox,
    view: a.view,
    viewFromLabel: false,
    pairKey: null,
    category: a.category,
    svg: rebuilt.svg,
    svgMm: null,
    scaleMmPerUnit: null,
    silhouetteSource: rebuilt.silhouetteSource,
    strategy: a.strategy,
    notes: [`Merged from ${a.id} and ${b.id}; re-review the view and scale before accepting.`],
  };
}

/** Cut one piece by a line (flat.piece.cut): each item's points are
 * partitioned at the cut, so a path that straddles the line contributes a
 * clipped copy to each side instead of landing whole on one side. */
export function cutPiece(piece: SplitPiece, axis: 'vertical' | 'horizontal', at: number): [SplitPiece, SplitPiece] {
  const parsed = parseSvg(piece.svg);
  // `at` is in the piece's local units from its left (vertical) / top
  // (horizontal) edge — the rebuilt SVG is local-coordinate.
  const cut = at;
  const left: DrawItem[] = [];
  const right: DrawItem[] = [];
  for (const it of parsed.items) {
    if (it.points.length === 0) continue;
    const coord = (p: [number, number]) => (axis === 'vertical' ? p[0] : p[1]);
    const lPts = it.points.filter((p) => coord(p) <= cut);
    const rPts = it.points.filter((p) => coord(p) > cut);
    if (lPts.length >= 2) left.push({ ...it, points: lPts });
    else if (lPts.length === 1 && it.kind === 'text') left.push(it);
    if (rPts.length >= 2) right.push({ ...it, points: rPts });
    else if (rPts.length === 1 && it.kind === 'text') right.push(it);
    // A single point on either side carries no geometry; it is dropped.
  }
  const mk = (items: DrawItem[], suffix: string): SplitPiece => {
    const bbox = itemsBbox(items) ?? piece.bbox;
    const rebuilt = rebuildPiece(items, bbox, piece.view, piece.category);
    return {
      id: `${piece.id}-${suffix}`,
      sourceRef: `${piece.sourceRef}/cut-${suffix}`,
      pageIndex: piece.pageIndex,
      bbox,
      view: piece.view,
      viewFromLabel: false,
      pairKey: null,
      category: piece.category,
      svg: rebuilt.svg,
      svgMm: null,
      scaleMmPerUnit: null,
      silhouetteSource: rebuilt.silhouetteSource,
      strategy: piece.strategy,
      notes: [`Cut from ${piece.id} (${axis} at ${at}); re-review the view and scale before accepting.`],
    };
  };
  return [mk(left, 'a'), mk(right, 'b')];
}
