// split/rebuild.ts — rebuild each piece into the 7-layer standard
// (plan/08 step 5): silhouette, seams, stitches, trims, print_areas,
// callouts (empty until POMs are mapped), shading (empty).
//
// Silhouette = boolean union of all filled closed paths, keep the largest
// outer ring. Without paper.js/Clipper in this repo, the union is done as
// a raster mask (largest connected component of filled cells) traced with
// marching squares and simplified (Douglas–Peucker) — the plan's own
// raster-trace fallback, used as the primary method. If the trace
// degenerates, the bbox rect is the fallback (flagged in the piece).
//
// Dashed strokes → stitches; other interior strokes → seams; small closed
// shapes near edges (buttons, zipper pulls, labels) → trims. Anything
// unclassified stays in seams so nothing is lost.
//
// Print areas start from the category defaults (plan/08: tee front chest
// 300 × 400 mm), shown for staff to drag into place; here they are placed
// centred and shrunk until all four corners sit inside the silhouette, so
// every rebuilt piece can pass the 7-layer validator once scaled to mm.

import type { BBox, PageRaster, PieceView } from './types';
import type { DrawItem } from './svg';
import { bboxOfPoints } from './svg';

export interface RebuiltPiece {
  /** SVG in source units (viewBox 0 0 w h). Scale to mm with scaleSvgToMm. */
  svg: string;
  silhouettePoints: [number, number][];
  printArea: { area: string; x: number; y: number; w: number; h: number };
  silhouetteSource: 'union-trace' | 'bbox-fallback';
  counts: { silhouettePaths: number; seams: number; stitches: number; trims: number };
}

type Pt = [number, number];

const r1 = (n: number) => Math.round(n * 10) / 10;

function pointInPolygon(p: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function polyPointsToD(pts: Pt[]): string {
  return `M ${pts.map(([x, y]) => `${r1(x)} ${r1(y)}`).join(' L ')} Z`;
}

function itemsToPathD(items: DrawItem[], origin: Pt): string[] {
  const ds: string[] = [];
  for (const it of items) {
    if (it.points.length < 2) continue;
    const local = it.points.map(([x, y]): Pt => [x - origin[0], y - origin[1]]);
    ds.push(`M ${local.map(([x, y]) => `${r1(x)} ${r1(y)}`).join(' L ')}${it.closed ? ' Z' : ''}`);
  }
  return ds;
}

/** Connected-component labelling of a binary mask (4-connectivity). */
function labelComponents(mask: Uint8Array, cols: number, rows: number): { labels: Int32Array; sizes: number[] } {
  const labels = new Int32Array(cols * rows).fill(-1);
  const sizes: number[] = [];
  const stack: number[] = [];
  for (let s = 0; s < cols * rows; s++) {
    if (!mask[s] || labels[s] >= 0) continue;
    const id = sizes.length;
    let size = 0;
    labels[s] = id;
    stack.push(s);
    while (stack.length) {
      const cur = stack.pop()!;
      size++;
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
        if (mask[ni] && labels[ni] < 0) {
          labels[ni] = id;
          stack.push(ni);
        }
      }
    }
    sizes.push(size);
  }
  return { labels, sizes };
}

/** Largest connected component of a binary mask (4-connectivity). */
function largestComponent(mask: Uint8Array, cols: number, rows: number): Uint8Array {
  const { labels, sizes } = labelComponents(mask, cols, rows);
  let best = 0;
  for (let i = 1; i < sizes.length; i++) if (sizes[i] > sizes[best]) best = i;
  const out = new Uint8Array(cols * rows);
  for (let i = 0; i < cols * rows; i++) if (labels[i] === best) out[i] = 1;
  return out;
}

