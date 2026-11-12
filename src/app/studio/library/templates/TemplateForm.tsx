// Garment template create/edit form (T10): views, size range, flat/GLB
// uploads, turntable frames, and the print-area editor.
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { saveTemplate } from '@/server/actions/library';
import type { Result } from '@/server/result';
import { ResultMessage, inputCls, labelCls } from '../components';
import { AssetUploadField } from './AssetUploadField';
import { PrintAreaEditor } from './PrintAreaEditor';
import type { PrintAreaIn } from './PrintAreaEditor';

const VIEWS = ['front', 'back', 'left_sleeve', 'right_sleeve', 'hood', 'crown', 'visor', 'side'];

export function TemplateForm({
  initial,
  sizeRanges,
}: {
  initial: Record<string, unknown> | null;
  sizeRanges: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [result, setResult] = useState<Result<string> | null>(null);
  const [busy, setBusy] = useState(false);
  const [views, setViews] = useState<string[]>(
    Array.isArray(initial?.views) ? (initial.views as string[]) : ['front', 'back'],
  );
  const str = (k: string) => (typeof initial?.[k] === 'string' ? (initial[k] as string) : '');
  const num = (k: string) => (typeof initial?.[k] === 'number' ? String(initial[k]) : '');
  const initialAreas = (initial?.print_areas ?? {}) as Record<string, PrintAreaIn>;

  function toggleView(v: string) {
    setViews((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]));
  }

  return (
    <form
      className="mt-3 grid max-w-2xl gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const res = await saveTemplate(new FormData(e.currentTarget));
        setResult(res);
        setBusy(false);
        if (res.ok) router.refresh();
      }}
    >
      {initial?.id ? <input type="hidden" name="id" value={String(initial.id)} /> : null}
      <div className="grid grid-cols-2 gap-3">
        <label className={labelCls}>
          Name
          <input name="name" required defaultValue={str('name')} placeholder="Boxy tee" className={inputCls} />
        </label>
        <label className={labelCls}>
          Category
          <input name="category" required defaultValue={str('category')} placeholder="tops" className={inputCls} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className={labelCls}>
          Archetype
          <input name="archetype" defaultValue={str('archetype') || 'APPAREL'} className={inputCls} />
        </label>
        <label className={labelCls}>
          Size range
          <select name="size_range_id" defaultValue={str('size_range_id')} className={inputCls}>
            <option value="">— none —</option>
            {sizeRanges.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </label>
      </div>
      <fieldset>
        <legend className={labelCls}>Views</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {VIEWS.map((v) => (
            <label key={v} className="flex items-center gap-1 text-sm">
              <input type="checkbox" name="views" value={v} checked={views.includes(v)} onChange={() => toggleView(v)} />
              {v}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <AssetUploadField name="flat_sketch_asset_id" label="Flat sketch (SVG)" accept=".svg,image/svg+xml" kind="flat_sketch" initial={str('flat_sketch_asset_id')} />
        <AssetUploadField name="model_asset_id" label="3D model (GLB)" accept=".glb,model/gltf-binary" kind="model" initial={str('model_asset_id')} />
      </div>
      <label className={labelCls}>
        Pattern asset id (DXF — upload in Assets first)
        <input name="pattern_asset_id" defaultValue={str('pattern_asset_id')} placeholder="uuid" className={inputCls} />
      </label>
      <label className={labelCls}>
        Turntable frames (8–72)
        <input name="turntable_frames" type="number" min="8" max="72" defaultValue={num('turntable_frames')} className={inputCls} />
      </label>
      <div>
        <span className="block text-sm font-medium">Print areas — draw on the flat</span>
        <PrintAreaEditor initial={initialAreas} views={views} flatAssetId={str('flat_sketch_asset_id') || null} />
      </div>
      <div>
        <button disabled={busy} className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50">
          {initial ? 'Save template' : 'Add template'}
        </button>
      </div>
      <ResultMessage result={result} />
    </form>
  );
}
