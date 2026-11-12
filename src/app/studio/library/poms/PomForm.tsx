// POM create/edit form (T10).
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { savePom } from '@/server/actions/library';
import type { Result } from '@/server/result';
import { ResultMessage, inputCls, labelCls } from '../components';

export function PomForm({ initial }: { initial: Record<string, unknown> | null }) {
  const router = useRouter();
  const [result, setResult] = useState<Result<string> | null>(null);
  const [busy, setBusy] = useState(false);
  const str = (k: string) => (typeof initial?.[k] === 'string' ? (initial[k] as string) : '');
  const num = (k: string, d: string) =>
    typeof initial?.[k] === 'number' ? String(initial[k]) : d;

  return (
    <form
      className="mt-3 grid max-w-xl gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const res = await savePom(new FormData(e.currentTarget));
        setResult(res);
        setBusy(false);
        if (res.ok) router.refresh();
      }}
    >
      {initial?.id ? <input type="hidden" name="id" value={String(initial.id)} /> : null}
      <div className="grid grid-cols-2 gap-3">
        <label className={labelCls}>
          Code
          <input name="code" required defaultValue={str('code')} placeholder="A" className={inputCls} />
        </label>
        <label className={labelCls}>
          Category
          <input name="category" defaultValue={str('category')} placeholder="tops" className={inputCls} />
        </label>
      </div>
      <label className={labelCls}>
        Name
        <input name="name" required defaultValue={str('name')} placeholder="Body length from HPS" className={inputCls} />
      </label>
      <label className={labelCls}>
        How to measure
        <textarea name="how_to_measure" defaultValue={str('how_to_measure')} rows={2} className={inputCls} />
      </label>
      <div className="grid grid-cols-3 gap-3">
        <label className={labelCls}>
          Tol +
          <input name="default_tol_plus" type="number" step="0.01" min="0" defaultValue={num('default_tol_plus', '1')} className={inputCls} />
        </label>
        <label className={labelCls}>
          Tol −
          <input name="default_tol_minus" type="number" step="0.01" min="0" defaultValue={num('default_tol_minus', '1')} className={inputCls} />
        </label>
        <label className={labelCls}>
          Sort
          <input name="sort" type="number" step="1" defaultValue={num('sort', '0')} className={inputCls} />
        </label>
      </div>
      <label className={labelCls}>
        Diagram asset id (upload in Assets first)
        <input name="diagram_asset_id" defaultValue={str('diagram_asset_id')} placeholder="uuid" className={inputCls} />
      </label>
      <div>
        <button disabled={busy} className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50">
          {initial ? 'Save POM' : 'Add POM'}
        </button>
      </div>
      <ResultMessage result={result} />
    </form>
  );
}