/** Marching-squares contour of a binary mask, longest loop kept. */
function traceContour(mask: Uint8Array, cols: number, rows: number): Pt[] {
  // Sample points live on grid nodes; a cell is "inside" when its centre
  // cell is filled. Build a node grid (cols+1) x (rows+1) from cell values.
  const key = (p: Pt) => `${p[0].toFixed(3)},${p[1].toFixed(3)}`;
  interface Seg {
    a: Pt;
    b: Pt;
  }
  const segs: Seg[] = [];
  const at = (c: number, r: number): number =>
    c < 0 || r < 0 || c >= cols || r >= rows ? 0 : mask[r * cols + c];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tl = at(c, r);
      const tr = at(c + 1, r);
      const br = at(c + 1, r + 1);
      const bl = at(c, r + 1);
      const idx = (tl ? 8 : 0) | (tr ? 4 : 0) | (br ? 2 : 0) | (bl ? 1 : 0);
      if (idx === 0 || idx === 15) continue;
      // Edge midpoints (node coordinates).
      const top: Pt = [c + 0.5, r];
      const right: Pt = [c + 1, r + 0.5];
      const bottom: Pt = [c + 0.5, r + 1];
      const left: Pt = [c, r + 0.5];
      const add = (a: Pt, b: Pt) => segs.push({ a, b });
      switch (idx) {
        case 1: case 14: add(left, bottom); break;
        case 2: case 13: add(bottom, right); break;
        case 3: case 12: add(left, right); break;
        case 4: case 11: add(top, right); break;
        // Saddle cells: each segment hugs ONE filled corner, so the
        // contour follows the filled region (the opposite pairing traces
        // the empty region and splits the outer loop).
        case 5: add(top, right); add(left, bottom); break;
        case 6: case 9: add(top, bottom); break;
        case 7: case 8: add(left, top); break;
        case 10: add(top, left); add(bottom, right); break;
        default: break;
      }
    }
  }
  if (segs.length === 0) return [];
  // Stitch segments into loops. Marching-squares segments are not
  // consistently oriented, so the adjacency is undirected: from the
  // current point take any unused segment touching it, and append its
  // other end.
  const byPoint = new Map<string, Seg[]>();
  for (const s of segs) {
    for (const p of [s.a, s.b]) {
      const k = key(p);
      const list = byPoint.get(k) ?? [];
      list.push(s);
      byPoint.set(k, list);
    }
  }
  const otherEnd = (s: Seg, p: Pt): Pt => (key(s.a) === key(p) ? s.b : s.a);
  const used = new Set<Seg>();
  let bestLoop: Pt[] = [];
  for (const seed of segs) {
    if (used.has(seed)) continue;
    const loop: Pt[] = [seed.a, seed.b];
    used.add(seed);
    let guard = 0;
    while (guard++ < segs.length + 2) {
      const last = loop[loop.length - 1];
      const next = (byPoint.get(key(last)) ?? []).find((s) => !used.has(s));
      if (!next) break;
      used.add(next);
      loop.push(otherEnd(next, last));
      if (key(loop[loop.length - 1]) === key(loop[0])) break;
    }
    if (loop.length > bestLoop.length) bestLoop = loop;
  }
  return bestLoop;
}

/** Douglas–Peucker simplification of a closed polyline. */
function simplifyClosed(pts: Pt[], tol: number): Pt[] {
  if (pts.length < 4) return pts;
  const open = pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1] ? pts.slice(0, -1) : [...pts];
  const keep = new Uint8Array(open.length);
  keep[0] = 1;
  keep[open.length - 1] = 1;
  const stack: [number, number][] = [[0, open.length - 1]];
  const distToSeg = (p: Pt, a: Pt, b: Pt): number => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy || 1;
    let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
  };
  while (stack.length) {
    const [s, e] = stack.pop()!;
    let maxD = 0;
    let maxI = -1;
    for (let i = s + 1; i < e; i++) {
      const d = distToSeg(open[i], open[s], open[e]);
      if (d > maxD) {
        maxD = d;
        maxI = i;
      }
    }
    if (maxI >= 0 && maxD > tol) {
      keep[maxI] = 1;
      stack.push([s, maxI], [maxI, e]);
    }
  }
  return open.filter((_, i) => keep[i]);
}

function rasterizeMask(
  filled: DrawItem[],
  bbox: BBox,
): { mask: Uint8Array; cols: number; rows: number; cw: number; ch: number } {
  const polys = filled.map((it) => it.points).filter((p) => p.length >= 3);
  const longSide = Math.max(bbox.w, bbox.h);
  const res = Math.max(60, Math.min(240, Math.round(longSide / 2)));
  const cols = Math.max(8, Math.round((bbox.w / longSide) * res));
  const rows = Math.max(8, Math.round((bbox.h / longSide) * res));
  const cw = bbox.w / cols;
  const ch = bbox.h / rows;
  const mask = new Uint8Array(cols * rows);
  // Path bboxes are computed ONCE — the inner loop is per cell, and
  // recomputing them there made real VecFashion pages (1000+ paths)
  // minutes slow.
  const boxes = polys.map((poly) => ({ poly, box: bboxOfPoints(poly)! }));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const px: Pt = [bbox.x + (c + 0.5) * cw, bbox.y + (r + 0.5) * ch];
      for (const { poly, box } of boxes) {
        if (px[0] < box.x || px[0] > box.x + box.w || px[1] < box.y || px[1] > box.y + box.h) continue;
        if (pointInPolygon(px, poly)) {
          mask[r * cols + c] = 1;
          break;
        }
      }
    }
  }
  return { mask, cols, rows, cw, ch };
}

