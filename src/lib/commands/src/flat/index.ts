// flat.* commands — plan/04 §Command list (flat.generate, flat.grade,
// flat.import), plan/08 §How a parametric flat is built.
// Registered into Lane A's registry (src/lib/commands/registry.ts).
// They generate SVGs with src/lib/flat-gen, store them in design-private
// via the staff storage policy (no signed URLs), and write the print-area
// rects back to ds_garment_templates.print_areas.
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/db';
import { GENERATOR_VERSION, getBlank, generateFlat, gradeFlat, validateFlatSvg } from '@/lib/flat-gen';
import type { StyleOptions } from '@/lib/flat-gen';
import { mapPgError } from '@/server/errors';
import { defineCommand } from '../../define';

// ds_garment_templates / design_assets / ds_asset_licenses have no generated
// table type yet (T03 covers 4 tables) — same cast-client pattern as
// src/lib/commands/design.ts.
type AnyClient = {
  from: (table: string) => {
    insert: (row: Record<string, unknown> | Record<string, unknown>[]) => {
      select: (cols?: string) => {
        single: () => Promise<{ data: Record<string, unknown> | null; error: { code?: string; message?: string } | null }>;
      };
    };
    upsert: (row: Record<string, unknown>, opts?: Record<string, unknown>) => {
      select: (cols?: string) => {
        single: () => Promise<{ data: Record<string, unknown> | null; error: { code?: string; message?: string } | null }>;
      };
    };
    select: (cols: string) => {
      eq: (col: string, v: string) => {
        eq: (col: string, v: string) => {
          limit: (n: number) => {
            maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: { code?: string; message?: string } | null }>;
          };
          single: () => Promise<{ data: Record<string, unknown> | null; error: { code?: string; message?: string } | null }>;
        };
        single: () => Promise<{ data: Record<string, unknown> | null; error: { code?: string; message?: string } | null }>;
      };
    };
  };
  storage: {
    from: (bucket: string) => {
      upload: (path: string, body: Blob, opts?: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
    };
  };
};

const asAny = (c: SupabaseClient<Database>): AnyClient => c as unknown as AnyClient;
const fail = (code: 'invalid_state' | 'missing_data' | 'not_found' | 'unknown', message: string) =>
  ({ ok: false as const, error: { code, message } });

async function findOwnedLicense(client: AnyClient, tenantId: string) {
  const { data, error } = await client
    .from('ds_asset_licenses')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('source', 'generated')
    .limit(1)
    .maybeSingle();
  if (error) return { license: null as string | null, error: mapPgError(error) };
  return { license: (data?.id as string | undefined) ?? null, error: null };
}

