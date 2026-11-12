// Tech pack data actions — T13/T13b.
// Reads go through the staff user's own client (RLS applies); writes go
// through direct child-table upserts (S600 children are member-writable;
// the S615 guards + ds__tp_child_guard are the enforcement) and through
// ds_create_tech_pack / ds_transition_tech_pack for lifecycle.
// `tech_packs` and its children have no generated table types yet, so
// reads/writes use a cast client — the table/column names are the S600/S615 ones.
'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/db';
import { requireStaff } from '@/server/auth/requireStaff';
import { fail, ok, type Result } from '@/server/result';
import { fill, validateTemplate } from '@/lib/techpack-render/fill';
import { loadTemplateSvgs } from '@/lib/techpack-render/loadTemplates';
import { boxyTeeFixture } from '@/lib/techpack-render/fixture';
import type { TechPackSnapshot } from '@/lib/techpack-render/types';
import { gradeValues } from '@/features/techpack/lib/validation';

type Row = Record<string, unknown>;
type RowResult = { data: Row | null; error: { message?: string } | null };
type RowsResult = { data: Row[] | null; error: { message?: string } | null };
type RpcResult = { data: unknown; error: { message?: string } | null };

interface DeleteBuilder extends Promise<RowsResult> {
  eq: (col: string, v: unknown) => DeleteBuilder;
}

interface DbQuery {
  select: (cols: string) => DbQuery;
  eq: (col: string, v: unknown) => DbQuery;
  is: (col: string, v: null) => DbQuery;
  order: (col: string, opts?: { ascending?: boolean }) => DbQuery;
  limit: (n: number) => Promise<RowsResult>;
  single: () => Promise<RowResult>;
  insert: (rows: Row | Row[]) => DbQuery;
  update: (patch: Row) => DbQuery;
  delete: () => DeleteBuilder;
  upsert: (rows: Row | Row[], opts?: { onConflict?: string }) => DbQuery;
}

type AnyClient = {
  from: (table: string) => DbQuery;
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<RpcResult>;
};

const asAny = (c: SupabaseClient<Database>): AnyClient => c as unknown as AnyClient;

const isTmpId = (id: unknown) => typeof id === 'string' && id.startsWith('tmp-');

function err(e: { message?: string } | null | undefined): Result<never> {
  return fail('unknown', e?.message ?? 'Database error');
}

function revalidate(tpId: string) {
  revalidatePath('/studio/techpacks');
  revalidatePath(`/studio/techpacks/${tpId}`);
}

// --- Reads -----------------------------------------------------------------

export async function listTechPacks(): Promise<Result<Row[]>> {
  const { supabase, tenantId } = await requireStaff();
  const { data, error } = await asAny(supabase).from('tech_packs').select('id, style_number, title, status, revision, base_size, updated_at').eq('tenant_id', tenantId).order('updated_at', { ascending: false }).limit(50);
  if (error || !data) return err(error);
  return ok(data);
}

export async function getTechPackSnapshot(tpId: string): Promise<Result<TechPackSnapshot>> {
  const { supabase } = await requireStaff();
  const { data, error } = await asAny(supabase).rpc('ds_tech_pack_snapshot', { p_tp: tpId });
  if (error || !data) return err(error);
  return ok(data as TechPackSnapshot);
}

export async function getTechPackPreview(
  tpId: string,
  mode: 'internal' | 'supplier' = 'internal',
): Promise<Result<{ pages: { pageId: string; pageNo: number; totalPages: number; svg: string }[]; validation: ReturnType<typeof validateTemplate> }>> {
  const snap = await getTechPackSnapshot(tpId);
  if (!snap.ok) return snap as unknown as Result<never>;
  const svgs = await loadTemplateSvgs();
  const { pages } = fill(svgs, snap.data, mode);
  return ok({ pages, validation: validateTemplate(svgs, snap.data, mode) });
}

export async function getDemoTechPackPreview(): Promise<{
  pages: { pageId: string; pageNo: number; totalPages: number; svg: string }[];
  validation: ReturnType<typeof validateTemplate>;
}> {
  const svgs = await loadTemplateSvgs();
  const snapshot = boxyTeeFixture();
  const { pages } = fill(svgs, snapshot, 'internal');
  return { pages, validation: validateTemplate(svgs, snapshot, 'internal') };
}

export async function listTechPackLookups(): Promise<Result<{
  materials: Row[]; poms: Row[]; seasons: Row[]; sizeRanges: Row[]; colorways: Row[]; assets: Row[];
}>> {
  const { supabase, tenantId } = await requireStaff();
  const client = asAny(supabase);
  const [materials, poms, seasons, sizeRanges, assets] = await Promise.all([
    client.from('ds_materials').select('id, code, name, kind, composition, weight_gsm').eq('tenant_id', tenantId).order('code').limit(100),
    client.from('ds_pom_library').select('id, code, name, how_to_measure').eq('tenant_id', tenantId).order('sort').limit(100),
    client.from('ds_seasons').select('id, code, name').eq('tenant_id', tenantId).order('code').limit(50),
    client.from('ds_size_ranges').select('id, name, sizes, base_size').eq('tenant_id', tenantId).order('name').limit(50),
    client.from('design_assets').select('id, name').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(50),
  ]);
  const firstErr = [materials, poms, seasons, sizeRanges, assets].find((r) => r.error)?.error;
  if (firstErr) return err(firstErr);
  return ok({
    materials: materials.data ?? [],
    poms: poms.data ?? [],
    seasons: seasons.data ?? [],
    sizeRanges: sizeRanges.data ?? [],
    colorways: [],
    assets: assets.data ?? [],
  });
}

