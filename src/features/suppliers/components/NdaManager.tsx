// NdaManager — T16 NDA versions (new version = new row; activate one).
// In demo mode the list is local fixture state.
'use client';

import { useState } from 'react';
import type { NdaRow } from '@/server/actions/suppliers';
import type { Result } from '@/server/result';

export function NdaManager({
  ndas,
  activeNdaId,
  onCreate,
  onActivate,
  demo = false,
}: {
  ndas: NdaRow[];
  activeNdaId: string | null;
  onCreate: (title: string, bodyMd: string) => Promise<Result<NdaRow>>;
  onActivate: (ndaId: string) => Promise<Result<{ activated: true }>>;
  demo?: boolean;
}) {
  const [title, setTitle] = useState('');
  const [bodyMd, setBodyMd] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [localNdas, setLocalNdas] = useState<NdaRow[]>(ndas);
  const [localActive, setLocalActive] = useState<string | null>(activeNdaId);

  const shown = demo ? localNdas : ndas;
  const active = demo ? localActive : activeNdaId;

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (demo) {
      const next: NdaRow = {
        id: `demo-nda-${shown.length + 1}`,
        version: (shown.length > 0 ? Math.max(...shown.map((n) => n.version)) : 0) + 1,
        title: title.trim(),
        bodyMd,
        bodySha256: 'demo-sha256-not-a-real-hash',
        isActive: false,
        createdAt: new Date().toISOString(),
      };
      setLocalNdas([...shown, next]);
      setTitle('');
      setBodyMd('');
      setMessage(`Demo: NDA v${next.version} created (not saved).`);
      return;
    }
    const res = await onCreate(title, bodyMd);
    setMessage(res.ok ? 'NDA version created.' : res.error?.message ?? 'Could not create NDA');
    if (res.ok) {
      setTitle('');
      setBodyMd('');
    }
  };

  const activate = async (id: string) => {
    if (demo) {
      setLocalNdas(shown.map((n) => ({ ...n, isActive: n.id === id })));
      setLocalActive(id);
      setMessage('Demo: NDA activated (not saved).');
      return;
    }
    const res = await onActivate(id);
    setMessage(res.ok ? 'NDA activated.' : res.error?.message ?? 'Could not activate NDA');
  };

  return (
    <div data-testid="nda-manager">
      {shown.length === 0 && <p className="text-sm text-neutral-500">No NDA versions yet. Create the first one below.</p>}
      <ul className="space-y-2">
        {shown.map((n) => (
          <li key={n.id} data-testid={`nda-${n.id}`}
            className="flex flex-wrap items-center gap-2 rounded-md border border-neutral-200 px-3 py-2 text-sm">
            <span className="font-medium">v{n.version} — {n.title}</span>
            <span className="font-mono text-xs text-neutral-500">sha256 {n.bodySha256.slice(0, 16)}…</span>
            {n.id === active ? (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-900">Active</span>
            ) : (
              <button type="button" data-testid={`nda-activate-${n.id}`} onClick={() => activate(n.id)}
                className="rounded-md border border-neutral-300 px-2 py-0.5 text-xs">Activate</button>
            )}
            <span className="text-xs text-neutral-500">{n.createdAt.slice(0, 10)}</span>
          </li>
        ))}
      </ul>
      <form onSubmit={create} className="mt-3 space-y-2">
        <input data-testid="nda-title" aria-label="NDA title" value={title}
          onChange={(e) => setTitle(e.target.value)} placeholder="NDA title, e.g. Mutual NDA v4"
          className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm" />
        <textarea data-testid="nda-body" aria-label="NDA body" value={bodyMd}
          onChange={(e) => setBodyMd(e.target.value)} placeholder="NDA body (Markdown)…" rows={4}
          className="w-full rounded-md border border-neutral-300 px-2 py-1 font-mono text-xs" />
        <button type="submit" data-testid="nda-create"
          className="rounded-md border border-neutral-300 bg-white px-3 py-1 text-sm">Create new NDA version</button>
        {message && <p role="status" className="text-sm text-neutral-600">{message}</p>}
      </form>
    </div>
  );
}
