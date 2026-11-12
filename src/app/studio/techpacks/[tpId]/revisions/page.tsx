// Tech pack revisions page — T15.
// Server component: loads the tech pack, its append-only revision log
// (tech_pack_revisions), the design-version lock, and the two T14 PDF jobs
// (craft_jobs: techpack_pdf / techpack_preview_pdf), then hands them to
// RevisionsClient. Reads go through the staff user's own client (RLS
// applies). Transitions go through the typed RPC wrappers in src/lib/db:
// ds_transition_tech_pack (approve/release/archive/…) and ds_create_tech_pack
// ("New revision").
//
// SEAM (Lane 1, src/server/actions/techpacks.ts): once Lane 1 lands the
// `runCommand` wrapper with techpack.approve / techpack.release /
// techpack.submit_review / techpack.create, the two inline actions below
// should call runCommand instead of the RPC wrappers directly. Signatures
// Lane 1 needs to expose:
//   runCommand('techpack.approve',        { techPackId, note? })
//   runCommand('techpack.submit_review',   { techPackId, note? })
//   runCommand('techpack.release',        { techPackId, note? })
//   runCommand('techpack.archive',        { techPackId, note? })
//   runCommand('techpack.create',         { designId })  -> new tech pack id
// Until then these actions call the RPC wrappers directly — no duplicate
// action file is created here.
export const dynamic = 'force-dynamic'; // Auth-gated: never prerendered (requireStaff needs a request).

import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/db';
import { dsCreateTechPack, dsTransitionTechPack } from '@/lib/db';
import { requireStaff } from '@/server/auth/requireStaff';
import { mapPgError } from '@/server/errors';
import RevisionsClient, {
  type RevisionRow,
  type TechPackSummary,
} from './RevisionsClient';
import type { TechPackTransition } from '@/features/techpack/components/ApproveDialog';
import type { TechPackSnapshot } from '@/features/techpack/components/RevisionDiff';
import type { PdfJobInput } from '@/features/techpack/components/PdfStatus';
import {
  FIXTURE_PDF_JOBS,
  FIXTURE_REVISIONS,
  FIXTURE_TECH_PACK,
} from '@/features/techpack/test-fixtures/revision-snapshots';

type Row = Record<string, unknown>;
type RowResult = { data: Row | null; error: { message?: string } | null };
type RowsResult = { data: Row[] | null; error: { message?: string } | null };

/** Minimal chainable query shape for the untyped S600 tables (same pattern as server/actions/designs.ts). */
interface DbQuery {
  select: (cols: string) => DbQuery;
  eq: (col: string, v: unknown) => DbQuery;
  order: (col: string, opts?: { ascending?: boolean }) => DbQuery;
  limit: (n: number) => Promise<RowsResult>;
  single: () => Promise<RowResult>;
}

type AnyClient = { from: (table: string) => DbQuery };

const asAny = (c: SupabaseClient<Database>): AnyClient => c as unknown as AnyClient;

const TECH_PACK_COLS =
  'id, tenant_id, design_id, version_id, revision, style_number, title, season_id, size_range_id, base_size, status, approved_by, approved_at, released_at, pdf_asset_id, preview_pdf_asset_id, created_at';

const REVISION_COLS =
  'id, tech_pack_id, revision, from_status, to_status, snapshot, change_summary, created_by, created_at';

const JOB_KINDS = new Set(['techpack_pdf', 'techpack_preview_pdf']);

function toTechPackSummary(row: Row): TechPackSummary {
  return {
    id: String(row.id),
    design_id: String(row.design_id),
    version_id: String(row.version_id),
    revision: Number(row.revision),
    style_number: (row.style_number as string | null) ?? null,
    title: String(row.title),
    status: row.status as TechPackSummary['status'],
    approved_by: (row.approved_by as string | null) ?? null,
    approved_at: (row.approved_at as string | null) ?? null,
    released_at: (row.released_at as string | null) ?? null,
  };
}

function toRevisionRow(row: Row): RevisionRow {
  return {
    id: String(row.id),
    revision: Number(row.revision),
    from_status: (row.from_status as string | null) ?? null,
    to_status: String(row.to_status),
    snapshot: row.snapshot as unknown as TechPackSnapshot,
    change_summary: (row.change_summary as string | null) ?? null,
    created_by: (row.created_by as string | null) ?? null,
    created_at: String(row.created_at),
  };
}

function toPdfJob(row: Row): PdfJobInput {
  return {
    id: String(row.id),
    kind: String(row.kind),
    status: String(row.status),
    error: (row.error as string | null) ?? null,
    finished_at: (row.finished_at as string | null) ?? null,
    output: (row.output as Record<string, unknown> | null) ?? null,
  };
}

