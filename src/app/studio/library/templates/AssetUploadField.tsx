// Upload-a-file-and-store-its-asset-id field (T10). Used for the flat SVG
// and GLB model on the garment template form: uploads through the staff
// route, then writes the returned asset id into a hidden field.
'use client';

import { useState } from 'react';

export function AssetUploadField({
  name,
  label,
  accept,
  kind,
  initial,
}: {
  name: string;
  label: string;
  accept: string;
  kind: string;
  initial: string;
}) {
  const [assetId, setAssetId] = useState(initial);
  const [status, setStatus] = useState('');

  async function onFile(file: File | undefined) {
    if (!file) return;
    setStatus('Uploading…');
    const form = new FormData();
    form.append('file', file);
    form.append('kind', kind);
    try {
      const res = await fetch('/api/studio/assets', { method: 'POST', body: form });
      const body = (await res.json()) as {
        ok: boolean;
        data?: { assetId: string };
        error?: { message: string };
      };
      if (!res.ok || !body.ok || !body.data) {
        setStatus(`Upload failed: ${body.error?.message ?? res.statusText}`);
      } else {
        setAssetId(body.data.assetId);
        setStatus(`Uploaded — asset ${body.data.assetId.slice(0, 8)}…`);
      }
    } catch (err) {
      setStatus(`Upload failed: ${err instanceof Error ? err.message : 'network error'}`);
    }
  }

  return (
    <div>
      <span className="block text-sm font-medium">{label}</span>
      <input
        type="file"
        accept={accept}
        className="mt-1 text-sm"
        onChange={(e) => void onFile(e.currentTarget.files?.[0])}
      />
      <input type="hidden" name={name} value={assetId} />
      <p className="text-xs text-neutral-500">{assetId ? `asset id: ${assetId}` : status || 'No file attached yet.'}</p>
      {status && !assetId && <p className="text-xs text-red-700">{status}</p>}
    </div>
  );
}