// Exported for unit tests / debugging the trace only.
export { rasterizeMask, largestComponent, traceContour };

function traceSilhouette(
  filled: DrawItem[],
  bbox: BBox,
): { points: Pt[]; source: 'union-trace' | 'bbox-fallback'; extraOutlines: Pt[][] } {
  const fallback = (): { points: Pt[]; source: 'bbox-fallback'; extraOutlines: Pt[][] } => ({
    points: [
      [bbox.x, bbox.y],
      [bbox.x + bbox.w, bbox.y],
      [bbox.x + bbox.w, bbox.y + bbox.h],
      [bbox.x, bbox.y + bbox.h],
    ],
    source: 'bbox-fallback',
    extraOutlines: [],
  });
  const polys = filled.map((it) => it.points).filter((p) => p.length >= 3);
  if (polys.length === 0) return fallback();
  const { mask, cols, rows } = rasterizeMask(filled, bbox);
  const traced = traceMaskToOutlines(mask, cols, rows, bbox);
  if (!traced) return fallback();
  return { points: traced.main, source: 'union-trace', extraOutlines: traced.extra };
}

/**
 * Trace a binary mask (cols×rows over `bbox`) into outlines: the largest
 * component is the silhouette; smaller ones are kept as extra outlines.
 * Shared by the vector path (mask from filled paths) and the raster path
 * (mask from the page ink raster). Returns null when nothing traces.
 */
export function traceMaskToOutlines(
  mask: Uint8Array,
  cols: number,
  rows: number,
  bbox: BBox,
): { main: Pt[]; extra: Pt[][] } | null {
  const { labels, sizes } = labelComponents(mask, cols, rows);
  if (sizes.length === 0) return null;
  const order = sizes.map((_, i) => i).sort((a, b) => sizes[b] - sizes[a]);
  const longSide = Math.max(bbox.w, bbox.h);
  const cellW = bbox.w / cols;
  const cellH = bbox.h / rows;
  const tol = Math.max(1, longSide * 0.01);
  // Trace one component (by id) with the padded-border rule; returns the
  // simplified ring in page coords, or [] when it degenerates.
  const traceOne = (id: number): Pt[] => {
    const comp = new Uint8Array(cols * rows);
    for (let i = 0; i < cols * rows; i++) if (labels[i] === id) comp[i] = 1;
    // Pad with a 1-cell empty border: when the silhouette touches the bbox
    // edge, its contour runs along the grid boundary, and marching squares
    // over the unpadded grid never emits those boundary segments — the loop
    // comes back open and the outline loses a whole side.
    const pcols = cols + 2;
    const prows = rows + 2;
    const padded = new Uint8Array(pcols * prows);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (comp[r * cols + c]) padded[(r + 1) * pcols + (c + 1)] = 1;
      }
    }
    const loop = traceContour(padded, pcols, prows);
    if (loop.length < 8) return [];
    const pts = simplifyClosed(
      loop.map(([gx, gy]): Pt => [
        Math.min(bbox.x + bbox.w, Math.max(bbox.x, bbox.x + (gx - 1) * cellW)),
        Math.min(bbox.y + bbox.h, Math.max(bbox.y, bbox.y + (gy - 1) * cellH)),
      ]),
      tol,
    );
    if (pts.length < 3) return [];
    const ring = pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1] ? pts.slice(0, -1) : pts;
    return ring;
  };
  const main = traceOne(order[0]);
  if (main.length < 3) return null;
  // Smaller components (a detached sleeve, a second garment in a merged
  // piece) are kept as seam outlines so nothing is silently lost — the
  // silhouette layer itself stays a single path (validator rule).
  const extra: Pt[][] = [];
  const mainSize = sizes[order[0]];
  for (const id of order.slice(1)) {
    if (sizes[id] < mainSize * 0.005) continue; // dust
    const ring = traceOne(id);
    if (ring.length >= 3) extra.push(ring);
  }
  return { main, extra };
}

