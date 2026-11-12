// split/classify.ts — view classification + front/back pairing (plan/08
// step 4). View comes from label hints first ("FRONT" / "BACK" text), else
// from shape: a front and back of the same garment have nearly the same
// outline width and height and sit side by side, so they get the same
// pair_key. A narrower middle view is a side. VecFashion watermark/logo
// text is detected and dropped from the piece but kept as a hint.

import type { BBox, PieceView } from './types';
import type { DrawItem } from './svg';
import { bboxOfPoints } from './svg';

export interface LabelHint {
  text: string;
  bbox: BBox;
  centreX: number;
  centreY: number;
}

const VIEW_WORD: [RegExp, PieceView][] = [
  [/\bfront\b/i, 'front'],
  [/\bback\b/i, 'back'],
  [/\bside\b/i, 'side'],
  [/\bdetail\b/i, 'detail'],
];

const WATERMARK = /vecfashion|fashion\s*sets?|copyright|©|all rights/i;

/** Split text items into watermark text (drop) and label hints (keep). */
export function splitTextItems(items: DrawItem[]): { hints: LabelHint[]; watermark: DrawItem[]; other: DrawItem[] } {
  const hints: LabelHint[] = [];
  const watermark: DrawItem[] = [];
  const other: DrawItem[] = [];
  for (const it of items) {
    if (it.kind !== 'text' || !it.text) continue;
    const b = bboxOfPoints(it.points);
    if (!b) continue;
    if (WATERMARK.test(it.text)) {
      watermark.push(it);
      continue;
    }
    const view = viewFromText(it.text);
    if (view) {
      hints.push({ text: it.text, bbox: b, centreX: b.x + b.w / 2, centreY: b.y + b.h / 2 });
    } else {
      other.push(it);
    }
  }
  return { hints, watermark, other };
}

export function viewFromText(text: string): PieceView | null {
  for (const [re, view] of VIEW_WORD) if (re.test(text)) return view;
  return null;
}

/** View for one piece: label hint inside its bbox wins, else position.
 * Returns whether the view came from a label (the review screen and the
 * global row pass trust labels over position). */
export function classifyView(
  pieceBBox: BBox,
  hints: LabelHint[],
  siblings: BBox[],
): { view: PieceView; fromLabel: boolean } {
  // A label whose centre falls inside this piece's bbox.
  for (const h of hints) {
    if (
      h.centreX >= pieceBBox.x &&
      h.centreX <= pieceBBox.x + pieceBBox.w &&
      h.centreY >= pieceBBox.y &&
      h.centreY <= pieceBBox.y + pieceBBox.h
    ) {
      const v = viewFromText(h.text);
      if (v) return { view: v, fromLabel: true };
    }
  }
  // Position fallback: leftmost of a left-to-right run is front, rightmost
  // is back, a middle one is a side.
  const ordered = [...siblings].sort((a, b) => a.x - b.x);
  const idx = ordered.findIndex((b) => b === pieceBBox);
  if (ordered.length === 2) return { view: idx === 0 ? 'front' : 'back', fromLabel: false };
  if (ordered.length >= 3) {
    if (idx === 0) return { view: 'front', fromLabel: false };
    if (idx === ordered.length - 1) return { view: 'back', fromLabel: false };
    return { view: 'side', fromLabel: false };
  }
  return { view: 'front', fromLabel: false };
}

/**
 * Global row pass: views are a property of a ROW of pieces, not of one
 * candidate — a cluster candidate is a single view, so per-candidate
 * position classification always says "front". Group pieces into rows by
 * vertical overlap, then classify each row left-to-right (front, side…,
 * back), keeping label-derived views and filling the remaining slots by
 * position. Runs after all pieces are built, before pairing.
 */
export function classifyRows(pieces: { bbox: BBox; view: PieceView; viewFromLabel: boolean }[]): void {
  const sorted = [...pieces].sort((a, b) => a.bbox.y + a.bbox.h / 2 - (b.bbox.y + b.bbox.h / 2) || a.bbox.x - b.bbox.x);
  const rows: typeof sorted[] = [];
  for (const p of sorted) {
    const row = rows.find((r) => {
      const top = Math.max(...r.map((q) => q.bbox.y));
      const bottom = Math.min(...r.map((q) => q.bbox.y + q.bbox.h));
      const overlap = bottom - top;
      return overlap >= Math.min(p.bbox.h, ...r.map((q) => q.bbox.h)) * 0.4;
    });
    if (row) row.push(p);
    else rows.push([p]);
  }
  for (const row of rows) {
    if (row.length === 1) continue;
    const ordered = [...row].sort((a, b) => a.bbox.x - b.bbox.x);
    const slots: PieceView[] =
      ordered.length === 2 ? ['front', 'back'] : ['front', ...Array<PieceView>(ordered.length - 2).fill('side'), 'back'];
    // Label-derived views keep their slots; the rest fill free slots left to right.
    const taken = new Set<number>();
    for (const p of ordered) {
      if (!p.viewFromLabel) continue;
      const slot = slots.indexOf(p.view);
      if (slot >= 0) taken.add(slot);
    }
    let nextSlot = 0;
    for (const p of ordered) {
      if (p.viewFromLabel) continue;
      while (nextSlot < slots.length && taken.has(nextSlot)) nextSlot++;
      if (nextSlot >= slots.length) break;
      p.view = slots[nextSlot];
      taken.add(nextSlot);
      nextSlot++;
    }
  }
}

/**
 * Pair front/back pieces that belong to one garment: nearly the same
 * outline width and height (within 12%). Each front takes the nearest
 * unpaired back that matches — nearest wins, so in a 3-garment set a front
 * pairs with its own garment's back, not the next garment's, and
 * front/back on separate artboards (same page coordinates) still pair.
 * Returns a pair_key per piece index, or null.
 */
export function pairPieces(bboxes: BBox[], views: PieceView[]): (string | null)[] {
  const keys: (string | null)[] = bboxes.map(() => null);
  const used = new Set<number>();
  let pairNo = 0;
  const centre = (b: BBox) => b.x + b.w / 2;
  for (let i = 0; i < bboxes.length; i++) {
    if (views[i] !== 'front' || keys[i]) continue;
    let best = -1;
    let bestDist = Infinity;
    for (let j = 0; j < bboxes.length; j++) {
      if (views[j] !== 'back' || used.has(j)) continue;
      const wSim = Math.abs(bboxes[i].w - bboxes[j].w) / Math.max(bboxes[i].w, bboxes[j].w);
      const hSim = Math.abs(bboxes[i].h - bboxes[j].h) / Math.max(bboxes[i].h, bboxes[j].h);
      if (wSim > 0.12 || hSim > 0.12) continue;
      const dist = Math.abs(centre(bboxes[i]) - centre(bboxes[j]));
      if (dist < bestDist) {
        bestDist = dist;
        best = j;
      }
    }
    if (best >= 0) {
      pairNo++;
      keys[i] = `pair-${pairNo}`;
      keys[best] = `pair-${pairNo}`;
      used.add(i);
      used.add(best);
    }
  }
  return keys;
}

/** Category: source category wins; else the file name; else 'default'. */
export function classifyCategory(sourceCategory: string | undefined, fileName: string | undefined): string {
  const fromFile = (fileName ?? '').toLowerCase();
  const known = ['tee', 'hoodie', 'sweatshirt', 'polo', 'jacket', 'short', 'pant', 'jogger', 'cap'];
  for (const k of known) if (fromFile.includes(k)) return k;
  const s = (sourceCategory ?? '').trim().toLowerCase();
  if (s) return s;
  return 'default';
}
