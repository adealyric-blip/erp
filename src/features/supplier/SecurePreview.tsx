'use client';

import { useEffect, useRef, useState } from 'react';
import Watermark from './releases/Watermark';

// SecurePreview — T18 supplier preview (canvas, per plan/04).
//
// The preview bytes come ONLY from /api/supplier/assets/[rfqId]/[assetId],
// which re-authorizes every fetch server-side through
// supplier_authorize_asset_view (NDA + invitation + grant + revocation).
// The image is drawn on a <canvas> — no <img src> pointing at a URL that
// can be copied — the context menu is disabled, and the watermark text the
// proxy stamped into the bytes is also shown as an overlay. Revocation
// blocks the NEXT fetch in every open tab (the proxy returns 403), so a
// revoked supplier sees the preview go dark without any client-side state.

export interface SecurePreviewProps {
  rfqId: string;
  assetId: string;
  surface: string;
  watermarkText?: string;
  /** Width/height from supplier_get_rfq (display only). */
  width?: number | null;
  height?: number | null;
}

export default function SecurePreview({ rfqId, assetId, surface, watermarkText, width, height }: SecurePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'denied' | 'error'>('loading');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setStatus('loading');
      try {
        const res = await fetch(`/api/supplier/assets/${rfqId}/${assetId}`, { credentials: 'include' });
        if (res.status === 403) {
          if (!cancelled) {
            setStatus('denied');
            setMessage('Access denied — your preview grant was revoked or has expired.');
          }
          return;
        }
        if (!res.ok) {
          if (!cancelled) {
            setStatus('error');
            setMessage(`Preview unavailable (HTTP ${res.status}).`);
          }
          return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        try {
          const img = new Image();
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('image decode failed'));
            img.src = url;
          });
          if (cancelled) return;
          const canvas = canvasRef.current;
          if (canvas) {
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) ctx.drawImage(img, 0, 0);
          }
          setStatus('ready');
        } finally {
          URL.revokeObjectURL(url);
        }
      } catch {
        if (!cancelled) {
          setStatus('error');
          setMessage('Preview failed to load.');
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [rfqId, assetId]);

  return (
    <figure data-testid="secure-preview" className="relative overflow-hidden rounded-md border bg-white">
      <figcaption className="border-b px-3 py-2 text-xs font-medium text-neutral-600">
        Preview — {surface} {width && height ? `· ${width}×${height}` : ''}
      </figcaption>
      <div className="relative" onContextMenu={(e) => e.preventDefault()}>
        <canvas ref={canvasRef} className="block max-h-[480px] w-full object-contain" aria-label={`Supplier preview for ${surface}`} />
        {status === 'ready' && watermarkText && <Watermark text={watermarkText} />}
        {status === 'loading' && <p className="px-3 py-8 text-sm text-neutral-500">Loading preview…</p>}
        {status === 'denied' && (
          <p data-testid="secure-preview-denied" className="px-3 py-8 text-sm font-medium text-red-700">
            {message}
          </p>
        )}
        {status === 'error' && <p className="px-3 py-8 text-sm text-neutral-500">{message}</p>}
      </div>
    </figure>
  );
}
