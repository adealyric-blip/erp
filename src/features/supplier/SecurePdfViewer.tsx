'use client';

import { useEffect, useState } from 'react';
import PreviewGuard from './releases/PreviewGuard';
import Watermark from './releases/Watermark';

// SecurePdfViewer — T18 supplier tech-pack preview PDF.
//
// There is no pdf.js bundle in this repo (no pdfjs-dist dependency), so the
// PDF is rendered in a sandboxed <iframe> pointed ONLY at the authorize
// proxy (/api/supplier/assets/…) with the viewer chrome stripped
// (#toolbar=0&navpanes=0&scrollbar=0) — no download button of ours, no
// storage URL anywhere in the page (zero-leak: the only host the browser
// ever talks to is our own origin). The proxy stream is authorized per
// fetch by supplier_authorize_asset_view; a revoked supplier gets 403 on
// the next load in every open tab.
// OPEN ITEM: burn a diagonal tiled watermark INTO the PDF bytes (pdf-lib)
// so a saved copy still carries the viewer identity; until that lands the
// watermark is the on-screen overlay below plus the proxy's X-Watermark
// header. The PDF bytes themselves are never re-hosted anywhere.

export interface SecurePdfViewerProps {
  rfqId: string;
  assetId: string;
  watermarkText?: string;
  title?: string;
}

export default function SecurePdfViewer({ rfqId, assetId, watermarkText, title }: SecurePdfViewerProps) {
  const [denied, setDenied] = useState(false);
  const src = `/api/supplier/assets/${rfqId}/${assetId}#toolbar=0&navpanes=0&scrollbar=0`;

  useEffect(() => {
    let cancelled = false;
    // Pre-flight the authorize check so a denial renders a message instead
    // of an empty PDF frame. A HEAD fetch carries no bytes.
    void fetch(`/api/supplier/assets/${rfqId}/${assetId}`, { method: 'HEAD', credentials: 'include' }).then((res) => {
      if (!cancelled && res.status === 403) setDenied(true);
    });
    return () => {
      cancelled = true;
    };
  }, [rfqId, assetId]);

  return (
    <div data-testid="secure-pdf-viewer">
      <PreviewGuard rfqId={rfqId} assetId={assetId}>
        <div className="relative overflow-hidden rounded-md border bg-white">
          <p className="border-b px-3 py-2 text-xs font-medium text-neutral-600">
            Tech-pack preview — {title ?? 'PDF'} · watermarked, download disabled in this viewer
          </p>
          {denied ? (
            <p data-testid="secure-pdf-denied" className="px-3 py-8 text-sm font-medium text-red-700">
              Access denied — your preview grant was revoked or has expired.
            </p>
          ) : (
            <div className="relative">
              <iframe
                title={title ?? 'Tech-pack preview'}
                src={src}
                sandbox="allow-scripts allow-same-origin"
                className="block h-[640px] w-full"
              />
              {watermarkText && <Watermark text={watermarkText} />}
            </div>
          )}
        </div>
      </PreviewGuard>
    </div>
  );
}
