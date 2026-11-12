// split/strategies.ts — the four strategies, tried in plan order
// (plan/08 §Splitting bundles): artboard → layer → group → cluster.
// Each returns candidate regions (a garment, or one view of a garment)
// over the parsed SVG; the orchestrator then view-splits each candidate
// and classifies the pieces. A strategy is "clean" only when it yields
// >= 1 candidate with real ink and the candidates do not overlap.

import type { BBox, PageRaster, SplitStrategy } from './types';
import type { DrawItem, ParsedSvg } from './svg';
import { bboxOfPoints, bboxUnion } from './svg';

export interface Candidate {
  /** artboard/page id, layer name, group id, or `cluster-<n>`. */
  sourceRef: string;
  pageIndex: number;
  bbox: BBox;
  /** Draw items assigned to this candidate. */
  items: DrawItem[];
  /** Strategy that produced it. */
  strategy: SplitStrategy;
  /** Page raster (raster mode only) — the rebuild traces the silhouette from it. */
  raster?: PageRaster;
  /** Page viewBox the raster covers. */
  pageBbox?: BBox;
}

export function itemBbox(item: DrawItem): BBox | null {
  return bboxOfPoints(item.points);
}

export function itemsBbox(items: DrawItem[]): BBox | null {
  let out: BBox | null = null;
  for (const it of items) {
    const b = itemBbox(it);
    if (!b) continue;
    out = out ? bboxUnion(out, b) : b;
  }
  return out;
}

function overlapFrac(a: BBox, b: BBox): number {
  const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const inter = x * y;
  const smaller = Math.min(a.w * a.h, b.w * b.h);
  return smaller > 0 ? inter / smaller : 0;
}

function inkItems(parsed: ParsedSvg): DrawItem[] {
  // Vector geometry only: text is a label hint, not garment ink; the
  // full-page background rect (VectorCraft/pdftocairo white page) is not ink.
  const page = parsed.viewBox;
  return parsed.items.filter((it) => {
    if (it.kind === 'text') return false;
    const b = itemBbox(it);
    if (!b) return false;
    if (b.w <= 0 || b.h <= 0) return false;
    // Background: covers > 92% of the page in both axes.
    if (b.w >= page.w * 0.96 && b.h >= page.h * 0.96) return false;
    return true;
  });
}

function clean(cands: Candidate[]): Candidate[] | null {
  const withInk = cands.filter((c) => c.items.length > 0 && c.bbox.w > 0 && c.bbox.h > 0);
  if (withInk.length === 0) return null;
  for (let i = 0; i < withInk.length; i++) {
    for (let j = i + 1; j < withInk.length; j++) {
      if (overlapFrac(withInk[i].bbox, withInk[j].bbox) > 0.05) return null;
    }
  }
  return withInk;
}

/** a. Artboards / PDF pages — one page = one candidate. Pages live in
 * different coordinate spaces, so candidates never overlap each other. */
export function artboardStrategy(pages: { pageIndex: number; parsed: ParsedSvg }[]): Candidate[] | null {
  if (pages.length < 2) return null;
  const cands: Candidate[] = pages.map(({ pageIndex, parsed }) => {
    const items = inkItems(parsed);
    const bbox = itemsBbox(items) ?? { x: 0, y: 0, w: 0, h: 0 };
    return { sourceRef: `page-${pageIndex + 1}`, pageIndex, bbox, items, strategy: 'artboard' as SplitStrategy };
  });
  const withInk = cands.filter((c) => c.items.length > 0 && c.bbox.w > 0 && c.bbox.h > 0);
  return withInk.length >= 2 ? withInk : null;
}

/** b. Named layers — Front / Back / Side / Detail, or a garment name. */
export function layerStrategy(parsed: ParsedSvg, pageIndex: number): Candidate[] | null {
  const byLayer = new Map<string, DrawItem[]>();
  for (const it of inkItems(parsed)) {
    if (!it.layerName) continue;
    const list = byLayer.get(it.layerName) ?? [];
    list.push(it);
    byLayer.set(it.layerName, list);
  }
  if (byLayer.size < 2) return null;
  const cands: Candidate[] = [...byLayer.entries()].map(([name, items]) => ({
    sourceRef: `layer-${name}`,
    pageIndex,
    bbox: itemsBbox(items) ?? { x: 0, y: 0, w: 0, h: 0 },
    items,
    strategy: 'layer' as SplitStrategy,
  }));
  return clean(cands);
}