// --- Lifecycle ---------------------------------------------------------------

export async function createTechPack(
  designId: string,
  title?: string,
  sizeRangeId?: string,
  baseSize?: string,
): Promise<Result<string>> {
  const { supabase } = await requireStaff();
  const { data, error } = await asAny(supabase).rpc('ds_create_tech_pack', {
    p_design: designId,
    p_title: title ?? null,
    p_version: null,
    p_size_range: sizeRangeId ?? null,
    p_base_size: baseSize ?? null,
  });
  if (error || !data) return err(error);
  revalidate(String(data));
  return ok(String(data));
}

export async function transitionTechPack(
  tpId: string,
  to: 'in_review' | 'draft' | 'approved' | 'released' | 'archived',
  note?: string,
): Promise<Result<Row>> {
  const { supabase } = await requireStaff();
  const { data, error } = await asAny(supabase).rpc('ds_transition_tech_pack', {
    p_tp: tpId,
    p_to: to,
    p_note: note ?? null,
  });
  if (error || !data) return err(error);
  revalidate(tpId);
  return ok(data as Row);
}

// --- Header ------------------------------------------------------------------

export async function updateTechPackHeader(tpId: string, patch: Row): Promise<Result<Row>> {
  const { supabase } = await requireStaff();
  const allowed = ['style_number', 'title', 'description', 'designer_id', 'season_id', 'size_range_id', 'base_size', 'measure_unit', 'template_id'];
  const clean: Row = {};
  for (const k of allowed) if (k in patch) clean[k] = patch[k];
  const { data, error } = await asAny(supabase).from('tech_packs').update(clean).eq('id', tpId).select('id, style_number, title, status').single();
  if (error || !data) return err(error);
  revalidate(tpId);
  return ok(data);
}

// --- Child upserts (member-writable S600/S615 children) ----------------------

async function upsertChild(
  tpId: string,
  table: string,
  row: Row,
  idKey: string,
): Promise<Result<Row>> {
  const { supabase, tenantId } = await requireStaff();
  const client = asAny(supabase);
  const body: Row = { ...row, tenant_id: tenantId, tech_pack_id: tpId };
  if (isTmpId(body[idKey]) || body[idKey] === undefined || body[idKey] === null) delete body[idKey];
  const { data, error } = await client.from(table).upsert(body, { onConflict: 'id' }).select('*').single();
  if (error || !data) return err(error);
  revalidate(tpId);
  return ok(data);
}

async function deleteChild(tpId: string, table: string, id: string): Promise<Result<boolean>> {
  const { supabase } = await requireStaff();
  const { error } = await asAny(supabase).from(table).delete().eq('id', id).eq('tech_pack_id', tpId);
  if (error) return err(error);
  revalidate(tpId);
  return ok(true);
}

export async function upsertBomLine(tpId: string, line: Row): Promise<Result<Row>> {
  return upsertChild(tpId, 'tech_pack_bom_lines', line, 'id');
}
export async function deleteBomLine(tpId: string, id: string): Promise<Result<boolean>> {
  return deleteChild(tpId, 'tech_pack_bom_lines', id);
}

export async function upsertMeasurement(
  tpId: string,
  pomId: string,
  size: string,
  value: number,
  tolPlus: number,
  tolMinus: number,
  grade: number | null,
): Promise<Result<Row>> {
  const { supabase, tenantId } = await requireStaff();
  const { data, error } = await asAny(supabase)
    .from('tech_pack_measurements')
    .upsert(
      { tenant_id: tenantId, tech_pack_id: tpId, pom_id: pomId, size_label: size, value, tol_plus: tolPlus, tol_minus: tolMinus, grade },
      { onConflict: 'tech_pack_id,pom_id,size_label' },
    )
    .select('*')
    .single();
  if (error || !data) return err(error);
  revalidate(tpId);
  return ok(data);
}

export async function applyGradeRule(
  tpId: string,
  pomId: string,
  baseValue: number,
  increment: number,
): Promise<Result<number>> {
  const { supabase, tenantId } = await requireStaff();
  const client = asAny(supabase);
  const { data: tp, error: tpErr } = await client.from('tech_packs').select('size_range_id, base_size').eq('id', tpId).single();
  if (tpErr || !tp) return err(tpErr);
  const { data: sr, error: srErr } = await client.from('ds_size_ranges').select('sizes').eq('id', String(tp.size_range_id ?? '')).single();
  if (srErr || !sr) return err(srErr);
  const sizes = (sr.sizes as string[]) ?? [];
  const values = gradeValues(baseValue, increment, sizes, String(tp.base_size ?? ''));
  const rows = sizes.map((s) => ({
    tenant_id: tenantId,
    tech_pack_id: tpId,
    pom_id: pomId,
    size_label: s,
    value: values[s],
    tol_plus: 1,
    tol_minus: 1,
    grade: increment,
  }));
  const { error } = await (client.from('tech_pack_measurements').upsert(rows, { onConflict: 'tech_pack_id,pom_id,size_label' }) as unknown as Promise<RowsResult>);
  if (error) return err(error);
  revalidate(tpId);
  return ok(rows.length);
}

