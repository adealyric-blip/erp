// Studio design commands — plan/04 §Command list (design.*, colorway.*, asset.*).
// Server commands use the typed RPC wrappers in src/lib/db/rpc.ts and the
// exact RPC names in plan/02. `designs` has no generated table type yet
// (T03 covers 4 tables), so the insert goes through a cast client — the
// table/columns are the S600 ones (designs: tenant_id, name, style_number,
// source, season_id, garment_template_id).
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/db';
import { dsCreateDesignVersion, dsEnqueueJob } from '@/lib/db/rpc';
import { mapPgError } from '@/server/errors';
import { defineCommand } from './define';

type AnyClient = {
  from: (table: string) => {
    insert: (row: Record<string, unknown>) => {
      select: (cols: string) => {
        single: () => Promise<{ data: { id: string } | null; error: { code?: string; message?: string } | null }>;
      };
    };
    select: (cols: string) => {
      eq: (col: string, v: string) => {
        single: () => Promise<{
          data: Record<string, unknown> | null;
          error: { code?: string; message?: string } | null;
        }>;
      };
    };
  };
};

const asAny = (c: SupabaseClient<Database>): AnyClient => c as unknown as AnyClient;

export const designCreate = defineCommand({
  id: 'design.create',
  title: 'Create design',
  scope: 'studio',
  permission: 'member',
  description:
    'Create a new design draft on a garment template. Returns the design id; the designer then opens the Konva canvas.',
  input: z.object({
    name: z.string().min(1).max(200),
    garmentTemplateId: z.string().uuid().optional(),
    styleNumber: z.string().max(60).optional(),
    seasonId: z.string().uuid().optional(),
  }),
  async run(ctx, i) {
    const { data, error } = await asAny(ctx.supabase)
      .from('designs')
      .insert({
        tenant_id: ctx.tenantId,
        name: i.name,
        source: 'konva',
        garment_template_id: i.garmentTemplateId ?? null,
        style_number: i.styleNumber ?? null,
        season_id: i.seasonId ?? null,
      })
      .select('id')
      .single();
    if (error || !data) return mapPgError(error ?? { message: 'design insert failed' });
    return { ok: true, data: { designId: data.id } };
  },
});

export const designSave = defineCommand({
  id: 'design.save',
  title: 'Save design version',
  scope: 'studio',
  permission: 'member',
  description:
    'Save the current Konva canvas state as a new design version via ds_create_design_version. Versions are append-only; restoring an old version saves it as a new version.',
  input: z.object({
    designId: z.string().uuid(),
    canvasState: z.record(z.string(), z.unknown()),
    message: z.string().max(500).optional(),
    sourceApp: z.string().max(40).optional(),
  }),
  async run(ctx, i) {
    const { data, error } = await dsCreateDesignVersion(ctx.supabase, {
      p_design: i.designId,
      p_canvas_state: i.canvasState as never,
      p_source_app: i.sourceApp ?? 'konva',
      p_message: i.message ?? null,
    });
    if (error) return mapPgError(error);
    return { ok: true, data: { versionId: data } };
  },
});

export const designDuplicate = defineCommand({
  id: 'design.duplicate',
  title: 'Duplicate design',
  scope: 'studio',
  permission: 'member',
  description:
    'Duplicate a design (used for locked versions: "Duplicate to edit"). Copies the draft row and its current canvas state; versions are not copied.',
  input: z.object({ designId: z.string().uuid(), name: z.string().min(1).max(200).optional() }),
  async run(ctx, i) {
    const client = asAny(ctx.supabase);
    // Read the source row through the user client (RLS applies), then insert a copy.
    const { data: rows, error: selErr } = await (ctx.supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (col: string, v: string) => {
            single: () => Promise<{
              data: Record<string, unknown> | null;
              error: { code?: string; message?: string } | null;
            }>;
          };
        };
      };
    })
      .from('designs')
      .select('name, style_number, season_id, garment_template_id, canvas_state')
      .eq('id', i.designId)
      .single();
    if (selErr || !rows) return mapPgError(selErr ?? { message: 'design not found' });
    const { data, error } = await client
      .from('designs')
      .insert({
        tenant_id: ctx.tenantId,
        name: i.name ?? `${String(rows.name)} (copy)`,
        source: 'konva',
        garment_template_id: (rows.garment_template_id as string | null) ?? null,
        style_number: null,
        season_id: (rows.season_id as string | null) ?? null,
        canvas_state: (rows.canvas_state as Record<string, unknown> | null) ?? null,
      })
      .select('id')
      .single();
    if (error || !data) return mapPgError(error ?? { message: 'design duplicate failed' });
    return { ok: true, data: { designId: data.id } };
  },
});

export const colorwayCreate = defineCommand({
  id: 'colorway.create',
  title: 'Create colorway',
  scope: 'studio',
  permission: 'member',
  description: 'Add a named colorway (name, hex, optional Pantone) to a design.',
  input: z.object({
    designId: z.string().uuid(),
    name: z.string().min(1).max(120),
    hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    pantone: z.string().max(40).optional(),
  }),
  async run(ctx, i) {
    const { data, error } = await (ctx.supabase as unknown as AnyClient)
      .from('design_colorways')
      .insert({ tenant_id: ctx.tenantId, design_id: i.designId, name: i.name, hex: i.hex, pantone: i.pantone ?? null })
      .select('id')
      .single();
    if (error || !data) return mapPgError(error ?? { message: 'colorway insert failed' });
    return { ok: true, data: { colorwayId: data.id } };
  },
});

const enqueueJob = (kind: string, app: string) =>
  defineCommand({
    id: kind === 'bg_remove' ? 'asset.remove_bg' : kind === 'mockup_render' ? 'mockup.render' : 'asset.upscale',
    title: kind === 'bg_remove' ? 'Remove background' : kind === 'mockup_render' ? 'Render mockup' : 'Upscale asset',
    scope: 'studio',
    permission: 'member',
    description: `Enqueue a ${kind} render-station job for an asset via ds_enqueue_job.`,
    input: z.object({ assetId: z.string().uuid(), designId: z.string().uuid().optional() }),
    async run(ctx, i) {
      const { data, error } = await dsEnqueueJob(ctx.supabase, {
        p_tenant: ctx.tenantId,
        p_kind: kind,
        p_app: app,
        p_input: { asset_id: i.assetId, design_id: i.designId ?? null } as never,
        p_subject_type: 'design_asset',
        p_subject: i.assetId,
        p_key: `${kind}:${i.assetId}:${Date.now()}`,
      });
      if (error) return mapPgError(error);
      return { ok: true, data: { jobId: data } };
    },
  });

export const assetRemoveBg = enqueueJob('bg_remove', 'photocraft');
export const assetUpscale = enqueueJob('upscale', 'photocraft');
export const mockupRender = enqueueJob('mockup_render', 'photocraft');
