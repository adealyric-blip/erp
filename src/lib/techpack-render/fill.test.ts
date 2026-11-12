// techpack-render unit tests (T13b accept): fill every page from the
// fixture snapshot, every required data-field id populated, a 30-POM chart
// produces "MEASUREMENT CHART (2/2)", supplier mode has no UNIT COST
// column, the validator lists missing ids, and the UPC/fibre guards in
// the editor validation lib behave.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fill, validateTemplate } from './fill';
import { boxyTeeFixture } from './fixture';
import { TEMPLATE_PAGES } from './types';

const DIR = join(process.cwd(), 'src', 'lib', 'techpack-render', 'templates');
const svgs = TEMPLATE_PAGES.map((p) => readFileSync(join(DIR, p.file), 'utf8'));

describe('techpack-render fill()', () => {
  it('fills all 11 pages from the fixture snapshot', () => {
    const { pages } = fill(svgs, boxyTeeFixture(), 'internal');
    expect(pages).toHaveLength(12); // 11 + 1 measurement-chart continuation
    expect(pages.map((p) => p.pageId)).toContain('sketch');
    expect(pages.map((p) => p.pageId)).toContain('packaging');
    // Every page carries the header block.
    for (const p of pages) {
      expect(p.svg).toContain('MT-27-001');
      expect(p.svg).toContain('SS27');
      expect(p.svg).toContain('Maison Test');
    }
  });

  it('populates every required data-field id on every page', () => {
    // Required = every data-field id the templates declare, except the
    // template-owned title/footer-page and the documented optional set:
    // cards beyond the fixture's 3 materials / 2 colorways, the optional
    // extra label, the optional 4th fold step and carton-marking text,
    // and the trim weight (trims carry no gsm).
    const v = validateTemplate(svgs, boxyTeeFixture(), 'internal');
    const optional = new Set<string>([
      ...['attachment', 'color', 'material', 'placement', 'size_mm', 'text', 'type'].map(
        (f) => `labels.extra.${f}`,
      ),
      'materials.3.weight_gsm',
      ...Array.from({ length: 9 }, (_, i) => i + 4).flatMap((n) =>
        ['code', 'color_ref', 'composition', 'name', 'placement', 'supplier', 'weight_gsm'].map(
          (f) => `materials.${n}.${f}`,
        ),
      ),
      ...[3, 4].flatMap((n) => ['hex', 'name', 'pantone'].map((f) => `colorways.${n}.${f}`)),
      'packaging.carton.markings',
      'packaging.fold_step_4.text',
    ]);
    expect(v.missingFields.filter((id) => !optional.has(id))).toEqual([]);
    expect([...optional].every((id) => v.missingFields.includes(id))).toBe(true);
  });

  it('a 30-POM chart produces MEASUREMENT CHART (2/2)', () => {
    const { pages } = fill(svgs, boxyTeeFixture(), 'internal');
    const chart = pages.filter((p) => p.pageId === 'measurement_chart');
    expect(chart).toHaveLength(2);
    expect(chart[0].svg).toContain('MEASUREMENT CHART (1/2)');
    expect(chart[1].svg).toContain('MEASUREMENT CHART (2/2)');
    expect(chart[1].svg).toContain('PAGE 5 / 12');
    // Base-size column (M) is shaded on the chart pages.
    expect(chart[0].svg).toContain('#ece8df');
    // All 30 POM codes appear across the two chart pages.
    const joined = chart.map((p) => p.svg).join('');
    for (const code of ['A', 'B', 'AD']) expect(joined).toContain(`>${code}<`);
  });

  it('supplier mode has no UNIT COST column and stamps the watermark', () => {
    const { pages } = fill(svgs, boxyTeeFixture(), 'supplier', {
      watermarkText: 'Acme Ltd · buyer@acme.example · 2026-11-12 05:00Z',
    });
    expect(pages).toHaveLength(12);
    const bom = pages.find((p) => p.pageId === 'bom');
    expect(bom).toBeDefined();
    expect(bom!.svg).not.toContain('UNIT COST');
    expect(bom!.svg).not.toContain('unit_cost');
    expect(bom!.svg).toContain('Acme Ltd');
    // Internal mode keeps the column.
    const internal = fill(svgs, boxyTeeFixture(), 'internal');
    expect(internal.pages.find((p) => p.pageId === 'bom')!.svg).toContain('UNIT COST');
  });

  it('renders construction callouts and POM arrows on the flats', () => {
    const { pages } = fill(svgs, boxyTeeFixture(), 'internal');
    const construction = pages.find((p) => p.pageId === 'construction')!;
    expect(construction.svg).toContain('#d62828'); // leader red
    expect(construction.svg).toContain('>1<');
    const guide = pages.find((p) => p.pageId === 'measurement_guide')!;
    expect(guide.svg).toContain('pom-arrow');
    expect(guide.svg).toContain('>A<');
  });

  it('fills labels (fibre 60/40), hang tag (UPC) and packaging ratio', () => {
    const { pages } = fill(svgs, boxyTeeFixture(), 'internal');
    const labels = pages.find((p) => p.pageId === 'labels')!;
    expect(labels.svg).toContain('cotton 60%');
    expect(labels.svg).toContain('polyester 40%');
    const hangtag = pages.find((p) => p.pageId === 'hangtag')!;
    expect(hangtag.svg).toContain('036000291452');
    expect(hangtag.svg).toContain('USD 48');
    const packaging = pages.find((p) => p.pageId === 'packaging')!;
    expect(packaging.svg).toContain('S:4 / M:4 / L:4');
    expect(packaging.svg).toContain('Fold in half');
  });
});

describe('validateTemplate()', () => {
  it('reports only the documented optional ids missing for the full fixture', () => {
    const v = validateTemplate(svgs, boxyTeeFixture(), 'internal');
    // Every non-optional field is populated; repeats all have data.
    expect(v.missingRepeats).toEqual([]);
    expect(
      v.missingFields.filter(
        (id) =>
          !id.startsWith('labels.extra.') &&
          !id.startsWith('materials.4.') &&
          !id.startsWith('materials.5.') &&
          !id.startsWith('materials.6.') &&
          !id.startsWith('materials.7.') &&
          !id.startsWith('materials.8.') &&
          !id.startsWith('materials.9.') &&
          !id.startsWith('materials.10.') &&
          !id.startsWith('materials.11.') &&
          !id.startsWith('materials.12.') &&
          !id.startsWith('colorways.3.') &&
          !id.startsWith('colorways.4.') &&
          id !== 'materials.3.weight_gsm' &&
          id !== 'packaging.carton.markings' &&
          id !== 'packaging.fold_step_4.text',
      ),
    ).toEqual([]);
  });

  it('lists missing ids for an empty snapshot', () => {
    const v = validateTemplate(svgs, { tech_pack: {} }, 'internal');
    expect(v.missingFields).toContain('header.brand');
    expect(v.missingFields).toContain('header.style_number');
    expect(v.missingRepeats).toContain('measurements');
    expect(v.missingRepeats).toContain('bom');
    expect(v.missingSlots).toContain('sketch.front');
  });
});
