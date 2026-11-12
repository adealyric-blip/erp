// Library zod schemas (T10) — plain module, NOT a 'use server' file.
// A 'use server' module may only export async functions; these schemas are
// plain objects, so they live here and are imported by the server actions
// (library.ts) and the unit test (library.test.ts).
import { z } from 'zod';

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
