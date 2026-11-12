'use client';

import { useState } from 'react';
import type { SupplierNda } from './types';

// NdaGate — T18. Shows the NDA text the server returned, and sends back
// the hash OF THE TEXT DISPLAYED (supplier_accept_nda rejects any hash
// that does not equal the current nda body_sha256). The signer name is
// typed by the supplier; nothing is pre-filled and no hash is ever
// constructed client-side from anything but the displayed NDA.

export interface NdaGateProps {
  rfqId: string;
  nda: SupplierNda;
  /** Server action: (rfqId, bodySha256, signerName, signerTitle) => Result<void>. */
  onAccept: (rfqId: string, bodySha256: string, signerName: string, signerTitle: string | null) => Promise<{
    ok: boolean;
    error?: { message: string };
  }>;
  onAccepted: () => void;
}

export default function NdaGate({ rfqId, nda, onAccept, onAccepted }: NdaGateProps) {
  const [signerName, setSignerName] = useState('');
  const [signerTitle, setSignerTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    // The hash sent is exactly nda.body_sha256 — the hash of the text shown
    // above. If the NDA changed server-side, the RPC rejects it.
    const res = await onAccept(rfqId, nda.body_sha256, signerName.trim(), signerTitle.trim() || null);
    setBusy(false);
    if (!res.ok) {
      setError(res.error?.message ?? 'Could not accept the NDA.');
      return;
    }
    onAccepted();
  }

  return (
    <section data-testid="nda-gate" className="rounded-lg border border-amber-300 bg-amber-50 p-5">
      <h2 className="text-lg font-semibold">Non-disclosure agreement required</h2>
      <p className="mt-1 text-sm text-neutral-600">
        Read the NDA below and sign with your full name to view this RFQ. The NDA is version {nda.version} —{' '}
        {nda.title}. Your acceptance is recorded with the hash of the text shown here.
      </p>
      <div data-testid="nda-body" className="mt-4 max-h-72 overflow-y-auto rounded-md border bg-white p-4 text-sm whitespace-pre-wrap">
        {nda.body_md}
      </div>
      <p className="mt-2 text-xs text-neutral-500">
        Document hash (sha256): <code>{nda.body_sha256}</code>
      </p>
      <form onSubmit={accept} className="mt-4 flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Signer full name
          <input
            required
            minLength={2}
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
            className="rounded-md border px-3 py-2"
            placeholder="Your full name"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Title (optional)
          <input
            value={signerTitle}
            onChange={(e) => setSignerTitle(e.target.value)}
            className="rounded-md border px-3 py-2"
            placeholder="e.g. Sales Director"
          />
        </label>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button
          type="submit"
          disabled={busy || signerName.trim().length < 2}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? 'Recording…' : 'I accept this NDA'}
        </button>
      </form>
    </section>
  );
}
