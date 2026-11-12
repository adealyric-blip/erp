// T15 component-level proof harness (same pattern as Lane A's konva-proof).
// The /studio pages are behind the staff + MFA guard and this VM has no
// local Supabase stack, so no authenticated session exists to open the real
// page. This harness renders the ACTUAL components with fixture data:
//   ?view=staff            ApproveDialog, role=member, in_review  (Approve disabled + reason)
//   ?view=owner            ApproveDialog, role=owner,  in_review  (Approve enabled)
//   ?view=diff             RevisionDiff rev1 -> rev2 (BOM/measurement highlights)
//   ?view=pdf              PdfStatus: both PDFs Ready + a queued/failed pair
//   ?view=revisions        RevisionsClient, in_review (New revision disabled + reason)
//   ?view=revisions-locked RevisionsClient, approved (version-lock banner visible)
import React from 'react';
import { createRoot } from 'react-dom/client';
import ApproveDialog from '../../../../src/features/techpack/components/ApproveDialog';
import RevisionDiff from '../../../../src/features/techpack/components/RevisionDiff';
import PdfStatus from '../../../../src/features/techpack/components/PdfStatus';
import RevisionsClient from '../../../../src/app/studio/techpacks/[tpId]/revisions/RevisionsClient';
import type { TechPackSnapshot } from '../../../../src/features/techpack/components/RevisionDiff';
import {
  FIXTURE_PDF_JOBS,
  FIXTURE_REVISIONS,
  FIXTURE_SNAPSHOT_REV1,
  FIXTURE_SNAPSHOT_REV2,
  FIXTURE_TECH_PACK,
} from '../../../../src/features/techpack/test-fixtures/revision-snapshots';

const view = new URLSearchParams(window.location.search).get('view') ?? 'diff';

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: 'Inter, sans-serif', padding: 16, maxWidth: 900 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>{title}</h1>
      <p style={{ fontSize: 13, color: '#666' }}>
        T15 component-level proof — real component, fixture data (see proof/README.md)
      </p>
      {children}
    </div>
  );
}

function noServer() {
  return Promise.resolve({ ok: false as const, error: 'Proof harness — no server' });
}

const fixtureRevisions = FIXTURE_REVISIONS.map((r) => ({
  id: r.id,
  revision: r.revision,
  from_status: r.from_status,
  to_status: r.to_status,
  snapshot: r.snapshot as unknown as TechPackSnapshot,
  change_summary: r.change_summary,
  created_by: r.created_by,
  created_at: r.created_at,
}));

const fixtureJobs = FIXTURE_PDF_JOBS.map((j) => ({
  id: j.id,
  kind: j.kind,
  status: j.status,
  error: j.error,
  finished_at: j.finished_at,
  output: j.output,
}));

const mixedJobs = [
  { id: 'm1', kind: 'techpack_pdf', status: 'queued', error: null, finished_at: null, output: null },
  {
    id: 'm2',
    kind: 'techpack_preview_pdf',
    status: 'failed',
    error: 'DesignCraft timed out after 120s',
    finished_at: null,
    output: null,
  },
];

let el: React.ReactNode;
if (view === 'staff' || view === 'owner') {
  const role = view === 'staff' ? 'member' : 'owner';
  el = (
    <ApproveDialog
      open
      onClose={() => {}}
      techPack={{
        id: FIXTURE_TECH_PACK.id,
        revision: 2,
        title: FIXTURE_TECH_PACK.title,
        style_number: FIXTURE_TECH_PACK.style_number,
        status: 'in_review',
      }}
      role={role}
      onTransition={async () => ({ ok: false, error: 'Proof harness — no server' })}
    />
  );
} else if (view === 'diff') {
  el = (
    <Shell title="RevisionDiff — rev 1 → rev 2">
      <RevisionDiff
        a={FIXTURE_SNAPSHOT_REV1 as unknown as TechPackSnapshot}
        b={FIXTURE_SNAPSHOT_REV2 as unknown as TechPackSnapshot}
        aLabel="Revision 1"
        bLabel="Revision 2"
      />
    </Shell>
  );
} else if (view === 'pdf') {
  el = (
    <Shell title="PdfStatus">
      <div style={{ marginTop: 16 }}>
        <p style={{ fontSize: 13, fontWeight: 600 }}>Approved pack — both PDFs ready</p>
        <PdfStatus jobs={fixtureJobs} approved />
      </div>
      <div style={{ marginTop: 24 }}>
        <p style={{ fontSize: 13, fontWeight: 600 }}>In-flight / failed jobs</p>
        <PdfStatus jobs={mixedJobs} approved />
      </div>
    </Shell>
  );
} else if (view === 'revisions-locked') {
  el = (
    <RevisionsClient
      techPack={{
        ...FIXTURE_TECH_PACK,
        revision: 1,
        title: 'Boxy Tee — SS27',
        status: 'approved',
        approved_by: '00000000-0000-4000-8000-000000000050',
        approved_at: '2026-11-10T15:30:00.000Z',
      }}
      designVersionNo={1}
      designVersionLocked
      revisions={fixtureRevisions.slice(0, 1)}
      pdfJobs={fixtureJobs}
      role="owner"
      onTransition={noServer}
      onCreateRevision={noServer}
    />
  );
} else {
  // view=revisions (default)
  el = (
    <RevisionsClient
      techPack={{
        ...FIXTURE_TECH_PACK,
        status: 'in_review',
      }}
      designVersionNo={1}
      designVersionLocked
      revisions={fixtureRevisions}
      pdfJobs={fixtureJobs}
      role="member"
      onTransition={noServer}
      onCreateRevision={noServer}
    />
  );
}

createRoot(document.getElementById('root')!).render(el);
