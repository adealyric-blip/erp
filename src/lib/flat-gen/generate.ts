// Parametric flat generator — plan/08_FLAT_LIBRARY.md.
// Block (base-size measurements, mm) + style options -> one SVG per view,
// viewBox = real mm, with the 7 fixed layer ids. No DOM, no dependencies.
// Silhouettes are single closed polylines (neck/hood curves sampled), so the
// 7-layer validator can check print-area containment exactly.
import type {
  BlankDefinition,
  Block,
  GeneratedFlat,
  GeneratedView,
  PrintAreaRect,
  StyleOptions,
  ViewName,
} from './types';

export const GENERATOR_VERSION = 'flat-gen/1';

type Pt = [number, number];

const r1 = (n: number) => Math.round(n * 10) / 10;

function poly(points: Pt[]): string {
  const [first, ...rest] = points;
  return `M ${r1(first[0])} ${r1(first[1])} ` + rest.map(([x, y]) => `L ${r1(x)} ${r1(y)}`).join(' ') + ' Z';
}

/** Sample a quadratic bezier (p0 -> p2, control p1) into n points. */
function quad(p0: Pt, p1: Pt, p2: Pt, n = 8): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = (1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0];
    const y = (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1];
    out.push([x, y]);
  }
  return out;
}

function bbox(points: Pt[]): { x: number; y: number; w: number; h: number } {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

// ---------------------------------------------------------------------
// Silhouettes (single closed path each)
// ---------------------------------------------------------------------

interface TorsoGeom {
  points: Pt[];
  w: number;
  h: number;
  cx: number;
  neckL: Pt;
  neckR: Pt;
  shoulderL: Pt;
  shoulderR: Pt;
  underarmY: number;
  hemY: number;
}

function torsoGeom(block: Block, style: StyleOptions, back: boolean): TorsoGeom {
  const W = Math.max(block.chestMm, block.hemMm);
  const H = block.bodyLengthMm;
  const cx = W / 2;
  const shoulderHalf = block.shoulderMm / 2;
  const neckHalf = block.neckWidthMm / 2;
  const shoulderY = style.sleeve === 'drop' ? 42 : 18;
  const underarmY = Math.round(H * 0.28);
  const sideX = (W - block.chestMm) / 2;
  const hemX = (W - block.hemMm) / 2;
  const neckDepth =
    style.neck === 'v' && !back ? 55 : style.neck === 'mock' ? 8 : back ? 12 : style.neck === 'hood' ? 20 : 28;
  const neckL: Pt = [cx - neckHalf, neckDepth];
  const neckR: Pt = [cx + neckHalf, neckDepth];
  const shoulderL: Pt = [cx - shoulderHalf, shoulderY];
  const shoulderR: Pt = [cx + shoulderHalf, shoulderY];
  const dip = style.neck === 'v' && !back ? 62 : back ? 16 : 34;
  // Neck curve from right neck point back to the left one, dipping down.
  const neckCurve = quad(neckR, [cx, neckDepth + dip * 2], neckL, 10).slice(1, -1);
  const points: Pt[] = [
    neckL,
    shoulderL,
    [sideX, underarmY],
    [hemX, H],
    [W - hemX, H],
    [W - sideX, underarmY],
    shoulderR,
    neckR,
    ...neckCurve,
  ];
  return { points, w: W, h: H, cx, neckL, neckR, shoulderL, shoulderR, underarmY, hemY: H };
}

function sleeveGeom(block: Block): { points: Pt[]; w: number; h: number } {
  const topW = block.sleeveWidthMm * 1.5;
  const cuffW = block.sleeveWidthMm;
  const L = block.sleeveLengthMm;
  const topCurve = quad([0, 0], [topW / 2, -14], [topW, 0], 6).slice(1, -1);
  const points: Pt[] = [
    [0, 0],
    ...topCurve,
    [topW, 0],
    [(topW + cuffW) / 2, L],
    [(topW - cuffW) / 2, L],
  ];
  return { points, w: topW, h: L };
}

function hoodGeom(block: Block): { points: Pt[]; w: number; h: number } {
  const w = block.neckWidthMm * 2;
  const h = 300;
  const points: Pt[] = [
    [0, h],
    [w * 0.03, h * 0.4],
    [w * 0.2, h * 0.1],
    [w * 0.5, 0],
    [w * 0.8, h * 0.1],
    [w * 0.97, h * 0.4],
    [w, h],
  ];
  return { points, w, h };
}

function pantsGeom(block: Block): { points: Pt[]; w: number; h: number; crotchY: number; cx: number } {
  const waist = block.waistMm ?? block.chestMm;
  const hip = block.chestMm;
  const H = block.outseamMm ?? block.bodyLengthMm;
  const I = block.inseamMm ?? H * 0.75;
  const crotchY = H - I;
  const legHem = block.hemMm;
  const W = Math.max(hip, 2 * legHem + 10);
  const cx = W / 2;
  const points: Pt[] = [
    [cx - waist / 2, 0],
    [cx + waist / 2, 0],
    [cx + hip / 2, 200],
    [cx + legHem + 5, H],
    [cx + 5, H],
    [cx + 5, crotchY],
    [cx, crotchY - 18],
    [cx - 5, crotchY],
    [cx - 5, H],
    [cx - legHem - 5, H],
    [cx - hip / 2, 200],
  ];
  return { points, w: W, h: H, crotchY, cx };
}

function capGeom(view: ViewName, block: Block): { points: Pt[]; w: number; h: number } {
  const w = 200;
  const h = block.crownHeightMm ?? 150;
  const visor = block.visorLengthMm ?? 80;
  if (view === 'side') {
    const points: Pt[] = [
      [0, h + 18],
      [5, h * 0.4],
      [50, h * 0.07],
      [100, 0],
      [150, h * 0.07],
      [195, h * 0.4],
      [200, h],
      [200 + visor, h + 8],
      [205, h + 16],
      [0, h + 18],
    ];
    return { points, w: 200 + visor, h: h + 18 };
  }
  const points: Pt[] = [
    [0, h],
    [5, h * 0.4],
    [50, h * 0.07],
    [100, 0],
    [150, h * 0.07],
    [195, h * 0.4],
    [200, h],
  ];
  return { points, w, h };
}

// ---------------------------------------------------------------------
// Layer builders
// ---------------------------------------------------------------------

const STROKE = '#111111';
const SEAM = `<g id="seams" fill="none" stroke="${STROKE}" stroke-width="1">`;
const STITCH = `<g id="stitches" fill="none" stroke="${STROKE}" stroke-width="0.8" stroke-dasharray="4 3">`;
const TRIM = `<g id="trims" fill="none" stroke="${STROKE}" stroke-width="1.2">`;
const SHADE = `<g id="shading" fill="#d9d9d9" fill-opacity="0.45" stroke="none">`;

function line(x1: number, y1: number, x2: number, y2: number): string {
  return `<path d="M ${r1(x1)} ${r1(y1)} L ${r1(x2)} ${r1(y2)}"/>`;
}

function arrow(x1: number, y1: number, x2: number, y2: number, label: string, lx: number, ly: number): string {
  // Double-headed measurement arrow + POM code label.
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const tick = (x: number, y: number, s: number) =>
    `<path d="M ${r1(x - uy * 4 * s)} ${r1(y + ux * 4 * s)} L ${r1(x + uy * 4 * s)} ${r1(y - ux * 4 * s)}"/>`;
  return (
    `<g stroke="#b91c1c" stroke-width="0.8" fill="none">` +
    line(x1, y1, x2, y2) +
    tick(x1, y1, 1) +
    tick(x2, y2, 1) +
    `</g><text x="${r1(lx)}" y="${r1(ly)}" font-size="11" fill="#b91c1c" font-family="monospace" text-anchor="middle">${label}</text>`
  );
}

function printRect(
  view: ViewName,
  box: { x: number; y: number; w: number; h: number },
  stdW: number,
  stdH: number,
  yFrac: number,
): PrintAreaRect {
  const w = Math.min(stdW, box.w * 0.8);
  const h = Math.min(stdH, box.h * 0.7);
  const x = box.x + (box.w - w) / 2;
  const y = box.y + box.h * yFrac;
  const rect: PrintAreaRect = {
    x: r1(x),
    y: r1(Math.min(y, box.y + box.h - h)),
    widthMm: r1(w),
    heightMm: r1(h),
    nx: 0,
    ny: 0,
    nw: 0,
    nh: 0,
  };
  return rect;
}

function withNorm(
  rect: PrintAreaRect,
  box: { x: number; y: number; w: number; h: number },
): PrintAreaRect {
  return {
    ...rect,
    nx: r1((rect.x - box.x) / box.w),
    ny: r1((rect.y - box.y) / box.h),
    nw: r1(rect.widthMm / box.w),
    nh: r1(rect.heightMm / box.h),
  };
}

// ---------------------------------------------------------------------
// Per-view assembly
// ---------------------------------------------------------------------

interface ViewGeom {
  points: Pt[];
  w: number;
  h: number;
}

function buildView(
  blank: BlankDefinition,
  block: Block,
  style: StyleOptions,
  view: ViewName,
  size: string,
): GeneratedView {
  const std = blank.printAreasMm[view] ?? [0, 0, 200, 200];
  const stdW = std[2];
  const stdH = std[3];
  let geom: ViewGeom;
  let extra: { torso?: TorsoGeom; pants?: ReturnType<typeof pantsGeom> } = {};
  if (blank.category === 'bottoms') {
    const p = pantsGeom(block);
    geom = p;
    extra = { pants: p };
  } else if (blank.category === 'headwear') {
    geom = capGeom(view, block);
  } else if (view === 'hood') {
    geom = hoodGeom(block);
  } else if (view === 'left_sleeve' || view === 'right_sleeve') {
    geom = sleeveGeom(block);
  } else {
    const t = torsoGeom(block, style, view === 'back');
    geom = t;
    extra = { torso: t };
  }
  const box = bbox(geom.points);
  const isFront = view === 'front';
  const t = extra.torso;
  const p = extra.pants;

  // --- silhouette (single closed path) ---
  const silhouette = `<g id="silhouette"><path d="${poly(geom.points)}" fill="#ffffff" stroke="${STROKE}" stroke-width="1.5"/></g>`;

  // --- seams ---
  let seams = '';
  if (t) {
    seams += line(t.neckL[0], t.neckL[1], t.shoulderL[0], t.shoulderL[1]);
    seams += line(t.neckR[0], t.neckR[1], t.shoulderR[0], t.shoulderR[1]);
    seams += line((box.w - block.chestMm) / 2, t.underarmY, (box.w - block.hemMm) / 2, box.h);
    seams += line(box.w - (box.w - block.chestMm) / 2, t.underarmY, box.w - (box.w - block.hemMm) / 2, box.h);
    seams += line((box.w - block.hemMm) / 2, box.h - 2, box.w - (box.w - block.hemMm) / 2, box.h - 2);
    if (style.sleeve === 'raglan') {
      seams += `<path d="M ${r1(t.shoulderL[0])} ${r1(t.shoulderL[1])} Q ${r1(t.cx - block.neckWidthMm / 2 - 20)} ${r1(box.h * 0.25)} ${r1((box.w - block.chestMm) / 2)} ${r1(t.underarmY)}"/>`;
    }
  } else if (p) {
    seams += line(0, 40, box.w, 40); // waistband
    seams += line(p.cx - 5, p.crotchY, p.cx - 5, box.h);
    seams += line(p.cx + 5, p.crotchY, p.cx + 5, box.h);
  } else if (view === 'hood') {
    seams += line(box.w / 2, 0, box.w / 2, box.h);
  } else if (view === 'left_sleeve' || view === 'right_sleeve') {
    seams += line(0, 0, (box.w - block.sleeveWidthMm) / 2, box.h);
    seams += line(box.w, 0, (box.w + block.sleeveWidthMm) / 2, box.h);
  } else {
    // cap: 6 panel seams fanning from the crown button
    seams += line(50, box.h * 0.07, 45, box.h);
    seams += line(100, 0, 100, box.h);
    seams += line(150, box.h * 0.07, 155, box.h);
  }

  // --- stitches (dashed) ---
  let stitches = '';
  if (t) {
    stitches += line((box.w - block.hemMm) / 2 + 4, box.h - 14, box.w - (box.w - block.hemMm) / 2 - 4, box.h - 14);
  } else if (p) {
    stitches += line(p.cx - block.hemMm - 1, box.h - 14, p.cx - 9, box.h - 14);
    stitches += line(p.cx + 9, box.h - 14, p.cx + block.hemMm + 1, box.h - 14);
  } else if (view === 'left_sleeve' || view === 'right_sleeve') {
    stitches += line((box.w - block.sleeveWidthMm) / 2 + 3, box.h - 12, (box.w + block.sleeveWidthMm) / 2 - 3, box.h - 12);
  } else if (view === 'side') {
    stitches += line(200, box.h - 6, box.w - 6, box.h - 2);
  }

  // --- trims ---
  let trims = '';
  if (t) {
    // neck rib: inner curve parallel to the neck edge
    const rib = quad(
      [t.neckR[0] - 2, t.neckR[1] + 7],
      [t.cx, t.neckR[1] + (style.neck === 'v' && isFront ? 62 : 34)],
      [t.neckL[0] + 2, t.neckL[1] + 7],
      8,
    );
    trims += `<path d="M ${rib.map(([x, y]) => `${r1(x)} ${r1(y)}`).join(' L ')}"/>`;
    if (style.hood && isFront) {
      trims += line(t.cx - 14, t.neckL[1] + 10, t.cx - 18, t.neckL[1] + 52);
      trims += line(t.cx + 14, t.neckR[1] + 10, t.cx + 18, t.neckR[1] + 52);
    }
    if (style.closure === 'zip' && isFront) {
      trims += line(t.cx, t.neckL[1] + 30, t.cx, box.h - 6);
      for (let y = t.neckL[1] + 44; y < box.h - 14; y += 16) {
        trims += line(t.cx - 4, y, t.cx + 4, y);
      }
    }
    if (style.closure === 'buttons' && isFront) {
      for (let i = 0; i < 5; i++) {
        const y = t.neckL[1] + 40 + i * ((box.h - t.neckL[1] - 60) / 4);
        trims += `<circle cx="${r1(t.cx)}" cy="${r1(y)}" r="4"/>`;
      }
    }
    if (style.neck === 'collar' && isFront) {
      trims += `<path d="M ${r1(t.neckL[0])} ${r1(t.neckL[1])} L ${r1(t.cx - 24)} ${r1(t.neckL[1] + 42)} L ${r1(t.cx)} ${r1(t.neckL[1] + 16)} Z"/>`;
      trims += `<path d="M ${r1(t.neckR[0])} ${r1(t.neckR[1])} L ${r1(t.cx + 24)} ${r1(t.neckR[1] + 42)} L ${r1(t.cx)} ${r1(t.neckR[1] + 16)} Z"/>`;
    }
    if (style.pockets && style.hood && isFront) {
      // kangaroo pocket
      const py = box.h * 0.62;
      const px1 = t.cx - 150;
      const px2 = t.cx + 150;
      const px3 = t.cx + 120;
      const px4 = t.cx - 120;
      const py2 = box.h - 40;
      trims += `<path d="M ${r1(px1)} ${r1(py)} L ${r1(px2)} ${r1(py)} L ${r1(px3)} ${r1(py2)} L ${r1(px4)} ${r1(py2)} Z"/>`;
    }
  } else if (p) {
    if (isFront) {
      trims += `<path d="M ${r1(p.cx - (block.waistMm ?? 380) / 2 + 8)} 40 L ${r1(p.cx - (block.waistMm ?? 380) / 2 + 52)} 96"/>`;
      trims += `<path d="M ${r1(p.cx + (block.waistMm ?? 380) / 2 - 8)} 40 L ${r1(p.cx + (block.waistMm ?? 380) / 2 - 52)} 96"/>`;
      if (style.pockets) {
        trims += `<rect x="${r1(p.cx - 170)}" y="300" width="90" height="110"/>`;
        trims += `<rect x="${r1(p.cx + 80)}" y="300" width="90" height="110"/>`;
      }
    } else {
      trims += `<rect x="${r1(p.cx - 150)}" y="210" width="110" height="90"/>`;
      trims += `<rect x="${r1(p.cx + 40)}" y="210" width="110" height="90"/>`;
    }
  } else if (view === 'hood') {
    const opening = quad([box.w * 0.3, box.h * 0.95], [box.w * 0.5, box.h * 0.45], [box.w * 0.7, box.h * 0.95], 10);
    trims += `<path d="M ${opening.map(([x, y]) => `${r1(x)} ${r1(y)}`).join(' L ')}"/>`;
  } else if (blank.category === 'headwear') {
    trims += `<circle cx="${r1(box.w / 2)}" cy="${r1(4)}" r="5"/>`;
    if (view === 'back') trims += `<rect x="${r1(box.w / 2 - 30)}" y="${r1(box.h - 18)}" width="60" height="14"/>`;
  }

  // --- print areas (centred in the silhouette; normalised against viewBox) ---
  const yFrac = t ? 0.2 : p ? 0.32 : view === 'hood' ? 0.3 : view === 'side' ? 0.45 : 0.2;
  const rect = withNorm(printRect(view, box, stdW, stdH, yFrac), box);
  const printAreas = `<g id="print_areas"><rect data-area="${view}" x="${rect.x}" y="${rect.y}" width="${rect.widthMm}" height="${rect.heightMm}" fill="none" stroke="#2563eb" stroke-width="1.5" stroke-dasharray="6 4"/></g>`;

  // --- callouts (POM arrows, codes from ds_pom_library) ---
  let callouts = '';
  if (t) {
    callouts += arrow(
      (box.w - block.chestMm) / 2 + 6,
      box.h * 0.45,
      box.w - (box.w - block.chestMm) / 2 - 6,
      box.h * 0.45,
      'B',
      box.w / 2,
      box.h * 0.45 - 6,
    );
    callouts += arrow(box.w - 14, 20, box.w - 14, box.h - 6, 'A', box.w - 26, box.h / 2);
  } else if (p) {
    callouts += arrow(box.w / 2 - 120, 20, box.w / 2 + 120, 20, 'B', box.w / 2, 14);
    callouts += arrow(box.w - 14, 44, box.w - 14, box.h - 6, 'A', box.w - 26, box.h / 2);
  } else if (view === 'left_sleeve' || view === 'right_sleeve') {
    callouts += arrow(box.w / 2 + 8, 8, box.w / 2 + 8, box.h - 8, 'C', box.w / 2 + 20, box.h / 2);
  } else if (view === 'hood') {
    callouts += arrow(box.w - 14, 8, box.w - 14, box.h - 8, 'F', box.w - 26, box.h / 2);
  } else if (blank.category === 'headwear') {
    callouts += arrow(box.w - 12, 8, box.w - 12, box.h - 8, 'G', box.w - 24, box.h / 2);
    if (view === 'side') {
      callouts += arrow(205, box.h - 2, box.w - 4, box.h - 2, 'H', box.w - 40, box.h - 12);
    }
  }

  // --- shading (fold hints, multiply layer) ---
  let shading = '';
  if (t) {
    shading += `<path d="M ${r1((box.w - block.chestMm) / 2 + 20)} ${r1(box.h * 0.4)} Q ${r1(box.w / 2)} ${r1(box.h * 0.5)} ${r1((box.w - block.chestMm) / 2 + 30)} ${r1(box.h * 0.75)} L ${r1((box.w - block.chestMm) / 2 + 44)} ${r1(box.h * 0.75)} Q ${r1(box.w / 2 + 10)} ${r1(box.h * 0.5)} ${r1((box.w - block.chestMm) / 2 + 34)} ${r1(box.h * 0.4)} Z"/>`;
  } else if (p) {
    shading += `<path d="M ${r1(p.cx - 60)} 260 L ${r1(p.cx - 40)} 260 L ${r1(p.cx - 30)} 420 L ${r1(p.cx - 50)} 420 Z"/>`;
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${r1(box.x)} ${r1(box.y)} ${r1(box.w)} ${r1(box.h)}" width="${r1(box.w)}mm" height="${r1(box.h)}mm" data-blank="${blank.id}" data-view="${view}" data-size="${size}" data-generator-version="${GENERATOR_VERSION}">` +
    `<title>${blank.name} — ${view} (${size})</title>` +
    silhouette +
    `${SEAM}${seams}</g>` +
    `${STITCH}${stitches}</g>` +
    `${TRIM}${trims}</g>` +
    printAreas +
    `<g id="callouts">${callouts}</g>` +
    `${SHADE}${shading}</g>` +
    `</svg>`;

  return {
    view,
    svg,
    widthMm: r1(box.w),
    heightMm: r1(box.h),
    printAreas: { [view]: rect },
  };
}

// ---------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------

/** Generate every view of a blank at one size. */
export function generateFlat(blank: BlankDefinition, size: string, blockOverride?: Partial<Block>): GeneratedFlat {
  const block: Block = { ...blank.block, ...(blockOverride ?? {}) };
  return {
    blankId: blank.id,
    size,
    block,
    style: blank.style,
    views: blank.views.map((view) => buildView(blank, block, blank.style, view, size)),
  };
}

/** Grade a blank across a size range: same generator, per-size block. */
export function gradeFlat(
  blank: BlankDefinition,
  sizes: string[],
  baseSize: string,
): Record<string, GeneratedFlat> {
  const baseIdx = sizes.indexOf(baseSize);
  if (baseIdx < 0) throw new Error(`base size ${baseSize} is not in sizes [${sizes.join(', ')}]`);
  const out: Record<string, GeneratedFlat> = {};
  for (let i = 0; i < sizes.length; i++) {
    const steps = i - baseIdx;
    const g = blank.grade;
    const block: Block = {
      ...blank.block,
      chestMm: Math.max(50, blank.block.chestMm + g.chestMm * steps),
      bodyLengthMm: Math.max(50, blank.block.bodyLengthMm + g.bodyLengthMm * steps),
      shoulderMm: Math.max(50, blank.block.shoulderMm + g.shoulderMm * steps),
      sleeveLengthMm: Math.max(20, blank.block.sleeveLengthMm + g.sleeveLengthMm * steps),
      sleeveWidthMm: Math.max(20, blank.block.sleeveWidthMm + g.sleeveWidthMm * steps),
      hemMm: Math.max(50, blank.block.hemMm + g.hemMm * steps),
      waistMm: blank.block.waistMm === undefined ? undefined : Math.max(50, blank.block.waistMm + (g.waistMm ?? 0) * steps),
      inseamMm: blank.block.inseamMm === undefined ? undefined : Math.max(20, blank.block.inseamMm + (g.inseamMm ?? 0) * steps),
    };
    out[sizes[i]] = generateFlat(blank, sizes[i], block);
  }
  return out;
}