/** c. Top-level groups — each <g> whose bbox does not overlap another. */
export function groupStrategy(parsed: ParsedSvg, pageIndex: number): Candidate[] | null {
  const byGroup = new Map<string, DrawItem[]>();
  for (const it of inkItems(parsed)) {
    if (!it.groupId) continue;
    const list = byGroup.get(it.groupId) ?? [];
    list.push(it);
    byGroup.set(it.groupId, list);
  }
  if (byGroup.size < 2) return null;
  const cands: Candidate[] = [...byGroup.entries()].map(([id, items]) => ({
    sourceRef: `group-${id}`,
    pageIndex,
    bbox: itemsBbox(items) ?? { x: 0, y: 0, w: 0, h: 0 },
    items,
    strategy: 'group' as SplitStrategy,
  }));
  return clean(cands);
}

/**
 * Connected components of a binary grid (4-connectivity). Returns a label
 * per cell (-1 = empty) and the component count.
 */
export function connectedComponents(grid: Uint8Array, cols: number, rows: number): { labels: Int32Array; count: number } {
  const labels = new Int32Array(cols * rows).fill(-1);
  let count = 0;
  const stack: number[] = [];
  for (let s = 0; s < cols * rows; s++) {
    if (!grid[s] || labels[s] >= 0) continue;
    labels[s] = count;
    stack.push(s);
    while (stack.length) {
      const cur = stack.pop()!;
      const cx = cur % cols;
      const cy = Math.floor(cur / cols);
      for (const [nx, ny] of [
        [cx - 1, cy],
        [cx + 1, cy],
        [cx, cy - 1],
        [cx, cy + 1],
      ]) {
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const ni = ny * cols + nx;
        if (grid[ni] && labels[ni] < 0) {
          labels[ni] = count;
          stack.push(ni);
        }
      }
    }
    count++;
  }
  return { labels, count };
}

/**
 * Raster mode (plan/08 step 3d): the grid comes from the page's ink
 * raster, not from vector bboxes — this is what splits bundles whose
 * artwork is raster (most bought VecFashion PDFs). Gaps > 2% of page
 * width separate garments; items (paths and image tiles) are mapped back
 * to the region their centre falls in.
 *
 * Method (the measured reference pipeline, ~/workspace/vecfashion-11006):
 * column/row ink profiles, not "any ink marks a cell" — a 20pt gap
 * straddles two 20pt cells that both hold view ink, so cell marking
 * bridges the gap and merges the views. A column counts as empty when it
 * holds <= eps ink pixels (eps = 0.2% of the region height, min 3);
 * a qualifying gap is >= 8pt wide with >= 3% of the region's ink on both
 * sides. Cuts recurse (vertical, then horizontal) so 2-D set layouts
 * split too. A density-thresholded connected-components pass is the
 * fallback when no clean gap exists.
 */
function rasterRegionRect(raster: PageRaster, page: BBox, region: BBox) {
  return {
    x0: Math.max(0, Math.floor(((region.x - page.x) / page.w) * raster.width)),
    x1: Math.min(raster.width, Math.ceil(((region.x + region.w - page.x) / page.w) * raster.width)),
    y0: Math.max(0, Math.floor(((region.y - page.y) / page.h) * raster.height)),
    y1: Math.min(raster.height, Math.ceil(((region.y + region.h - page.y) / page.h) * raster.height)),
  };
}

function regionInkTotal(raster: PageRaster, rect: { x0: number; x1: number; y0: number; y1: number }): number {
  let total = 0;
  for (let y = rect.y0; y < rect.y1; y++) {
    for (let x = rect.x0; x < rect.x1; x++) total += raster.ink[y * raster.width + x];
  }
  return total;
}

