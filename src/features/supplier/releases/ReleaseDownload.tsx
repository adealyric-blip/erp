'use client';

import { useEffect, useState } from 'react';
import PreviewGuard from './PreviewGuard';
import Watermark from './Watermark';

// ReleaseDownload — T20 supplier release download (client island).
//
// Every download re-authorizes: POST /api/supplier/releases/[rfqId]
// calls supplier_authorize_release with the supplier's JWT and only then
// mints a FRESH signed URL with ttlSeconds 900 (15 minutes). The URL is
// never persisted, never embedded in page HTML, and every authorize call
// is recorded in ds_access_events by the RPC itself
// (release_download_authorized / _denied).
//
// Revocation blocks ALL open tabs: this component re-checks access every
// 30 s (GET token-check on the same route). A 403 flips every open tab to
// the blocked state and disables the buttons — no tab keeps a working
// download after revocation.

export interface ReleasePack {
  techPackId: string;
  title: string;
  styleNumber: string | null;
  revision: number;
  allowed: boolean;
  reason?: string;
}

export interface ReleaseDownloadProps {
  rfqId: string;
  packs: ReleasePack[];
}

interface HistoryEntry {
  at: string;
  techPackId: string;
  title: string;
  result: 'downloaded' | 'denied';
}

export default function ReleaseDownload({ rfqId, packs }: ReleaseDownloadProps) {
  const [access, setAccess] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(packs.map((p) => [p.techPackId, p.allowed])),
  );
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Pre-download check: re-authorize every 30 s so a revocation lands in
  // every open tab within one poll interval.
  useEffect(() => {
    const timer = setInterval(() => {
      void fetch(`/api/supplier/releases/${rfqId}`, { credentials: 'include' })
        .then((res) => {
          if (res.status === 403) {
            setBlocked(true);
            setAccess({});
            return null;
          }
          return res.json() as Promise<{ packs?: Array<{ tech_pack_id: string; allowed: boolean }> }>;
        })
        .then((json) => {
          if (!json) return;
          const next: Record<string, boolean> = {};
          for (const p of json.packs ?? []) next[p.tech_pack_id] = p.allowed;
          setAccess(next);
          setBlocked(!Object.values(next).some(Boolean));
        })
        .catch(() => {
          // A failed re-check never grants access; the download POST
          // re-authorizes anyway.
        });
    }, 30_000);
    return () => clearInterval(timer);
  }, [rfqId]);

  async function download(pack: ReleasePack) {
    setBusy(pack.techPackId);
    setMessage(null);
    try {
      const res = await fetch(`/api/supplier/releases/${rfqId}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ techPackId: pack.techPackId }),
      });
      if (res.status === 403) {
        setBlocked(true);
        setHistory((h) => [{ at: new Date().toISOString(), techPackId: pack.techPackId, title: pack.title, result: 'denied' }, ...h]);
        setMessage('Access denied — this release was revoked or has expired.');
        return;
      }
      if (!res.ok) {
        setMessage(`Download failed (HTTP ${res.status}).`);
        return;
      }
      const json = (await res.json()) as { url: string; expiresIn: number };
      const a = document.createElement('a');
      a.href = json.url;
      a.download = `${pack.styleNumber ?? 'techpack'}-r${pack.revision}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setHistory((h) => [{ at: new Date().toISOString(), techPackId: pack.techPackId, title: pack.title, result: 'downloaded' }, ...h]);
      setMessage(`Download started — the link expires in ${Math.round(json.expiresIn / 60)} minutes.`);
    } catch {
      setMessage('Download failed.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div data-testid="release-download">
      {blocked && (
        <p data-testid="release-blocked" className="mb-4 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          Access revoked — this release is no longer available to you. Downloads are blocked in every open tab.
        </p>
      )}
      <ul className="space-y-3">
        {packs.map((p) => {
          const allowed = access[p.techPackId] ?? p.allowed;
          return (
            <li key={p.techPackId} data-testid="release-pack-row" className="rounded-md border bg-white px-4 py-3">
              <p className="font-medium">
                {p.title} {p.styleNumber ? `(${p.styleNumber})` : ''} — rev {p.revision}
              </p>
              <p className="text-sm text-neutral-500">
                {allowed
                  ? 'Released to you — production pack, watermarked with your vendor name.'
                  : `Not available — ${p.reason ?? 'not released to you'}`}
              </p>
              <button
                type="button"
                disabled={!allowed || blocked || busy === p.techPackId}
                onClick={() => void download(p)}
                className="mt-2 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {busy === p.techPackId ? 'Preparing…' : 'Download production pack (fresh 15-minute link)'}
              </button>
            </li>
          );
        })}
      </ul>
      {message && <p className="mt-3 text-sm text-neutral-600">{message}</p>}
      <section className="mt-6">
        <h2 className="font-semibold">Download history (this session)</h2>
        {history.length === 0 ? (
          <p className="mt-1 text-sm text-neutral-500">
            No downloads yet in this session. Every download is also recorded server-side in the audit trail
            — staff see the full history on the release page.
          </p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {history.map((h, i) => (
              <li key={i} data-testid="download-history-row">
                {h.at.slice(0, 10)} {h.at.slice(11, 19)}Z — {h.title} — {h.result}
              </li>
            ))}
          </ul>
        )}
      </section>
      <PreviewGuard rfqId={rfqId}>
        <p className="mt-6 rounded-md border bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
          Previews on this page are guarded: screen sharing, printing and copying are prohibited in production.
        </p>
        <Watermark text="Release preview — watermarked copy" variant="single" className="hidden" />
      </PreviewGuard>
    </div>
  );
}
