// SupplierDetailActions — T16 invite / revoke / unban (detail page).
// Invite is gated on "approved" (active, not revoked/suspended) and sends
// the invite email only then. Revoke lists the four surfaces it blocks:
// portal access, GCP (Craft apps), Calls (Meet briefings), Assets /
// Download (preview + production grants). Unban is owner-only.
'use client';

import { useState } from 'react';
import type { Result } from '@/server/result';
import type { InviteSupplierResult } from '@/server/actions/suppliers';

export interface DetailActionResult {
  ok: boolean;
  error?: { message: string; hint?: string };
  [key: string]: unknown;
}

export function SupplierDetailActions({
  vendorId,
  vendorName,
  isApproved,
  memberStatus,
  canUnban,
  demo = false,
  onInvite,
  onRevoke,
  onUnban,
}: {
  vendorId: string;
  vendorName: string;
  isApproved: boolean;
  memberStatus: string | null;
  canUnban: boolean;
  demo?: boolean;
  onInvite: (vendorId: string, email: string, role: 'owner' | 'estimator' | 'viewer', name?: string | null) => Promise<Result<InviteSupplierResult>>;
  onRevoke: (vendorId: string, reason?: string | null) => Promise<Result<{ revoked: true }>>;
  onUnban: (vendorId: string) => Promise<Result<{ unbanned: true }>>;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'owner' | 'estimator' | 'viewer'>('estimator');
  const [name, setName] = useState('');
  const [reason, setReason] = useState('');
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<Result<unknown>>, okMsg: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fn();
      setMessage(res.ok ? okMsg : res.error?.message ?? 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="supplier-detail-actions" className="space-y-4">
      <section className="rounded-md border border-neutral-300 bg-white p-4">
        <h2 className="text-lg font-semibold">Invite to the supplier portal</h2>
        {!isApproved && (
          <p role="alert" data-testid="invite-blocked" className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Invite is blocked: the invite email is only sent for an approved supplier
            (active vendor, portal member not revoked/suspended). Current portal status: {memberStatus ?? 'never invited'}.
          </p>
        )}
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <label className="text-sm" htmlFor="invite-email">Invited email *</label>
            <input id="invite-email" data-testid="invite-email" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm" />
          </div>
          <div>
            <label className="text-sm" htmlFor="invite-name">Contact name</label>
            <input id="invite-name" data-testid="invite-name" value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm" />
          </div>
          <div>
            <label className="text-sm" htmlFor="invite-role">Portal role</label>
            <select id="invite-role" data-testid="invite-role" value={role}
              onChange={(e) => setRole(e.target.value as typeof role)}
              className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm">
              <option value="estimator">Estimator</option>
              <option value="viewer">Viewer</option>
              <option value="owner">Owner</option>
            </select>
          </div>
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          Invite → ds_invite_supplier_user → email with /supplier/invite/&#123;token&#123;. The token is
          shown once and never stored or logged by us. The acceptance page is T18.
        </p>
        <button type="button" data-testid="invite-send" disabled={!isApproved || busy || !email.trim()}
          onClick={() =>
            run(
              demo
                ? async () => ({ ok: true as const, data: {} })
                : () => onInvite(vendorId, email, role, name || null),
              `Demo: invite ${demo ? '(not sent)' : 'sent'} to ${email}.`,
            )
          }
          className="mt-3 rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          Send invite email
        </button>
      </section>

      <section className="rounded-md border border-neutral-300 bg-white p-4">
        <h2 className="text-lg font-semibold">Revoke supplier</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Revoking blocks the underlying access and GCP / Calls / Assets / Download: the portal
          membership and invites are killed (portal, Craft apps, and Meet briefings all gate on
          membership) and every asset release grant — preview and production — is revoked, so
          downloads stop working.
        </p>
        {!revokeOpen ? (
          <button type="button" data-testid="revoke-open" onClick={() => setRevokeOpen(true)}
            className="mt-3 rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-900">
            Revoke {vendorName}
          </button>
        ) : (
          <div className="mt-3 space-y-2" role="dialog" aria-label="Confirm revoke" data-testid="revoke-dialog">
            <p className="text-sm font-medium">This revokes, immediately:</p>
            <ul className="list-disc pl-5 text-sm text-neutral-700">
              <li>Portal access — supplier portal membership + open invites</li>
              <li>GCP — Craft app access gated on membership</li>
              <li>Calls — Meet briefing spaces for this vendor</li>
              <li>Assets / Download — preview + production release grants</li>
            </ul>
            <input data-testid="revoke-reason" aria-label="Revocation reason" value={reason}
              onChange={(e) => setReason(e.target.value)} placeholder="Reason (shown in the audit log)"
              className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm" />
            <div className="flex gap-2">
              <button type="button" data-testid="revoke-confirm" disabled={busy}
                onClick={() =>
                  run(
                    demo ? async () => ({ ok: true as const, data: {} }) : () => onRevoke(vendorId, reason || null),
                    'Demo: supplier revoked (no change made).',
                  )
                }
                className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                Confirm revoke
              </button>
              <button type="button" data-testid="revoke-cancel" onClick={() => setRevokeOpen(false)}
                className="rounded-md border border-neutral-300 px-4 py-2 text-sm">Cancel</button>
            </div>
          </div>
        )}
        {memberStatus === 'suspended' && (
          <div className="mt-3">
            <p className="text-sm text-neutral-600">This supplier is suspended.</p>
            <button type="button" data-testid="unban-supplier" disabled={!canUnban || busy}
              onClick={() => run(demo ? async () => ({ ok: true as const, data: {} }) : () => onUnban(vendorId), 'Demo: supplier unbanned (no change made).')}
              className="mt-2 rounded-md border border-neutral-300 px-4 py-2 text-sm disabled:opacity-50">
              Unban supplier (owner only)
            </button>
            {!canUnban && <p className="mt-1 text-xs text-neutral-500">Only the tenant owner can unban a supplier.</p>}
          </div>
        )}
        {message && <p role="status" className="mt-3 text-sm text-neutral-700">{message}</p>}
      </section>
    </div>
  );
}
