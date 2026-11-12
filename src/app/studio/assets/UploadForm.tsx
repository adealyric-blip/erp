// Upload form for /studio/assets (T09). Posts multipart to the staff
// upload route; shows the returned asset id / thumbnail job, or the error.
'use client';

import { useState } from 'react';

export function UploadForm() {
  const [status, setStatus] = useState<string>('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const file = form.get('file');
    if (!(file instanceof File) || file.size === 0) {
      setStatus('Choose a file first.');
      return;
    }
    setBusy(true);
    setStatus('Uploading…');
    try {
      const res = await fetch('/api/studio/assets', { method: 'POST', body: form });
      const body = (await res.json()) as {
        ok: boolean;
        data?: { assetId: string; mimeType: string; thumbnailJobId: string | null };
        error?: { message: string };
      };
      if (!res.ok || !body.ok) {
        setStatus(`Upload failed: ${body.error?.message ?? res.statusText}`);
      } else {
        setStatus(
          `Uploaded ${body.data?.mimeType ?? ''} — asset ${body.data?.assetId ?? ''}` +
            (body.data?.thumbnailJobId ? ` (thumbnail job ${body.data.thumbnailJobId})` : ' (no thumbnail for this type)'),
        );
        e.currentTarget.reset();
      }
    } catch (err) {
      setStatus(`Upload failed: ${err instanceof Error ? err.message : 'network error'}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 flex flex-wrap items-center gap-3">
      <input type="file" name="file" accept="image/*,.pdf,.glb,.svg" className="text-sm" />
      <label className="flex items-center gap-1 text-sm">
        <input type="checkbox" name="bgRemove" value="true" /> Remove background
      </label>
      <button
        type="submit"
        disabled={busy}
        className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {busy ? 'Uploading…' : 'Upload to design-private'}
      </button>
      {status && <p className="w-full text-sm text-neutral-600">{status}</p>}
    </form>
  );
}
