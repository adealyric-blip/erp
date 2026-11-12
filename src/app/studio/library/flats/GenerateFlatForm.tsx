// Generate flat form (T10b) — runs the flat.generate command.
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { BLANKS } from '@/lib/flat-gen';
import { runCommand } from '@/server/actions/commands';

export function GenerateFlatForm() {
  const router = useRouter();
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setStatus('Generating…');
    const res = await runCommand('flat.generate', {
      blankId: String(form.get('blankId')),
      size: String(form.get('size') || 'M'),
      templateName: String(form.get('templateName') || '') || undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setStatus(`Failed: ${res.error.message}`);
      return;
    }
    const data = res.data as { templateId: string; templateName: string; views: unknown[] };
    setStatus(`Generated ${data.templateName} — ${data.views.length} views, template ${data.templateId.slice(0, 8)}…`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 grid gap-2">
      <label className="text-sm font-medium">
        Blank
        <select name="blankId" required className="mt-1 w-full rounded border px-2 py-1 text-sm">
          {BLANKS.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} ({b.views.join(', ')})
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-sm font-medium">
          Base size
          <input name="size" defaultValue="M" className="mt-1 w-full rounded border px-2 py-1 text-sm" />
        </label>
        <label className="text-sm font-medium">
          Template name (optional)
          <input name="templateName" placeholder="defaults to the blank name" className="mt-1 w-full rounded border px-2 py-1 text-sm" />
        </label>
      </div>
      <div>
        <button disabled={busy} className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50">
          {busy ? 'Generating…' : 'Generate flat'}
        </button>
      </div>
      {status && <p className="text-sm text-neutral-600">{status}</p>}
    </form>
  );
}
