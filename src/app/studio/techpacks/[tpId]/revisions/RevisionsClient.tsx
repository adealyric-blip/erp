// RevisionsClient — T15. Client shell for the revisions page: version-lock
// banner, ApproveDialog trigger, "New revision" (ds_create_tech_pack),
// PdfStatus, and the append-only revision log with a diff against the
// previous snapshot for every revision after the first.
// No rail/sidebar: everything renders inside the existing studio shell.

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ApproveDialog, {
  type TechPackStatus,
  type TechPackTransition,
} from '@/features/techpack/components/ApproveDialog';
import RevisionDiff, { type TechPackSnapshot } from '@/features/techpack/components/RevisionDiff';
import PdfStatus, { type PdfJobInput } from '@/features/techpack/components/PdfStatus';

export interface RevisionRow {
  id: string;
  revision: number;
  from_status: string | null;
  to_status: string;
  snapshot: TechPackSnapshot;
  change_summary: string | null;
  created_by: string | null;
  created_at: string;
}

export interface TechPackSummary {
  id: string;
  design_id: string;
  version_id: string;
  revision: number;
  style_number: string | null;
  title: string;
  status: TechPackStatus;
  approved_by: string | null;
  approved_at: string | null;
  released_at: string | null;
}

export interface RevisionsClientProps {
  techPack: TechPackSummary;
  designVersionNo: number | null;
  designVersionLocked: boolean;
  revisions: RevisionRow[];
  pdfJobs: PdfJobInput[];
  role: string;
  onTransition: (input: {
    techPackId: string;
    to: TechPackTransition;
    note?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  onCreateRevision: (designId: string) => Promise<{
    ok: boolean;
    newTechPackId?: string;
    error?: string;
  }>;
}

const STATUS_TONE: Record<TechPackStatus, string> = {
  draft: 'border-neutral-300 bg-neutral-100 text-neutral-700',
  in_review: 'border-amber-300 bg-amber-50 text-amber-800',
  approved: 'border-green-300 bg-green-50 text-green-800',
  released: 'border-blue-300 bg-blue-50 text-blue-800',
  superseded: 'border-neutral-300 bg-neutral-100 text-neutral-500',
  archived: 'border-neutral-300 bg-neutral-100 text-neutral-500',
};

/** ds_create_tech_pack refuses when the latest revision is still open. */
export function newRevisionAvailability(status: TechPackStatus): {
  enabled: boolean;
  reason?: string;
} {
  if (status === 'draft' || status === 'in_review') {
    return {
      enabled: false,
      reason: `Revision is still ${status} — finish or archive it first.`,
    };
  }
  return { enabled: true };
}

export default function RevisionsClient({
  techPack,
  designVersionNo,
  designVersionLocked,
  revisions,
  pdfJobs,
  role,
  onTransition,
  onCreateRevision,
}: RevisionsClientProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const locked = techPack.status === 'approved' || techPack.status === 'released';
  const newRev = newRevisionAvailability(techPack.status);
  const sorted = [...revisions].sort((a, b) => b.revision - a.revision);

  async function createRevision() {
    setCreating(true);
    setCreateError(null);
    const res = await onCreateRevision(techPack.design_id);
    setCreating(false);
    if (!res.ok || !res.newTechPackId) {
      setCreateError(res.error ?? 'Could not create a new revision');
      return;
    }
    router.push(`/studio/techpacks/${res.newTechPackId}/revisions`);
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12" data-testid="revisions-page">
      <p className="text-sm text-neutral-500">
        <a href="/studio" className="underline">
          Studio
        </a>{' '}
        / Tech packs / Revisions
      </p>
      <h1 className="mt-2 text-2xl font-bold">
        {techPack.title} — Revision {techPack.revision}
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        {techPack.style_number ? `Style ${techPack.style_number} · ` : ''}
        Tech pack {techPack.id}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          data-testid="techpack-status"
          className={`rounded border px-2 py-0.5 text-xs font-semibold ${STATUS_TONE[techPack.status]}`}
        >
          {techPack.status}
        </span>
        {locked && (
          <span
            data-testid="version-lock"
            className="rounded border border-green-300 bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-800"
          >
            Version locked — approved packs cannot be edited
          </span>
        )}
        {designVersionLocked && (
          <span
            data-testid="design-version-lock"
            className="rounded border border-neutral-300 bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-700"
          >
            Design version{designVersionNo !== null ? ` ${designVersionNo}` : ''} locked
          </span>
        )}
      </div>

      {locked && (
        <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          This revision is {techPack.status} and locked: its BOM, measurements, construction and
          artwork cannot change. Further changes need a new revision, which clones this pack&apos;s
          children as a fresh draft.
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          data-testid="open-approve-dialog"
          onClick={() => setDialogOpen(true)}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
        >
          Review / Approve…
        </button>
        <button
          type="button"
          data-testid="new-revision"
          disabled={!newRev.enabled || creating}
          onClick={() => void createRevision()}
          title={newRev.reason}
          className={`rounded-md px-4 py-2 text-sm font-medium ${
            newRev.enabled
              ? 'border border-neutral-300 bg-white hover:bg-neutral-50'
              : 'cursor-not-allowed border border-neutral-200 bg-neutral-100 text-neutral-400'
          }`}
        >
          {creating ? 'Creating…' : 'New revision'}
        </button>
      </div>
      {!newRev.enabled && newRev.reason && (
        <p data-testid="new-revision-reason" className="mt-2 text-sm text-neutral-500">
          {newRev.reason}
        </p>
      )}
      {createError && (
        <p data-testid="new-revision-error" className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {createError}
        </p>
      )}

      <ApproveDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        techPack={{
          id: techPack.id,
          revision: techPack.revision,
          title: techPack.title,
          style_number: techPack.style_number,
          status: techPack.status,
        }}
        role={role}
        onTransition={(input) =>
          onTransition({ techPackId: techPack.id, to: input.to, note: input.note })
        }
        onDone={() => router.refresh()}
      />

      <div className="mt-8">
        <PdfStatus jobs={pdfJobs} approved={locked || techPack.status === 'approved'} />
      </div>

      <section className="mt-8" aria-label="Revision history">
        <h3 className="text-base font-semibold">Revision history</h3>
        {sorted.length === 0 && (
          <p className="mt-2 text-sm text-neutral-500">
            No revisions yet — the first transition (e.g. submit for review) writes the first
            snapshot here.
          </p>
        )}
        <ol className="mt-2 space-y-4">
          {sorted.map((rev, i) => {
            // Diff against the next-older revision (sorted is newest-first).
            const prev = sorted[i + 1] ?? null;
            return (
              <li
                key={rev.id}
                data-testid={`revision-${rev.revision}`}
                className="rounded-md border border-neutral-200 px-4 py-3"
              >
                <p className="text-sm font-semibold">
                  Revision {rev.revision} · {rev.from_status ?? '—'} → {rev.to_status}
                </p>
                <p className="text-sm text-neutral-500">
                  {new Date(rev.created_at).toLocaleString()}
                  {rev.change_summary ? ` · ${rev.change_summary}` : ''}
                </p>
                <details open={i === 0} className="mt-2">
                  <summary className="cursor-pointer text-sm font-medium text-blue-700">
                    {prev ? `Changes vs revision ${prev.revision}` : 'Initial snapshot'}
                  </summary>
                  <RevisionDiff
                    a={prev ? prev.snapshot : null}
                    b={rev.snapshot}
                    aLabel={prev ? `Revision ${prev.revision}` : ''}
                    bLabel={`Revision ${rev.revision}`}
                  />
                </details>
              </li>
            );
          })}
        </ol>
      </section>
    </main>
  );
}
