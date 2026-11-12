// Import licensed flat form (T10b) — uploads the bundle to design-private,
// then registers the import batch with the chosen license. SVG conversion
// runs in VectorCraft (Lane C); the batch queues until that bridge lands.
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { runCommand } from '@/server/actions/commands';

const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  svg: 'image/svg+xml',
  eps: 'application/postscript',
  ai: 'application/illustrator',
};

export function ImportFlatForm({ licenses }: { licenses: { id: string; label: string }[] }) {
  const router = useRouter();
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const file = form.get('file');
    if (!(file instanceof File) || file.size === 0) {
      setStatus('Choose a bundle file first (PDF preferred).');
      return;
    }
    const licenseId = String(form.get('licenseId') || '');
    if (!licenseId) {
      setStatus('Pick the license record for this bundle first.');
      return;
    }
    setBusy(true);
    setStatus('Uploading bundle…');
    try {
      const upForm = new FormData();
      upForm.append('file', file);
      upForm.append('kind', 'flat_sketch');
      const up = await fetch('/api/studio/assets', { method: 'POST', body: upForm });
      const upBody = (await up.json()) as {
        ok: boolean;
        data?: { assetId: string; storagePath: string; mimeType: string };
        error?: { message: string };
      };
      if (!up.ok || !upBody.ok || !upBody.data) {
        setStatus(`Upload failed: ${upBody.error?.message ?? up.statusText}`);
        setBusy(false);
        return;
      }
      const ext = (file.name.split('.').pop() ?? '').toLowerCase();
      const mime = MIME_BY_EXT[ext] ?? upBody.data.mimeType;
      const res = await runCommand('flat.import', {
        fileName: file.name,
        mimeType: mime,
        storagePath: upBody.data.storagePath,
        licenseId,
        sourceCategory: String(form.get('sourceCategory') || '') || undefined,
      });
      setBusy(false);
      if (!res.ok) {
        setStatus(`Import failed: ${res.error.message}`);
        return;
      }
      const data = res.data as { batchId: string; note: string };
      setStatus(`Batch ${data.batchId.slice(0, 8)}… queued. ${data.note}`);
      router.refresh();
    } catch (err) {
      setBusy(false);
      setStatus(`Import failed: ${err instanceof Error ? err.message : 'network error'}`);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 grid gap-2">
      <label className="text-sm font-medium">
        Bundle (PDF preferred, or AI / EPS / SVG)
        <input type="file" name="file" accept=".pdf,.svg,.eps,.ai" className="mt-1 block text-sm" />
      </label>
      <label className="text-sm font-medium">
        License record (required)
        <select name="licenseId" required className="mt-1 w-full rounded border px-2 py-1 text-sm" defaultValue="">
          <option value="" disabled>Pick a license…</option>
          {licenses.map((l) => (
            <option key={l.id} value={l.id}>{l.label}</option>
          ))}
        </select>
      </label>
      <label className="text-sm font-medium">
        Source category
        <input name="sourceCategory" placeholder="tops" className="mt-1 w-full rounded border px-2 py-1 text-sm" />
      </label>
      <div>
        <button disabled={busy || licenses.length === 0} className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50">
          {busy ? 'Importing…' : 'Import licensed flat'}
        </button>
      </div>
      {licenses.length === 0 && (
        <p className="text-sm text-red-700">Add a license record below before importing.</p>
      )}
      {status && <p className="text-sm text-neutral-600">{status}</p>}
    </form>
  );
}