/**
 * Downsample a page ink raster to a trace grid over one piece bbox, then
 * trace it. The raster path for bundles whose artwork is raster (most
 * bought VecFashion PDFs): the silhouette is the ink outline, not a
 * vector union.
 */
export function traceRasterToOutlines(
  raster: PageRaster,
  pageBbox: BBox,
  pieceBbox: BBox,
): { main: Pt[]; extra: Pt[][] } | null {
  const longSide = Math.max(pieceBbox.w, pieceBbox.h);
  const res = Math.max(60, Math.min(240, Math.round(longSide / 2)));
  const cols = Math.max(8, Math.round((pieceBbox.w / longSide) * res));
  const rows = Math.max(8, Math.round((pieceBbox.h / longSide) * res));
  const mask = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const px = pieceBbox.x + ((c + 0.5) / cols) * pieceBbox.w;
      const py = pieceBbox.y + ((r + 0.5) / rows) * pieceBbox.h;
      const rx = Math.min(raster.width - 1, Math.max(0, Math.floor(((px - pageBbox.x) / pageBbox.w) * raster.width)));
      const ry = Math.min(raster.height - 1, Math.max(0, Math.floor(((py - pageBbox.y) / pageBbox.h) * raster.height)));
      if (raster.ink[ry * raster.width + rx]) mask[r * cols + c] = 1;
    }
  }
  return traceMaskToOutlines(mask, cols, rows, pieceBbox);
}

function sortLayers(items: DrawItem[], bbox: BBox): {
  filled: DrawItem[];
  seams: DrawItem[];
  stitches: DrawItem[];
  trims: DrawItem[];
} {
  const filled: DrawItem[] = [];
  const seams: DrawItem[] = [];
  const stitches: DrawItem[] = [];
  const trims: DrawItem[] = [];
  const pieceArea = Math.max(1, bbox.w * bbox.h);
  for (const it of items) {
    if (it.kind === 'text' || it.kind === 'image') continue;
    const b = bboxOfPoints(it.points);
    const area = b ? b.w * b.h : 0;
    const isSmall = area > 0 && area < pieceArea * 0.02;
    const nearEdge =
      !!b &&
      (b.x - bbox.x < bbox.w * 0.12 ||
        bbox.x + bbox.w - (b.x + b.w) < bbox.w * 0.12 ||
        b.y - bbox.y < bbox.h * 0.12 ||
        bbox.y + bbox.h - (b.y + b.h) < bbox.h * 0.12);
    if (it.closed && (it.fill || it.stroke) && b) {
      // Filled OR stroked closed paths build the silhouette mask — the
      // outline of a VecFashion flat is often stroke-only. Small edge
      // shapes (buttons, labels) are trims instead.
      if (isSmall && nearEdge) trims.push(it);
      else filled.push(it);
      continue;
    }
    if (it.stroke && it.dashed) {
      stitches.push(it);
      continue;
    }
    if (it.stroke) {
      if (isSmall && nearEdge && it.closed) trims.push(it);
      else seams.push(it);
      continue;
    }
    // Anything unclassified stays in seams so nothing is lost (plan/08).
    seams.push(it);
  }
  return { filled, seams, stitches, trims };
}

