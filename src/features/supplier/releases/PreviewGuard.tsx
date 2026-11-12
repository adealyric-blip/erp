'use client';

import { useCallback, useEffect, useState } from 'react';

// PreviewGuard — T20 no-screenshare preview guard.
//
// The guard is advisory in the browser (a screenshot can never be fully
// prevented client-side) and ENFORCED server-side: every preview fetch and
// every download re-authorizes through the S600 RPCs, so a revoked supplier
// is blocked on their next fetch in every open tab. This component adds the
// visible, production-only layer on top of that:
//  - production only: the guard is inert outside production (dev/preview
//    builds show a notice instead of blocking staff work);
//  - context menu, drag, text selection and printing are disabled;
//  - beforeprint / copy attempts are reported to /api/supplier/access-events
//    (advisory logging) and the print stylesheet hides the guarded content.

export interface PreviewGuardProps {
  rfqId: string;
  assetId?: string;
  children: React.ReactNode;
}

const isProd = process.env.NODE_ENV === 'production';

async function reportAttempt(rfqId: string, assetId: string | undefined, event: string) {
  try {
    await fetch('/api/supplier/access-events', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rfqId, assetId: assetId ?? null, event }),
    });
  } catch {
    // Advisory only — a failed report must never break the preview.
  }
}

export default function PreviewGuard({ rfqId, assetId, children }: PreviewGuardProps) {
  const [attempts, setAttempts] = useState(0);

  const report = useCallback(
    (event: string) => {
      setAttempts((n) => n + 1);
      void reportAttempt(rfqId, assetId, event);
    },
    [rfqId, assetId],
  );

  useEffect(() => {
    if (!isProd) return;
    const onBeforePrint = (e: Event) => {
      e.preventDefault();
      report('print_attempt');
    };
    const onCopy = () => report('copy_attempt');
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ['p', 's', 'c'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        report(e.key.toLowerCase() === 'p' ? 'print_attempt' : 'copy_attempt');
      }
    };
    window.addEventListener('beforeprint', onBeforePrint);
    document.addEventListener('copy', onCopy);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('beforeprint', onBeforePrint);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [report]);

  return (
    <div
      data-testid="preview-guard"
      data-guard-active={isProd ? 'true' : 'false'}
      onContextMenu={isProd ? (e) => e.preventDefault() : undefined}
      onDragStart={isProd ? (e) => e.preventDefault() : undefined}
      className={isProd ? 'relative select-none' : 'relative'}
    >
      {!isProd && (
        <p data-testid="preview-guard-notice" className="mb-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Preview guard is disabled outside production. In production, screen sharing, printing,
          copying and right-click are blocked on this preview and attempts are logged.
        </p>
      )}
      {isProd && (
        <p className="mb-2 rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
          Screen sharing, printing and copying are prohibited for this preview. Attempts are logged
          to the access audit trail.
          {attempts > 0 && <span className="ml-2 font-semibold text-red-700">Blocked attempts this session: {attempts}</span>}
        </p>
      )}
      <div className="print:hidden">{children}</div>
      <style>{`@media print { [data-testid="preview-guard"] { display: none !important; } }`}</style>
    </div>
  );
}
