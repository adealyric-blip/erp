// split/svg.ts — minimal SVG parsing for the splitter (plan/08 §Splitting).
// Pure string parsing, no DOM: the same code runs in Node unit tests, in
// the browser review screen, and on the render station. Handles the SVG
// VectorCraft exports (plain paths/rects/groups/text) and the pdftocairo
// SVGs of the VecFashion PDFs (feImage filter chain, <image> tiles — those
// elements carry no stroked vector geometry and are skipped for clustering,
// the same way the reference pipeline verifies against the PDF raster).
//
// Curves are flattened to polylines for bboxes / raster masks; transforms
// supported: translate / scale / matrix / rotate (about an optional centre).
// Everything else passes through untouched into the rebuilt piece SVG.

import type { BBox } from './types';

export interface SvgNode {
  tag: string;
  attrs: Record<string, string>;
  children: SvgNode[];
  text: string;
}

export interface DrawItem {
  kind: 'path' | 'rect' | 'circle' | 'ellipse' | 'line' | 'polyline' | 'polygon' | 'text' | 'image';
  /** Flattened polyline points in page coordinates (for path-like kinds). */
  points: [number, number][];
  /** Closed (fill) shape, i.e. contributes to the silhouette mask. */
  closed: boolean;
  fill: string | null;
  stroke: string | null;
  strokeWidth: number;
  dashed: boolean;
  /** Top-level group id this item came from ('' when ungrouped / flattened). */
  groupId: string;
  /** Named layer (inherited id/label) this item came from, if any. */
  layerName: string | null;
  /** Original element, re-emitted verbatim into the rebuilt seams/stitches/trims layers. */
  raw: string;
  /** Text content for text items. */
  text?: string;
  /** Font size (px/pt) for text items, for the label-hint bbox estimate. */
  fontSize?: number;
}

export interface ParsedSvg {
  root: SvgNode;
  width: number;
  height: number;
  viewBox: BBox;
  items: DrawItem[];
  /** Top-level <g> children of the root, in document order. */
  topGroups: SvgNode[];
}

const r1 = (n: number) => Math.round(n * 10) / 10;

function parseAttrs(tagInner: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([A-Za-z_:][\w:.-]*)\s*=\s*"([^"]*)"|([A-Za-z_:][\w:.-]*)\s*=\s*'([^']*)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tagInner))) {
    attrs[m[1] ?? m[3]] = m[2] ?? m[4];
  }
  return attrs;
}

