// Library CRUD server actions — T10 (plan/06).
// Seasons, size ranges, POM library, materials, garment templates (+ the
// S610 license record, admin-only). Every write validates with zod and
// returns Result; DB constraint errors (e.g. base size not in sizes) are
// mapped to inline messages with the field in `hint` — never a raw PG error.
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireStaff } from '@/server/auth/requireStaff';
import { mapPgError } from '@/server/errors';
import type { Result } from '@/server/result';

// --- zod schemas -----------------------------------------------------------
export const seasonSchema = z
  .object({
    id: z.string().uuid().optional(),
    code: z.string().min(1).max(20),
    name: z.string().min(1).max(200),
    starts_on: z.string().date().optional().nullable(),
    ends_on: z.string().date().optional().nullable(),
    status: z.enum(['planning', 'active', 'closed', 'archived']).default('planning'),
  })
  .refine((v) => !v.starts_on || !v.ends_on || v.ends_on >= v.starts_on, {
    message: 'End date must be on or after the start date',
    path: ['ends_on'],
  });

export const sizeRangeSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().min(1).max(200),
    sizes: z.array(z.string().min(1).max(10)).min(1).max(30),
    base_size: z.string().min(1).max(10),
    unit: z.enum(['cm', 'in']).default('cm'),
  })
  .refine((v) => v.sizes.includes(v.base_size), {
    message: 'Base size must be one of the sizes in the range',
    path: ['base_size'],
  });

export const pomSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(200),
  how_to_measure: z.string().max(2000).optional().nullable(),
  category: z.string().max(80).optional().nullable(),
  default_tol_plus: z.number().min(0).default(1),
  default_tol_minus: z.number().min(0).default(1),
  diagram_asset_id: z.string().uuid().optional().nullable(),
  sort: z.number().int().default(0),
});

const MATERIAL_KINDS = ['fabric', 'trim', 'label', 'packaging', 'thread', 'hardware', 'interlining', 'other'] as const;

export const materialSchema = z.object({
  id: z.string().uuid().optional(),
  kind: z.enum(MATERIAL_KINDS),
  code: z.string().min(1).max(60),
  name: z.string().min(1).max(200),
  composition: z.string().max(500).optional().nullable(),
  weight_gsm: z.number().positive().optional().nullable(),
  width_cm: z.number().positive().optional().nullable(),
  color_ref: z.string().max(200).optional().nullable(),
  vendor_id: z.string().uuid().optional().nullable(),
  unit_cost: z.number().nonnegative().optional().nullable(),
  currency: z.string().length(3).default('USD'),
  uom: z.string().max(10).default('m'),
  certifications: z.array(z.string().min(1).max(40)).default([]),
  notes: z.string().max(4000).optional().nullable(),
  swatch_asset_id: z.string().uuid().optional().nullable(),
  is_active: z.boolean().default(true),
});

const TEMPLATE_VIEWS = ['front', 'back', 'left_sleeve', 'right_sleeve', 'hood', 'crown', 'visor', 'side'] as const;

export const templateSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  category: z.string().min(1).max(80),
  archetype: z.string().max(40).default('APPAREL'),
  views: z.array(z.enum(TEMPLATE_VIEWS)).min(1),
  print_areas: z.record(z.string(), z.unknown()).default({}),
  size_range_id: z.string().uuid().optional().nullable(),
  flat_sketch_asset_id: z.string().uuid().optional().nullable(),
  pattern_asset_id: z.string().uuid().optional().nullable(),
  model_asset_id: z.string().uuid().optional().nullable(),
  turntable_frames: z.number().int().min(8).max(72).optional().nullable(),
  is_active: z.boolean().default(true),
});

export const licenseSchema = z
  .object({
    source: z.enum(['generated', 'vecfashion', 'fashiondesign411', 'opentechpack', 'printful', 'other']),
    license_type: z.enum(['owned', 'open_source', 'licensed_commercial', 'vendor_restricted']),
    license_name: z.string().max(200).optional().nullable(),
    license_url: z.string().url().max(500).optional().nullable(),
    allow_supplier_view: z.boolean(),
    allow_redistribution: z.boolean().default(false),
    restricted_to_vendor_id: z.string().uuid().optional().nullable(),
    expires_at: z.string().datetime().optional().nullable(),
    notes: z.string().max(4000).optional().nullable(),
  })
  .refine((v) => v.license_type !== 'vendor_restricted' || (v.restricted_to_vendor_id && v.allow_supplier_view === false), {
    message: 'A vendor-restricted license needs a vendor and must not allow supplier viewing',
    path: ['restricted_to_vendor_id'],
  })
  .refine((v) => v.license_type !== 'owned' || v.source === 'generated', {
    message: 'An owned license must come from the generated source',
    path: ['source'],
  })
  .refine((v) => v.license_type === 'owned' || !!v.license_url, {
    message: 'A non-owned license needs its license URL',
    path: ['license_url'],
  });

