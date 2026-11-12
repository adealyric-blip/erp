// PdfStatus — T15. Status of the two PDFs a tech pack approval queues
// (S600 `ds_transition_tech_pack`, approved/released):
//   techpack_pdf         — internal master, rendered by the T14 render station
//   techpack_preview_pdf — watermarked supplier copy, flattened, low-res
// Reads `craft_jobs` rows for the tech pack (subject_id = tech pack id).
// `derivePdfStatus` is pure and unit-tested; the component only renders it.
// No download route is invented here: when a job succeeded, the finished
// asset id is shown; the asset viewer/download belongs to T14 / Lane 1.

export type PdfKind = 'techpack_pdf' | 'techpack_preview_pdf';

export type PdfJobState = 'not_queued' | 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface PdfJobInput {
  id: string;
  kind: string;
  status: string;
  error?: string | null;
  finished_at?: string | null;
  output?: Record<string, unknown> | null;
}

export interface DerivedPdfStatus {
  kind: PdfKind;
  state: PdfJobState;
  job: PdfJobInput | null;
  assetId: string | null;
}

const PDF_LABELS: Record<PdfKind, { title: string; description: string }> = {
  techpack_pdf: {
    title: 'Internal master PDF',
    description: 'Full-resolution 11-page tech pack, unit costs shown, no watermark.',
  },
  techpack_preview_pdf: {
    title: 'Supplier preview PDF',
    description: 'Watermarked, flattened, low-res images, unit costs removed.',
  },
};

export const PDF_STATE_LABELS: Record<PdfJobState, string> = {
  not_queued: 'Not queued',
  queued: 'Queued',
  running: 'Rendering',
  succeeded: 'Ready',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

function normalizeState(status: string): PdfJobState {
  switch (status) {
    case 'queued':
    case 'running':
    case 'succeeded':
    case 'failed':
    case 'cancelled':
      return status;
    default:
      return 'not_queued';
  }
}

/** Latest job of this kind wins (jobs arrive newest-first from the page). */
export function derivePdfStatus(jobs: PdfJobInput[], kind: PdfKind): DerivedPdfStatus {
  const job = jobs.find((j) => j.kind === kind) ?? null;
  const assetId =
    job && job.output && typeof job.output.asset_id === 'string' ? job.output.asset_id : null;
  return { kind, state: job ? normalizeState(job.status) : 'not_queued', job, assetId };
}

function stateClasses(state: PdfJobState): string {
  switch (state) {
    case 'succeeded':
      return 'border-green-300 bg-green-50 text-green-800';
    case 'failed':
      return 'border-red-300 bg-red-50 text-red-800';
    case 'running':
      return 'border-blue-300 bg-blue-50 text-blue-800';
    case 'queued':
      return 'border-amber-300 bg-amber-50 text-amber-800';
    case 'cancelled':
      return 'border-neutral-300 bg-neutral-100 text-neutral-500';
    default:
      return 'border-neutral-300 bg-neutral-50 text-neutral-500';
  }
}

export default function PdfStatus({
  jobs,
  approved,
}: {
  /** craft_jobs rows for this tech pack, newest first. */
  jobs: PdfJobInput[];
  /** True once the pack has been approved (PDFs are only queued on approve/release). */
  approved: boolean;
}) {
  const kinds: PdfKind[] = ['techpack_pdf', 'techpack_preview_pdf'];
  return (
    <section data-testid="pdf-status" aria-label="Tech pack PDFs">
      <h3 className="text-base font-semibold">PDFs</h3>
      <ul className="mt-2 space-y-2">
        {kinds.map((kind) => {
          const derived = derivePdfStatus(jobs, kind);
          const label = PDF_LABELS[kind];
          return (
            <li
              key={kind}
              data-testid={`pdf-status-${kind}`}
              className="flex items-start justify-between gap-3 rounded-md border border-neutral-200 px-3 py-2"
            >
              <div>
                <span className="text-sm font-semibold">{label.title}</span>
                <p className="text-sm text-neutral-500">{label.description}</p>
                {derived.state === 'not_queued' && !approved && (
                  <p className="mt-1 text-sm text-neutral-500">
                    Queued automatically when the pack is approved.
                  </p>
                )}
                {derived.state === 'not_queued' && approved && (
                  <p className="mt-1 text-sm text-neutral-500">
                    Approved, but no render job was queued — check the render station.
                  </p>
                )}
                {derived.state === 'failed' && derived.job?.error && (
                  <p data-testid={`pdf-error-${kind}`} className="mt-1 text-sm text-red-700">
                    {derived.job.error}
                  </p>
                )}
                {derived.state === 'succeeded' && derived.job?.finished_at && (
                  <p className="mt-1 text-sm text-neutral-500">
                    Finished {new Date(derived.job.finished_at).toLocaleString()}
                    {derived.assetId ? ` · asset ${derived.assetId}` : ''}
                  </p>
                )}
              </div>
              <span
                data-testid={`pdf-state-${kind}`}
                className={`shrink-0 rounded border px-2 py-0.5 text-xs font-semibold ${stateClasses(derived.state)}`}
              >
                {PDF_STATE_LABELS[derived.state]}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