function placePrintArea(
  view: PieceView,
  category: string,
  silhouetteLocal: Pt[],
  bboxLocal: BBox,
): { area: string; x: number; y: number; w: number; h: number } {
  // Default mm size is scaled to source units by the piece's own scale:
  // until calibrated, place the rect as a fraction of the silhouette box
  // (55% wide, 45% tall, centred, top at 20%) — at accept time
  // calibratePiece clamps it to the category default in mm.
  void category;
  let w = bboxLocal.w * 0.55;
  let h = bboxLocal.h * 0.45;
  let x = bboxLocal.x + (bboxLocal.w - w) / 2;
  let y = bboxLocal.y + bboxLocal.h * 0.2;
  const inside = (rx: number, ry: number, rw: number, rh: number) =>
    pointInPolygon([rx, ry], silhouetteLocal) &&
    pointInPolygon([rx + rw, ry], silhouetteLocal) &&
    pointInPolygon([rx, ry + rh], silhouetteLocal) &&
    pointInPolygon([rx + rw, ry + rh], silhouetteLocal);
  for (let i = 0; i < 12 && !inside(x, y, w, h); i++) {
    w *= 0.9;
    h *= 0.9;
    x = bboxLocal.x + (bboxLocal.w - w) / 2;
    y = bboxLocal.y + bboxLocal.h * 0.2;
  }
  if (!inside(x, y, w, h)) {
    // Last resort: inset rect, guaranteed inside any convex-ish outline.
    const m = 0.12;
    x = bboxLocal.x + bboxLocal.w * m;
    y = bboxLocal.y + bboxLocal.h * m;
    w = bboxLocal.w * (1 - 2 * m);
    h = bboxLocal.h * (1 - 2 * m);
  }
  return { area: view, x: r1(x), y: r1(y), w: r1(w), h: r1(h) };
}

/**
 * Rebuild one piece's items into a 7-layer SVG in source units.
 * Coordinates are local to the piece bbox (viewBox 0 0 w h).
 * With `opts.raster` (a page whose artwork is raster) the silhouette is
 * traced from the ink raster instead of the vector union, and the piece's
 * image tiles are kept in the shading layer, windowed by the viewBox, so
 * the piece still shows the artwork.
 */
export function rebuildPiece(
  items: DrawItem[],
  bbox: BBox,
  view: PieceView,
  category: string,
  opts: { raster?: PageRaster; pageBbox?: BBox } = {},
): RebuiltPiece {
  const { filled, seams, stitches, trims } = sortLayers(items, bbox);
  let traced: { points: Pt[]; source: 'union-trace' | 'bbox-fallback'; extraOutlines: Pt[][] };
  if (opts.raster && opts.pageBbox) {
    const fromRaster = traceRasterToOutlines(opts.raster, opts.pageBbox, bbox);
    traced = fromRaster
      ? { points: fromRaster.main, source: 'union-trace', extraOutlines: fromRaster.extra }
      : traceSilhouette(filled, bbox);
  } else {
    traced = traceSilhouette(filled, bbox);
  }
  const origin: Pt = [bbox.x, bbox.y];
  const silhouetteLocal = traced.points.map(([x, y]): Pt => [x - origin[0], y - origin[1]]);
  // The print area is placed inside the SILHOUETTE's own box, not the
  // piece bbox: in a merged piece the silhouette is one garment of two,
  // and a rect centred on the whole piece would land in the gap between
  // them, outside every outline.
  const silBox = bboxOfPoints(silhouetteLocal) ?? { x: 0, y: 0, w: bbox.w, h: bbox.h };
  const printArea = placePrintArea(view, category, silhouetteLocal, silBox);
  const seamDs = itemsToPathD(seams, origin);
  // Outlines of smaller mask components (detached sleeve, second garment
  // in a merged piece) stay visible as seam lines — nothing is lost.
  for (const ring of traced.extraOutlines) {
    const local = ring.map(([x, y]): Pt => [x - origin[0], y - origin[1]]);
    seamDs.push(polyPointsToD(local));
  }
  // Raster tiles of the piece, kept in the shading layer and shifted into
  // local coordinates so the piece still shows the artwork (the viewBox
  // windows them to the piece, exactly like the reference windowed SVGs).
  const imageTags = items
    .filter((it) => it.kind === 'image')
    .map((it) => it.raw);
  const shading =
    imageTags.length > 0
      ? `<g transform="translate(${r1(-origin[0])} ${r1(-origin[1])})">${imageTags.join('')}</g>`
      : '';
  const stitchDs = itemsToPathD(stitches, origin);
  const trimDs = itemsToPathD(trims, origin);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${r1(bbox.w)} ${r1(bbox.h)}" width="${r1(bbox.w)}" height="${r1(bbox.h)}" data-view="${view}" data-category="${category}">` +
    `<g id="silhouette"><path d="${polyPointsToD(silhouetteLocal)}" fill="#ffffff" stroke="#111111" stroke-width="1.5"/></g>` +
    `<g id="seams" fill="none" stroke="#111111" stroke-width="1">${seamDs.map((d) => `<path d="${d}"/>`).join('')}</g>` +
    `<g id="stitches" fill="none" stroke="#111111" stroke-width="0.8" stroke-dasharray="4 3">${stitchDs.map((d) => `<path d="${d}"/>`).join('')}</g>` +
    `<g id="trims" fill="none" stroke="#111111" stroke-width="1.2">${trimDs.map((d) => `<path d="${d}"/>`).join('')}</g>` +
    `<g id="print_areas"><rect data-area="${printArea.area}" x="${printArea.x}" y="${printArea.y}" width="${printArea.w}" height="${printArea.h}" fill="none" stroke="#2563eb" stroke-width="1.5" stroke-dasharray="6 4"/></g>` +
    `<g id="callouts"></g>` +
    `<g id="shading">${shading}</g>` +
    `</svg>`;
  return {
    svg,
    silhouettePoints: silhouetteLocal,
    printArea,
    silhouetteSource: traced.source,
    counts: {
      silhouettePaths: filled.length,
      seams: seamDs.length,
      stitches: stitchDs.length,
      trims: trimDs.length,
    },
  };
}

