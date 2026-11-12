// Tech pack editor — PomMarkerEditor (T13b): drag POM arrows on the flat.
// Arrow ends are draggable handles (pointer events, normalized 0..1);
// the guide table below lists POM code, description, how to measure.
'use client';

import { useRef, useState } from 'react';
import type { TechPackSnapshot } from '@/lib/techpack-render/types';
import type { TechPackLookups } from '../types';

const W = 200;
const H = 260;

export default function PomMarkerEditor(props: {
  snapshot: TechPackSnapshot;
  lookups: TechPackLookups;
  locked: boolean;
  onUpsertPomMarker: (row: Record<string, unknown>) => void;
  onDeletePomMarker: (id: string) => void;
}) {
  const { snapshot, lookups, locked, onUpsertPomMarker, onDeletePomMarker } = props;
  const markers = (snapshot.pom_markers ?? []) as Record<string, unknown>[];
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [drag, setDrag] = useState<{ id: string; end: 'start' | 'end' | 'label' } | null>(null);

  const toNorm = (e: React.PointerEvent) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  };

  const onMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const { x, y } = toNorm(e);
    const m = markers.find((r) => String(r.id) === drag.id);
    if (!m) return;
    const patch: Record<string, unknown> =
      drag.end === 'start' ? { x1: Math.round(x * 100) / 100, y1: Math.round(y * 100) / 100 }
      : drag.end === 'end' ? { x2: Math.round(x * 100) / 100, y2: Math.round(y * 100) / 100 }
      : { label_x: Math.round(x * 100) / 100, label_y: Math.round(y * 100) / 100 };
    onUpsertPomMarker({ ...m, ...patch });
  };

  const pomName = (code: string) => lookups.poms.find((p) => p.code === code)?.name ?? code;

  return (
    <section data-testid="techpack-pom-markers">
      <p className="mb-2 text-xs text-neutral-500">Drag an arrow end to move it; drag the letter to move its label.</p>
      <div className="flex flex-wrap gap-4">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full max-w-[220px] touch-none rounded border border-dashed border-neutral-400 bg-white"
          role="img"
          aria-label="Measurement guide flat — drag POM arrows"
          data-testid="flat-measure-guide"
          onPointerMove={onMove}
          onPointerUp={() => setDrag(null)}
          onPointerLeave={() => setDrag(null)}
        >
          <defs>
            <marker id="pom-arrowhead" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
              <path d="M0,0 L5,2.5 L0,5 z" fill="#d62828" />
            </marker>
          </defs>
          <text x={W / 2} y={16} textAnchor="middle" fontSize={10} fill="#888">FRONT</text>
          <rect x={50} y={30} width={100} height={200} fill="none" stroke="#bbb" strokeWidth={1} />
          {markers.map((m) => {
            const x1 = Number(m.x1 ?? 0) * W;
            const y1 = Number(m.y1 ?? 0) * H;
            const x2 = Number(m.x2 ?? 0) * W;
            const y2 = Number(m.y2 ?? 0) * H;
            const lx = Number(m.label_x ?? 0.5) * W;
            const ly = Number(m.label_y ?? 0.5) * H;
            const id = String(m.id);
            return (
              <g key={id}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#d62828" strokeWidth={1.5} markerEnd="url(#pom-arrowhead)" />
                <circle cx={x1} cy={y1} r={5} fill="#d62828" style={{ cursor: locked ? 'default' : 'grab' }} onPointerDown={(e) => { if (!locked) { e.preventDefault(); setDrag({ id, end: 'start' }); } }} />
                <circle cx={x2} cy={y2} r={5} fill="#d62828" style={{ cursor: locked ? 'default' : 'grab' }} onPointerDown={(e) => { if (!locked) { e.preventDefault(); setDrag({ id, end: 'end' }); } }} />
                <text x={lx} y={ly} textAnchor="middle" fontSize={11} fontWeight={700} fill="#d62828" style={{ cursor: locked ? 'default' : 'grab' }} onPointerDown={(e) => { if (!locked) { e.preventDefault(); setDrag({ id, end: 'label' }); } }}>
                  {String(m.pom ?? m.pom_code ?? '?')}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="min-w-64 flex-1">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-neutral-500">
                <th className="py-1 pr-2">POM</th><th className="py-1 pr-2">Description</th><th className="py-1 pr-2">How to measure</th><th />
              </tr>
            </thead>
            <tbody>
              {markers.map((m) => {
                const code = String(m.pom ?? m.pom_code ?? '');
                const lib = lookups.poms.find((p) => p.code === code);
                return (
                  <tr key={String(m.id)} className="border-b">
                    <td className="py-1 pr-2 font-medium">{code}</td>
                    <td className="py-1 pr-2">{String(m.description ?? lib?.name ?? '')}</td>
                    <td className="py-1 pr-2 text-xs">{String(m.how_to_measure ?? lib?.how_to_measure ?? '')}</td>
                    <td>{!locked && (<button type="button" className="text-xs text-red-700" onClick={() => onDeletePomMarker(String(m.id))}>Remove</button>)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!locked && (
            <div className="mt-3 flex items-end gap-2">
              <label className="text-xs font-medium text-neutral-600">
                Add POM marker
                <select
                  className="mt-1 block rounded border border-neutral-300 px-2 py-1 text-sm"
                  value=""
                  onChange={(e) => {
                    const pom = lookups.poms.find((x) => x.id === e.target.value);
                    if (pom) onUpsertPomMarker({ pom_id: pom.id, pom: pom.code, view: 'front', x1: 0.3, y1: 0.1, x2: 0.3, y2: 0.9, label_x: 0.35, label_y: 0.5 });
                  }}
                >
                  <option value="">Pick a POM…</option>
                  {lookups.poms.map((p) => (<option key={p.id} value={p.id}>{p.code} — {p.name}</option>))}
                </select>
              </label>
              <span className="text-xs text-neutral-500">Default arrow: vertical, left chest.</span>
            </div>
          )}
          {markers.length === 0 && <p className="mt-2 text-xs text-neutral-500">No POM markers yet — they default from the flat&apos;s callouts layer (plan/09).</p>}
          <p className="mt-2 text-xs text-neutral-500">Guide rows: {markers.map((m) => `${String(m.pom ?? '')} ${pomName(String(m.pom ?? ''))}`).join(' · ') || '—'}</p>
        </div>
      </div>
    </section>
  );
}
