// Import review grid — plan/08 §Splitting bundles, review screen.
// Staff-only (the page requires staff; piece SVGs stream through the
// staff asset route, never a signed URL). Lives in the existing shell —
// no rail, no sidebar. Actions run through runCommand (flat.piece.*);
// reject is the one piece action without a command — see actions.ts.
'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { runCommand } from '@/server/actions/commands';
import { rejectPiece } from './actions';

export interface ReviewPiece {
  id: string;
  sourceRef: string;
  view: string;
  category: string;
  pairKey: string | null;
  scaleMmPerUnit: number | null;
  svgAssetId: string | null;
  status: string;
  templateId: string | null;
  bboxW: number;
  bboxH: number;
}

export interface ReviewBatch {
  id: string;
  sourceCategory: string;
  status: string;
  strategy: string;
  pieceCount: number;
  error: string;
  /** Bundle asset id — the Split now bridge downloads it via the staff route. */
  sourceAssetId: string | null;
}

interface PieceForm {
  view: string;
  category: string;
  knownMm: string;
  measuredUnits: string;
}

const VIEWS = ['front', 'back', 'side', 'detail'] as const;

function resultMessage(res: { ok: boolean; error?: { message: string } }): string {
  return res.ok ? '' : (res.error?.message ?? 'failed');
}

