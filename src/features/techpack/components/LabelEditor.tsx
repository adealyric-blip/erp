// Tech pack editor — LabelEditor (T13b): labels by kind (main / size /
// care / content / flag / extra) with the ISO 3758 care-symbol picker and
// fibre % inputs that must total 100 (live total + error, S615 guard).
'use client';

import { useState } from 'react';
import type { TechPackSnapshot } from '@/lib/techpack-render/types';
import { ISO_3758_SYMBOLS } from '@/lib/techpack-render/types';
import { fibreTotal } from '../lib/validation';

const KINDS = ['main', 'size', 'care', 'content', 'flag', 'extra'] as const;
const LABEL_TYPES = ['woven', 'printed', 'heat_transfer', 'satin', 'leather', 'patch', 'other'] as const;
const ATTACHMENTS = ['sewn_in_seam', 'sewn_4_sides', 'loop', 'heat_seal', 'other'] as const;

export default function LabelEditor(props: {
  snapshot: TechPackSnapshot;
  locked: boolean;
  onUpsertLabel: (row: Record<string, unknown>) => void;
  onDeleteLabel: (id: string) => void;
}) {
  const { snapshot, locked, onUpsertLabel, onDeleteLabel } = props;
  const labels = (snapshot.labels ?? []) as Record<string, unknown>[];
  const [kind, setKind] = useState<(typeof KINDS)[number]>('main');
  const label = labels.find((l) => String(l.kind) === kind);
  const fibre = (Array.isArray(label?.fibre_content) ? label.fibre_content : []) as { fibre: string; pct: number }[];
  const total = fibreTotal(fibre);
  const symbols = (Array.isArray(label?.care_symbols) ? label.care_symbols : []) as string[];

  const patch = (p: Record<string, unknown>) => {
    if (label) onUpsertLabel({ ...label, ...p });
    else onUpsertLabel({ kind, ...p, sort: labels.length });
  };

  return (
    <section data-testid="techpack-labels">
      <div className="mb-3 flex flex-wrap gap-1" role="tablist" aria-label="Label kind">
        {KINDS.map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={kind === k}
            className={`rounded-md border px-3 py-1 text-sm ${kind === k ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 bg-white'}`}
            onClick={() => setKind(k)}
          >
            {k}{labels.some((l) => String(l.kind) === k) ? ' ✓' : ''}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <label className="text-xs font-medium text-neutral-600">
          Type
          <select className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm" value={String(label?.label_type ?? '')} disabled={locked} onChange={(e) => patch({ label_type: e.target.value || null })}>
            <option value="">—</option>
            {LABEL_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
          </select>
        </label>
        <label className="text-xs font-medium text-neutral-600">
          Size mm (W × H)
          <span className="flex gap-1">
            <input type="number" min={0} className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm" value={Number(label?.width_mm ?? '')} disabled={locked} onChange={(e) => patch({ width_mm: Number(e.target.value) })} />
            <input type="number" min={0} className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm" value={Number(label?.height_mm ?? '')} disabled={locked} onChange={(e) => patch({ height_mm: Number(e.target.value) })} />
          </span>
        </label>
        <label className="text-xs font-medium text-neutral-600">
          Colour
          <input className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm" value={String(label?.color ?? '')} disabled={locked} onChange={(e) => patch({ color: e.target.value })} />
        </label>
        <label className="text-xs font-medium text-neutral-600">
          Attachment
          <select className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm" value={String(label?.attachment ?? '')} disabled={locked} onChange={(e) => patch({ attachment: e.target.value || null })}>
            <option value="">—</option>
            {ATTACHMENTS.map((t) => (<option key={t} value={t}>{t}</option>))}
          </select>
        </label>
        <label className="text-xs font-medium text-neutral-600">
          Placement
          <input className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm" value={String(label?.placement ?? '')} disabled={locked} onChange={(e) => patch({ placement: e.target.value })} />
        </label>
        <label className="text-xs font-medium text-neutral-600 md:col-span-2">
          Text
          <input className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm" value={String(label?.text ?? '')} disabled={locked} onChange={(e) => patch({ text: e.target.value })} />
        </label>
        <label className="text-xs font-medium text-neutral-600">
          Country of origin
          <input maxLength={2} className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm uppercase" value={String(label?.country_of_origin ?? '')} disabled={locked} onChange={(e) => patch({ country_of_origin: e.target.value.toUpperCase() })} />
        </label>
      </div>
      {kind === 'care' && (
        <div className="mt-3">
          <h3 className="text-sm font-semibold">Care label — fibre content must total 100%</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {fibre.map((f, i) => (
              <span key={i} className="flex items-center gap-1 text-sm">
                <input className="w-24 rounded border border-neutral-300 px-2 py-1" value={f.fibre} disabled={locked} onChange={(e) => patch({ fibre_content: fibre.map((x, j) => (j === i ? { ...x, fibre: e.target.value } : x)) })} />
                <input type="number" min={0} max={100} className="w-16 rounded border border-neutral-300 px-2 py-1" value={f.pct} disabled={locked} onChange={(e) => patch({ fibre_content: fibre.map((x, j) => (j === i ? { ...x, pct: Number(e.target.value) } : x)) })} />
                %
              </span>
            ))}
            {!locked && (
              <button type="button" className="rounded-md border border-neutral-300 px-2 py-1 text-sm" onClick={() => patch({ fibre_content: [...fibre, { fibre: '', pct: 0 }] })}>
                + fibre
              </button>
            )}
            <span className={`text-sm font-semibold ${total === null || total === 100 ? 'text-green-700' : 'text-red-700'}`} data-testid="fibre-total">
              Total: {total === null ? '—' : `${total}%`}{total !== null && total !== 100 ? ' — must total 100' : ''}
            </span>
          </div>
          <h4 className="mt-3 text-xs font-semibold text-neutral-600">ISO 3758 care symbols</h4>
          <div className="mt-1 flex flex-wrap gap-1">
            {ISO_3758_SYMBOLS.map((s) => {
              const on = symbols.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={on}
                  disabled={locked}
                  className={`rounded-full border px-2 py-0.5 text-xs ${on ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 bg-white'}`}
                  onClick={() => patch({ care_symbols: on ? symbols.filter((x) => x !== s) : [...symbols, s] })}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {label?.id !== undefined && label?.id !== null && !locked && (
        <button type="button" className="mt-3 text-xs text-red-700" onClick={() => onDeleteLabel(String(label.id))}>
          Remove {kind} label
        </button>
      )}
    </section>
  );
}
