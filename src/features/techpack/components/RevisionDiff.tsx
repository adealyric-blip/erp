// RevisionDiff — T15. Diff two `tech_pack_revisions.snapshot` JSONs
// (S600 `ds_tech_pack_snapshot` shape; S615 sections tolerated as generic
// section summaries until S615 lands). BOM / measurement / construction /
// artwork changes are field-level; additions and removals are listed.
// Pure `diffTechPackSnapshots` is unit-tested; the component only renders it.

export interface TechPackSnapshot {
  tech_pack: Record<string, unknown>;
  design: Record<string, unknown> | null;
  size_range: Record<string, unknown> | null;
  colorways: Array<Record<string, unknown>>;
  bom: Array<Record<string, unknown>>;
  measurements: Array<Record<string, unknown>>;
  construction: Array<Record<string, unknown>>;
  artwork: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface FieldChange {
  field: string;
  from: string;
  to: string;
}

export interface RowChange {
  key: string;
  kind: 'added' | 'removed' | 'changed';
  label: string;
  fields: FieldChange[];
}

export interface SectionDiff {
  added: RowChange[];
  removed: RowChange[];
  changed: RowChange[];
}

export interface OtherSectionChange {
  section: string;
  summary: string;
}

export interface TechPackDiff {
  header: FieldChange[];
  bom: SectionDiff;
  measurements: SectionDiff;
  construction: SectionDiff;
  artwork: SectionDiff;
  colorways: SectionDiff;
  otherSections: OtherSectionChange[];
  totalChanges: number;
  isEmpty: boolean;
}

const KNOWN_KEYS = new Set([
  'tech_pack',
  'design',
  'size_range',
  'colorways',
  'bom',
  'measurements',
  'construction',
  'artwork',
]);

const EMPTY_SECTION: SectionDiff = { added: [], removed: [], changed: [] };

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (Array.isArray(v)) return v.map((x) => String(x)).join(', ');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || a === undefined || b === null || b === undefined) return a === b;
  const na = typeof a === 'number' ? a : Number(a);
  const nb = typeof b === 'number' ? b : Number(b);
  if (typeof a === 'number' || typeof b === 'number') {
    return !Number.isNaN(na) && !Number.isNaN(nb) && na === nb;
  }
  return String(a) === String(b);
}

function compareFields(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
  fields: string[],
): FieldChange[] {
  const out: FieldChange[] = [];
  for (const f of fields) {
    if (!valuesEqual(a[f], b[f])) {
      out.push({ field: f, from: formatValue(a[f]), to: formatValue(b[f]) });
    }
  }
  return out;
}

function diffRows(
  aRows: Array<Record<string, unknown>>,
  bRows: Array<Record<string, unknown>>,
  keyOf: (r: Record<string, unknown>) => string,
  labelOf: (r: Record<string, unknown>) => string,
  fields: string[],
): SectionDiff {
  const aByKey = new Map(aRows.map((r) => [keyOf(r), r]));
  const bByKey = new Map(bRows.map((r) => [keyOf(r), r]));
  const added: RowChange[] = [];
  const removed: RowChange[] = [];
  const changed: RowChange[] = [];
  for (const [k, bRow] of bByKey) {
    const aRow = aByKey.get(k);
    if (!aRow) {
      added.push({ key: k, kind: 'added', label: labelOf(bRow), fields: [] });
    } else {
      const fc = compareFields(aRow, bRow, fields);
      if (fc.length > 0) {
        changed.push({ key: k, kind: 'changed', label: labelOf(bRow), fields: fc });
      }
    }
  }
  for (const [k, aRow] of aByKey) {
    if (!bByKey.has(k)) {
      removed.push({ key: k, kind: 'removed', label: labelOf(aRow), fields: [] });
    }
  }
  return { added, removed, changed };
}

function asRows(v: unknown): Array<Record<string, unknown>> {
  return Array.isArray(v) ? (v as Array<Record<string, unknown>>) : [];
}

function asRecord(v: unknown): Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function summarizeOtherSection(a: unknown, b: unknown): string {
  if (Array.isArray(a) && Array.isArray(b)) {
    return `${a.length} row${a.length === 1 ? '' : 's'} → ${b.length} row${b.length === 1 ? '' : 's'}`;
  }
  if (a === undefined) return 'section added';
  if (b === undefined) return 'section removed';
  return 'section changed';
}

