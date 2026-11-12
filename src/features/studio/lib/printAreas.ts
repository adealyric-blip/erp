// Canvas geometry — plan/04 PrintArea / GarmentPrintAreas, T07 canvas math.
// A print area is normalized (x/y/w/h in 0..1 over the garment view) plus
// real mm. Preview scale is 300 dpi: px = mm / 25.4 * 300.
import { GarmentPrintAreas } from '@/lib/db/schemas';

export type ViewId = 'front' | 'back' | 'left_sleeve' | 'right_sleeve' | 'hood' | 'crown' | 'visor' | 'side';

export interface PrintAreaRect {
  x: number;
  y: number;
  w: number;
  h: number;
  width_mm: number;
  height_mm: number;
}

export const DPI = 300;
export const MM_PER_INCH = 25.4;

/** mm → px at the 300 dpi preview scale. */
export function mmToPx(mm: number): number {
  return (mm / MM_PER_INCH) * DPI;
}

/** Parse + validate a template's print_areas jsonb (plan/04 GarmentPrintAreas). */
export function parsePrintAreas(raw: unknown): Partial<Record<ViewId, PrintAreaRect>> {
  const parsed = GarmentPrintAreas.safeParse(raw);
  if (!parsed.success) return {};
  return parsed.data as Partial<Record<ViewId, PrintAreaRect>>;
}

/** Print-area rect in stage pixels for a view of `stageW × stageH`. */
export function printAreaPx(
  area: PrintAreaRect,
  stageW: number,
  stageH: number,
): { x: number; y: number; width: number; height: number } {
  return { x: area.x * stageW, y: area.y * stageH, width: area.w * stageW, height: area.h * stageH };
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** True when the layer box sits fully inside the print area (with 1 px tolerance). */
export function isInsidePrintArea(box: Box, area: { x: number; y: number; width: number; height: number }): boolean {
  const tol = 1;
  return (
    box.x >= area.x - tol &&
    box.y >= area.y - tol &&
    box.x + box.width <= area.x + area.width + tol &&
    box.y + box.height <= area.y + area.height + tol
  );
}

/** Snap a value to the nearest guide within `threshold` px. Returns the snapped value. */
export function snapToGuides(value: number, guides: number[], threshold = 6): number {
  let best = value;
  let bestDist = threshold;
  for (const g of guides) {
    const d = Math.abs(value - g);
    if (d < bestDist) {
      bestDist = d;
      best = g;
    }
  }
  return best;
}

/** Seed templates — mirrors supabase/seed/20_demo_design.sql exactly (same
 *  names, views, normalized rects and mm). Used by the template picker and
 *  by the local-demo editor path when the DB is unreachable; the DB seed
 *  remains the source of truth for staff designs. */
export const SEED_TEMPLATES: Array<{
  id: string;
  name: string;
  category: string;
  views: ViewId[];
  print_areas: Partial<Record<ViewId, PrintAreaRect>>;
}> = [
  {
    id: 'seed-boxy-tee',
    name: 'Boxy tee',
    category: 'tops',
    views: ['front', 'back', 'left_sleeve', 'right_sleeve'],
    print_areas: {
      front: { x: 0.18, y: 0.2, w: 0.64, h: 0.6, width_mm: 300, height_mm: 400 },
      back: { x: 0.18, y: 0.2, w: 0.64, h: 0.6, width_mm: 300, height_mm: 400 },
      left_sleeve: { x: 0.3, y: 0.2, w: 0.4, h: 0.6, width_mm: 102, height_mm: 305 },
      right_sleeve: { x: 0.3, y: 0.2, w: 0.4, h: 0.6, width_mm: 102, height_mm: 305 },
    },
  },
  {
    id: 'seed-hoodie',
    name: 'Pullover hoodie',
    category: 'tops',
    views: ['front', 'back', 'left_sleeve', 'right_sleeve', 'hood'],
    print_areas: {
      front: { x: 0.17, y: 0.22, w: 0.66, h: 0.58, width_mm: 305, height_mm: 406 },
      back: { x: 0.17, y: 0.22, w: 0.66, h: 0.58, width_mm: 305, height_mm: 406 },
      left_sleeve: { x: 0.3, y: 0.2, w: 0.4, h: 0.6, width_mm: 102, height_mm: 305 },
      right_sleeve: { x: 0.3, y: 0.2, w: 0.4, h: 0.6, width_mm: 102, height_mm: 305 },
      hood: { x: 0.35, y: 0.05, w: 0.3, h: 0.25, width_mm: 200, height_mm: 180 },
    },
  },
  {
    id: 'seed-cap',
    name: '6-panel cap',
    category: 'headwear',
    views: ['front', 'back', 'side'],
    print_areas: {
      front: { x: 0.3, y: 0.25, w: 0.4, h: 0.35, width_mm: 110, height_mm: 90 },
      back: { x: 0.3, y: 0.25, w: 0.4, h: 0.35, width_mm: 110, height_mm: 90 },
      side: { x: 0.35, y: 0.3, w: 0.3, h: 0.3, width_mm: 90, height_mm: 80 },
    },
  },
];

export const VIEW_LABELS: Record<ViewId, string> = {
  front: 'Front',
  back: 'Back',
  left_sleeve: 'Left sleeve',
  right_sleeve: 'Right sleeve',
  hood: 'Hood',
  crown: 'Crown',
  visor: 'Visor',
  side: 'Side',
};

/** Switcher labels are data-driven.
 *  Phase 3 (T13/T13b, Jaizon 2026-11-12): the option labeled Flat becomes
 *  Tech Packs. The flat is the Sketch page inside the 11-tab Tech Packs
 *  view — it is no longer a peer of the tech pack — and the old standalone
 *  Tech Pack (white pill flat) button folds in as that Sketch page, so the
 *  'techpack' option is gone from this list. Model stays render-only.
 *  (The SurfaceId type keeps 'techpack' for backwards compatibility with
 *  older screens; no switcher offers it anymore.) */
export const SURFACE_OPTIONS = [
  { id: 'flat', label: 'Tech Packs' },
  { id: 'model', label: 'Model' },
] as const;
