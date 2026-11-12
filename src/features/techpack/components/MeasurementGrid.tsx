// Tech pack editor — MeasurementGrid (T13): POM x sizes grid with
// tolerance and the grade rule dialog (base value + increment per size).
// A size outside the range is rejected by ds__measurement_size_guard;
// the DB error is mapped to the offending cell (see validation.ts).
'use client';

import { useState } from 'react';
import type { TechPackSnapshot } from '@/lib/techpack-render/types';
import type { TechPackLookups } from '../types';
import { gradeValues, snapshotSizes } from '../lib/validation';

export default function MeasurementGrid(props: {
  snapshot: TechPackSnapshot;
  lookups: TechPackLookups;
  locked: boolean;
  cellError: { cell: string | null; message: string } | null;
  onUpsertMeasurement: (pomId: string, size: string, value: number, tolPlus: number, tolMinus: number, grade: number | null) => void;
  onApplyGradeRule: (pomId: string, baseValue: number, increment: number) => void;
}) {
  const { snapshot, lookups, locked, cellError, onUpsertMeasurement, onApplyGradeRule } = props;
  const sizes = snapshotSizes(snapshot);
  const tp = (snapshot.tech_pack ?? {}) as Record<string, unknown>;
  const baseSize = String(tp.base_size ?? '');
  const measurements = snapshot.measurements ?? [];
  const [gradePom, setGradePom] = useState<string | null>(null);
  const [gradeForm, setGradeForm] = useState({ baseValue: 0, increment: 2 });
  const [newSize, setNewSize] = useState('');

  const poms = lookups.poms.filter((p) => measurements.some((m) => String(m.pom_id ?? m.pom) === p.id || String(m.pom) === p.code));
  const usedPomIds = new Set(poms.map((p) => p.id));
  const unusedPoms = lookups.poms.filter((p) => !usedPomIds.has(p.id));

  const valueFor = (pomId: string, size: string) => {
    const m = measurements.find((x) => (String(x.pom_id ?? '') === pomId || String(x.pom ?? '') === pomId) && String(x.size ?? x.size_label) === size);
    return m ? Number(m.value ?? 0) : null;
  };

  return (
    <section data-testid="techpack-measurement-grid">
      {cellError && (
        <p className="mb-2 rounded border border-red-300 bg-red-50 px-2 py-1 text-sm text-red-800" data-testid="cell-error">
          {cellError.cell ? `Size ${cellError.cell}: ` : ''}{cellError.message}
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-neutral-500">
              <th className="py-1 pr-2">POM</th>
              {sizes.map((s) => (
                <th key={s} className={`py-1 pr-2 ${s === baseSize ? 'bg-neutral-100 font-bold text-neutral-900' : ''}`}>{s}{s === baseSize ? ' (base)' : ''}</th>
              ))}
              <th className="py-1 pr-2">Tol +/–</th>
              <th className="py-1 pr-2">Grade</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {poms.map((p) => {
              const row0 = measurements.find((x) => String(x.pom_id ?? '') === p.id || String(x.pom) === p.code);
              return (
                <tr key={p.id} className="border-b">
                  <td className="py-1 pr-2 font-medium">{p.code} — {p.name}</td>
                  {sizes.map((s) => {
                    const v = valueFor(p.id, s);
                    const isCellError = cellError?.cell === s;
                    return (
                      <td key={s} className={`py-1 pr-2 ${s === baseSize ? 'bg-neutral-50' : ''}`}>
                        <input
                          type="number" step="0.01" min={0}
                          aria-label={`${p.code} ${s}`}
                          className={`w-16 rounded border px-1 py-0.5 ${isCellError ? 'border-red-500 bg-red-50' : 'border-neutral-300'}`}
                          value={v === null ? '' : v}
                          disabled={locked}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            if (Number.isNaN(val)) return;
                            onUpsertMeasurement(p.id, s, val, Number(row0?.tol_plus ?? 1), Number(row0?.tol_minus ?? 1), row0?.grade === undefined ? null : Number(row0.grade));
                          }}
                        />
                      </td>
                    );
                  })}
                  <td className="py-1 pr-2 text-xs">±{Number(row0?.tol_plus ?? 1)} / {Number(row0?.tol_minus ?? 1)}</td>
                  <td className="py-1 pr-2 text-xs">{row0?.grade === undefined || row0?.grade === null ? '—' : String(row0.grade)}</td>
                  <td>
                    {!locked && (
                      <button type="button" className="text-xs text-blue-700" onClick={() => { setGradePom(p.id); setGradeForm({ baseValue: valueFor(p.id, baseSize) ?? 0, increment: 2 }); }}>
                        Grade rule…
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!locked && unusedPoms.length > 0 && (
        <div className="mt-3 flex items-end gap-2">
          <label className="text-xs font-medium text-neutral-600">
            Add POM
            <select
              className="mt-1 block rounded border border-neutral-300 px-2 py-1 text-sm"
              value=""
              onChange={(e) => {
                const pom = lookups.poms.find((x) => x.id === e.target.value);
                if (pom) onUpsertMeasurement(pom.id, baseSize || sizes[0] || '', 0, 1, 1, null);
              }}
            >
              <option value="">Pick a POM…</option>
              {unusedPoms.map((p) => (<option key={p.id} value={p.id}>{p.code} — {p.name}</option>))}
            </select>
          </label>
          <label className="text-xs font-medium text-neutral-600">
            Try a size (must be in the range)
            <span className="flex gap-1">
              <input className="mt-1 w-24 rounded border border-neutral-300 px-2 py-1 text-sm" value={newSize} placeholder="e.g. XXXL" onChange={(e) => setNewSize(e.target.value)} />
              <button
                type="button"
                className="mt-1 rounded-md border border-neutral-300 px-2 py-1 text-sm"
                onClick={() => {
                  if (poms[0] && newSize) onUpsertMeasurement(poms[0].id, newSize, 0, 1, 1, null);
                }}
              >
                Add cell
              </button>
            </span>
          </label>
        </div>
      )}
      {gradePom && (
        <div className="mt-3 rounded-md border border-neutral-300 bg-neutral-50 p-3" data-testid="grade-rule-dialog" role="dialog" aria-label="Grade rule">
          <h3 className="text-sm font-semibold">Grade rule — base + increment per size</h3>
          <p className="text-xs text-neutral-500">Values fill from the base size ({baseSize}) outward: base, base ± increment, base ± 2× increment…</p>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <label className="text-xs font-medium text-neutral-600">
              Base value ({baseSize})
              <input type="number" step="0.01" className="mt-1 block w-24 rounded border border-neutral-300 px-2 py-1 text-sm" value={gradeForm.baseValue} onChange={(e) => setGradeForm((f) => ({ ...f, baseValue: Number(e.target.value) }))} />
            </label>
            <label className="text-xs font-medium text-neutral-600">
              Increment / size
              <input type="number" step="0.01" className="mt-1 block w-24 rounded border border-neutral-300 px-2 py-1 text-sm" value={gradeForm.increment} onChange={(e) => setGradeForm((f) => ({ ...f, increment: Number(e.target.value) }))} />
            </label>
            <span className="text-xs text-neutral-600">
              Preview: {sizes.map((s) => `${s} ${gradeValues(gradeForm.baseValue, gradeForm.increment, sizes, baseSize)[s]}`).join(' · ')}
            </span>
            <button type="button" className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white" onClick={() => { onApplyGradeRule(gradePom, gradeForm.baseValue, gradeForm.increment); setGradePom(null); }}>
              Apply grade
            </button>
            <button type="button" className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm" onClick={() => setGradePom(null)}>Cancel</button>
          </div>
        </div>
      )}
    </section>
  );
}