/**
 * Diff two snapshots. `a` is the older snapshot; pass `null` for the first
 * revision (no previous snapshot exists). S615 sections that are not part of
 * the S600 snapshot shape are reported as generic section changes, never
 * silently dropped.
 */
export function diffTechPackSnapshots(
  a: TechPackSnapshot | null,
  b: TechPackSnapshot,
): TechPackDiff {
  if (a === null) {
    return {
      header: [],
      bom: EMPTY_SECTION,
      measurements: EMPTY_SECTION,
      construction: EMPTY_SECTION,
      artwork: EMPTY_SECTION,
      colorways: EMPTY_SECTION,
      otherSections: [],
      totalChanges: 0,
      isEmpty: true,
    };
  }

  const aTp = asRecord(a.tech_pack);
  const bTp = asRecord(b.tech_pack);
  const header = compareFields(aTp, bTp, ['title', 'style_number', 'base_size', 'measure_unit']);
  const aSizes = asRecord(a.size_range).sizes;
  const bSizes = asRecord(b.size_range).sizes;
  if (!valuesEqual(JSON.stringify(aSizes ?? null), JSON.stringify(bSizes ?? null))) {
    header.push({
      field: 'size_range',
      from: Array.isArray(aSizes) ? aSizes.join(', ') : '—',
      to: Array.isArray(bSizes) ? bSizes.join(', ') : '—',
    });
  }

  const bom = diffRows(
    asRows(a.bom),
    asRows(b.bom),
    (r) => `${String(r.kind ?? '')}|${String(r.placement ?? '')}|${String(r.description ?? '')}`,
    (r) => `${String(r.description ?? '')} (${String(r.kind ?? '')}${r.placement ? ` · ${String(r.placement)}` : ''})`,
    ['quantity', 'uom', 'unit_cost', 'material_id', 'colorway_id', 'vendor_id', 'supplier_note'],
  );

  const measurements = diffRows(
    asRows(a.measurements),
    asRows(b.measurements),
    (r) => `${String(r.pom ?? '')}|${String(r.size ?? '')}`,
    (r) => `${String(r.pom ?? '')} ${String(r.name ?? '')} — size ${String(r.size ?? '')}`,
    ['value', 'tol_plus', 'tol_minus'],
  );

  const construction = diffRows(
    asRows(a.construction),
    asRows(b.construction),
    (r) => `${String(r.area ?? '')}|${String(r.operation ?? '')}`,
    (r) => `${String(r.area ?? '')} — ${String(r.operation ?? '')}`,
    ['stitch_type', 'spi', 'seam_allowance_mm', 'notes'],
  );

  const artwork = diffRows(
    asRows(a.artwork),
    asRows(b.artwork),
    (r) => `${String(r.view ?? 'front')}|${String(r.placement ?? '')}|${String(r.technique ?? '')}`,
    (r) => `${String(r.placement ?? '')} (${String(r.technique ?? '')})`,
    ['width_mm', 'height_mm', 'offset_ref', 'offset_x_mm', 'offset_y_mm', 'pantone_codes', 'stitch_count', 'notes'],
  );

  const colorways = diffRows(
    asRows(a.colorways),
    asRows(b.colorways),
    (r) => String(r.id ?? r.name ?? ''),
    (r) => String(r.name ?? r.id ?? ''),
    ['name', 'hex', 'pantone_codes'],
  );

  const otherSections: OtherSectionChange[] = [];
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of allKeys) {
    if (KNOWN_KEYS.has(k)) continue;
    if (JSON.stringify(a[k] ?? null) !== JSON.stringify(b[k] ?? null)) {
      otherSections.push({ section: k, summary: summarizeOtherSection(a[k], b[k]) });
    }
  }

  const count = (s: SectionDiff) => s.added.length + s.removed.length + s.changed.length;
  const totalChanges =
    header.length +
    count(bom) +
    count(measurements) +
    count(construction) +
    count(artwork) +
    count(colorways) +
    otherSections.length;

  return {
    header,
    bom,
    measurements,
    construction,
    artwork,
    colorways,
    otherSections,
    totalChanges,
    isEmpty: totalChanges === 0,
  };
}

