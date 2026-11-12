'use client';

import { useState } from 'react';

// RevokeDialog — T20. One-click revocation, staff only.
//
// The RPC ds_revoke_supplier is the SINGLE source of truth: in one
// transaction it kills the portal membership, open invitations and ALL
// asset release grants for the vendor. Blocking the underlying access
// (GCP/Calls/Assets/Download in plan language) follows from that — the
// authorize RPCs (supplier_authorize_asset_view, supplier_authorize_release)
// check the grants on every call, so a revoked vendor is denied on the
// next fetch in every open tab. This dialog never tries to revoke anything
// itself; it only confirms and calls the action.

export interface RevokeDialogProps {
  vendorId: string;
  vendorName: string;
  onRevoke: (vendorId: string, reason: string | null) => Promise<{
    ok: boolean;
    error?: { message: string };
  }>;
  onRevoked: () => void;
}

export default function RevokeDialog({ vendorId, vendorName, onRevoke, onRevoked }: RevokeDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function revoke() {
    setBusy(true);
    setError(null);
    const res = await onRevoke(vendorId, reason.trim() || null);
    setBusy(false);
    if (!res.ok) {
      setError(res.error?.message ?? 'Revocation failed.');
      return;
    }
    setDone(true);
    onRevoked();
  }

  if (done) {
    return (
      <p data-testid="revoke-done" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
        {vendorName} revoked — membership, open invitations and all release grants are blocked. Open supplier tabs
        are denied on their next fetch.
      </p>
    );
  }

  return (
    <div data-testid="revoke-dialog">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-red-600 px-4 py-2 text-sm font-medium text-red-700"
      >
        Revoke supplier
      </button>
      {open && (
        <div className="mt-3 rounded-lg border border-red-300 bg-red-50 p-4" role="alertdialog" aria-label="Revoke supplier">
          <h3 className="font-semibold text-red-900">Revoke {vendorName}?</h3>
          <p className="mt-1 text-sm text-red-800">
            This immediately blocks the vendor everywhere: portal sign-in, RFQ views, preview assets, production
            releases and downloads — in every open tab. The revocation is written to the audit trail. This cannot
            be undone from here; a new invite is required to restore access.
          </p>
          <label className="mt-3 flex flex-col gap-1 text-sm">
            Reason (recorded in the audit trail)
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="rounded-md border px-3 py-2"
              placeholder="e.g. NDA breach — leaked preview"
            />
          </label>
          {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void revoke()}
              className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? 'Revoking…' : 'Revoke now'}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-md border px-4 py-2 text-sm font-medium">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