function regionInkBbox(raster: PageRaster, page: BBox, rect: { x0: number; x1: number; y0: number; y1: number }): BBox | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let y = rect.y0; y < rect.y1; y++) {
    for (let x = rect.x0; x < rect.x1; x++) {
      if (!raster.ink[y * raster.width + x]) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (!Number.isFinite(minX)) return null;
  return {
    x: page.x + (minX / raster.width) * page.w,
    y: page.y + (minY / raster.height) * page.h,
    w: ((maxX - minX + 1) / raster.width) * page.w,
    h: ((maxY - minY + 1) / raster.height) * page.h,
  };
}

/** Qualifying cut positions (in page units) along one axis of a region. */
function findGaps(
  raster: PageRaster,
  page: BBox,
  region: BBox,
  vertical: boolean,
): number[] {
  const rect = rasterRegionRect(raster, page, region);
  const total = regionInkTotal(raster, rect);
  if (total === 0) return [];
  const len = vertical ? rect.x1 - rect.x0 : rect.y1 - rect.y0;
  const perp = vertical ? rect.y1 - rect.y0 : rect.x1 - rect.x0;
  const eps = Math.max(3, Math.round(0.002 * perp));
  const profile = new Array<number>(len).fill(0);
  for (let i = 0; i < len; i++) {
    let sum = 0;
    if (vertical) {
      const x = rect.x0 + i;
      for (let y = rect.y0; y < rect.y1; y++) sum += raster.ink[y * raster.width + x];
    } else {
      const y = rect.y0 + i;
      for (let x = rect.x0; x < rect.x1; x++) sum += raster.ink[y * raster.width + x];
    }
    profile[i] = sum;
  }
  const ptPerPx = (vertical ? page.w : page.h) / (vertical ? raster.width : raster.height);
  const cuts: number[] = [];
  let runStart: number | null = null;
  const flush = (runEnd: number) => {
    if (runStart === null) return;
    const gapPt = (runEnd - runStart) * ptPerPx;
    if (gapPt >= 8) {
      const left = profile.slice(0, runStart).reduce((a, b) => a + b, 0);
      const right = profile.slice(runEnd).reduce((a, b) => a + b, 0);
      if (left >= total * 0.03 && right >= total * 0.03) {
        const cutPx = (runStart + runEnd - 1) / 2;
        cuts.push(
          vertical
            ? page.x + ((rect.x0 + cutPx) / raster.width) * page.w
            : page.y + ((rect.y0 + cutPx) / raster.height) * page.h,
        );
      }
    }
    runStart = null;
  };
  for (let i = 0; i < len; i++) {
    if (profile[i] <= eps) {
      if (runStart === null) runStart = i;
    } else {
      flush(i);
    }
  }
  flush(len);
  return cuts;
}

/** Slice a region by its clean gaps — ONE orientation only (vertical
 * preferred, else horizontal). The reference split of 130 VecFashion
 * files never needed a second level: a front view that stacks a hoodie
 * over joggers is ONE view, not two pieces, and recursing would split
 * it at the waist. A true 2-D grid layout (garments in rows AND columns)
 * is left for the review screen's Cut tool — see open items. */
function sliceRegion(
  raster: PageRaster,
  page: BBox,
  region: BBox,
): BBox[] {
  for (const vertical of [true, false]) {
    const cuts = findGaps(raster, page, region, vertical);
    if (cuts.length === 0) continue;
    const bounds = vertical
      ? [region.x, ...cuts, region.x + region.w]
      : [region.y, ...cuts, region.y + region.h];
    const out: BBox[] = [];
    for (let i = 0; i + 1 < bounds.length; i++) {
      out.push(
        vertical
          ? { x: bounds[i], y: region.y, w: bounds[i + 1] - bounds[i], h: region.h }
          : { x: region.x, y: bounds[i], w: region.w, h: bounds[i + 1] - bounds[i] },
      );
    }
    return out;
  }
  return [region];
}

/**
 * Density-thresholded connected components (fallback when no clean gap
 * exists): a cell counts as ink only when >= 5% of its pixels are ink,
 * so stray specks never bridge two garments.
 */
function componentsFromRaster(
  raster: PageRaster,
  page: BBox,
  region: BBox,
  gapFrac: number,
): BBox[] {
  const cell = Math.max(1, page.w * gapFrac);
  const rect = rasterRegionRect(raster, page, region);
  const cols = Math.max(1, Math.ceil((rect.x1 - rect.x0) / ((cell / page.w) * raster.width)));
  const rows = Math.max(1, Math.ceil((rect.y1 - rect.y0) / ((cell / page.h) * raster.height)));
  const cellWpx = (rect.x1 - rect.x0) / cols;
  const cellHpx = (rect.y1 - rect.y0) / rows;
  const grid = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = Math.floor(rect.x0 + c * cellWpx);
      const x1 = Math.min(rect.x1, Math.ceil(rect.x0 + (c + 1) * cellWpx));
      const y0 = Math.floor(rect.y0 + r * cellHpx);
      const y1 = Math.min(rect.y1, Math.ceil(rect.y0 + (r + 1) * cellHpx));
      let ink = 0;
      let total = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          total++;
          ink += raster.ink[y * raster.width + x];
        }
      }
      if (total > 0 && ink / total >= 0.05) grid[r * cols + c] = 1;
    }
  }
  const { labels, count } = connectedComponents(grid, cols, rows);
  const boxes: BBox[] = [];
  for (let k = 0; k < count; k++) {
    let minC = Infinity;
    let minR = Infinity;
    let maxC = -Infinity;
    let maxR = -Infinity;
    let cells = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (labels[r * cols + c] !== k) continue;
        cells++;
        if (c < minC) minC = c;
        if (r < minR) minR = r;
        if (c > maxC) maxC = c;
        if (r > maxR) maxR = r;
      }
    }
    if (cells < 2) continue;
    boxes.push({
      x: page.x + ((rect.x0 + minC * cellWpx) / raster.width) * page.w,
      y: page.y + ((rect.y0 + minR * cellHpx) / raster.height) * page.h,
      w: (((maxC - minC + 1) * cellWpx) / raster.width) * page.w,
      h: (((maxR - minR + 1) * cellHpx) / raster.height) * page.h,
    });
  }
  return boxes;
}

