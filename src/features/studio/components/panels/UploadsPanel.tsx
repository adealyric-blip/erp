// UploadsPanel — T07 Uploads drawer panel (Konva editor).
// Reads the file client-side and places it as an image layer immediately.
// Server-side upload into `design-private` with sha256/thumbnail is Lane B
// (T09 asset pipeline) — listed as an open item, not stubbed here.
'use client';

import { useRef, useState } from 'react';
import { useCommand } from '../../hooks/useCommand';

export default function UploadsPanel({ onToast }: { onToast: (m: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const { run } = useCommand();

  const place = async (file: File) => {
    if (!/^image\/(png|jpe?g|webp|svg\+xml)$/.test(file.type)) {
      onToast('Upload a PNG, JPG, WebP or SVG image.');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      onToast('That file is over the 25 MB upload limit.');
      return;
    }
    setBusy(true);
    try {
      const dataUri = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error('Could not read that file'));
        r.readAsDataURL(file);
      });
      const res = await run('layer.add_image', { kind: 'image', src: dataUri, width: 240, height: 240 });
      if (res.ok) onToast(`Added ${file.name} to the canvas.`);
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="uploads-panel">
      <p className="text-sm text-neutral-600">PNG, JPG, SVG, WebP — up to 25 MB. Placed on the canvas immediately; server upload + thumbnails land with the T09 asset pipeline.</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        aria-label="Choose an image file"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void place(f);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="mt-3 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {busy ? 'Placing…' : 'Browse files'}
      </button>
    </div>
  );
}
