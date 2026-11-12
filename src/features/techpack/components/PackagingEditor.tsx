// Tech pack editor — PackagingEditor (T13b): fold steps (≤ 4), polybag
// spec, carton spec with the size ratio (sizes must exist in the pack's
// size range and sum to units per carton; live validation, S615 guard).
'use client';

import type { TechPackSnapshot } from '@/lib/techpack-render/types';
import { sizeRatioError, snapshotSizes } from '../lib/validation';

export default function PackagingEditor(props: {
  snapshot: TechPackSnapshot;
  locked: boolean;
  onUpsertPackaging: (row: Record<string, unknown>) => void;
}) {
  const { snapshot, locked, onUpsertPackaging } = props;
  const pkg = ((snapshot.packaging ?? {}) as Record<string, unknown>);
  const sizes = snapshotSizes(snapshot);
  const foldSteps = (Array.isArray(pkg.fold_steps) ? pkg.fold_steps : []) as { asset_id?: string; text?: string }[];
  const ratio = (pkg.carton_size_ratio ?? {}) as Record<string, number>;
  const ratioError = sizeRatioError(ratio, sizes, pkg.carton_units === undefined ? null : Number(pkg.carton_units));

  const patch = (p: Record<string, unknown>) => onUpsertPackaging({ ...pkg, ...p });

  return (
    <section data-testid="techpack-packaging">
      <h3 className="text-sm font-semibold">Fold steps (max 4)</h3>
      <ol className="mt-2 space-y-2">
        {foldSteps.map((s, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            <span className="font-semibold">{i + 1}.</span>
            <input
              className="w-80 rounded border border-neutral-300 px-2 py-1"
              value={s.text ?? ''}
              disabled={locked}
              onChange={(e) => patch({ fold_steps: foldSteps.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })}
            />
            {!locked && (
              <button type="button" className="text-xs text-red-700" onClick={() => patch({ fold_steps: foldSteps.filter((_, j) => j !== i) })}>
                Remove
              </button>
            )}
          </li>
        ))}
      </ol>
      {!locked && foldSteps.length < 4 && (
        <button type="button" className="mt-2 rounded-md border border-neutral-300 px-2 py-1 text-sm" onClick={() => patch({ fold_steps: [...foldSteps, { text: '' }] })}>
          + fold step
        </button>
      )}
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <h3 className="col-span-full text-sm font-semibold">Polybag</h3>
        <label className="text-xs font-medium text-neutral-600">
          Size mm
          <input className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm" value={String(pkg.polybag_size_mm ?? '')} disabled={locked} onChange={(e) => patch({ polybag_size_mm: e.target.value })} />
        </label>
        <label className="text-xs font-medium text-neutral-600">
          Thickness (micron)
          <input type="number" min={0} className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm" value={Number(pkg.polybag_thickness_micron ?? '')} disabled={locked} onChange={(e) => patch({ polybag_thickness_micron: Number(e.target.value) })} />
        </label>
        <label className="text-xs font-medium text-neutral-600">
          Material
          <input className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm" value={String(pkg.polybag_material ?? '')} disabled={locked} onChange={(e) => patch({ polybag_material: e.target.value })} />
        </label>
        <label className="text-xs font-medium text-neutral-600">
          Closure
          <input className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm" value={String(pkg.polybag_closure ?? '')} disabled={locked} onChange={(e) => patch({ polybag_closure: e.target.value })} />
        </label>
        <label className="text-xs font-medium text-neutral-600 md:col-span-2">
          Warning text
          <input className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm" value={String(pkg.polybag_warning ?? '')} disabled={locked} onChange={(e) => patch({ polybag_warning: e.target.value })} />
        </label>
        <label className="text-xs font-medium text-neutral-600">
          Print
          <input className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm" value={String(pkg.polybag_print ?? '')} disabled={locked} onChange={(e) => patch({ polybag_print: e.target.value })} />
        </label>
        <label className="text-xs font-medium text-neutral-600">
          Units per bag
          <input type="number" min={0} className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm" value={Number(pkg.polybag_units ?? '')} disabled={locked} onChange={(e) => patch({ polybag_units: Number(e.target.value) })} />
        </label>
        <h3 className="col-span-full mt-2 text-sm font-semibold">Carton</h3>
        <label className="text-xs font-medium text-neutral-600">
          Size mm
          <input className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm" value={String(pkg.carton_size_mm ?? '')} disabled={locked} onChange={(e) => patch({ carton_size_mm: e.target.value })} />
        </label>
        <label className="text-xs font-medium text-neutral-600">
          Ply
          <input type="number" min={0} className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm" value={Number(pkg.carton_ply ?? '')} disabled={locked} onChange={(e) => patch({ carton_ply: Number(e.target.value) })} />
        </label>
        <label className="text-xs font-medium text-neutral-600">
          Max weight kg
          <input type="number" min={0} step="0.01" className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm" value={Number(pkg.carton_max_kg ?? '')} disabled={locked} onChange={(e) => patch({ carton_max_kg: Number(e.target.value) })} />
        </label>
        <label className="text-xs font-medium text-neutral-600">
          Units per carton
          <input type="number" min={0} className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm" value={Number(pkg.carton_units ?? '')} disabled={locked} onChange={(e) => patch({ carton_units: Number(e.target.value) })} />
        </label>
        <label className="text-xs font-medium text-neutral-600">
          Assortment
          <select className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm" value={String(pkg.carton_assortment ?? '')} disabled={locked} onChange={(e) => patch({ carton_assortment: e.target.value || null })}>
            <option value="">—</option>
            <option value="solid">solid</option>
            <option value="ratio">ratio</option>
          </select>
        </label>
        <label className="text-xs font-medium text-neutral-600">
          Tape
          <input className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm" value={String(pkg.carton_tape ?? '')} disabled={locked} onChange={(e) => patch({ carton_tape: e.target.value })} />
        </label>
        <div className="text-xs font-medium text-neutral-600 md:col-span-2">
          Size ratio (must sum to units per carton)
          <div className="mt-1 flex flex-wrap gap-2">
            {sizes.map((s) => (
              <label key={s} className="flex items-center gap-1 text-sm font-normal">
                {s}
                <input
                  type="number" min={0}
                  className={`w-14 rounded border px-1 py-0.5 ${ratioError ? 'border-red-500 bg-red-50' : 'border-neutral-300'}`}
                  value={ratio[s] ?? ''}
                  disabled={locked}
                  onChange={(e) => {
                    const next = { ...ratio };
                    if (e.target.value === '') delete next[s];
                    else next[s] = Number(e.target.value);
                    patch({ carton_size_ratio: next });
                  }}
                />
              </label>
            ))}
          </div>
          <span className={`text-sm ${ratioError ? 'text-red-700' : 'text-green-700'}`} data-testid="size-ratio-check">
            {ratioError ?? `Ratio sums to ${Object.values(ratio).reduce((n, v) => n + v, 0)} — matches the carton.`}
          </span>
        </div>
      </div>
    </section>
  );
}
