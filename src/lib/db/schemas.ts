// Shared zod schemas — plan/04 §Zod schemas, verbatim.
import { z } from 'zod';

export const BidPayload = z.object({
  valid_until: z.string().date().optional(),
  lead_time_days: z.number().int().positive().optional(),
  payment_terms: z.string().max(200).optional(),
  incoterm: z
    .enum(['EXW', 'FCA', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'])
    .optional(),
  notes: z.string().max(4000).optional(),
  lines: z
    .array(
      z.object({
        rfq_line_id: z.string().uuid(),
        unit_price: z.number().nonnegative(),
        moq: z.number().int().positive().optional(),
        lead_time_days: z.number().int().positive().optional(),
        sample_cost: z.number().nonnegative().optional(),
        tooling_cost: z.number().nonnegative().optional(),
        size_price_overrides: z.record(z.string(), z.number().nonnegative()).optional(),
        notes: z.string().max(2000).optional(),
      }),
    )
    .max(200),
});

export const AwardPayload = z
  .array(z.object({ rfq_line_id: z.string().uuid(), bid_id: z.string().uuid() }))
  .min(1);

export const PrintArea = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
  width_mm: z.number().positive(),
  height_mm: z.number().positive(),
});

// NOTE (erp adaptation, zod v4): plan/04 writes this as
// z.record(z.enum([...]), PrintArea). Under zod v3 that was a PARTIAL
// record (only present areas validated). Under zod v4 (this repo pins
// zod ^4.0.2) an enum-keyed z.record() REQUIRES all 8 areas — which
// rejects real garments (a tee has no hood/crown/visor). z.partialRecord
// restores the plan's intent: a garment carries only its own areas.
export const GarmentPrintAreas = z.partialRecord(
  z.enum(['front', 'back', 'left_sleeve', 'right_sleeve', 'hood', 'crown', 'visor', 'side']),
  PrintArea,
);
