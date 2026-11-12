// StockImagesPanel — T07 Images drawer panel: stock images via /api/stock
// (Unsplash / Pexels server-side keys; attribution stored per image).
'use client';

import { useEffect, useState } from 'react';
import { useCommand } from '../../hooks/useCommand';

interface StockImage {
  id: string;
  url: string;
  thumbUrl: string;
  alt: string;
  provider: string;
  attribution: string;
}

export default function StockImagesPanel({ onToast }: { onToast: (m: string) => void }) {
  const [query, setQuery] = useState('tshirt');
  const [images, setImages] = useState<StockImage[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [provider, setProvider] = useState('');
  const { run } = useCommand();

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    fetch(`/api/stock?q=${encodeURIComponent(query)}&limit=12`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Stock API ${r.status}`))))
      .then((body: { images: StockImage[]; provider: string }) => {
        if (cancelled) return;
        setImages(body.images ?? []);
        setProvider(body.provider ?? '');
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  const add = async (img: StockImage) => {
    const res = await run('layer.add_image', { kind: 'image', src: img.url, width: 240, height: 240 });
    if (res.ok) onToast(`Added stock image (${img.attribution}).`);
  };

  return (
    <div data-testid="stock-images-panel">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search stock images…"
        aria-label="Search stock images"
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
      />
      {provider && <p className="mt-2 text-xs text-neutral-500">Provider: {provider}</p>}
      {status === 'loading' && <p className="mt-3 text-sm text-neutral-500">Loading stock images…</p>}
      {status === 'error' && <p className="mt-3 text-sm text-red-600">Could not load stock images.</p>}
      {status === 'ready' && images.length === 0 && <p className="mt-3 text-sm text-neutral-500">No images for “{query}”.</p>}
      <div className="mt-3 grid grid-cols-3 gap-2">
        {images.map((img) => (
          <button
            key={img.id}
            type="button"
            title={`${img.alt} — ${img.attribution}`}
            onClick={() => void add(img)}
            className="overflow-hidden rounded-md border border-neutral-200 hover:border-blue-500"
          >
            <img src={img.thumbUrl} alt={img.alt} loading="lazy" className="aspect-square w-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}
