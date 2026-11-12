// Tech pack editor — HeaderPanel (T13): style no, season, size range,
// base size, description, measure unit. The header block is identical on
// every template page, so it sits above the tabs.
'use client';

import type { TechPackSnapshot } from '@/lib/techpack-render/types';
import type { TechPackLookups } from '../types';
import { snapshotSizes } from '../lib/validation';

export default function HeaderPanel(props: {
  snapshot: TechPackSnapshot;
  lookups: TechPackLookups;
  locked: boolean;
  onUpdateHeader: (patch: Record<string, unknown>) => void;
}) {
  const { snapshot, lookups, locked, onUpdateHeader } = props;
  const tp = (snapshot.tech_pack ?? {}) as Record<string, unknown>;
  const header = (snapshot.header ?? {}) as Record<string, unknown>;
  const sizes = snapshotSizes(snapshot);
  const baseSize = String(header.base_size ?? tp.base_size ?? '');

  return (
    <section className="rounded-md border border-neutral-300 bg-white p-4" data-testid="techpack-header">
      <h2 className="text-sm font-semibold">Header — on every page</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <label className="text-xs font-medium text-neutral-600">
          Style no
          <input
            className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm"
            value={String(header.style_number ?? tp.style_number ?? '')}
            disabled={locked}
            onChange={(e) => onUpdateHeader({ style_number: e.target.value })}
          />
        </label>
        <label className="text-xs font-medium text-neutral-600">
          Season
          <select
            className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm"
            value={String((header.season_id as string | undefined) ?? (tp.season_id as string | undefined) ?? '')}
            disabled={locked}
            onChange={(e) => onUpdateHeader({ season_id: e.target.value || null })}
          >
            <option value="">—</option>
            {lookups.seasons.map((s) => (
              <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-neutral-600">
          Size range
          <select
            className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm"
            value={String((tp.size_range_id as string | undefined) ?? '')}
            disabled={locked}
            onChange={(e) => onUpdateHeader({ size_range_id: e.target.value || null })}
          >
            <option value="">—</option>
            {lookups.sizeRanges.map((r) => (
              <option key={r.id} value={r.id}>{r.name} ({r.sizes.join(', ')})</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-neutral-600">
          Base size
          <select
            className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm"
            value={baseSize}
            disabled={locked || sizes.length === 0}
            onChange={(e) => onUpdateHeader({ base_size: e.target.value })}
          >
            {sizes.map((s) => (
              <option key={s} value={s}>{s}{s === baseSize ? ' (base)' : ''}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-neutral-600 md:col-span-3">
          Description
          <input
            className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm"
            value={String(header.description ?? tp.description ?? '')}
            disabled={locked}
            onChange={(e) => onUpdateHeader({ description: e.target.value })}
          />
        </label>
        <label className="text-xs font-medium text-neutral-600">
          Unit
          <select
            className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm"
            value={String(header.measure_unit ?? tp.measure_unit ?? 'cm')}
            disabled={locked}
            onChange={(e) => onUpdateHeader({ measure_unit: e.target.value })}
          >
            <option value="cm">cm</option>
            <option value="in">in</option>
          </select>
        </label>
      </div>
    </section>
  );
}