export const flatGenerate = defineCommand({
  id: 'flat.generate',
  title: 'Generate flat',
  scope: 'library',
  permission: 'member',
  description:
    'Generate a parametric flat (all views, mm-unit SVG, 7 fixed layers) from a core blank and save it as an owned garment template. Writes each print-area rect back to ds_garment_templates.print_areas.',
  input: z.object({
    blankId: z.string().min(1).max(80),
    size: z.string().min(1).max(10).default('M'),
    templateName: z.string().min(1).max(200).optional(),
    sizeRangeId: z.string().uuid().optional(),
  }),
  async run(ctx, i) {
    let blank;
    try {
      blank = getBlank(i.blankId);
    } catch {
      return fail('invalid_state', `Unknown blank: ${i.blankId}`);
    }
    const flat = generateFlat(blank, i.size);
    for (const view of flat.views) {
      const res = validateFlatSvg(view.svg);
      if (!res.ok) return fail('invalid_state', `Generated ${view.view} view failed validation: ${res.errors.join('; ')}`);
    }
    const client = asAny(ctx.supabase);
    const { license, error: licErr } = await findOwnedLicense(client, ctx.tenantId);
    if (licErr) return licErr;
    if (!license) {
      return fail(
        'missing_data',
        'No owned flat license in this workspace — an owner must create one (Library → Flats → Generate flat, or run scripts/seed-flats.ts).',
      );
    }
    const templateName = i.templateName ?? blank.name;
    const slug = i.blankId;
    const assetIds: Record<string, string> = {};
    for (const view of flat.views) {
      const path = `${ctx.tenantId}/library/flats/${slug}/${view.view}.svg`;
      const { error: upErr } = await client.storage
        .from('design-private')
        .upload(path, new Blob([view.svg], { type: 'image/svg+xml' }), { upsert: true, contentType: 'image/svg+xml' });
      if (upErr) return fail('unknown', `Upload of ${view.view} flat failed: ${upErr.message}`);
      const { data: asset, error: insErr } = await client
        .from('design_assets')
        .insert({
          tenant_id: ctx.tenantId,
          kind: 'flat_sketch',
          storage_path: path,
          bucket: 'design-private',
          classification: 'internal',
          mime_type: 'image/svg+xml',
          license_id: license,
          metadata: { blank_id: blank.id, view: view.view, size: i.size, generator_version: GENERATOR_VERSION },
        })
        .select('id')
        .single();
      if (insErr || !asset) return insErr ? mapPgError(insErr) : fail('unknown', 'Flat asset insert returned nothing');
      assetIds[view.view] = asset.id as string;
    }
    const printAreas: Record<string, unknown> = {};
    for (const view of flat.views) {
      const pa = view.printAreas[view.view];
      printAreas[view.view] = {
        x: pa.nx,
        y: pa.ny,
        w: pa.nw,
        h: pa.nh,
        width_mm: pa.widthMm,
        height_mm: pa.heightMm,
      };
    }
    const { data: template, error: tplErr } = await client
      .from('ds_garment_templates')
      .upsert(
        {
          tenant_id: ctx.tenantId,
          name: templateName,
          category: blank.category,
          archetype: blank.archetype,
          views: blank.views,
          print_areas: printAreas,
          size_range_id: i.sizeRangeId ?? null,
          flat_sketch_asset_id: assetIds.front ?? assetIds[blank.views[0]],
          license_id: license,
          block: flat.block,
          style_options: { ...blank.style, blank_id: blank.id },
          generator_version: GENERATOR_VERSION,
        },
        { onConflict: 'tenant_id,name' },
      )
      .select('id')
      .single();
    if (tplErr || !template) return tplErr ? mapPgError(tplErr) : fail('unknown', 'Template upsert returned nothing');
    return {
      ok: true as const,
      data: {
        templateId: template.id as string,
        templateName,
        blankId: blank.id,
        size: i.size,
        licenseScope: 'owned',
        views: flat.views.map((v) => ({
          view: v.view,
          assetId: assetIds[v.view],
          widthMm: v.widthMm,
          heightMm: v.heightMm,
          printArea: v.printAreas[v.view],
        })),
      },
    };
  },
});

