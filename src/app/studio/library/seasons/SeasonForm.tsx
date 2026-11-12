// Season create/edit form (T10). Constraint errors come back inline from
// the server action (message + field hint).
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { saveSeason } from '@/server/actions/library';
import type { Result } from '@/server/result';
import { ResultMessage, inputCls, labelCls } from '../components';

export function SeasonForm({ initial }: { initial: Record<string, unknown> | null }) {
  const router = useRouter();
  const [result, setResult] = useState<Result<string> | null>(null);
  const [busy, setBusy] = useState(false);
  const str = (k: string) => (typeof initial?.[k] === 'string' ? (initial[k] as string) : '');

  return (
    <form
      className="mt-3 grid max-w-xl gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const res = await saveSeason(new FormData(e.currentTarget));
        setResult(res);
        setBusy(false);
        if (res.ok) router.refresh();
      }}
    >
      {initial?.id ? <input type="hidden" name="id" value={String(initial.id)} /> : null}
      <label className={labelCls}>
        Code
        <input name="code" required defaultValue={str('code')} placeholder="SS27" className={inputCls} />
      </label>
      <label className={labelCls}>
        Name
        <input name="name" required defaultValue={str('name')} placeholder="Spring Summer 27" className={inputCls} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className={labelCls}>
          Starts on
          <input name="starts_on" type="date" defaultValue={str('starts_on').slice(0, 10)} className={inputCls} />
        </label>
        <label className={labelCls}>
          Ends on
          <input name="ends_on" type="date" defaultValue={str('ends_on').slice(0, 10)} className={inputCls} />
        </label>
      </div>
      <label className={labelCls}>
        Status
        <select name="status" defaultValue={str('status') || 'planning'} className={inputCls}>
          {['planning', 'active', 'closed', 'archived'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </label>
      <div>
        <button disabled={busy} className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50">
          {initial ? 'Save season' : 'Add season'}
        </button>
      </div>
      <ResultMessage result={result} />
    </form>
  );
}