function clusterFromRaster(
  parsed: ParsedSvg,
  pageIndex: number,
  items: DrawItem[],
  raster: PageRaster,
  gapFrac: number,
  region?: BBox,
): Candidate[] | null {
  const page = parsed.viewBox;
  const bounds = region ?? page;
  let leaves = sliceRegion(raster, page, bounds);
  // A single leaf means no clean gap in this region — try the component
  // fallback before giving up.
  if (leaves.length < 2) {
    const compBoxes = componentsFromRaster(raster, page, bounds, gapFrac);
    if (compBoxes.length >= 2) leaves = compBoxes;
  }
  if (leaves.length < 2) return null;
  const leafBoxes: BBox[] = [];
  for (const leaf of leaves) {
    const inkBox = regionInkBbox(raster, page, rasterRegionRect(raster, page, leaf));
    if (inkBox && inkBox.w > 0 && inkBox.h > 0) leafBoxes.push(inkBox);
  }
  if (leafBoxes.length < 2) return null;
  // Assign items by bbox centre; fall back to the nearest leaf box.
  const byLeaf = new Map<number, DrawItem[]>();
  for (const it of items) {
    const b = itemBbox(it);
    if (!b) continue;
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    let id = leafBoxes.findIndex((box) => cx >= box.x && cx <= box.x + box.w && cy >= box.y && cy <= box.y + box.h);
    if (id < 0) {
      let best = -1;
      let bestD = Infinity;
      for (let k = 0; k < leafBoxes.length; k++) {
        const box = leafBoxes[k];
        const dx = Math.max(0, Math.max(box.x - cx, cx - (box.x + box.w)));
        const dy = Math.max(0, Math.max(box.y - cy, cy - (box.y + box.h)));
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = k;
        }
      }
      id = best;
    }
    if (id < 0) continue;
    const list = byLeaf.get(id) ?? [];
    list.push(it);
    byLeaf.set(id, list);
  }
  const cands: Candidate[] = leafBoxes.map((box, i) => ({
    sourceRef: `cluster-${i + 1}`,
    pageIndex,
    bbox: box,
    items: byLeaf.get(i) ?? [],
    strategy: 'cluster',
    raster,
    pageBbox: page,
  }));
  cands.sort((a, b) => a.bbox.x - b.bbox.x || a.bbox.y - b.bbox.y);
  return cands;
}