export const flatGrade = defineCommand({
  id: 'flat.grade',
  title: 'Grade flat',
  scope: 'library',
  permission: 'member',
  description:
    'Re-run the flat generator for every size in a range using the blank grade rules, so the size-set flats and the POM table always agree. Returns the graded set; it does not persist per-size assets.',
  input: z.object({
    templateId: z.string().uuid(),
    sizes: z.array(z.string().min(1).max(10)).min(1).max(30),
    baseSize: z.string().min(1).max(10),
  }),
  async run(ctx, i) {
    const client = asAny(ctx.supabase);
    const { data: tpl, error } = await client
      .from('ds_garment_templates')
      .select('id,block,style_options,generator_version')
      .eq('tenant_id', ctx.tenantId)
      .eq('id', i.templateId)
      .single();
    if (error || !tpl) return error ? mapPgError(error) : fail('not_found', `Template not found: ${i.templateId}`);
    const style = (tpl.style_options ?? {}) as StyleOptions & { blank_id?: string };
    if (!style.blank_id) {
      return fail('invalid_state', 'Template was not generated by flat-gen (no blank_id in style_options); grade it from its blank instead.');
    }
    let blank;
    try {
      blank = getBlank(style.blank_id);
    } catch {
      return fail('invalid_state', `Unknown blank in template: ${style.blank_id}`);
    }
    let graded;
    try {
      graded = gradeFlat(blank, i.sizes, i.baseSize);
    } catch (e) {
      return fail('invalid_state', e instanceof Error ? e.message : 'Grading failed');
    }
    const out: Record<string, unknown> = {};
    for (const size of i.sizes) {
      const flat = graded[size];
      for (const view of flat.views) {
        const res = validateFlatSvg(view.svg);
        if (!res.ok) return fail('invalid_state', `Graded ${size}/${view.view} failed validation: ${res.errors.join('; ')}`);
      }
      out[size] = flat.views.map((v) => ({
        view: v.view,
        widthMm: v.widthMm,
        heightMm: v.heightMm,
        printArea: v.printAreas[v.view],
      }));
    }
    return {
      ok: true as const,
      data: { templateId: i.templateId, blankId: blank.id, baseSize: i.baseSize, generatorVersion: GENERATOR_VERSION, sizes: out },
    };
  },
});

export const flatImport = defineCommand({
  id: 'flat.import',
  title: 'Import licensed flat',
  scope: 'library',
  permission: 'member',
  description:
    'Register a licensed flat bundle (AI/EPS/PDF/SVG) for import: checks the license record and creates a ds_flat_import_batches row in queued status. VectorCraft conversion of the bundle to SVG is a Lane C step (T11/T12 bridge) and is NOT done here.',
  input: z.object({
    fileName: z.string().min(1).max(300),
    mimeType: z.enum([
      'application/pdf',
      'image/svg+xml',
      'application/postscript',
      'application/illustrator',
      'application/octet-stream',
    ]),
    storagePath: z.string().min(1).max(500),
    licenseId: z.string().uuid(),
    sourceCategory: z.string().min(1).max(80).optional(),
  }),
  async run(ctx, i) {
    const client = asAny(ctx.supabase);
    const { data: lic, error: licErr } = await client
      .from('ds_asset_licenses')
      .select('id,license_type,allow_redistribution')
      .eq('tenant_id', ctx.tenantId)
      .eq('id', i.licenseId)
      .single();
    if (licErr || !lic) return licErr ? mapPgError(licErr) : fail('not_found', `License not found: ${i.licenseId}`);
    // The license row is required; split pieces inherit it (allow_redistribution
    // stays whatever the license says — VecFashion pieces are tenant-only).
    const { data: bundle, error: bErr } = await client
      .from('design_assets')
      .insert({
        tenant_id: ctx.tenantId,
        kind: 'flat_sketch',
        storage_path: i.storagePath,
        bucket: 'design-private',
        classification: 'internal',
        mime_type: i.mimeType,
        license_id: i.licenseId,
        metadata: { import_file_name: i.fileName, source: 'licensed_import' },
      })
      .select('id')
      .single();
    if (bErr || !bundle) return bErr ? mapPgError(bErr) : fail('unknown', 'Bundle asset insert returned nothing');
    const { data: batch, error: batchErr } = await client
      .from('ds_flat_import_batches')
      .insert({
        tenant_id: ctx.tenantId,
        source_asset_id: bundle.id,
        license_id: i.licenseId,
        source_category: i.sourceCategory ?? null,
        status: 'queued',
      })
      .select('id')
      .single();
    if (batchErr || !batch) return batchErr ? mapPgError(batchErr) : fail('unknown', 'Import batch insert returned nothing');
    return {
      ok: true as const,
      data: {
        batchId: batch.id as string,
        bundleAssetId: bundle.id as string,
        status: 'queued',
        conversion: 'pending',
        note: 'Bundle registered. SVG conversion runs in VectorCraft (Lane C craft bridge, T11/T12) — the batch stays queued until that bridge lands; splitting (flat.split) is T10c and needs the T11 WASM spike.',
      },
    };
  },
});
