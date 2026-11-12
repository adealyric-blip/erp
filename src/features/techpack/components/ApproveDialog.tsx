// ApproveDialog — T15. The approval UX for a tech pack.
// The state machine comes from S600 `ds_transition_tech_pack`:
//   draft -> in_review -> approved -> released -> superseded
//   in_review -> draft (changes requested); draft/in_review/approved -> archived
// Approve / release / archive need an owner or admin role
// (`platform_is_tenant_admin`: owner, admin, administrator). The RPC is the
// final authority — this dialog only explains, up front, why an action is
// disabled, so staff never hit a bare 42501.
// `getTransitionOptions` is pure and unit-tested; the component only renders it.
// Uses the drawer-free overlay pattern of the studio pages (no rail/sidebar);
// the dialog is opened from the revisions page inside the existing shell.

import { useState } from 'react';

export type TechPackStatus =
  | 'draft'
  | 'in_review'
  | 'approved'
  | 'released'
  | 'superseded'
  | 'archived';

export type TechPackTransition = 'in_review' | 'draft' | 'approved' | 'released' | 'archived';

export interface TransitionOption {
  to: TechPackTransition;
  label: string;
  description: string;
  enabled: boolean;
  reason?: string;
}

/** Roles the DB accepts for approve / release / archive (ds__assert_admin). */
export function isApproverRole(role: string): boolean {
  return ['owner', 'admin', 'administrator'].includes(role.trim().toLowerCase());
}

/**
 * Every transition with its enabled state and, when disabled, the exact
 * reason shown in the UI. Status is checked before role so a staff member
 * on a draft sees the status reason, not a role lecture.
 */
export function getTransitionOptions(status: TechPackStatus, role: string): TransitionOption[] {
  const approver = isApproverRole(role);
  const roleReason = `Only an owner or admin can approve — your role is ${role}.`;
  return [
    {
      to: 'in_review',
      label: 'Submit for review',
      description: 'Send this draft to an owner or admin for approval.',
      enabled: status === 'draft',
      reason:
        status === 'draft'
          ? undefined
          : `Tech pack is ${status} — only a draft can be submitted for review.`,
    },
    {
      to: 'draft',
      label: 'Request changes',
      description: 'Send an in-review pack back to draft for edits.',
      enabled: status === 'in_review',
      reason:
        status === 'in_review'
          ? undefined
          : `Tech pack is ${status} — changes can only be requested while it is in review.`,
    },
    {
      to: 'approved',
      label: 'Approve',
      description:
        'Approve the pack. Locks the design version and queues the master + supplier-preview PDFs.',
      enabled: status === 'in_review' && approver,
      reason:
        status !== 'in_review'
          ? `Tech pack is ${status} — only an in-review pack can be approved.`
          : approver
            ? undefined
            : roleReason,
    },
    {
      to: 'released',
      label: 'Release',
      description: 'Release the approved pack for production. Supersedes any released revision.',
      enabled: status === 'approved' && approver,
      reason:
        status !== 'approved'
          ? `Tech pack is ${status} — only an approved pack can be released.`
          : approver
            ? undefined
            : roleReason,
    },
    {
      to: 'archived',
      label: 'Archive',
      description: 'Archive the pack. Archived packs cannot be edited or approved.',
      enabled: ['draft', 'in_review', 'approved'].includes(status) && approver,
      reason:
        !['draft', 'in_review', 'approved'].includes(status)
          ? `A ${status} tech pack cannot be archived.`
          : approver
            ? undefined
            : roleReason,
    },
  ];
}

export interface ApproveDialogProps {
  open: boolean;
  onClose: () => void;
  techPack: {
    id: string;
    revision: number;
    title: string;
    style_number: string | null;
    status: TechPackStatus;
  };
  /** The current user's tenant role, from requireStaff. */
  role: string;
  /** Server action (wired by the revisions page) that calls ds_transition_tech_pack. */
  onTransition: (input: { to: TechPackTransition; note?: string }) => Promise<{
    ok: boolean;
    error?: string;
  }>;
  /** Called after a successful transition so the page can refresh. */
  onDone?: (to: TechPackTransition) => void;
}

export default function ApproveDialog({
  open,
  onClose,
  techPack,
  role,
  onTransition,
  onDone,
}: ApproveDialogProps) {
  const [armed, setArmed] = useState<TechPackTransition | null>(null);
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const options = getTransitionOptions(techPack.status, role);
  const armedOption = options.find((o) => o.to === armed);

  async function confirm() {
    if (!armed) return;
    setPending(true);
    setError(null);
    const res = await onTransition({ to: armed, note: note.trim() || undefined });
    setPending(false);
    if (!res.ok) {
      setError(res.error ?? 'Transition failed');
      return;
    }
    const done = armed;
    setArmed(null);
    setNote('');
    onDone?.(done);
    onClose();
  }

  return (
    <div
      data-testid="approve-dialog"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Approve tech pack revision ${techPack.revision}`}
    >
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold">
          Revision {techPack.revision} — {techPack.title}
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          {techPack.style_number ? `Style ${techPack.style_number} · ` : ''}Status:{' '}
          <strong>{techPack.status}</strong> · Signed in as {role}
        </p>

        <ul className="mt-4 space-y-3">
          {options.map((opt) => (
            <li
              key={opt.to}
              data-testid={`transition-${opt.to}`}
              className="rounded-md border border-neutral-200 px-3 py-2"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="text-sm font-semibold">{opt.label}</span>
                  <p className="text-sm text-neutral-500">{opt.description}</p>
                </div>
                <button
                  type="button"
                  disabled={!opt.enabled || pending}
                  onClick={() => {
                    setError(null);
                    setArmed(opt.to);
                  }}
                  className={`shrink-0 rounded-md px-3 py-2 text-sm font-medium ${
                    opt.enabled
                      ? 'bg-neutral-900 text-white hover:bg-neutral-700'
                      : 'cursor-not-allowed bg-neutral-100 text-neutral-400'
                  }`}
                >
                  {opt.label}
                </button>
              </div>
              {!opt.enabled && opt.reason && (
                <p data-testid={`transition-reason-${opt.to}`} className="mt-1 text-sm text-neutral-500">
                  {opt.reason}
                </p>
              )}
              {opt.to === 'approved' && opt.enabled && (
                <p className="mt-1 text-sm text-neutral-500">
                  Approving locks the design version — the pack and its children can no longer be
                  edited. Create a new revision for further changes.
                </p>
              )}
            </li>
          ))}
        </ul>

        {armedOption && (
          <div data-testid="transition-confirm" className="mt-4 rounded-md border border-neutral-300 p-3">
            <label htmlFor="transition-note" className="text-sm font-semibold">
              Note for {armedOption.label.toLowerCase()} (optional, saved on the revision log)
            </label>
            <textarea
              id="transition-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={2000}
              className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1 text-sm"
              placeholder="Why is this pack being moved?"
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => void confirm()}
                className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {pending ? 'Working…' : `Confirm ${armedOption.label}`}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setArmed(null);
                  setNote('');
                }}
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {error && (
          <p data-testid="transition-error" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-4 text-sm text-neutral-500 underline"
        >
          Close
        </button>
      </div>
    </div>
  );
}