/**
 * d. Spatial clustering — for flattened files: rasterize at low res, find
 * connected regions (gaps > 2% of page width separate garments), map paths
 * back to the region they fall in (plan/08 step 3d).
 *
 * Implemented without a raster: path bboxes occupy a coarse grid (cell =
 * 2% of page width); 4-connected occupied cells form a region; an item
 * belongs to the region its bbox centre falls in. The 2% gap rule is the
 * measured VecFashion rule (genuine inter-view gaps >= 11.5pt on a
 * 1000pt page; intra-view whitespace <= 6.5pt — reference pipeline).
 */
export function clusterStrategy(
  parsed: ParsedSvg,
  pageIndex: number,
  itemsIn?: DrawItem[],
  gapFrac = 0.02,
  raster?: PageRaster,
  region?: BBox,
): Candidate[] | null {
  const items = itemsIn ?? parsed.items.filter((it) => it.kind !== 'text');
  if (raster) return clusterFromRaster(parsed, pageIndex, items, raster, gapFrac, region);
  const ink = itemsIn ?? inkItems(parsed);
  if (ink.length === 0) return null;
  const page = parsed.viewBox;
  const cell = Math.max(1, page.w * gapFrac);
  const cols = Math.max(1, Math.ceil(page.w / cell));
  const rows = Math.max(1, Math.ceil(page.h / cell));
  const grid = new Uint8Array(cols * rows);
  for (const it of ink) {
    const b = itemBbox(it);
    if (!b) continue;
    const c0 = Math.max(0, Math.floor((b.x - page.x) / cell));
    const c1 = Math.min(cols - 1, Math.floor((b.x + b.w - page.x) / cell));
    const r0 = Math.max(0, Math.floor((b.y - page.y) / cell));
    const r1 = Math.min(rows - 1, Math.floor((b.y + b.h - page.y) / cell));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) grid[r * cols + c] = 1;
    }
  }
  // Connected components, 4-connectivity.
  const { labels: comp, count: nComp } = connectedComponents(grid, cols, rows);
  if (nComp < 2) return null;
  // Assign each item to the component its bbox centre falls in.
  const byComp = new Map<number, DrawItem[]>();
  for (const it of ink) {
    const b = itemBbox(it);
    if (!b) continue;
    const cx = Math.min(cols - 1, Math.max(0, Math.floor((b.x + b.w / 2 - page.x) / cell)));
    const cy = Math.min(rows - 1, Math.max(0, Math.floor((b.y + b.h / 2 - page.y) / cell)));
    const ci = comp[cy * cols + cx];
    if (ci < 0) continue;
    const list = byComp.get(ci) ?? [];
    list.push(it);
    byComp.set(ci, list);
  }
  // Drop dust: a region holding < 3% of the items is a label/logo fragment.
  const total = ink.length;
  const cands: Candidate[] = [...byComp.entries()]
    .filter(([, list]) => list.length >= Math.max(1, Math.round(total * 0.03)))
    .sort((a, b) => {
      const ba = itemsBbox(a[1]) ?? { x: 0, y: 0, w: 0, h: 0 };
      const bb = itemsBbox(b[1]) ?? { x: 0, y: 0, w: 0, h: 0 };
      return ba.x - bb.x || ba.y - bb.y;
    })
    .map(([ci, list], idx) => ({
      sourceRef: `cluster-${idx + 1}`,
      pageIndex,
      bbox: itemsBbox(list) ?? { x: 0, y: 0, w: 0, h: 0 },
      items: list,
      strategy: 'cluster' as SplitStrategy,
    }));
  return cands.length >= 2 ? cands : null;
}

/**
 * View-split inside one candidate: a garment candidate (e.g. a top-level
 * group holding front + back) still needs one piece per view. Same 2% gap
 * rule, restricted to the candidate's own items. A raster candidate
 * view-splits on its raster too.
 */
export function viewSplit(candidate: Candidate, page: ParsedSvg): Candidate[] {
  // A raster candidate view-splits inside its own region only — the raster
  // clusterer works page-wide, so without the region it would return every
  // view on the page for every candidate.
  const sub = clusterStrategy(page, candidate.pageIndex, candidate.items, 0.02, candidate.raster, candidate.bbox);
  if (!sub || sub.length < 2) return [candidate];
  return sub.map((s, i) => ({
    ...s,
    sourceRef: `${candidate.sourceRef}/view-${i + 1}`,
    strategy: candidate.strategy,
  }));
}
