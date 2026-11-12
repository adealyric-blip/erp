// License record form (T10b, admin-only — enforced again in the action).
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createLicense } from '@/server/actions/library';
import type { Result } from '@/server/result';
import { ResultMessage, inputCls, labelCls } from '../components';

export function LicenseForm() {
  const router = useRouter();
  const [result, setResult] = useState<Result<string> | null>(null);
  const [busy, setBusy] = useState(false);
  const [type, setType] = useState('licensed_commercial');

  return (
    <form
      className="mt-3 grid max-w-xl gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const res = await createLicense(new FormData(e.currentTarget));
        setResult(res);
        setBusy(false);
        if (res.ok) router.refresh();
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <label className={labelCls}>
          Source
          <select name="source" className={inputCls} defaultValue="vecfashion">
            {['generated', 'vecfashion', 'fashiondesign411', 'opentechpack', 'printful', 'other'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className={labelCls}>
          License type
          <select name="license_type" value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
            {['owned', 'open_source', 'licensed_commercial', 'vendor_restricted'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className={labelCls}>
          License name
          <input name="license_name" placeholder="VecFashion Standard" className={inputCls} />
        </label>
        <label className={labelCls}>
          License URL {type !== 'owned' && '(required)'}
          <input name="license_url" type="url" placeholder="https://…" className={inputCls} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="allow_supplier_view" value="true" defaultChecked={type !== 'vendor_restricted'} />
          May appear in supplier previews
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="allow_redistribution" value="true" />
          May be redistributed as a template
        </label>
      </div>
      <label className={labelCls}>
        Restricted to vendor id (vendor_restricted only)
        <input name="restricted_to_vendor_id" placeholder="uuid" className={inputCls} />
      </label>
      <label className={labelCls}>
        Expires at
        <input name="expires_at" type="datetime-local" className={inputCls} />
      </label>
      <label className={labelCls}>
        Notes
        <textarea name="notes" rows={2} className={inputCls} />
      </label>
      <div>
        <button disabled={busy} className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50">
          Add license
        </button>
      </div>
      <ResultMessage result={result} />
    </form>
  );
}