// --- helpers ---------------------------------------------------------------
type AnyClient = {
  from: (table: string) => {
    insert: (row: Record<string, unknown>) => { select: (c?: string) => { single: () => Promise<{ data: { id: string } | null; error: { code?: string; message?: string; hint?: string } | null }> } };
    update: (row: Record<string, unknown>) => { eq: (c: string, v: string) => { eq: (c: string, v: string) => { select: (c?: string) => { single: () => Promise<{ data: { id: string } | null; error: { code?: string; message?: string; hint?: string } | null }> } } } };
    delete: () => { eq: (c: string, v: string) => { eq: (c: string, v: string) => Promise<{ error: { code?: string; message?: string; hint?: string } | null }> } };
  };
};

function formValues(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === 'string') out[k] = v;
  return out;
}

function parseFail<T>(parsed: { success: false; error: z.ZodError }): Result<T> {
  const first = parsed.error.issues[0];
  return {
    ok: false,
    error: {
      code: 'invalid_state',
      message: first?.message ?? 'Invalid input',
      hint: first ? first.path.map(String).join('.') : undefined,
    },
  };
}

async function upsert(
  table: string,
  path: string,
  id: string | undefined,
  row: Record<string, unknown>,
): Promise<Result<string>> {
  const { supabase, tenantId } = await requireStaff();
  const client = supabase as unknown as AnyClient;
  const full = { ...row, tenant_id: tenantId };
  let res;
  if (id) {
    res = await client.from(table).update(full).eq('id', id).eq('tenant_id', tenantId).select('id').single();
  } else {
    res = await client.from(table).insert(full).select('id').single();
  }
  if (res.error || !res.data) return res.error ? mapPgError(res.error) : { ok: false, error: { code: 'unknown', message: 'Save returned nothing' } };
  revalidatePath(path);
  return { ok: true, data: res.data.id };
}

async function remove(table: string, path: string, id: string): Promise<Result<string>> {
  const { supabase, tenantId } = await requireStaff();
  const client = supabase as unknown as AnyClient;
  const { error } = await client.from(table).delete().eq('id', id).eq('tenant_id', tenantId);
  if (error) return mapPgError(error);
  revalidatePath(path);
  return { ok: true, data: id };
}

// --- seasons ---------------------------------------------------------------
export async function saveSeason(form: FormData): Promise<Result<string>> {
  const v = formValues(form);
  const parsed = seasonSchema.safeParse({
    id: v.id || undefined,
    code: v.code,
    name: v.name,
    starts_on: v.starts_on || null,
    ends_on: v.ends_on || null,
    status: v.status || 'planning',
  });
  if (!parsed.success) return parseFail(parsed);
  const { id, ...row } = parsed.data;
  return upsert('ds_seasons', '/studio/library/seasons', id, row);
}

export async function deleteSeason(id: string): Promise<Result<string>> {
  return remove('ds_seasons', '/studio/library/seasons', id);
}