function RowChangeList({ rows }: { rows: RowChange[] }) {
  if (rows.length === 0) return null;
  return (
    <ul className="mt-1 space-y-1">
      {rows.map((r) => (
        <li
          key={`${r.kind}:${r.key}`}
          data-testid={`diff-${r.kind}`}
          className={
            r.kind === 'added'
              ? 'rounded border border-green-300 bg-green-50 px-2 py-1 text-sm'
              : r.kind === 'removed'
                ? 'rounded border border-red-300 bg-red-50 px-2 py-1 text-sm line-through'
                : 'rounded border border-amber-300 bg-amber-50 px-2 py-1 text-sm'
          }
        >
          <span className="font-medium">
            {r.kind === 'added' ? '+ ' : r.kind === 'removed' ? '− ' : '~ '}
            {r.label}
          </span>
          {r.fields.map((f) => (
            <span key={f.field} className="ml-2 text-neutral-600 no-underline">
              {f.field}: {f.from} → <strong>{f.to}</strong>
            </span>
          ))}
        </li>
      ))}
    </ul>
  );
}

function DiffSection({
  title,
  section,
  emptyLabel,
}: {
  title: string;
  section: SectionDiff;
  emptyLabel: string;
}) {
  const total = section.added.length + section.removed.length + section.changed.length;
  return (
    <div data-testid={`diff-section-${title.toLowerCase().replace(/[^a-z]+/g, '-')}`}>
      <h4 className="mt-4 text-sm font-semibold">
        {title}{' '}
        <span className="font-normal text-neutral-500">
          ({total === 0 ? emptyLabel : `${total} change${total === 1 ? '' : 's'}`})
        </span>
      </h4>
      <RowChangeList rows={section.added} />
      <RowChangeList rows={section.removed} />
      <RowChangeList rows={section.changed} />
    </div>
  );
}

/**
 * Render the diff between two revision snapshots. `a` is the older snapshot
 * (null for the first revision); `b` is the newer one.
 */
export default function RevisionDiff({
  a,
  b,
  aLabel,
  bLabel,
}: {
  a: TechPackSnapshot | null;
  b: TechPackSnapshot;
  aLabel: string;
  bLabel: string;
}) {
  if (a === null) {
    return (
      <p data-testid="diff-first-revision" className="mt-2 text-sm text-neutral-500">
        First revision — no earlier snapshot to compare against.
      </p>
    );
  }
  const diff = diffTechPackSnapshots(a, b);
  return (
    <div data-testid="revision-diff" className="mt-2">
      <p className="text-sm text-neutral-600" data-testid="diff-summary">
        {aLabel} → {bLabel}:{' '}
        {diff.isEmpty
          ? 'no changes'
          : `${diff.totalChanges} change${diff.totalChanges === 1 ? '' : 's'}`}
      </p>
      {diff.header.length > 0 && (
        <div>
          <h4 className="mt-4 text-sm font-semibold">Header</h4>
          <ul className="mt-1 space-y-1">
            {diff.header.map((f) => (
              <li
                key={f.field}
                data-testid="diff-changed"
                className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-sm"
              >
                {f.field}: {f.from} → <strong>{f.to}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}
      <DiffSection title="Bill of materials" section={diff.bom} emptyLabel="unchanged" />
      <DiffSection title="Measurements" section={diff.measurements} emptyLabel="unchanged" />
      <DiffSection title="Construction" section={diff.construction} emptyLabel="unchanged" />
      <DiffSection title="Artwork" section={diff.artwork} emptyLabel="unchanged" />
      <DiffSection title="Colorways" section={diff.colorways} emptyLabel="unchanged" />
      {diff.otherSections.length > 0 && (
        <div>
          <h4 className="mt-4 text-sm font-semibold">Other sections</h4>
          <ul className="mt-1 space-y-1">
            {diff.otherSections.map((s) => (
              <li key={s.section} data-testid="diff-other-section" className="text-sm text-neutral-600">
                {s.section}: {s.summary}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