export async function upsertConstruction(tpId: string, row: Row): Promise<Result<Row>> {
  return upsertChild(tpId, 'tech_pack_construction', row, 'id');
}
export async function deleteConstruction(tpId: string, id: string): Promise<Result<boolean>> {
  return deleteChild(tpId, 'tech_pack_construction', id);
}

export async function upsertArtwork(tpId: string, row: Row): Promise<Result<Row>> {
  return upsertChild(tpId, 'tech_pack_artwork', row, 'id');
}
export async function deleteArtwork(tpId: string, id: string): Promise<Result<boolean>> {
  return deleteChild(tpId, 'tech_pack_artwork', id);
}

export async function upsertPomMarker(tpId: string, row: Row): Promise<Result<Row>> {
  const { supabase, tenantId } = await requireStaff();
  const body: Row = { ...row, tenant_id: tenantId, tech_pack_id: tpId };
  if (isTmpId(body.id) || body.id === undefined) delete body.id;
  const { data, error } = await asAny(supabase)
    .from('tech_pack_pom_markers')
    .upsert(body, { onConflict: 'tech_pack_id,pom_id,view' })
    .select('*')
    .single();
  if (error || !data) return err(error);
  revalidate(tpId);
  return ok(data);
}
export async function deletePomMarker(tpId: string, id: string): Promise<Result<boolean>> {
  return deleteChild(tpId, 'tech_pack_pom_markers', id);
}

export async function upsertColorwayComponent(tpId: string, row: Row): Promise<Result<Row>> {
  const { supabase, tenantId } = await requireStaff();
  const body: Row = { ...row, tenant_id: tenantId, tech_pack_id: tpId };
  const { data, error } = await asAny(supabase)
    .from('tech_pack_colorway_components')
    .upsert(body, { onConflict: 'tech_pack_id,colorway_id,bom_line_id' })
    .select('*')
    .single();
  if (error || !data) return err(error);
  revalidate(tpId);
  return ok(data);
}

export async function upsertLabel(tpId: string, row: Row): Promise<Result<Row>> {
  return upsertChild(tpId, 'tech_pack_labels', row, 'id');
}
export async function deleteLabel(tpId: string, id: string): Promise<Result<boolean>> {
  return deleteChild(tpId, 'tech_pack_labels', id);
}

export async function upsertHangtag(tpId: string, row: Row): Promise<Result<Row>> {
  return upsertChild(tpId, 'tech_pack_hangtags', row, 'id');
}

export async function upsertPackaging(tpId: string, row: Row): Promise<Result<Row>> {
  const { supabase, tenantId } = await requireStaff();
  const body: Row = { ...row, tenant_id: tenantId, tech_pack_id: tpId };
  if (isTmpId(body.id) || body.id === undefined) delete body.id;
  const { data, error } = await asAny(supabase)
    .from('tech_pack_packaging')
    .upsert(body, { onConflict: 'tech_pack_id' })
    .select('*')
    .single();
  if (error || !data) return err(error);
  revalidate(tpId);
  return ok(data);
}

// --- Templates (S615 library) -------------------------------------------------

export async function listTechPackTemplates(): Promise<Result<Row[]>> {
  const { supabase, tenantId } = await requireStaff();
  const { data, error } = await asAny(supabase).from('ds_tech_pack_templates').select('*').eq('tenant_id', tenantId).order('created_at').limit(50);
  if (error || !data) return err(error);
  return ok(data);
}

/**
 * Seed note (S615): template rows are per-tenant, so the migration cannot
 * seed them. The first library visit creates the tenant's default template
 * row (11 pages, SVG masters from src/lib/techpack-render/templates).
 */
export async function ensureDefaultTechPackTemplate(): Promise<Result<Row>> {
  const { supabase, tenantId } = await requireStaff();
  const client = asAny(supabase);
  const { data: existing } = await client.from('ds_tech_pack_templates').select('id').eq('tenant_id', tenantId).eq('is_default', true).limit(1);
  if (existing && existing.length > 0) return ok(existing[0]);
  const { data, error } = await client
    .from('ds_tech_pack_templates')
    .insert({ tenant_id: tenantId, name: 'Atelier 11-page master', version: 1, is_default: true, pages: ['sketch', 'construction', 'measurement_guide', 'measurement_chart', 'bom', 'materials', 'colorways', 'artwork', 'labels', 'hangtag', 'packaging'] })
    .select('*')
    .single();
  if (error || !data) return err(error);
  return ok(data);
}
