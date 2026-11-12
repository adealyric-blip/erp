// Tech pack editor — ConstructionCallouts (T13b): click on the flat to
// drop a numbered callout. The callout anchors (normalized 0..1) are the
// S615 construction columns; the renderer draws the red leaders.
'use client';

import { useState } from 'react';
import type { TechPackSnapshot } from '@/lib/techpack-render/types';

function FlatBox(props: {
  view: 'front' | 'back';
  callouts: Record<string, unknown>[];
  selectedId: string | null;
  locked: boolean;
  onDrop: (view: 'front' | 'back', anchorX: number, anchorY: number) => void;
  onSelect: (id: string) => void;
}) {
  const { view, callouts, selectedId, locked, onDrop, onSelect } = props;
  const W = 200;
  const H = 260;
  const mine = callouts.filter((c) => String(c.view ?? 'front') === view);
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full max-w-[220px] rounded border border-dashed border-neutral-400 bg-white"
      role="img"
      aria-label={`${view} flat — click to drop a callout`}
      data-testid={`flat-${view}`}
      onClick={(e) => {
        if (locked) return;
        const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
        const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
        const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
        onDrop(view, Math.round(x * 100) / 100, Math.round(y * 100) / 100);
      }}
    >
      <text x={W / 2} y={16} textAnchor="middle" fontSize={10} fill="#888">{view.toUpperCase()}</text>
      <rect x={50} y={30} width={100} height={200} fill="none" stroke="#bbb" strokeWidth={1} />
      {mine.map((c) => {
        const ax = Number(c.anchor_x ?? 0) * W;
        const ay = Number(c.anchor_y ?? 0) * H;
        const lx = Number(c.label_x ?? 0) * W;
        const ly = Number(c.label_y ?? 0) * H;
        const id = String(c.id ?? '');
        return (
          <g key={id}>
            <line x1={ax} y1={ay} x2={lx} y2={ly} stroke="#d62828" strokeWidth={1} />
            <circle cx={ax} cy={ay} r={3} fill="#d62828" />
            <circle
              cx={lx} cy={ly} r={9} fill="#d62828" stroke={selectedId === id ? '#111' : 'none'} strokeWidth={2}
              style={{ cursor: 'pointer' }}
              onClick={(e) => { e.stopPropagation(); onSelect(id); }}
            />
            <text x={lx} y={ly + 3.5} textAnchor="middle" fontSize={10} fontWeight={700} fill="#fff">
              {String(c.callout_no ?? '?')}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function ConstructionCallouts(props: {
  snapshot: TechPackSnapshot;
  locked: boolean;
  onUpsertConstruction: (row: Record<string, unknown>) => void;
  onDeleteConstruction: (id: string) => void;
}) {
  const { snapshot, locked, onUpsertConstruction, onDeleteConstruction } = props;
  const rows = (snapshot.construction ?? []) as Record<string, unknown>[];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = rows.find((r) => String(r.id) === selectedId);
  const nextNo = rows.reduce((n, r) => Math.max(n, Number(r.callout_no ?? 0)), 0) + 1;

  const drop = (view: 'front' | 'back', anchorX: number, anchorY: number) => {
    onUpsertConstruction({
      area: 'new callout',
      operation: '',
      callout_no: nextNo,
      view,
      anchor_x: anchorX,
      anchor_y: anchorY,
      label_x: Math.min(1, anchorX + 0.2),
      label_y: Math.max(0, anchorY - 0.08),
      sort: rows.length,
    });
  };

  return (
    <section data-testid="techpack-callouts">
      <p className="mb-2 text-xs text-neutral-500">Click the flat to drop a numbered callout. Click a numbered dot to edit it.</p>
      <div className="flex flex-wrap gap-4">
        <FlatBox view="front" callouts={rows} selectedId={selectedId} locked={locked} onDrop={drop} onSelect={setSelectedId} />
        <FlatBox view="back" callouts={rows} selectedId={selectedId} locked={locked} onDrop={drop} onSelect={setSelectedId} />
        <div className="min-w-56 flex-1">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-neutral-500">
                <th className="py-1 pr-2">#</th><th className="py-1 pr-2">Area</th><th className="py-1 pr-2">Operation</th><th className="py-1 pr-2">Anchor</th><th />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={String(c.id)} className={`border-b ${selectedId === String(c.id) ? 'bg-red-50' : ''}`} onClick={() => setSelectedId(String(c.id))}>
                  <td className="py-1 pr-2">{String(c.callout_no ?? '')}</td>
                  <td className="py-1 pr-2">{String(c.area ?? '')}</td>
                  <td className="py-1 pr-2">{String(c.operation ?? '')}</td>
                  <td className="py-1 pr-2 text-xs">{String(c.anchor_x ?? '')}, {String(c.anchor_y ?? '')} → {String(c.label_x ?? '')}, {String(c.label_y ?? '')}</td>
                  <td>
                    {!locked && (
                      <button type="button" className="text-xs text-red-700" onClick={(e) => { e.stopPropagation(); onDeleteConstruction(String(c.id)); }}>
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {selected && !locked && (
            <div className="mt-3 flex flex-wrap gap-2">
              <label className="text-xs font-medium text-neutral-600">
                Area
                <input className="mt-1 block rounded border border-neutral-300 px-2 py-1 text-sm" value={String(selected.area ?? '')} onChange={(e) => onUpsertConstruction({ ...selected, area: e.target.value })} />
              </label>
              <label className="text-xs font-medium text-neutral-600">
                Operation
                <input className="mt-1 block rounded border border-neutral-300 px-2 py-1 text-sm" value={String(selected.operation ?? '')} onChange={(e) => onUpsertConstruction({ ...selected, operation: e.target.value })} />
              </label>
              <label className="text-xs font-medium text-neutral-600">
                Label x
                <input type="number" step="0.01" min={0} max={1} className="mt-1 block w-20 rounded border border-neutral-300 px-2 py-1 text-sm" value={Number(selected.label_x ?? 0)} onChange={(e) => onUpsertConstruction({ ...selected, label_x: Number(e.target.value) })} />
              </label>
              <label className="text-xs font-medium text-neutral-600">
                Label y
                <input type="number" step="0.01" min={0} max={1} className="mt-1 block w-20 rounded border border-neutral-300 px-2 py-1 text-sm" value={Number(selected.label_y ?? 0)} onChange={(e) => onUpsertConstruction({ ...selected, label_y: Number(e.target.value) })} />
              </label>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