/** Transition a tech pack via ds_transition_tech_pack (status changes only inside RPCs).
 * Colocated (not exported): page files reject unknown named exports, so the
 * actions live as module-level functions and are passed to RevisionsClient
 * as props. */
async function transitionTechPackAction(input: {
  techPackId: string;
  to: TechPackTransition;
  note?: string;
}): Promise<{ ok: boolean; error?: string }> {
  'use server';
  const { supabase } = await requireStaff();
  const { data, error } = await dsTransitionTechPack(supabase, {
    p_tp: input.techPackId,
    p_to: input.to,
    p_note: input.note ?? null,
  });
  if (error || !data) {
    const mapped = mapPgError(error ?? { message: 'Transition failed' });
    return { ok: false, error: !mapped.ok ? mapped.error.message : 'Transition failed' };
  }
  revalidatePath(`/studio/techpacks/${input.techPackId}/revisions`);
  return { ok: true };
}

/** "New revision" = ds_create_tech_pack (clones children as a fresh draft). */
async function createNewRevisionAction(
  designId: string,
): Promise<{ ok: boolean; newTechPackId?: string; error?: string }> {
  'use server';
  const { supabase } = await requireStaff();
  const { data, error } = await dsCreateTechPack(supabase, { p_design: designId });
  if (error || !data) {
    const mapped = mapPgError(error ?? { message: 'Could not create a new revision' });
    return { ok: false, error: !mapped.ok ? mapped.error.message : 'Could not create a new revision' };
  }
  revalidatePath('/studio/techpacks');
  return { ok: true, newTechPackId: data };
}

function demoData(): {
  techPack: TechPackSummary;
  designVersionNo: number;
  designVersionLocked: boolean;
  revisions: RevisionRow[];
  pdfJobs: PdfJobInput[];
} {
  return {
    techPack: toTechPackSummary({ ...FIXTURE_TECH_PACK, tenant_id: 'demo-tenant' }),
    designVersionNo: 1,
    designVersionLocked: true,
    revisions: FIXTURE_REVISIONS.map((r) => ({
      id: r.id,
      revision: r.revision,
      from_status: r.from_status,
      to_status: r.to_status,
      snapshot: r.snapshot as unknown as TechPackSnapshot,
      change_summary: r.change_summary,
      created_by: r.created_by,
      created_at: r.created_at,
    })),
    pdfJobs: FIXTURE_PDF_JOBS.map((j) => ({
      id: j.id,
      kind: j.kind,
      status: j.status,
      error: j.error,
      finished_at: j.finished_at,
      output: j.output,
    })),
  };
}

export default async function TechPackRevisionsPage(props: {
  params: Promise<{ tpId: string }>;
}) {
  const { tpId } = await props.params;
  const { supabase, role, tenantId } = await requireStaff();

  // Local demo pack (no DB row): staff-only, fixture data, same shape as live.
  if (tpId.startsWith('demo-')) {
    const demo = demoData();
    return (
      <RevisionsClient
        techPack={demo.techPack}
        designVersionNo={demo.designVersionNo}
        designVersionLocked={demo.designVersionLocked}
        revisions={demo.revisions}
        pdfJobs={demo.pdfJobs}
        role={role}
        onTransition={transitionTechPackAction}
        onCreateRevision={createNewRevisionAction}
      />
    );
  }

  const client = asAny(supabase);

  const { data: tp, error: tpError } = await client
    .from('tech_packs')
    .select(TECH_PACK_COLS)
    .eq('id', tpId)
    .single();
  if (tpError || !tp || tp.tenant_id !== tenantId) notFound();

  const { data: revRows } = await client
    .from('tech_pack_revisions')
    .select(REVISION_COLS)
    .eq('tech_pack_id', tpId)
    .order('created_at', { ascending: true })
    .limit(100);

  const { data: versionRow } = await client
    .from('design_versions')
    .select('version_no, is_locked')
    .eq('id', tp.version_id)
    .single();

  const { data: jobRows } = await client
    .from('craft_jobs')
    .select('id, kind, status, error, finished_at, output')
    .eq('subject_id', tpId)
    .order('created_at', { ascending: false })
    .limit(10);

  return (
    <RevisionsClient
      techPack={toTechPackSummary(tp)}
      designVersionNo={versionRow ? Number(versionRow.version_no) : null}
      designVersionLocked={versionRow ? Boolean(versionRow.is_locked) : false}
      revisions={(revRows ?? []).map(toRevisionRow)}
      pdfJobs={(jobRows ?? []).filter((j) => JOB_KINDS.has(String(j.kind))).map(toPdfJob)}
      role={role}
      onTransition={transitionTechPackAction}
      onCreateRevision={createNewRevisionAction}
    />
  );
}
