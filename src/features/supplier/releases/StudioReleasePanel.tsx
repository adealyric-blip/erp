'use client';

import { useState } from 'react';
import RevokeDialog from '../RevokeDialog';
import ReleaseAuditTrail from './ReleaseAuditTrail';
import type { AccessEventRow } from '../types';
import type { ReleaseStatus } from '@/server/actions/revoke';

// Studio release panel — T20 (staff side, client island).
// Composes the release gate, the submit-release buttons, per-vendor
// revocation and the audit trail. All mutations go through the
// server actions passed in as props; this component decides nothing
// about access — the RPCs do.

export interface StudioReleasePanelProps {
  status: ReleaseStatus;
  audit: { events: AccessEventRow[]; vendors: Array<{ id: string; name: string }>; rfqs: Array<{ id: string; number: string }> };
  onSubmitRelease: (techPackId: string) => Promise<{ ok: boolean; error?: { message: string } }>;
  onRevoke: (vendorId: string, reason: string | null) => Promise<{ ok: boolean; error?: { message: string } }>;
  onChanged: () => void;
}

export default function StudioReleasePanel({ status, audit, onSubmitRelease, onRevoke, onChanged }: StudioReleasePanelProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [released, setReleased] = useState<string[]>([]);

  const grantedVendors = new Map<string, string>();
  for (const l of status.lines) {
    if (l.production_granted && l.production_granted_vendor_id) {
      grantedVendors.set(l.production_granted_vendor_id, audit.vendors.find((v) => v.id === l.production_granted_vendor_id)?.name ?? l.production_granted_vendor_id);
    }
  }

  async function submit(techPackId: string) {
    setBusy(techPackId);
    setError(null);
    const res = await onSubmitRelease(techPackId);
    setBusy(null);
    if (!res.ok) {
      setError(res.error?.message ?? 'Release failed.');
      return;
    }
    setReleased((r) => [...r, techPackId]);
    onChanged();
  }

  return (
    <div className="space-y-6">
      <section data-testid="release-gate" className="rounded-lg border p-5">
        <h2 className="text-lg font-semibold">Release gate</h2>
        <p className="mt-1 text-sm text-neutral-600">
          A release requires at least one APPROVED tech pack with an attached production PDF. The production
          grant itself is created by the award (ds_award_rfq); this page releases the pack.
        </p>
        {status.lines.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">This RFQ has no lines yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {status.lines.map((l) => (
              <li key={l.rfq_line_id} className="rounded-md border bg-white px-4 py-3 text-sm">
                <p className="font-medium">
                  Line {l.line_no} — {l.tech_pack_title} ({l.style_number ?? 'no style no.'}) rev {l.revision}
                </p>
                <p className="mt-1 text-neutral-600">
                  Pack status: {l.status}
                  {l.pdf_asset_id ? ' · production PDF attached' : ' · NO production PDF attached'}
                  {' · '}
                  {l.releasable ? 'releasable' : 'NOT releasable'}
                  {l.production_granted ? ` · production grant live` : ' · no production grant'}
                </p>
                {l.releasable && !released.includes(l.tech_pack_id) && (
                  <button
                    type="button"
                    disabled={busy === l.tech_pack_id}
                    onClick={() => void submit(l.tech_pack_id)}
                    className="mt-2 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {busy === l.tech_pack_id ? 'Releasing…' : 'Submit release'}
                  </button>
                )}
                {released.includes(l.tech_pack_id) && (
                  <p className="mt-2 text-sm font-medium text-green-700">Released.</p>
                )}
              </li>
            ))}
          </ul>
        )}
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      </section>

      {grantedVendors.size > 0 && (
        <section className="rounded-lg border p-5">
          <h2 className="text-lg font-semibold">Revoke a vendor</h2>
          <p className="mt-1 text-sm text-neutral-600">
            One click blocks the vendor everywhere — portal, previews, releases, downloads — in every open tab.
          </p>
          <div className="mt-3 space-y-3">
            {[...grantedVendors.entries()].map(([vendorId, name]) => (
              <div key={vendorId} className="flex flex-wrap items-center gap-3 rounded-md border bg-white px-4 py-3">
                <span className="text-sm font-medium">{name}</span>
                <RevokeDialog vendorId={vendorId} vendorName={name} onRevoke={onRevoke} onRevoked={onChanged} />
              </div>
            ))}
          </div>
        </section>
      )}

      <ReleaseAuditTrail events={audit.events} vendors={audit.vendors} rfqs={audit.rfqs} />
    </div>
  );
}