// --- size ranges -----------------------------------------------------------
export async function saveSizeRange(form: FormData): Promise<Result<string>> {
  const v = formValues(form);
  const sizes = (v.sizes ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const parsed = sizeRangeSchema.safeParse({
    id: v.id || undefined,
    name: v.name,
    sizes,
    base_size: v.base_size,
    unit: v.unit || 'cm',
  });
  if (!parsed.success) return parseFail(parsed);
  const { id, ...row } = parsed.data;
  return upsert('ds_size_ranges', '/studio/library/size-ranges', id, row);
}

export async function deleteSizeRange(id: string): Promise<Result<string>> {
  return remove('ds_size_ranges', '/studio/library/size-ranges', id);
}

// --- POM library -----------------------------------------------------------
export async function savePom(form: FormData): Promise<Result<string>> {
  const v = formValues(form);
  const parsed = pomSchema.safeParse({
    id: v.id || undefined,
    code: v.code,
    name: v.name,
    how_to_measure: v.how_to_measure || null,
    category: v.category || null,
    default_tol_plus: v.default_tol_plus ? Number(v.default_tol_plus) : 1,
    default_tol_minus: v.default_tol_minus ? Number(v.default_tol_minus) : 1,
    diagram_asset_id: v.diagram_asset_id || null,
    sort: v.sort ? Number(v.sort) : 0,
  });
  if (!parsed.success) return parseFail(parsed);
  const { id, ...row } = parsed.data;
  return upsert('ds_pom_library', '/studio/library/poms', id, row);
}

export async function deletePom(id: string): Promise<Result<string>> {
  return remove('ds_pom_library', '/studio/library/poms', id);
}

// --- materials -------------------------------------------------------------
export async function saveMaterial(form: FormData): Promise<Result<string>> {
  const v = formValues(form);
  const certifications = (v.certifications ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const parsed = materialSchema.safeParse({
    id: v.id || undefined,
    kind: v.kind,
    code: v.code,
    name: v.name,
    composition: v.composition || null,
    weight_gsm: v.weight_gsm ? Number(v.weight_gsm) : null,
    width_cm: v.width_cm ? Number(v.width_cm) : null,
    color_ref: v.color_ref || null,
    vendor_id: v.vendor_id || null,
    unit_cost: v.unit_cost ? Number(v.unit_cost) : null,
    currency: v.currency || 'USD',
    uom: v.uom || 'm',
    certifications,
    notes: v.notes || null,
    swatch_asset_id: v.swatch_asset_id || null,
    is_active: v.is_active !== 'false',
  });
  if (!parsed.success) return parseFail(parsed);
  const { id, ...row } = parsed.data;
  return upsert('ds_materials', '/studio/library/materials', id, row);
}

export async function deleteMaterial(id: string): Promise<Result<string>> {
  return remove('ds_materials', '/studio/library/materials', id);
}

// --- garment templates -----------------------------------------------------
export async function saveTemplate(form: FormData): Promise<Result<string>> {
  const v = formValues(form);
  const views = form.getAll('views').filter((x): x is string => typeof x === 'string');
  let printAreas: Record<string, unknown> = {};
  try {
    printAreas = v.print_areas ? (JSON.parse(v.print_areas) as Record<string, unknown>) : {};
  } catch {
    return { ok: false, error: { code: 'invalid_state', message: 'Print areas are not valid JSON', hint: 'print_areas' } };
  }
  const parsed = templateSchema.safeParse({
    id: v.id || undefined,
    name: v.name,
    category: v.category,
    archetype: v.archetype || 'APPAREL',
    views,
    print_areas: printAreas,
    size_range_id: v.size_range_id || null,
    flat_sketch_asset_id: v.flat_sketch_asset_id || null,
    pattern_asset_id: v.pattern_asset_id || null,
    model_asset_id: v.model_asset_id || null,
    turntable_frames: v.turntable_frames ? Number(v.turntable_frames) : null,
    is_active: v.is_active !== 'false',
  });
  if (!parsed.success) return parseFail(parsed);
  const { id, ...row } = parsed.data;
  return upsert('ds_garment_templates', '/studio/library/templates', id, row);
}

export async function deleteTemplate(id: string): Promise<Result<string>> {
  return remove('ds_garment_templates', '/studio/library/templates', id);
}

// --- licenses (S610, admin-only) -------------------------------------------
export async function createLicense(form: FormData): Promise<Result<string>> {
  const { role } = await requireStaff();
  if (role !== 'owner' && role !== 'admin') {
    return { ok: false, error: { code: 'forbidden', message: 'Only owners and admins write license records' } };
  }
  const v = formValues(form);
  const parsed = licenseSchema.safeParse({
    source: v.source,
    license_type: v.license_type,
    license_name: v.license_name || null,
    license_url: v.license_url || null,
    allow_supplier_view: v.allow_supplier_view === 'true',
    allow_redistribution: v.allow_redistribution === 'true',
    restricted_to_vendor_id: v.restricted_to_vendor_id || null,
    expires_at: v.expires_at || null,
    notes: v.notes || null,
  });
  if (!parsed.success) return parseFail(parsed);
  const { supabase, tenantId } = await requireStaff();
  const client = supabase as unknown as AnyClient;
  const res = await client
    .from('ds_asset_licenses')
    .insert({ ...parsed.data, tenant_id: tenantId })
    .select('id')
    .single();
  if (res.error || !res.data) return res.error ? mapPgError(res.error) : { ok: false, error: { code: 'unknown', message: 'Save returned nothing' } };
  revalidatePath('/studio/library/flats');
  return { ok: true, data: res.data.id };
}
