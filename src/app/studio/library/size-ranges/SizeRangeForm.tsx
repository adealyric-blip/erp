// Size range create/edit form (T10).
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { saveSizeRange } from '@/server/actions/library';
import type { Result } from '@/server/result';
import { ResultMessage, inputCls, labelCls } from '../components';

export function SizeRangeForm({ initial }: { initial: Record<string, unknown> | null }) {
  const router = useRouter();
  const [result, setResult] = useState<Result<string> | null>(null);
  const [busy, setBusy] = useState(false);
  const str = (k: string) => (typeof initial?.[k] === 'string' ? (initial[k] as string) : '');
  const sizes = Array.isArray(initial?.sizes) ? (initial.sizes as string[]).join(', ') : '';

  return (
    <form
      className="mt-3 grid max-w-xl gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const res = await saveSizeRange(new FormData(e.currentTarget));
        setResult(res);
        setBusy(false);
        if (res.ok) router.refresh();
      }}
    >
      {initial?.id ? <input type="hidden" name="id" value={String(initial.id)} /> : null}
      <label className={labelCls}>
        Name
        <input name="name" required defaultValue={str('name')} placeholder="Unisex XS-XL" className={inputCls} />
      </label>
      <label className={labelCls}>
        Sizes (comma separated, in order)
        <input name="sizes" required defaultValue={sizes} placeholder="XS, S, M, L, XL" className={inputCls} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className={labelCls}>
          Base size
          <input name="base_size" required defaultValue={str('base_size')} placeholder="M" className={inputCls} />
        </label>
        <label className={labelCls}>
          Unit
          <select name="unit" defaultValue={str('unit') || 'cm'} className={inputCls}>
            <option value="cm">cm</option>
            <option value="in">in</option>
          </select>
        </label>
      </div>
      <div>
        <button disabled={busy} className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50">
          {initial ? 'Save size range' : 'Add size range'}
        </button>
      </div>
      <ResultMessage result={result} />
    </form>
  );
}
