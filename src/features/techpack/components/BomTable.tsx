// Tech pack editor — BomTable (T13): BOM lines with a materials picker.
// One line may be the main fabric (S615 partial unique index); unit cost
// is internal and never reaches the supplier snapshot.
'use client';

import { useState } from 'react';
import type { TechPackSnapshot } from '@/lib/techpack-render/types';
import type { TechPackLookups } from '../types';

const KINDS = ['fabric', 'trim', 'label', 'packaging', 'thread', 'hardware', 'interlining', 'other'] as const;

export default function BomTable(props: {
  snapshot: TechPackSnapshot;
  lookups: TechPackLookups;
  locked: boolean;
  onUpsertBomLine: (line: Record<string, unknown>) => void;
  onDeleteBomLine: (id: string) => void;
}) {
  const { snapshot, lookups, locked, onUpsertBomLine, onDeleteBomLine } = props;
  const bom = snapshot.bom ?? [];
  const [draft, setDraft] = useState({ material_id: '', kind: 'fabric', placement: 'body', description: '', quantity: 1, uom: 'm', unit_cost: '' });
  const material = lookups.materials.find((m) => m.id === draft.material_id);

  return (
    <section data-testid="techpack-bom">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-neutral-500">
            <th className="py-1 pr-2">#</th><th className="py-1 pr-2">Component</th><th className="py-1 pr-2">Placement</th>
            <th className="py-1 pr-2">Material</th><th className="py-1 pr-2">Qty</th><th className="py-1 pr-2">UOM</th>
            <th className="py-1 pr-2">Unit cost</th><th className="py-1 pr-2">Main fabric</th><th />
          </tr>
        </thead>
        <tbody>
          {bom.map((b, i) => (
            <tr key={String(b.id ?? i)} className="border-b">
              <td className="py-1 pr-2">{i + 1}</td>
              <td className="py-1 pr-2">{String(b.description ?? '')}</td>
              <td className="py-1 pr-2">{String(b.placement ?? '')}</td>
              <td className="py-1 pr-2">{String((b as Record<string, unknown>).material_code ?? '')}</td>
              <td className="py-1 pr-2">
                <input
                  type="number" step="0.01" min={0}
                  className="w-20 rounded border border-neutral-300 px-1 py-0.5"
                  value={Number(b.quantity ?? 0)}
                  disabled={locked}
                  onChange={(e) => onUpsertBomLine({ ...b, quantity: Number(e.target.value) })}
                />
              </td>
              <td className="py-1 pr-2">{String(b.uom ?? '')}</td>
              <td className="py-1 pr-2">
                <input
                  type="number" step="0.01" min={0}
                  className="w-20 rounded border border-neutral-300 px-1 py-0.5"
                  value={b.unit_cost === null || b.unit_cost === undefined ? '' : Number(b.unit_cost)}
                  disabled={locked}
                  onChange={(e) => onUpsertBomLine({ ...b, unit_cost: e.target.value === '' ? null : Number(e.target.value) })}
                />
              </td>
              <td className="py-1 pr-2">
                <input
                  type="checkbox"
                  checked={Boolean(b.is_main_fabric)}
                  disabled={locked}
                  onChange={(e) => onUpsertBomLine({ ...b, is_main_fabric: e.target.checked })}
                />
              </td>
              <td>
                {!locked && (
                  <button type="button" className="text-xs text-red-700" onClick={() => b.id && onDeleteBomLine(String(b.id))}>
                    Remove
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!locked && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="text-xs font-medium text-neutral-600">
            Material
            <select
              className="mt-1 block rounded border border-neutral-300 px-2 py-1 text-sm"
              value={draft.material_id}
              onChange={(e) => {
                const m = lookups.materials.find((x) => x.id === e.target.value);
                setDraft((d) => ({ ...d, material_id: e.target.value, description: m ? `${m.name} (${m.code})` : d.description, kind: (m?.kind as typeof d.kind) ?? d.kind }));
              }}
            >
              <option value="">Pick a material…</option>
              {lookups.materials.map((m) => (
                <option key={m.id} value={m.id}>{m.code} — {m.name}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-neutral-600">
            Kind
            <select className="mt-1 block rounded border border-neutral-300 px-2 py-1 text-sm" value={draft.kind} onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value }))}>
              {KINDS.map((k) => (<option key={k} value={k}>{k}</option>))}
            </select>
          </label>
          <label className="text-xs font-medium text-neutral-600">
            Placement
            <input className="mt-1 block rounded border border-neutral-300 px-2 py-1 text-sm" value={draft.placement} onChange={(e) => setDraft((d) => ({ ...d, placement: e.target.value }))} />
          </label>
          <label className="text-xs font-medium text-neutral-600">
            Description
            <input className="mt-1 block w-56 rounded border border-neutral-300 px-2 py-1 text-sm" value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />
          </label>
          <label className="text-xs font-medium text-neutral-600">
            Qty
            <input type="number" step="0.01" min={0} className="mt-1 block w-20 rounded border border-neutral-300 px-2 py-1 text-sm" value={draft.quantity} onChange={(e) => setDraft((d) => ({ ...d, quantity: Number(e.target.value) }))} />
          </label>
          <button
            type="button"
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            disabled={!draft.description}
            onClick={() => {
              onUpsertBomLine({ ...draft, material_code: material?.code ?? '', unit_cost: draft.unit_cost === '' ? null : Number(draft.unit_cost), sort: bom.length });
              setDraft({ material_id: '', kind: 'fabric', placement: 'body', description: '', quantity: 1, uom: 'm', unit_cost: '' });
            }}
          >
            Add line
          </button>
        </div>
      )}
      <p className="mt-2 text-xs text-neutral-500">Unit cost is internal — the supplier snapshot strips it (S615).</p>
    </section>
  );
}
