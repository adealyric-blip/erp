// Tech pack editor — ArtworkPlacements (T13): pick an asset, technique,
// W x H in mm, offset reference (HPS / CF / hem) and offsets.
'use client';

import { useState } from 'react';
import type { TechPackSnapshot } from '@/lib/techpack-render/types';
import type { TechPackLookups } from '../types';

const TECHNIQUES = ['screen_print', 'dtg', 'dtf', 'embroidery', 'puff_embroidery', 'heat_transfer', 'sublimation', 'jacquard', 'patch', 'laser', 'other'] as const;

export default function ArtworkPlacements(props: {
  snapshot: TechPackSnapshot;
  lookups: TechPackLookups;
  locked: boolean;
  onUpsertArtwork: (row: Record<string, unknown>) => void;
  onDeleteArtwork: (id: string) => void;
}) {
  const { snapshot, lookups, locked, onUpsertArtwork, onDeleteArtwork } = props;
  const rows = snapshot.artwork ?? [];
  const [draft, setDraft] = useState({ asset_id: '', view: 'front', placement: 'center chest', technique: 'screen_print', width_mm: 280, height_mm: 300, offset_ref: 'HPS', offset_x_mm: 0, offset_y_mm: 120 });

  return (
    <section data-testid="techpack-artwork">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-neutral-500">
            <th className="py-1 pr-2">#</th><th className="py-1 pr-2">Asset</th><th className="py-1 pr-2">View</th>
            <th className="py-1 pr-2">Placement</th><th className="py-1 pr-2">Technique</th><th className="py-1 pr-2">W × H mm</th>
            <th className="py-1 pr-2">Offset ref</th><th className="py-1 pr-2">Offset mm</th><th />
          </tr>
        </thead>
        <tbody>
          {rows.map((a, i) => (
            <tr key={String(a.id ?? i)} className="border-b">
              <td className="py-1 pr-2">{i + 1}</td>
              <td className="py-1 pr-2">{String(a.asset_id ?? '').slice(0, 8)}</td>
              <td className="py-1 pr-2">{String(a.view ?? '')}</td>
              <td className="py-1 pr-2">{String(a.placement ?? '')}</td>
              <td className="py-1 pr-2">{String(a.technique ?? '')}</td>
              <td className="py-1 pr-2">{String(a.width_mm ?? '')} × {String(a.height_mm ?? '')}</td>
              <td className="py-1 pr-2">{String(a.offset_ref ?? '')}</td>
              <td className="py-1 pr-2">{String(a.offset_x_mm ?? '')} / {String(a.offset_y_mm ?? '')}</td>
              <td>{!locked && a.id !== undefined && a.id !== null && (<button type="button" className="text-xs text-red-700" onClick={() => onDeleteArtwork(String(a.id))}>Remove</button>)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!locked && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="text-xs font-medium text-neutral-600">
            Asset
            <select className="mt-1 block rounded border border-neutral-300 px-2 py-1 text-sm" value={draft.asset_id} onChange={(e) => setDraft((d) => ({ ...d, asset_id: e.target.value }))}>
              <option value="">Pick an asset…</option>
              {lookups.assets.map((a) => (<option key={a.id} value={a.id}>{a.name ?? a.id.slice(0, 8)}</option>))}
            </select>
          </label>
          <label className="text-xs font-medium text-neutral-600">
            View
            <select className="mt-1 block rounded border border-neutral-300 px-2 py-1 text-sm" value={draft.view} onChange={(e) => setDraft((d) => ({ ...d, view: e.target.value }))}>
              {['front', 'back', 'side', 'detail'].map((v) => (<option key={v} value={v}>{v}</option>))}
            </select>
          </label>
          <label className="text-xs font-medium text-neutral-600">
            Placement
            <input className="mt-1 block w-32 rounded border border-neutral-300 px-2 py-1 text-sm" value={draft.placement} onChange={(e) => setDraft((d) => ({ ...d, placement: e.target.value }))} />
          </label>
          <label className="text-xs font-medium text-neutral-600">
            Technique
            <select className="mt-1 block rounded border border-neutral-300 px-2 py-1 text-sm" value={draft.technique} onChange={(e) => setDraft((d) => ({ ...d, technique: e.target.value }))}>
              {TECHNIQUES.map((t) => (<option key={t} value={t}>{t}</option>))}
            </select>
          </label>
          <label className="text-xs font-medium text-neutral-600">
            W mm
            <input type="number" min={0} className="mt-1 block w-20 rounded border border-neutral-300 px-2 py-1 text-sm" value={draft.width_mm} onChange={(e) => setDraft((d) => ({ ...d, width_mm: Number(e.target.value) }))} />
          </label>
          <label className="text-xs font-medium text-neutral-600">
            H mm
            <input type="number" min={0} className="mt-1 block w-20 rounded border border-neutral-300 px-2 py-1 text-sm" value={draft.height_mm} onChange={(e) => setDraft((d) => ({ ...d, height_mm: Number(e.target.value) }))} />
          </label>
          <label className="text-xs font-medium text-neutral-600">
            Offset ref
            <select className="mt-1 block rounded border border-neutral-300 px-2 py-1 text-sm" value={draft.offset_ref} onChange={(e) => setDraft((d) => ({ ...d, offset_ref: e.target.value }))}>
              {['HPS', 'CF', 'hem', 'CB'].map((r) => (<option key={r} value={r}>{r}</option>))}
            </select>
          </label>
          <button
            type="button"
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            disabled={!draft.asset_id}
            onClick={() => { onUpsertArtwork({ ...draft, sort: rows.length }); setDraft((d) => ({ ...d, asset_id: '' })); }}
          >
            Place artwork
          </button>
        </div>
      )}
    </section>
  );
}
