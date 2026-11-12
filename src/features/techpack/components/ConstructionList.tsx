// Tech pack editor — ConstructionList (T13): construction rows (area,
// operation, ISO 4915 stitch, SPI, seam allowance, notes).
'use client';

import { useState } from 'react';
import type { TechPackSnapshot } from '@/lib/techpack-render/types';

export default function ConstructionList(props: {
  snapshot: TechPackSnapshot;
  locked: boolean;
  onUpsertConstruction: (row: Record<string, unknown>) => void;
  onDeleteConstruction: (id: string) => void;
}) {
  const { snapshot, locked, onUpsertConstruction, onDeleteConstruction } = props;
  const rows = snapshot.construction ?? [];
  const [draft, setDraft] = useState({ area: '', operation: '', stitch_type: '', spi: '', seam_allowance_mm: '', notes: '' });

  return (
    <section data-testid="techpack-construction">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-neutral-500">
            <th className="py-1 pr-2">#</th><th className="py-1 pr-2">Area</th><th className="py-1 pr-2">Operation</th>
            <th className="py-1 pr-2">Stitch (ISO 4915)</th><th className="py-1 pr-2">SPI</th><th className="py-1 pr-2">Seam allow. mm</th><th className="py-1 pr-2">Notes</th><th />
          </tr>
        </thead>
        <tbody>
          {rows.map((c, i) => (
            <tr key={String(c.id ?? i)} className="border-b">
              <td className="py-1 pr-2">{String(c.callout_no ?? i + 1)}</td>
              <td className="py-1 pr-2">{String(c.area ?? '')}</td>
              <td className="py-1 pr-2">{String(c.operation ?? '')}</td>
              <td className="py-1 pr-2">{String(c.stitch_type ?? '')}</td>
              <td className="py-1 pr-2">{String(c.spi ?? '')}</td>
              <td className="py-1 pr-2">{String(c.seam_allowance_mm ?? '')}</td>
              <td className="py-1 pr-2">{String(c.notes ?? '')}</td>
              <td>{!locked && c.id !== undefined && c.id !== null && (<button type="button" className="text-xs text-red-700" onClick={() => onDeleteConstruction(String(c.id))}>Remove</button>)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!locked && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          {(['area', 'operation', 'stitch_type', 'spi', 'seam_allowance_mm', 'notes'] as const).map((k) => (
            <label key={k} className="text-xs font-medium text-neutral-600">
              {k.replace(/_/g, ' ')}
              <input
                className="mt-1 block w-32 rounded border border-neutral-300 px-2 py-1 text-sm"
                value={draft[k]}
                onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
              />
            </label>
          ))}
          <button
            type="button"
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            disabled={!draft.area || !draft.operation}
            onClick={() => {
              onUpsertConstruction({ ...draft, spi: draft.spi === '' ? null : Number(draft.spi), seam_allowance_mm: draft.seam_allowance_mm === '' ? null : Number(draft.seam_allowance_mm), sort: rows.length });
              setDraft({ area: '', operation: '', stitch_type: '', spi: '', seam_allowance_mm: '', notes: '' });
            }}
          >
            Add step
          </button>
        </div>
      )}
    </section>
  );
}
