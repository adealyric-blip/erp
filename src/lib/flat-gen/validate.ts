// 7-layer validator — plan/08_FLAT_LIBRARY.md.
// Checks every generated (or split-accepted) SVG, with no DOM:
//   * all 7 fixed layer ids present, exactly once each
//   * silhouette = exactly one path, a single closed loop (one M, ends Z)
//   * every print-area rect lies inside the silhouette polygon (all 4 corners)
//   * viewBox is real mm (width/height attributes end in "mm")
import { LAYER_IDS } from './types';

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  layersFound: string[];
  printAreas: { area: string; x: number; y: number; w: number; h: number }[];
}

type Pt = [number, number];

function groupInner(svg: string, id: string): string | null {
  const m = svg.match(new RegExp(`<g id="${id}"[^>]*>([\\s\\S]*?)</g>`));
  return m ? m[1] : null;
}

/** Parse "M x y L x y ... Z" polylines into point lists (our generator output). */
function parsePolygon(d: string): Pt[] {
  const nums = d.replace(/[MLZmlz,]/g, ' ').trim().split(/\s+/).map(Number);
  const pts: Pt[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
  return pts;
}

function pointInPolygon(p: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function validateFlatSvg(svg: string): ValidationResult {
  const errors: string[] = [];
  const layersFound: string[] = [];
  for (const id of LAYER_IDS) {
    const count = (svg.match(new RegExp(`<g id="${id}"`, 'g')) ?? []).length;
    if (count === 1) layersFound.push(id);
    else errors.push(`layer ${id}: found ${count} time(s), expected 1`);
  }

  const sil = groupInner(svg, 'silhouette');
  let poly: Pt[] = [];
  if (sil === null) {
    errors.push('silhouette layer missing');
  } else {
    const paths = [...sil.matchAll(/<path[^>]*d="([^"]+)"[^>]*>/g)].map((m) => m[1]);
    if (paths.length !== 1) {
      errors.push(`silhouette must contain exactly one path, found ${paths.length}`);
    } else {
      const d = paths[0];
      const mCount = (d.match(/M/g) ?? []).length;
      if (mCount !== 1) errors.push(`silhouette path must have a single M (one closed loop), found ${mCount}`);
      if (!/Z\s*$/.test(d.trim())) errors.push('silhouette path is not closed (must end with Z)');
      poly = parsePolygon(d);
      if (poly.length < 3) errors.push('silhouette polygon has fewer than 3 points');
    }
  }

  const printAreas: ValidationResult['printAreas'] = [];
  const pa = groupInner(svg, 'print_areas');
  if (pa === null) {
    errors.push('print_areas layer missing');
  } else {
    for (const m of pa.matchAll(/<rect[^>]*data-area="([^"]+)"[^>]*x="([\d.]+)"[^>]*y="([\d.]+)"[^>]*width="([\d.]+)"[^>]*height="([\d.]+)"/g)) {
      const [, area, x, y, w, h] = m;
      const rect = { area, x: Number(x), y: Number(y), w: Number(w), h: Number(h) };
      printAreas.push(rect);
      if (poly.length >= 3) {
        const corners: Pt[] = [
          [rect.x, rect.y],
          [rect.x + rect.w, rect.y],
          [rect.x, rect.y + rect.h],
          [rect.x + rect.w, rect.y + rect.h],
        ];
        for (const c of corners) {
          if (!pointInPolygon(c, poly)) {
            errors.push(`print area ${area} corner (${c[0]}, ${c[1]}) lies outside the silhouette`);
            break;
          }
        }
      }
    }
    if (printAreas.length === 0) errors.push('no print-area rects found');
  }

  if (!/width="[\d.]+mm" height="[\d.]+mm"/.test(svg)) {
    errors.push('svg width/height must be in mm units');
  }

  return { ok: errors.length === 0, errors, layersFound, printAreas };
}
