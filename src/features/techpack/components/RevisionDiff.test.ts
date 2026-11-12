// T15 — RevisionDiff unit tests: diff two S600 snapshot JSONs.
import { describe, expect, it } from 'vitest';
import { diffTechPackSnapshots, type TechPackSnapshot } from './RevisionDiff';
import {
  FIXTURE_SNAPSHOT_REV1,
  FIXTURE_SNAPSHOT_REV2,
} from '../test-fixtures/revision-snapshots';

const asSnapshot = (s: unknown): TechPackSnapshot => s as TechPackSnapshot;

describe('diffTechPackSnapshots', () => {
  it('returns empty for identical snapshots', () => {
    const d = diffTechPackSnapshots(asSnapshot(FIXTURE_SNAPSHOT_REV1), asSnapshot(FIXTURE_SNAPSHOT_REV1));
    expect(d.isEmpty).toBe(true);
    expect(d.totalChanges).toBe(0);
  });

  it('returns an empty diff for the first revision (null previous)', () => {
    const d = diffTechPackSnapshots(null, asSnapshot(FIXTURE_SNAPSHOT_REV1));
    expect(d.isEmpty).toBe(true);
    expect(d.totalChanges).toBe(0);
  });

  it('detects the fixture rev1 -> rev2 changes', () => {
    const d = diffTechPackSnapshots(asSnapshot(FIXTURE_SNAPSHOT_REV1), asSnapshot(FIXTURE_SNAPSHOT_REV2));
    expect(d.isEmpty).toBe(false);
    // Header: title + base_size changed; size_range unchanged.
    expect(d.header.map((f) => f.field).sort()).toEqual(['base_size', 'title']);
    expect(d.header.find((f) => f.field === 'base_size')).toMatchObject({ from: 'M', to: 'L' });

    // BOM: fabric qty changed, rib trim added, neck tape removed.
    expect(d.bom.changed).toHaveLength(1);
    expect(d.bom.changed[0]).toMatchObject({ label: expect.stringContaining('Cotton jersey') });
    expect(d.bom.changed[0]?.fields).toEqual([{ field: 'quantity', from: '1.8', to: '2.1' }]);
    expect(d.bom.added).toHaveLength(1);
    expect(d.bom.added[0]?.label).toContain('Rib trim');
    expect(d.bom.removed).toHaveLength(1);
    expect(d.bom.removed[0]?.label).toContain('Neck tape');

    // Measurements: CW size M 58 -> 59.
    expect(d.measurements.changed).toHaveLength(1);
    expect(d.measurements.changed[0]?.fields).toEqual([
      { field: 'value', from: '58', to: '59' },
    ]);

    // Construction: hem note changed.
    expect(d.construction.changed).toHaveLength(1);
    expect(d.construction.changed[0]?.fields).toEqual([
      { field: 'notes', from: '2-needle coverstitch', to: '2-needle coverstitch, 3mm topstitch' },
    ]);

    // Artwork + colorways: colorway Sage added, artwork unchanged.
    expect(d.artwork.added).toHaveLength(0);
    expect(d.artwork.changed).toHaveLength(0);
    expect(d.colorways.added).toHaveLength(1);
    expect(d.colorways.added[0]?.label).toBe('Sage');
  });

  it('flags an S615 section it does not know as a generic section change', () => {
    const a = asSnapshot({ ...FIXTURE_SNAPSHOT_REV1 });
    const b = asSnapshot({
      ...FIXTURE_SNAPSHOT_REV1,
      labels: [{ kind: 'main', label_type: 'woven', text: 'Atelier' }],
    });
    const d = diffTechPackSnapshots(a, b);
    expect(d.otherSections).toEqual([{ section: 'labels', summary: 'section added' }]);
    expect(d.isEmpty).toBe(false);
  });

  it('does not count a reordered-but-identical BOM as a change', () => {
    const reordered = asSnapshot({
      ...FIXTURE_SNAPSHOT_REV1,
      bom: [...asSnapshot(FIXTURE_SNAPSHOT_REV1).bom].reverse(),
    });
    const d = diffTechPackSnapshots(asSnapshot(FIXTURE_SNAPSHOT_REV1), reordered);
    expect(d.bom.added).toHaveLength(0);
    expect(d.bom.removed).toHaveLength(0);
    expect(d.bom.changed).toHaveLength(0);
  });
});
