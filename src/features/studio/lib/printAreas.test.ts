// T07 geometry accept support: print-area math (mm ↔ px at 300 dpi),
// containment, snapping, and the seed templates matching supabase/seed/20_demo_design.sql.
import { describe, expect, it } from 'vitest';
import {
  DPI,
  SEED_TEMPLATES,
  isInsidePrintArea,
  mmToPx,
  parsePrintAreas,
  printAreaPx,
  snapToGuides,
} from './printAreas';

describe('print-area math', () => {
  it('mm → px at 300 dpi: 300mm ≈ 3543px (12in × 300dpi)', () => {
    expect(mmToPx(25.4)).toBeCloseTo(DPI, 6);
    expect(mmToPx(300)).toBeCloseTo(3543.31, 1);
    expect(mmToPx(305)).toBeCloseTo(3602.36, 1);
  });

  it('seed templates mirror the DB seed (names, views, mm)', () => {
    const tee = SEED_TEMPLATES.find((t) => t.name === 'Boxy tee');
    expect(tee).toBeDefined();
    expect(tee?.views).toEqual(['front', 'back', 'left_sleeve', 'right_sleeve']);
    expect(tee?.print_areas.front?.width_mm).toBe(300);
    expect(tee?.print_areas.front?.height_mm).toBe(400);
    const hoodie = SEED_TEMPLATES.find((t) => t.name === 'Pullover hoodie');
    expect(hoodie?.print_areas.hood?.width_mm).toBe(200);
    const cap = SEED_TEMPLATES.find((t) => t.name === '6-panel cap');
    expect(cap?.views).toEqual(['front', 'back', 'side']);
  });

  it('parses the seed print_areas jsonb via GarmentPrintAreas', () => {
    const tee = SEED_TEMPLATES.find((t) => t.name === 'Boxy tee');
    const parsed = parsePrintAreas(tee?.print_areas);
    expect(parsed.front?.width_mm).toBe(300);
    expect(parsePrintAreas({ front: { x: 2, y: 0, w: 1, h: 1, width_mm: 1, height_mm: 1 } })).toEqual({});
  });

  it('printAreaPx maps normalized rects onto a stage', () => {
    const r = printAreaPx({ x: 0.18, y: 0.2, w: 0.64, h: 0.6, width_mm: 300, height_mm: 400 }, 1000, 800);
    expect(r).toEqual({ x: 180, y: 160, width: 640, height: 480 });
  });

  it('containment: inside passes, straddling the edge fails', () => {
    const area = { x: 180, y: 160, width: 640, height: 480 };
    expect(isInsidePrintArea({ x: 200, y: 200, width: 100, height: 100 }, area)).toBe(true);
    expect(isInsidePrintArea({ x: 100, y: 200, width: 100, height: 100 }, area)).toBe(false);
    expect(isInsidePrintArea({ x: 200, y: 200, width: 700, height: 100 }, area)).toBe(false);
  });

  it('snapping pulls to a guide within threshold and leaves far values alone', () => {
    expect(snapToGuides(103, [100, 500])).toBe(100);
    expect(snapToGuides(120, [100, 500])).toBe(120);
  });
});