/** Tiny XML parser: elements, self-closing tags, comments, CDATA, doctype. */
export function parseXml(svg: string): SvgNode {
  const root: SvgNode = { tag: '#root', attrs: {}, children: [], text: '' };
  const stack: SvgNode[] = [root];
  // Strip XML declaration / doctype / comments / CDATA markers (keep content).
  const clean = svg
    .replace(/<\?xml[^>]*\?>/g, '')
    .replace(/<!DOCTYPE[^>]*>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!\[CDATA\[/g, '')
    .replace(/\]\]>/g, '');
  const tagRe = /<(\/?)([A-Za-z][\w:.-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;
  let last = 0;
  let m: RegExpExecArray | null;
  const pushText = (t: string) => {
    if (t.trim()) stack[stack.length - 1].text += t;
  };
  while ((m = tagRe.exec(clean))) {
    pushText(clean.slice(last, m.index));
    last = tagRe.lastIndex;
    const [, closing, tag, inner, selfClose] = m;
    if (closing) {
      if (stack.length > 1 && stack[stack.length - 1].tag === tag) stack.pop();
      continue;
    }
    const node: SvgNode = { tag, attrs: parseAttrs(inner), children: [], text: '' };
    stack[stack.length - 1].children.push(node);
    if (!selfClose) stack.push(node);
  }
  pushText(clean.slice(last));
  return root;
}

export function serializeNode(node: SvgNode): string {
  const attrs = Object.entries(node.attrs)
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ');
  const open = attrs ? `<${node.tag} ${attrs}` : `<${node.tag}`;
  if (node.children.length === 0 && !node.text) return `${open}/>`;
  const inner = node.text + node.children.map(serializeNode).join('');
  return `${open}>${inner}</${node.tag}>`;
}

type Mat = [number, number, number, number, number, number]; // a b c d e f

const IDENTITY: Mat = [1, 0, 0, 1, 0, 0];

function mulMat(m1: Mat, m2: Mat): Mat {
  const [a1, b1, c1, d1, e1, f1] = m1;
  const [a2, b2, c2, d2, e2, f2] = m2;
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ];
}

function applyMat(m: Mat, [x, y]: [number, number]): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

function parseTransform(t: string | undefined): Mat {
  if (!t) return IDENTITY;
  let out: Mat = IDENTITY;
  const re = /(translate|scale|rotate|matrix)\s*\(([^)]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const nums = m[2].split(/[\s,]+/).filter(Boolean).map(Number);
    if (m[1] === 'translate') {
      out = mulMat(out, [1, 0, 0, 1, nums[0] ?? 0, nums[1] ?? 0]);
    } else if (m[1] === 'scale') {
      const sx = nums[0] ?? 1;
      out = mulMat(out, [sx, 0, 0, nums[1] ?? sx, 0, 0]);
    } else if (m[1] === 'rotate') {
      const rad = ((nums[0] ?? 0) * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const cx = nums[1] ?? 0;
      const cy = nums[2] ?? 0;
      const rot: Mat = [cos, sin, -sin, cos, cx - cx * cos + cy * sin, cy - cx * sin - cy * cos];
      out = mulMat(out, rot);
    } else if (m[1] === 'matrix' && nums.length >= 6) {
      out = mulMat(out, [nums[0], nums[1], nums[2], nums[3], nums[4], nums[5]]);
    }
  }
  return out;
}

function styleOf(attrs: Record<string, string>, key: string): string | null {
  if (attrs[key] !== undefined) return attrs[key];
  const style = attrs.style ?? '';
  const m = style.match(new RegExp(`${key}\\s*:\\s*([^;]+)`));
  return m ? m[1].trim() : null;
}

function isNone(v: string | null | undefined): boolean {
  return v === undefined || v === null || v.trim().toLowerCase() === 'none';
}

/** Flatten an SVG path `d` into polyline points (curves sampled). */
export function flattenPath(d: string): [number, number][] {
  const tokens = d.match(/[MmLlHhVvCcSsQqTtAaZz]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
  const pts: [number, number][] = [];
  let i = 0;
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  let cmd = '';
  const num = () => Number(tokens[i++]);
  const push = (x: number, y: number) => {
    cx = x;
    cy = y;
    pts.push([x, y]);
  };
  const cubic = (x1: number, y1: number, x2: number, y2: number, x: number, y: number) => {
    const p0: [number, number] = [cx, cy];
    for (let s = 1; s <= 10; s++) {
      const t = s / 10;
      const mt = 1 - t;
      push(
        mt * mt * mt * p0[0] + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t * x,
        mt * mt * mt * p0[1] + 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t * y,
      );
    }
  };
  const quad = (x1: number, y1: number, x: number, y: number) => {
    const p0: [number, number] = [cx, cy];
    for (let s = 1; s <= 8; s++) {
      const t = s / 8;
      const mt = 1 - t;
      push(mt * mt * p0[0] + 2 * mt * t * x1 + t * t * x, mt * mt * p0[1] + 2 * mt * t * y1 + t * t * y);
    }
  };
  while (i < tokens.length) {
    const tok = tokens[i];
    if (/^[MmLlHhVvCcSsQqTtAaZz]$/.test(tok)) {
      cmd = tok;
      i++;
    }
    if (cmd === '') break;
    const rel = cmd === cmd.toLowerCase();
    const up = cmd.toUpperCase();
    if (up === 'M') {
      const x = num() + (rel ? cx : 0);
      const y = num() + (rel ? cy : 0);
      push(x, y);
      sx = x;
      sy = y;
      cmd = rel ? 'l' : 'L';
    } else if (up === 'L') {
      push(num() + (rel ? cx : 0), num() + (rel ? cy : 0));
    } else if (up === 'H') {
      push(num() + (rel ? cx : 0), cy);
    } else if (up === 'V') {
      push(cx, num() + (rel ? cy : 0));
    } else if (up === 'C') {
      const x1 = num() + (rel ? cx : 0);
      const y1 = num() + (rel ? cy : 0);
      const x2 = num() + (rel ? cx : 0);
      const y2 = num() + (rel ? cy : 0);
      const x = num() + (rel ? cx : 0);
      const y = num() + (rel ? cy : 0);
      cubic(x1, y1, x2, y2, x, y);
    } else if (up === 'S') {
      const x2 = num() + (rel ? cx : 0);
      const y2 = num() + (rel ? cy : 0);
      const x = num() + (rel ? cx : 0);
      const y = num() + (rel ? cy : 0);
      cubic(cx, cy, x2, y2, x, y);
    } else if (up === 'Q') {
      const x1 = num() + (rel ? cx : 0);
      const y1 = num() + (rel ? cy : 0);
      const x = num() + (rel ? cx : 0);
      const y = num() + (rel ? cy : 0);
      quad(x1, y1, x, y);
    } else if (up === 'T') {
      quad(cx, cy, num() + (rel ? cx : 0), num() + (rel ? cy : 0));
    } else if (up === 'A') {
      // Arc: approximate with a straight chord plus the rx/ry extents.
      // Good enough for bbox + mask work; arcs are rare in flat outlines.
      num(); num(); num(); num(); num();
      push(num() + (rel ? cx : 0), num() + (rel ? cy : 0));
    } else if (up === 'Z') {
      if (pts.length) push(sx, sy);
      cmd = '';
    } else {
      break;
    }
  }
  return pts;
}

export function bboxOfPoints(points: [number, number][]): BBox | null {
  if (points.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function bboxUnion(a: BBox, b: BBox): BBox {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

/** Shape element → polygon points (rect/circle/ellipse/line/polyline/polygon). */
function shapePoints(node: SvgNode): [number, number][] {
  const a = node.attrs;
  const n = (k: string, d = 0) => Number(a[k] ?? d) || 0;
  if (node.tag === 'rect') {
    const x = n('x');
    const y = n('y');
    const w = n('width');
    const h = n('height');
    return [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
      [x, y],
    ];
  }
  if (node.tag === 'circle') {
    const cx = n('cx');
    const cy = n('cy');
    const r = n('r');
    const pts: [number, number][] = [];
    for (let s = 0; s <= 16; s++) {
      const t = (s / 16) * Math.PI * 2;
      pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]);
    }
    return pts;
  }
  if (node.tag === 'ellipse') {
    const cx = n('cx');
    const cy = n('cy');
    const rx = n('rx');
    const ry = n('ry');
    const pts: [number, number][] = [];
    for (let s = 0; s <= 16; s++) {
      const t = (s / 16) * Math.PI * 2;
      pts.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]);
    }
    return pts;
  }
  if (node.tag === 'line') {
    return [
      [n('x1'), n('y1')],
      [n('x2'), n('y2')],
    ];
  }
  if (node.tag === 'polyline' || node.tag === 'polygon') {
    const nums = (a.points ?? '').trim().split(/[\s,]+/).filter(Boolean).map(Number);
    const pts: [number, number][] = [];
    for (let k = 0; k + 1 < nums.length; k += 2) pts.push([nums[k], nums[k + 1]]);
    if (node.tag === 'polygon' && pts.length) pts.push(pts[0]);
    return pts;
  }
  return [];
}

const LAYER_HINT = /^(front|back|side|detail)$/i;

export function parseSvg(svg: string): ParsedSvg {
  const tree = parseXml(svg);
  const svgNode = tree.children.find((c) => c.tag === 'svg');
  if (!svgNode) throw new Error('No <svg> root element');
  const w = Number(svgNode.attrs.width ?? 0) || 0;
  const h = Number(svgNode.attrs.height ?? 0) || 0;
  const vbParts = (svgNode.attrs.viewBox ?? '').trim().split(/[\s,]+/).map(Number);
  const viewBox: BBox =
    vbParts.length >= 4 && vbParts.every(Number.isFinite)
      ? { x: vbParts[0], y: vbParts[1], w: vbParts[2], h: vbParts[3] }
      : { x: 0, y: 0, w: w || 1000, h: h || 1000 };
  const items: DrawItem[] = [];
  const topGroups = svgNode.children.filter((c) => c.tag === 'g');

  const walk = (node: SvgNode, mat: Mat, groupId: string, layerName: string | null, depth: number) => {
    // Non-rendered subtrees: definitions, clip paths, masks, filters and
    // patterns hold geometry that is never drawn directly (pdftocairo
    // SVGs carry clip rects here — reading them as ink would invent
    // phantom garments).
    if (node.tag === 'defs' || node.tag === 'clipPath' || node.tag === 'mask' || node.tag === 'filter' || node.tag === 'pattern') {
      return;
    }
    const nextMat = mulMat(mat, parseTransform(node.attrs.transform));
    let nextGroup = groupId;
    let nextLayer = layerName;
    if (node.tag === 'g') {
      if (depth === 1 && node.attrs.id) nextGroup = node.attrs.id;
      // A layer name is layer metadata (Illustrator/VectorCraft layer
      // labels), NOT the group's id — a top-level group's id identifies
      // the group for the group strategy; its layer label, when present,
      // identifies it for the layer strategy.
      const label = node.attrs['inkscape:label'] ?? node.attrs['data-layer'] ?? node.attrs['data-name'] ?? '';
      if (LAYER_HINT.test(label.trim())) nextLayer = label.trim().toLowerCase();
      else if (label && depth <= 2 && !nextLayer) nextLayer = label.trim();
    }
    if (node.tag === 'path' || node.tag === 'rect' || node.tag === 'circle' || node.tag === 'ellipse' || node.tag === 'line' || node.tag === 'polyline' || node.tag === 'polygon') {
      const rawPoints =
        node.tag === 'path' ? flattenPath(node.attrs.d ?? '') : shapePoints(node);
      const points = rawPoints.map((p) => applyMat(nextMat, p));
      const fill = styleOf(node.attrs, 'fill');
      const stroke = styleOf(node.attrs, 'stroke');
      const dash = styleOf(node.attrs, 'stroke-dasharray');
      const closed =
        node.tag !== 'line' &&
        node.tag !== 'polyline' &&
        (node.tag === 'path'
          ? /Z\s*$/.test((node.attrs.d ?? '').trim()) || !isNone(fill)
          : !isNone(fill) || node.tag === 'rect' || node.tag === 'circle' || node.tag === 'ellipse' || node.tag === 'polygon');
      items.push({
        kind: node.tag as DrawItem['kind'],
        points,
        closed,
        fill: isNone(fill) ? null : fill,
        stroke: isNone(stroke) ? null : stroke,
        strokeWidth: Number(styleOf(node.attrs, 'stroke-width') ?? 1) || 1,
        dashed: !!dash && dash.trim() !== 'none' && dash.trim() !== '0',
        groupId: nextGroup,
        layerName: nextLayer,
        raw: serializeNode(node),
      });
    } else if (node.tag === 'text') {
      const x = Number(node.attrs.x ?? 0) || 0;
      const y = Number(node.attrs.y ?? 0) || 0;
      const [tx, ty] = applyMat(nextMat, [x, y]);
      const fs = Number(styleOf(node.attrs, 'font-size') ?? node.attrs['font-size'] ?? 12) || 12;
      const txt = node.text.trim();
      if (txt) {
        const estW = txt.length * fs * 0.6;
        items.push({
          kind: 'text',
          points: [
            [tx, ty - fs],
            [tx + estW, ty],
          ],
          closed: false,
          fill: styleOf(node.attrs, 'fill'),
          stroke: null,
          strokeWidth: 0,
          dashed: false,
          groupId: nextGroup,
          layerName: nextLayer,
          raw: serializeNode(node),
          text: txt,
          fontSize: fs,
        });
      }
    } else if (node.tag === 'image') {
      // Raster tiles (pdftocairo feImage chain, VectorCraft exports of
      // raster PDFs): no vector geometry, but their bbox IS ink — the
      // cluster strategy maps them to regions, and the rebuild keeps the
      // tile (windowed by the piece viewBox) so the piece still shows
      // the artwork. `use` stays skipped (a reference, not ink).
      const x = Number(node.attrs.x ?? 0) || 0;
      const y = Number(node.attrs.y ?? 0) || 0;
      const w = Number(node.attrs.width ?? 0) || 0;
      const h = Number(node.attrs.height ?? 0) || 0;
      if (w > 0 && h > 0) {
        const corners: [number, number][] = [
          [x, y],
          [x + w, y],
          [x + w, y + h],
          [x, y + h],
          [x, y],
        ].map((p) => applyMat(nextMat, p));
        items.push({
          kind: 'image',
          points: corners,
          closed: true,
          fill: null,
          stroke: null,
          strokeWidth: 0,
          dashed: false,
          groupId: nextGroup,
          layerName: nextLayer,
          raw: serializeNode(node),
        });
      }
    } else if (node.tag === 'use') {
      // Referenced content: skipped (a reference, not ink).
    }
    for (const child of node.children) walk(child, nextMat, nextGroup, nextLayer, depth + 1);
  };

  for (const child of svgNode.children) walk(child, IDENTITY, '', null, 1);
  return { root: svgNode, width: w, height: h, viewBox, items, topGroups };
}

/** Escape for embedding text in SVG output. */
export function escXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export { r1 };