/**
 * Re-express a rebuilt piece SVG in real mm: every coordinate is multiplied
 * by `mmPerUnit` and width/height gain the mm suffix the 7-layer validator
 * requires. Only works on rebuildPiece output (M/L path data, rects, plain
 * viewBox — no transforms, no curves).
 */
export function scaleSvgToMm(svg: string, mmPerUnit: number): string {
  const scaleNums = (d: string) =>
    d.replace(/-?\d*\.?\d+/g, (n) => String(r1(Number(n) * mmPerUnit)));
  let out = svg.replace(/d="([^"]*)"/g, (_m, d: string) => `d="${scaleNums(d)}"`);
  out = out.replace(/viewBox="([^"]*)"/, (_m, vb: string) => `viewBox="${scaleNums(vb)}"`);
  out = out.replace(/<rect([^>]*)>/g, (m) =>
    m
      .replace(/\bx="([\d.]+)"/, (_a, v: string) => `x="${r1(Number(v) * mmPerUnit)}"`)
      .replace(/\by="([\d.]+)"/, (_a, v: string) => `y="${r1(Number(v) * mmPerUnit)}"`)
      .replace(/width="([\d.]+)"/, (_a, v: string) => `width="${r1(Number(v) * mmPerUnit)}"`)
      .replace(/height="([\d.]+)"/, (_a, v: string) => `height="${r1(Number(v) * mmPerUnit)}"`),
  );
  // Raster tiles in the shading layer scale with everything else, or the
  // artwork would render at source size inside the mm piece.
  out = out.replace(/<image([^>]*)>/g, (m) =>
    m
      .replace(/\bx="([\d.-]+)"/, (_a, v: string) => `x="${r1(Number(v) * mmPerUnit)}"`)
      .replace(/\by="([\d.-]+)"/, (_a, v: string) => `y="${r1(Number(v) * mmPerUnit)}"`)
      .replace(/width="([\d.]+)"/, (_a, v: string) => `width="${r1(Number(v) * mmPerUnit)}"`)
      .replace(/height="([\d.]+)"/, (_a, v: string) => `height="${r1(Number(v) * mmPerUnit)}"`),
  );
  // The shading wrapper's translate (local-coordinate shift) scales too.
  out = out.replace(/transform="translate\(([-\d.]+) ([-\d.]+)\)"/g, (_m, x: string, y: string) => {
    const tx = r1(Number(x) * mmPerUnit);
    const ty = r1(Number(y) * mmPerUnit);
    return `transform="translate(${tx} ${ty})"`;
  });
  out = out.replace(
    /<svg([^>]*)width="([\d.]+)" height="([\d.]+)"/,
    (_m, pre: string, w: string, h: string) =>
      `<svg${pre}width="${r1(Number(w) * mmPerUnit)}mm" height="${r1(Number(h) * mmPerUnit)}mm"`,
  );
  return out;
}

/** Print-area rect of a rebuilt piece, in mm at the given scale. */
export function printAreaMm(
  rebuilt: RebuiltPiece,
  mmPerUnit: number,
): { area: string; x: number; y: number; w: number; h: number } {
  const p = rebuilt.printArea;
  return {
    area: p.area,
    x: r1(p.x * mmPerUnit),
    y: r1(p.y * mmPerUnit),
    w: r1(p.w * mmPerUnit),
    h: r1(p.h * mmPerUnit),
  };
}
