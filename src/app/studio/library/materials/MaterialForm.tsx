// Material create/edit form (T10).
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { saveMaterial } from '@/server/actions/library';
import type { Result } from '@/server/result';
import { ResultMessage, inputCls, labelCls } from '../components';

const KINDS = ['fabric', 'trim', 'label', 'packaging', 'thread', 'hardware', 'interlining', 'other'];

export function MaterialForm({ initial }: { initial: Record<string, unknown> | null }) {
  const router = useRouter();
  const [result, setResult] = useState<Result<string> | null>(null);
  const [busy, setBusy] = useState(false);
  const str = (k: string) => (typeof initial?.[k] === 'string' ? (initial[k] as string) : '');
  const num = (k: string) => (typeof initial?.[k] === 'number' ? String(initial[k]) : '');
  const certs = Array.isArray(initial?.certifications) ? (initial.certifications as string[]).join(', ') : '';

  return (
    <form
      className="mt-3 grid max-w-xl gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const res = await saveMaterial(new FormData(e.currentTarget));
        setResult(res);
        setBusy(false);
        if (res.ok) router.refresh();
      }}
    >
      {initial?.id ? <input type="hidden" name="id" value={String(initial.id)} /> : null}
      <div className="grid grid-cols-2 gap-3">
        <label className={labelCls}>
          Kind
          <select name="kind" defaultValue={str('kind') || 'fabric'} className={inputCls}>
            {KINDS.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </label>
        <label className={labelCls}>
          Code
          <input name="code" required defaultValue={str('code')} placeholder="JER-240" className={inputCls} />
        </label>
      </div>
      <label className={labelCls}>
        Name
        <input name="name" required defaultValue={str('name')} placeholder="240gsm jersey" className={inputCls} />
      </label>
      <label className={labelCls}>
        Composition
        <input name="composition" defaultValue={str('composition')} placeholder="100% organic cotton" className={inputCls} />
      </label>
      <div className="grid grid-cols-3 gap-3">
        <label className={labelCls}>
          Weight (gsm)
          <input name="weight_gsm" type="number" step="0.01" min="0" defaultValue={num('weight_gsm')} className={inputCls} />
        </label>
        <label className={labelCls}>
          Width (cm)
          <input name="width_cm" type="number" step="0.01" min="0" defaultValue={num('width_cm')} className={inputCls} />
        </label>
        <label className={labelCls}>
          Unit cost
          <input name="unit_cost" type="number" step="0.01" min="0" defaultValue={num('unit_cost')} className={inputCls} />
        </label>
      </div>
      <label className={labelCls}>
        Colour ref
        <input name="color_ref" defaultValue={str('color_ref')} placeholder="Pantone / lab dip ref" className={inputCls} />
      </label>
      <label className={labelCls}>
        Certifications (comma separated)
        <input name="certifications" defaultValue={certs} placeholder="GOTS, OEKO-TEX" className={inputCls} />
      </label>
      <label className={labelCls}>
        Nominated vendor id (optional)
        <input name="vendor_id" defaultValue={str('vendor_id')} placeholder="uuid" className={inputCls} />
      </label>
      <label className={labelCls}>
        Swatch asset id (upload in Assets first)
        <input name="swatch_asset_id" defaultValue={str('swatch_asset_id')} placeholder="uuid" className={inputCls} />
      </label>
      <label className={labelCls}>
        Notes
        <textarea name="notes" defaultValue={str('notes')} rows={2} className={inputCls} />
      </label>
      <div>
        <button disabled={busy} className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50">
          {initial ? 'Save material' : 'Add material'}
        </button>
      </div>
      <ResultMessage result={result} />
    </form>
  );
}
