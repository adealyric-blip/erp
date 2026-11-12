// split/scale.ts — scale calibration (plan/08 step 6). VecFashion flats
// aren't drawn to a size: staff enter one known measurement for the base
// size (e.g. half chest = 54 cm, or waist = 42 cm); the piece is scaled
// to mm so print areas and placements are true size. Front and back in a
// pair share one scale.

import type { SplitPiece } from './types';
import { printAreaDefaultMm } from './types';
import { scaleSvgToMm } from './rebuild';
import { flattenPath, parseXml } from './svg';

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * mm per source unit from one known measurement: the staff-measured
 * distance (in source units, e.g. across the front silhouette) and the
 * real-world mm it represents. E.g. half chest 540 mm over 270 pt → 2.
 */
export function scaleFromMeasurement(knownMm: number, measuredUnits: number): number {
  if (!Number.isFinite(knownMm) || knownMm <= 0) throw new Error('known measurement must be > 0 mm');
  if (!Number.isFinite(measuredUnits) || measuredUnits <= 0) throw new Error('measured units must be > 0');
  return knownMm / measuredUnits;
}

/** Silhouette polygon (local mm coords) parsed back out of a scaled SVG. */
function silhouettePolygonMm(svgMm: string): [number, number][] {
  const tree = parseXml(svgMm);
  const svgNode = tree.children.find((c) => c.tag === 'svg');
  const sil = svgNode?.children.find((c) => c.tag === 'g' && c.attrs.id === 'silhouette');
  const path = sil?.children.find((c) => c.tag === 'path');
  if (!path) return [];
  return flattenPath(path.attrs.d ?? '');
}

function pointInPolygon(p: [number, number], poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Calibrate a piece to mm: scale the SVG, then clamp the print-area rect
 * to the category default (plan/08: tee front chest 300 × 400 mm) centred
 * in the scaled rect, shrinking until all four corners sit inside the
 * silhouette — so the calibrated piece passes the 7-layer validator.
 */
export function calibratePiece(piece: SplitPiece, mmPerUnit: number): SplitPiece {
  let svgMm = scaleSvgToMm(piece.svg, mmPerUnit);
  const poly = silhouettePolygonMm(svgMm);
  const def = printAreaDefaultMm(piece.category);
  const rectRe = /(<rect data-area="([^"]+)" x=")([\d.]+)(" y=")([\d.]+)(" width=")([\d.]+)(" height=")([\d.]+)"/;
  const m = svgMm.match(rectRe);
  if (m && poly.length >= 3) {
    const x = Number(m[3]);
    const y = Number(m[5]);
    const w = Number(m[7]);
    const h = Number(m[9]);
    let nw = Math.min(w, def.w);
    let nh = Math.min(h, def.h);
    let nx = x + (w - nw) / 2;
    let ny = y + (h - nh) / 2;
    const inside = (rx: number, ry: number, rw: number, rh: number) =>
      pointInPolygon([rx, ry], poly) &&
      pointInPolygon([rx + rw, ry], poly) &&
      pointInPolygon([rx, ry + rh], poly) &&
      pointInPolygon([rx + rw, ry + rh], poly);
    for (let i = 0; i < 12 && !inside(nx, ny, nw, nh); i++) {
      nw *= 0.9;
      nh *= 0.9;
      nx = x + (w - nw) / 2;
      ny = y + (h - nh) / 2;
    }
    if (inside(nx, ny, nw, nh)) {
      svgMm = svgMm.replace(
        rectRe,
        (_full, p1: string, _area: string, _x: string, p4: string, _y: string, p6: string, _w: string, p8: string) =>
          `${p1}${r1(nx)}${p4}${r1(ny)}${p6}${r1(nw)}${p8}${r1(nh)}"`,
      );
    }
  }
  return { ...piece, svgMm, scaleMmPerUnit: mmPerUnit };
}

/** Apply one scale to both halves of a front/back pair. */
export function calibratePair(front: SplitPiece, back: SplitPiece, mmPerUnit: number): [SplitPiece, SplitPiece] {
  return [calibratePiece(front, mmPerUnit), calibratePiece(back, mmPerUnit)];
}
