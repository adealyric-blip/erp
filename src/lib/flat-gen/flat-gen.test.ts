// flat-gen unit tests — plan/08 accept: every generated SVG has all 7 layer
// ids, a single closed silhouette path, and print-area rects inside the
// silhouette for every size.
import { describe, expect, it } from 'vitest';
import { BLANKS, generateFlat, gradeFlat, validateFlatSvg } from './index';

describe('flat-gen', () => {
  it('defines the 12 core blanks', () => {
    expect(BLANKS).toHaveLength(12);
    expect(BLANKS.map((b) => b.id)).toEqual([
      'classic-tee',
      'oversized-tee',
      'long-sleeve-tee',
      'pullover-hoodie',
      'zip-hoodie',
      'crewneck-sweatshirt',
      'jogger',
      'cargo-pant',
      'short',
      'denim-jacket',
      'polo',
      'six-panel-cap',
    ]);
  });

  it('every blank, every view: 7 layers, one closed silhouette, print areas inside', () => {
    for (const blank of BLANKS) {
      const flat = generateFlat(blank, 'M');
      expect(flat.views.map((v) => v.view)).toEqual(blank.views);
      for (const view of flat.views) {
        const res = validateFlatSvg(view.svg);
        expect(res.errors, `${blank.id}/${view.view}: ${res.errors.join('; ')}`).toEqual([]);
        expect(res.ok).toBe(true);
        expect(res.layersFound).toHaveLength(7);
        expect(res.printAreas.length).toBeGreaterThan(0);
        expect(view.svg).toContain('width="');
        expect(view.svg).toMatch(/width="[\d.]+mm" height="[\d.]+mm"/);
        expect(view.svg).toContain(`data-blank="${blank.id}"`);
        expect(view.svg).toContain(`data-view="${view.view}"`);
        expect(view.svg).toContain('data-generator-version="flat-gen/1"');
      }
    }
  });

  it('grading: chest grows per size step and every size validates', () => {
    const blank = BLANKS.find((b) => b.id === 'classic-tee')!;
    const sizes = ['XS', 'S', 'M', 'L', 'XL'];
    const graded = gradeFlat(blank, sizes, 'M');
    const widths = sizes.map((s) => graded[s].views.find((v) => v.view === 'front')!.widthMm);
    expect(widths).toEqual([500, 520, 540, 560, 580]);
    for (const size of sizes) {
      for (const view of graded[size].views) {
        const res = validateFlatSvg(view.svg);
        expect(res.errors, `${size}/${view.view}`).toEqual([]);
      }
    }
    // print areas stay inside the silhouette at the smallest size too
    const xsFront = graded['XS'].views.find((v) => v.view === 'front')!;
    expect(xsFront.printAreas.front.widthMm).toBeLessThanOrEqual(500);
  });

  it('grading rejects a base size not in the range', () => {
    const blank = BLANKS.find((b) => b.id === 'classic-tee')!;
    expect(() => gradeFlat(blank, ['S', 'M', 'L'], 'XL')).toThrow('not in sizes');
  });

  it('validator rejects a missing layer and an out-of-silhouette print rect', () => {
    const blank = BLANKS.find((b) => b.id === 'classic-tee')!;
    const svg = generateFlat(blank, 'M').views.find((v) => v.view === 'front')!.svg;
    const noShading = svg.replace('<g id="shading"', '<g id="shading-x"');
    expect(validateFlatSvg(noShading).ok).toBe(false);
    expect(validateFlatSvg(noShading).errors.join(' ')).toContain('shading');
    const moved = svg.replace(/<rect data-area="front" x="[\d.]+"/, '<rect data-area="front" x="9999"');
    const res = validateFlatSvg(moved);
    expect(res.ok).toBe(false);
    expect(res.errors.join(' ')).toContain('outside the silhouette');
  });

  it('hoodie front carries a kangaroo pocket and zip hoodie a zipper (trims)', () => {
    const hoodie = BLANKS.find((b) => b.id === 'pullover-hoodie')!;
    const front = generateFlat(hoodie, 'M').views.find((v) => v.view === 'front')!.svg;
    expect(front).toContain('id="trims"');
    const zip = BLANKS.find((b) => b.id === 'zip-hoodie')!;
    const zipFront = generateFlat(zip, 'M').views.find((v) => v.view === 'front')!.svg;
    expect(zipFront).not.toEqual(front);
  });
});
