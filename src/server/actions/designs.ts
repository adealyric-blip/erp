// Design + version data actions — T07/T08.
// Reads go through the staff user's own client (RLS applies); writes go
// through ds_create_design_version via the design.save command.
// `designs` / `design_versions` / `ds_garment_templates` have no generated
// table types yet (T03 covers 4 tables), so reads use a cast client — the
// table/column names are the S600 ones.
'use server';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/db';
import { requireStaff } from '@/server/auth/requireStaff';
import { fail, ok, type Result } from '@/server/result';
import { parseCanvasState, type CanvasSceneJson } from '@/features/studio/store/canvasStore';
import { SEED_TEMPLATES } from '@/features/studio/lib/printAreas';

type Row = Record<string, unknown>;
type RowResult = { data: Row | null; error: { message?: string } | null };
type RowsResult = { data: Row[] | null; error: { message?: string } | null };

/** Minimal chainable query shape for the untyped S600 tables (designs,
 *  design_versions, ds_garment_templates). Terminal calls return promises;
 *  intermediate calls return the chain. */
interface DbQuery {
  select: (cols: string) => DbQuery;
  eq: (col: string, v: unknown) => DbQuery;
  is: (col: string, v: null) => DbQuery;
  order: (col: string, opts?: { ascending?: boolean }) => DbQuery;
  limit: (n: number) => Promise<RowsResult>;
  single: () => Promise<RowResult>;
}

type AnyClient = { from: (table: string) => DbQuery };

const asAny = (c: SupabaseClient<Database>): AnyClient => c as unknown as AnyClient;

export interface DesignEditorData {
  design: { id: string; name: string; style_number: string | null; garment_template_id: string | null; canvas_state: unknown };
  template: { id: string; name: string; views: string[]; print_areas: Record<string, unknown> } | null;
  latestVersion: { id: string; version_no: number; is_locked: boolean; message: string | null; created_at: string } | null;
  versionCount: number;
}

export interface DesignVersionRow {
  id: string;
  version_no: number;
  is_locked: boolean;
  message: string | null;
  canvas_state: unknown;
  source_app: string;
  created_at: string;
  created_by: string | null;
}

/** Load one design + its template + latest version for the editor. */
export async function getDesignEditorData(designId: string): Promise<Result<DesignEditorData>> {
  const { supabase } = await requireStaff();
  const client = asAny(supabase);
  const { data: design, error } = await client
    .from('designs')
    .select('id, name, style_number, garment_template_id, canvas_state')
    .eq('id', designId)
    .single();
  if (error || !design) return fail('not_found', 'Design not found');
  let template: DesignEditorData['template'] = null;
  if (design.garment_template_id) {
    const { data: t } = await client
      .from('ds_garment_templates')
      .select('id, name, views, print_areas')
      .eq('id', design.garment_template_id as string)
      .single();
    if (t) {
      template = {
        id: String(t.id),
        name: String(t.name),
        views: (t.views as string[]) ?? ['front', 'back'],
        print_areas: (t.print_areas as Record<string, unknown>) ?? {},
      };
    }
  }
  const { data: versions } = await client
    .from('design_versions')
    .select('id, version_no, is_locked, message, created_at')
    .eq('design_id', designId)
    .order('version_no', { ascending: false })
    .limit(1);
  const latest = (versions?.[0] as Row | undefined) ?? null;
  return ok({
    design: {
      id: String(design.id),
      name: String(design.name),
      style_number: (design.style_number as string | null) ?? null,
      garment_template_id: (design.garment_template_id as string | null) ?? null,
      canvas_state: design.canvas_state ?? null,
    },
    template,
    latestVersion: latest
      ? {
          id: String(latest.id),
          version_no: Number(latest.version_no),
          is_locked: Boolean(latest.is_locked),
          message: (latest.message as string | null) ?? null,
          created_at: String(latest.created_at),
        }
      : null,
    versionCount: versions?.length ?? 0,
  });
}

/** Version history for designs/[id]/history. */
export async function listDesignVersions(designId: string): Promise<Result<DesignVersionRow[]>> {
  const { supabase } = await requireStaff();
  const client = asAny(supabase);
  const { data, error } = await client
    .from('design_versions')
    .select('id, version_no, is_locked, message, canvas_state, source_app, created_at, created_by')
    .eq('design_id', designId)
    .order('version_no', { ascending: false })
    .limit(50);
  if (error) return fail('unknown', error.message ?? 'Could not load versions');
  return ok(
    (data ?? []).map((r) => ({
      id: String(r.id),
      version_no: Number(r.version_no),
      is_locked: Boolean(r.is_locked),
      message: (r.message as string | null) ?? null,
      canvas_state: r.canvas_state ?? null,
      source_app: String(r.source_app ?? 'konva'),
      created_at: String(r.created_at),
      created_by: (r.created_by as string | null) ?? null,
    })),
  );
}

/** List the tenant's designs for /studio/designs. */
export async function listDesigns(): Promise<
  Result<Array<{ id: string; name: string; style_number: string | null; updated_at: string }>>
> {
  const { supabase } = await requireStaff();
  const client = asAny(supabase);
  const { data, error } = await client
    .from('designs')
    .select('id, name, style_number, updated_at')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(100);
  if (error) return fail('unknown', error.message ?? 'Could not load designs');
  return ok(
    (data ?? []).map((r) => ({
      id: String(r.id),
      name: String(r.name),
      style_number: (r.style_number as string | null) ?? null,
      updated_at: String(r.updated_at),
    })),
  );
}

/** The three seed templates (same data as supabase/seed/20_demo_design.sql)
 *  for the new-design template picker when the DB template rows are absent
 *  (e.g. a fresh tenant before seed). The DB rows remain authoritative. */
export function seedTemplatesForPicker() {
  return SEED_TEMPLATES.map((t) => ({ id: t.id, name: t.name, category: t.category, views: t.views }));
}

/** Garment templates for the new-design picker (DB rows are authoritative;
 *  the seed mirror is the fallback when the DB has none). */
export async function listGarmentTemplates(): Promise<
  Result<Array<{ id: string; name: string; category: string; views: string[] }>>
> {
  const { supabase } = await requireStaff();
  const client = asAny(supabase);
  const { data, error } = await client
    .from('ds_garment_templates')
    .select('id, name, category, views')
    .eq('is_active', true)
    .order('name', { ascending: true })
    .limit(50);
  if (error) return fail('unknown', error.message ?? 'Could not load templates');
  return ok(
    (data ?? []).map((r) => ({
      id: String(r.id),
      name: String(r.name),
      category: String(r.category ?? ''),
      views: (r.views as string[]) ?? ['front', 'back'],
    })),
  );
}

/** Resolve a stored canvas_state into a scene the editor can restore. */
export function sceneFromStored(raw: unknown): CanvasSceneJson | null {
  return parseCanvasState(raw);
}
