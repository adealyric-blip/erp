// Fixture snapshots for T15 (Approval UX + revisions).
// Shape is exactly what S600 `ds_tech_pack_snapshot(tp)` returns:
//   { tech_pack, design, size_range, colorways, bom, measurements,
//     construction, artwork }
// No invented fields: every key below exists in the S600 snapshot or in
// the S600 source tables. Rev 2 changes, relative to rev 1:
//   - BOM: main fabric qty 1.8 -> 2.1 m, rib trim added, neck tape removed
//   - Measurements: chest width (CW) size M 58 -> 59 cm
//   - Construction: hem operation note changed
//   - Header: base_size M -> L, title gained a season suffix
// S615 sections (header, pom_markers, labels, hangtags, packaging,
// template) are NOT in this fixture — S615 has not landed yet; the diff
// tolerates them when present (see RevisionDiff).

export interface FixtureSnapshot {
  tech_pack: Record<string, unknown>;
  design: Record<string, unknown>;
  size_range: Record<string, unknown> | null;
  colorways: Array<Record<string, unknown>>;
  bom: Array<Record<string, unknown>>;
  measurements: Array<Record<string, unknown>>;
  construction: Array<Record<string, unknown>>;
  artwork: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export const FIXTURE_TECH_PACK_ID = '00000000-0000-4000-8000-000000000001';
export const FIXTURE_DESIGN_ID = '00000000-0000-4000-8000-000000000002';

export const FIXTURE_SNAPSHOT_REV1: FixtureSnapshot = {
  tech_pack: {
    id: FIXTURE_TECH_PACK_ID,
    revision: 1,
    style_number: 'AT-BOX-TEE-001',
    title: 'Boxy Tee — SS27',
    size_range_id: '00000000-0000-4000-8000-000000000010',
    base_size: 'M',
    status: 'approved',
  },
  design: {
    id: FIXTURE_DESIGN_ID,
    name: 'Boxy Tee',
    style_number: 'AT-BOX-TEE-001',
    product_type: 'tee',
  },
  size_range: {
    id: '00000000-0000-4000-8000-000000000010',
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
  },
  colorways: [
    { id: '00000000-0000-4000-8000-000000000020', name: 'Ecru', hex: '#EFE7D8' },
    { id: '00000000-0000-4000-8000-000000000021', name: 'Black', hex: '#111111' },
  ],
  bom: [
    {
      kind: 'fabric',
      placement: 'body',
      description: 'Cotton jersey 180gsm',
      quantity: 1.8,
      uom: 'm',
      unit_cost: 4.2,
      sort: 0,
    },
    {
      kind: 'trim',
      placement: 'neck tape',
      description: 'Neck tape 10mm',
      quantity: 0.6,
      uom: 'm',
      unit_cost: 0.15,
      sort: 1,
    },
    {
      kind: 'trim',
      placement: 'hem',
      description: 'Coverstitch thread',
      quantity: 12,
      uom: 'm',
      unit_cost: 0.02,
      sort: 2,
    },
  ],
  measurements: [
    { pom: 'CW', name: 'Chest width', size: 'S', value: 55, tol_plus: 0.5, tol_minus: 0.5 },
    { pom: 'CW', name: 'Chest width', size: 'M', value: 58, tol_plus: 0.5, tol_minus: 0.5 },
    { pom: 'CW', name: 'Chest width', size: 'L', value: 61, tol_plus: 0.5, tol_minus: 0.5 },
    { pom: 'BL', name: 'Body length', size: 'M', value: 68, tol_plus: 0.5, tol_minus: 0.5 },
  ],
  construction: [
    {
      area: 'hem',
      operation: 'Coverstitch hem',
      stitch_type: '406',
      spi: 12,
      seam_allowance_mm: 25,
      notes: '2-needle coverstitch',
      sort: 0,
    },
    {
      area: 'neckline',
      operation: 'Bind neckline',
      stitch_type: '301',
      spi: 12,
      seam_allowance_mm: 10,
      notes: 'Self-fabric binding',
      sort: 1,
    },
  ],
  artwork: [
    {
      view: 'front',
      placement: 'center chest',
      technique: 'screen_print',
      width_mm: 200,
      height_mm: 150,
      offset_ref: 'HPS',
      pantone_codes: ['Black 6 C'],
      sort: 0,
    },
  ],
};

export const FIXTURE_SNAPSHOT_REV2: FixtureSnapshot = {
  tech_pack: {
    id: '00000000-0000-4000-8000-000000000003',
    revision: 2,
    style_number: 'AT-BOX-TEE-001',
    title: 'Boxy Tee — SS27 (v2)',
    size_range_id: '00000000-0000-4000-8000-000000000010',
    base_size: 'L',
    status: 'in_review',
  },
  design: {
    id: FIXTURE_DESIGN_ID,
    name: 'Boxy Tee',
    style_number: 'AT-BOX-TEE-001',
    product_type: 'tee',
  },
  size_range: {
    id: '00000000-0000-4000-8000-000000000010',
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
  },
  colorways: [
    { id: '00000000-0000-4000-8000-000000000020', name: 'Ecru', hex: '#EFE7D8' },
    { id: '00000000-0000-4000-8000-000000000021', name: 'Black', hex: '#111111' },
    { id: '00000000-0000-4000-8000-000000000022', name: 'Sage', hex: '#9CAF88' },
  ],
  bom: [
    {
      kind: 'fabric',
      placement: 'body',
      description: 'Cotton jersey 180gsm',
      quantity: 2.1,
      uom: 'm',
      unit_cost: 4.2,
      sort: 0,
    },
    {
      kind: 'trim',
      placement: 'rib',
      description: 'Rib trim 1x1',
      quantity: 0.4,
      uom: 'm',
      unit_cost: 0.9,
      sort: 1,
    },
    {
      kind: 'trim',
      placement: 'hem',
      description: 'Coverstitch thread',
      quantity: 12,
      uom: 'm',
      unit_cost: 0.02,
      sort: 2,
    },
  ],
  measurements: [
    { pom: 'CW', name: 'Chest width', size: 'S', value: 55, tol_plus: 0.5, tol_minus: 0.5 },
    { pom: 'CW', name: 'Chest width', size: 'M', value: 59, tol_plus: 0.5, tol_minus: 0.5 },
    { pom: 'CW', name: 'Chest width', size: 'L', value: 61, tol_plus: 0.5, tol_minus: 0.5 },
    { pom: 'BL', name: 'Body length', size: 'M', value: 68, tol_plus: 0.5, tol_minus: 0.5 },
  ],
  construction: [
    {
      area: 'hem',
      operation: 'Coverstitch hem',
      stitch_type: '406',
      spi: 12,
      seam_allowance_mm: 25,
      notes: '2-needle coverstitch, 3mm topstitch',
      sort: 0,
    },
    {
      area: 'neckline',
      operation: 'Bind neckline',
      stitch_type: '301',
      spi: 12,
      seam_allowance_mm: 10,
      notes: 'Self-fabric binding',
      sort: 1,
    },
  ],
  artwork: [
    {
      view: 'front',
      placement: 'center chest',
      technique: 'screen_print',
      width_mm: 200,
      height_mm: 150,
      offset_ref: 'HPS',
      pantone_codes: ['Black 6 C'],
      sort: 0,
    },
  ],
};

/** Demo tech pack row (mirrors the S600 tech_packs columns used by the page). */
export const FIXTURE_TECH_PACK = {
  id: FIXTURE_TECH_PACK_ID,
  design_id: FIXTURE_DESIGN_ID,
  version_id: '00000000-0000-4000-8000-000000000030',
  revision: 2,
  style_number: 'AT-BOX-TEE-001',
  title: 'Boxy Tee — SS27 (v2)',
  size_range_id: '00000000-0000-4000-8000-000000000010',
  base_size: 'L',
  status: 'in_review',
  approved_by: null,
  approved_at: null,
  released_at: null,
  pdf_asset_id: null,
  preview_pdf_asset_id: null,
  created_at: '2026-11-11T10:00:00.000Z',
};

/** Demo revision log: rev 1 approved, rev 2 created (new revision = ds_create_tech_pack). */
export const FIXTURE_REVISIONS = [
  {
    id: '00000000-0000-4000-8000-000000000040',
    tech_pack_id: FIXTURE_TECH_PACK_ID,
    revision: 1,
    from_status: 'in_review',
    to_status: 'approved',
    snapshot: FIXTURE_SNAPSHOT_REV1,
    change_summary: 'Approved for production',
    created_by: '00000000-0000-4000-8000-000000000050',
    created_at: '2026-11-10T15:30:00.000Z',
  },
  {
    id: '00000000-0000-4000-8000-000000000041',
    tech_pack_id: FIXTURE_TECH_PACK_ID,
    revision: 2,
    from_status: 'approved',
    to_status: 'in_review',
    snapshot: FIXTURE_SNAPSHOT_REV2,
    change_summary: 'New revision — fabric usage + chest width updated',
    created_by: '00000000-0000-4000-8000-000000000051',
    created_at: '2026-11-11T10:00:00.000Z',
  },
];

/** Demo craft_jobs rows for the two T14 PDF kinds. */
export const FIXTURE_PDF_JOBS = [
  {
    id: '00000000-0000-4000-8000-000000000060',
    kind: 'techpack_pdf',
    status: 'succeeded',
    error: null,
    finished_at: '2026-11-10T15:32:00.000Z',
    output: { asset_id: '00000000-0000-4000-8000-000000000070' },
  },
  {
    id: '00000000-0000-4000-8000-000000000061',
    kind: 'techpack_preview_pdf',
    status: 'succeeded',
    error: null,
    finished_at: '2026-11-10T15:33:00.000Z',
    output: { asset_id: '00000000-0000-4000-8000-000000000071' },
  },
];
