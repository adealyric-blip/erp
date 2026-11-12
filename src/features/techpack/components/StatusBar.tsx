// Tech pack editor — StatusBar (T13): status, revision, and the review
// transitions. In-review → "Request changes" returns the pack to draft
// (ds_transition_tech_pack in_review → draft).
'use client';

export default function StatusBar(props: {
  status: string;
  revision: number;
  locked: boolean;
  onTransition: (to: 'in_review' | 'draft' | 'approved' | 'released' | 'archived', note?: string) => void;
}) {
  const { status, revision, locked, onTransition } = props;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm" data-testid="techpack-statusbar">
      <span className="font-semibold">Status: {status.replace('_', ' ')}</span>
      <span className="text-neutral-500">REV {revision}</span>
      {locked && <span className="rounded bg-neutral-900 px-2 py-0.5 text-xs text-white">Locked — create a new revision to edit</span>}
      <span className="ml-auto flex gap-2">
        {status === 'draft' && (
          <button type="button" className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white" onClick={() => onTransition('in_review', 'submitted for review')}>
            Submit for review
          </button>
        )}
        {status === 'in_review' && (
          <>
            <button type="button" className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm" onClick={() => onTransition('draft', 'changes requested')}>
              Request changes
            </button>
            <button type="button" className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white" onClick={() => onTransition('approved', 'approved')}>
              Approve
            </button>
          </>
        )}
        {status === 'approved' && (
          <button type="button" className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white" onClick={() => onTransition('released', 'released to production')}>
            Release
          </button>
        )}
        {status !== 'archived' && (
          <button type="button" className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm" onClick={() => onTransition('archived', 'archived')}>
            Archive
          </button>
        )}
      </span>
    </div>
  );
}