export function ImportReview({ batch, pieces }: { batch: ReviewBatch; pieces: ReviewPiece[] }) {
  const router = useRouter();
  const [forms, setForms] = useState<Record<string, PieceForm>>(() =>
    Object.fromEntries(
      pieces.map((p) => [
        p.id,
        {
          view: p.view || 'front',
          category: p.category || batch.sourceCategory || '',
          knownMm: '',
          measuredUnits: p.bboxW ? String(Math.round(p.bboxW)) : '',
        },
      ]),
    ),
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [cutTarget, setCutTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  const proposed = useMemo(() => pieces.filter((p) => p.status === 'proposed'), [pieces]);
  const paired = useMemo(() => {
    const groups = new Map<string, ReviewPiece[]>();
    for (const p of pieces) {
      if (!p.pairKey) continue;
      const g = groups.get(p.pairKey) ?? [];
      g.push(p);
      groups.set(p.pairKey, g);
    }
    return groups;
  }, [pieces]);

  function setForm(id: string, patch: Partial<PieceForm>) {
    setForms((f) => ({ ...f, [id]: { ...f[id], ...patch } }));
  }

  function scaleArgs(p: ReviewPiece): { scaleMmPerUnit?: number; knownMeasurementMm?: number; measuredUnits?: number } {
    const f = forms[p.id];
    if (!f) return {};
    const known = Number(f.knownMm);
    const measured = Number(f.measuredUnits);
    if (known > 0 && measured > 0) return { knownMeasurementMm: known, measuredUnits: measured };
    if (p.scaleMmPerUnit && p.scaleMmPerUnit > 0) return { scaleMmPerUnit: p.scaleMmPerUnit };
    return {};
  }

  async function act(label: string, fn: () => Promise<{ ok: boolean; error?: { message: string } }>) {
    setBusy(label);
    setMessage('');
    try {
      const res = await fn();
      const msg = resultMessage(res);
      setMessage(msg || `${label} done.`);
      if (res.ok) router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'failed');
    } finally {
      setBusy('');
    }
  }

  async function acceptPiece(p: ReviewPiece) {
    const f = forms[p.id];
    await act(`Accepting ${p.id.slice(0, 8)}…`, () =>
      runCommand('flat.piece.accept', {
        pieceId: p.id,
        category: f?.category || undefined,
        view: (f?.view ?? p.view) as (typeof VIEWS)[number],
        ...scaleArgs(p),
      }),
    );
  }

  async function acceptAll() {
    setBusy('Accepting all…');
    setMessage('');
    const skipped: string[] = [];
    const failed: string[] = [];
    let accepted = 0;
    for (const p of proposed) {
      const res = await runCommand('flat.piece.accept', {
        pieceId: p.id,
        category: forms[p.id]?.category || undefined,
        view: (forms[p.id]?.view ?? p.view) as (typeof VIEWS)[number],
        ...scaleArgs(p),
      });
      if (res.ok) accepted++;
      else if (String(res.error?.message ?? '').includes('scale')) skipped.push(p.id.slice(0, 8));
      else failed.push(`${p.id.slice(0, 8)}: ${res.error?.message ?? 'failed'}`);
    }
    setMessage(
      `Accepted ${accepted}/${proposed.length}.` +
        (skipped.length ? ` Skipped (no scale): ${skipped.join(', ')}.` : '') +
        (failed.length ? ` Failed: ${failed.join('; ')}.` : ''),
    );
    setBusy('');
    router.refresh();
  }

  function toggleSelect(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s.slice(-1), id]));
  }

  async function mergeSelected() {
    if (selected.length !== 2) {
      setMessage('Select exactly two pieces to merge.');
      return;
    }
    await act('Merging…', () => runCommand('flat.piece.merge', { pieceIds: [selected[0], selected[1]] }));
    setSelected([]);
  }

  async function pairSelected() {
    if (selected.length !== 2) {
      setMessage('Select exactly two pieces to pair.');
      return;
    }
    await act('Pairing…', () => runCommand('flat.piece.pair', { pieceIds: [selected[0], selected[1]] }));
    setSelected([]);
  }

  /** Click on a piece preview cuts it there (vertical cut at the clicked x). */
  async function cutAt(p: ReviewPiece, e: React.MouseEvent<HTMLImageElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    const at = Math.max(1, Math.round(p.bboxW * frac));
    await act('Cutting…', () => runCommand('flat.piece.cut', { pieceId: p.id, axis: 'vertical', at }));
    setCutTarget(null);
  }

  return (
    <div>
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded border p-4 text-sm">
        <span>
          Status: <strong>{batch.status}</strong>
        </span>
        <span>Strategy: {batch.strategy || '—'}</span>
        <span>Category: {batch.sourceCategory || '—'}</span>
        <span>
          Pieces: {pieces.length} proposed {proposed.length}
        </span>
        {batch.error && <span className="text-red-700">Error: {batch.error}</span>}
        {(batch.status === 'queued' || batch.status === 'splitting') && batch.sourceAssetId && (
          <button
            type="button"
            disabled={!!busy}
            onClick={() =>
              void (async () => {
                setBusy('Splitting…');
                setMessage('');
                try {
                  // SVG bundles only: the bundle streams through the staff
                  // asset route and flat.split parses it directly. PDF/AI/EPS
                  // bundles need the render station (flat_split, T14) to
                  // normalize them to SVG first.
                  const res = await fetch(`/api/studio/assets/${batch.sourceAssetId}`);
                  if (!res.ok) {
                    setMessage('Could not load the bundle asset.');
                    setBusy('');
                    return;
                  }
                  const svgText = await res.text();
                  const out = await runCommand('flat.split', {
                    batchId: batch.id,
                    svgText,
                    fileName: 'bundle.svg',
                    sourceCategory: batch.sourceCategory || undefined,
                  });
                  setMessage(out.ok ? 'Split done — pieces below for review.' : (out.error?.message ?? 'split failed'));
                  if (out.ok) router.refresh();
                } catch (e) {
                  setMessage(e instanceof Error ? e.message : 'split failed');
                } finally {
                  setBusy('');
                }
              })()
            }
            className="ml-auto rounded border px-3 py-1.5 disabled:opacity-50"
          >
            {busy === 'Splitting…' ? 'Splitting…' : 'Split now (SVG bundles)'}
          </button>
        )}
        {proposed.length > 0 && (
          <button
            type="button"
            disabled={!!busy}
            onClick={acceptAll}
            className="ml-auto rounded bg-black px-3 py-1.5 text-white disabled:opacity-50"
          >
            {busy === 'Accepting all…' ? 'Accepting…' : 'Accept all'}
          </button>
        )}
      </div>

      {message && <p className="mt-3 text-sm">{message}</p>}

      {selected.length > 0 && (
        <div className="mt-3 flex items-center gap-3 text-sm">
          <span>{selected.length} selected</span>
          <button type="button" disabled={!!busy || selected.length !== 2} onClick={mergeSelected} className="rounded border px-2 py-1 disabled:opacity-50">
            Merge two
          </button>
          <button type="button" disabled={!!busy || selected.length !== 2} onClick={pairSelected} className="rounded border px-2 py-1 disabled:opacity-50">
            Pair two
          </button>
          <button type="button" onClick={() => setSelected([])} className="underline">
            Clear
          </button>
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pieces.map((p) => {
          const f = forms[p.id] ?? { view: p.view, category: p.category, knownMm: '', measuredUnits: '' };
          const isCutting = cutTarget === p.id;
          return (
            <article key={p.id} className={`rounded border p-3 ${selected.includes(p.id) ? 'ring-2 ring-black' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-medium">
                  {p.sourceRef || p.id.slice(0, 8)} · {p.view}
                </h3>
                <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs">{p.status}</span>
              </div>
              <p className="mt-1 text-xs text-neutral-500">
                {p.pairKey ? `Pair ${p.pairKey}` : 'Unpaired'}
                {p.scaleMmPerUnit ? ` · scale ${p.scaleMmPerUnit} mm/unit` : ' · scale not set'}
                {p.templateId ? (
                  <>
                    {' · '}
                    <Link href={`/studio/library/templates?edit=${p.templateId}`} className="underline">
                      Template
                    </Link>
                  </>
                ) : null}
              </p>
              {p.svgAssetId ? (
                <button
                  type="button"
                  title={isCutting ? 'Click on the piece to cut there (vertical)' : 'Click to arm the cut tool'}
                  onClick={(e) => {
                    if (isCutting) return; // the img click below does the cut
                    if (p.status === 'proposed') setCutTarget(p.id);
                  }}
                  className="mt-2 block w-full cursor-pointer"
                >
                  <img
                    src={`/api/studio/assets/${p.svgAssetId}`}
                    alt={`${p.view} piece ${p.sourceRef}`}
                    className={`max-h-64 w-full border object-contain ${isCutting ? 'ring-2 ring-red-600' : ''}`}
                    onClick={(e) => {
                      if (isCutting) {
                        e.stopPropagation();
                        void cutAt(p, e);
                      }
                    }}
                  />
                </button>
              ) : (
                <p className="mt-2 text-xs text-neutral-500">No preview asset.</p>
              )}
              {isCutting && (
                <p className="mt-1 text-xs text-red-700">
                  Cut armed — click on the piece where the vertical cut goes.{' '}
                  <button type="button" className="underline" onClick={() => setCutTarget(null)}>
                    Cancel
                  </button>
                </p>
              )}
              {p.status === 'proposed' && (
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex gap-2">
                    <label className="flex-1">
                      <span className="text-xs text-neutral-500">View</span>
                      <select
                        value={f.view}
                        onChange={(e) => setForm(p.id, { view: e.target.value })}
                        className="mt-0.5 w-full rounded border px-2 py-1"
                      >
                        {VIEWS.map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex-1">
                      <span className="text-xs text-neutral-500">Category</span>
                      <input
                        value={f.category}
                        onChange={(e) => setForm(p.id, { category: e.target.value })}
                        className="mt-0.5 w-full rounded border px-2 py-1"
                      />
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <label className="flex-1">
                      <span className="text-xs text-neutral-500">Known mm (e.g. waist 420)</span>
                      <input
                        inputMode="decimal"
                        value={f.knownMm}
                        onChange={(e) => setForm(p.id, { knownMm: e.target.value })}
                        className="mt-0.5 w-full rounded border px-2 py-1"
                      />
                    </label>
                    <label className="flex-1">
                      <span className="text-xs text-neutral-500">Measured units</span>
                      <input
                        inputMode="decimal"
                        value={f.measuredUnits}
                        onChange={(e) => setForm(p.id, { measuredUnits: e.target.value })}
                        className="mt-0.5 w-full rounded border px-2 py-1"
                      />
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() => void acceptPiece(p)}
                      className="rounded bg-black px-3 py-1.5 text-white disabled:opacity-50"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() =>
                        void act('Rejecting…', () => rejectPiece(p.id).then((r) => (r.ok ? { ok: true as const } : { ok: false as const, error: r.error })))
                      }
                      className="rounded border px-3 py-1.5 disabled:opacity-50"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() =>
                        void act('Setting scale…', () =>
                          runCommand('flat.piece.scale', { pieceId: p.id, ...scaleArgs(p) }),
                        )
                      }
                      className="rounded border px-3 py-1.5 disabled:opacity-50"
                    >
                      Set scale
                    </button>
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() => toggleSelect(p.id)}
                      className="rounded border px-3 py-1.5 disabled:opacity-50"
                    >
                      {selected.includes(p.id) ? 'Unselect' : 'Select'}
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {pieces.length === 0 && (
        <p className="mt-6 text-sm text-neutral-500">
          No pieces yet — the batch is still {batch.status}. The render station splits it (flat_split) and the
          pieces appear here for review.
        </p>
      )}

      {paired.size > 0 && (
        <section className="mt-8">
          <h2 className="font-semibold">Pairs</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {[...paired.entries()].map(([key, group]) => (
              <li key={key}>
                {key}: {group.map((g) => `${g.view} (${g.status})`).join(' + ')}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
