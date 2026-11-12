// RFQ builder — pure validation + publish checklist (T17).
// No DB, no network; unit-tested in validation.test.ts.
//
// Mirrors the S600 `ds_publish_rfq` preconditions exactly — the
// PublishChecklist in the UI must show the same items the RPC enforces,
// so a publish that the checklist calls green cannot fail in the RPC
// (and vice versa). RPC checks (S600 ds_publish_rfq):
//   status = draft; bid_deadline ≥ now + 1h; nda_id NOT NULL;
//   ≥ 1 rfq_lines row; every line's tech pack approved/released AND
//   preview_pdf_asset_id NOT NULL; ≥ 1 non-revoked invitation.

export const RFQ_LINE_CAP = 100;

/** RFQ2 carve-out: any line (or the RFQ total) over the 100-unit cap. */
export interface CarveOut {
  totalQuantity: number;
  overCapLines: number[];
  needsCarveOut: boolean;
}

export function checkCarveOut(lineQuantities: number[]): CarveOut {
  const totalQuantity = lineQuantities.reduce((n, q) => n + (Number(q) || 0), 0);
  const overCapLines = lineQuantities
    .map((q, i) => ({ q, lineNo: i + 1 }))
    .filter((l) => l.q > RFQ_LINE_CAP)
    .map((l) => l.lineNo);
  return { totalQuantity, overCapLines, needsCarveOut: totalQuantity > RFQ_LINE_CAP || overCapLines.length > 0 };
}

export interface RfqLineInput {
  techPackId: string;
  techPackTitle?: string;
  techPackStatus?: string;
  quantity: number;
  /** { size: qty } — must sum to quantity. Stored as JSONB size_breakdown. */
  sizeBreakdown: Record<string, number>;
  /** Internal only — never sent to suppliers. */
  targetUnitCost?: number | null;
  notes?: string | null;
}

export function sizeBreakdownSum(breakdown: Record<string, number> | null | undefined): number {
  if (!breakdown) return 0;
  return Object.values(breakdown).reduce((n, v) => n + (Number(v) || 0), 0);
}

/** Size breakdown must sum to the line quantity (T17 accept). */
export function sizeBreakdownError(line: RfqLineInput): string | null {
  const sum = sizeBreakdownSum(line.sizeBreakdown);
  if (Object.keys(line.sizeBreakdown ?? {}).length === 0) {
    return 'Add a size breakdown — it must sum to the line quantity';
  }
  if (sum !== line.quantity) {
    return `Size breakdown sums to ${sum}, but the line quantity is ${line.quantity}`;
  }
  for (const [size, qty] of Object.entries(line.sizeBreakdown)) {
    if (!Number.isInteger(qty) || qty < 0) return `Size ${size} must be a whole number ≥ 0`;
  }
  return null;
}

export function validateRfqLine(line: RfqLineInput): string[] {
  const errors: string[] = [];
  if (!line.techPackId) errors.push('Choose a tech pack for the line');
  if (line.techPackStatus && !['approved', 'released'].includes(line.techPackStatus)) {
    errors.push(`Tech pack “${line.techPackTitle ?? line.techPackId}” is ${line.techPackStatus} — lines only come from approved or released packs`);
  }
  if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
    errors.push('Quantity must be a whole number greater than 0');
  }
  const sb = sizeBreakdownError(line);
  if (sb) errors.push(sb);
  if (line.targetUnitCost != null && (Number.isNaN(line.targetUnitCost) || line.targetUnitCost < 0)) {
    errors.push('Estimated unit cost cannot be negative');
  }
  return errors;
}

/** Estimated line total (internal): qty × estimated unit cost. */
export function estimatedLineTotal(line: RfqLineInput): number | null {
  if (line.targetUnitCost == null) return null;
  return line.quantity * line.targetUnitCost;
}

export function estimatedRfqTotal(lines: RfqLineInput[]): number | null {
  let total = 0;
  let any = false;
  for (const l of lines) {
    const t = estimatedLineTotal(l);
    if (t != null) { total += t; any = true; }
  }
  return any ? total : null;
}

// --- PO draft (JSONB array) + embed budget -----------------------------------

export interface PoDraftLine {
  rfq_line_id: string;
  tech_pack_id: string;
  quantity: number;
  unit_price: number | null;
  line_total: number | null;
}

/**
 * The award produces one draft PO per vendor; the PO rows are a JSONB
 * array (the `p_awards` shape `ds_award_rfq` takes). The builder keeps
 * the draft small enough to embed in the award payload / notification
 * payload: 8 KiB. A draft over budget is a builder warning, never a
 * silent truncation.
 */
export const PO_DRAFT_EMBED_BUDGET_BYTES = 8 * 1024;

export function buildPoDraft(
  lines: { id: string; techPackId: string; quantity: number; targetUnitCost?: number | null }[],
): PoDraftLine[] {
  return lines.map((l) => ({
    rfq_line_id: l.id,
    tech_pack_id: l.techPackId,
    quantity: l.quantity,
    unit_price: l.targetUnitCost ?? null,
    line_total: l.targetUnitCost == null ? null : l.quantity * l.targetUnitCost,
  }));
}

export function poDraftByteLength(draft: PoDraftLine[]): number {
  return new TextEncoder().encode(JSON.stringify(draft)).length;
}

export function poDraftFitsEmbed(draft: PoDraftLine[]): boolean {
  return poDraftByteLength(draft) <= PO_DRAFT_EMBED_BUDGET_BYTES;
}

// --- Publish checklist (mirrors ds_publish_rfq) ------------------------------

export interface PublishChecklistInput {
  status: string;
  bidDeadline: string | null;
  ndaId: string | null;
  lines: { techPackId: string; techPackStatus?: string; hasPreview?: boolean }[];
  inviteCount: number;
  /** Tech-pack snapshot pins, one per line (see pinTechPackVersion). */
  pins?: TechPackVersionPin[];
}

export interface ChecklistItem {
  id: string;
  label: string;
  met: boolean;
  /** The exact RPC failure this maps to, for the operator. */
  rpcNote: string;
}

export function computePublishChecklist(input: PublishChecklistInput): ChecklistItem[] {
  const deadlineOk =
    !!input.bidDeadline && new Date(input.bidDeadline).getTime() > Date.now() + 60 * 60 * 1000;
  const badLines = input.lines.filter(
    (l) => !['approved', 'released'].includes(l.techPackStatus ?? '') || l.hasPreview !== true,
  );
  return [
    {
      id: 'draft',
      label: 'RFQ is still a draft',
      met: input.status === 'draft',
      rpcNote: 'ds_publish_rfq: only draft RFQs can be published',
    },
    {
      id: 'deadline',
      label: 'Bid deadline is at least 1 hour away',
      met: deadlineOk,
      rpcNote: 'ds_publish_rfq: bid deadline must be at least 1 hour away',
    },
    {
      id: 'nda',
      label: 'An active NDA is attached (NDA accepted before any award or release)',
      met: !!input.ndaId,
      rpcNote: 'ds_publish_rfq: an NDA is required before suppliers can see designs',
    },
    {
      id: 'lines',
      label: 'At least one line',
      met: input.lines.length > 0,
      rpcNote: 'ds_publish_rfq: RFQ has no lines',
    },
    {
      id: 'packs',
      label:
        badLines.length === 0
          ? 'Every line’s tech pack is approved/released with a watermarked preview'
          : `${badLines.length} line(s) use a tech pack that is not approved or has no watermarked preview yet`,
      met: input.lines.length > 0 && badLines.length === 0,
      rpcNote: 'ds_publish_rfq: line(s) use a tech pack that is not approved or has no watermarked preview yet',
    },
    {
      id: 'invites',
      label: 'At least one supplier invited',
      met: input.inviteCount > 0,
      rpcNote: 'ds_publish_rfq: invite at least one supplier',
    },
    {
      id: 'pins',
      label: 'Tech-pack version pinned for every line (tp_specSnapshot)',
      met:
        (input.pins?.length ?? 0) === input.lines.length &&
        (input.pins ?? []).every((p) => !!p.techPackId && !!p.revision && !!p.snapshotSha256),
      rpcNote: 'Builder pin: published RFQ records the tech-pack snapshot revision per line',
    },
  ];
}

export function publishChecklistMet(items: ChecklistItem[]): boolean {
  return items.every((i) => i.met);
}

// --- Tech-pack version pin ----------------------------------------------------

export interface TechPackVersionPin {
  techPackId: string;
  revision: number;
  snapshotSha256: string;
  pinnedAt: string;
}

export function pinTechPackVersion(
  techPackId: string,
  revision: number,
  snapshotSha256: string,
): TechPackVersionPin {
  return { techPackId, revision, snapshotSha256, pinnedAt: new Date().toISOString() };
}

// --- RFQ status stepper ------------------------------------------------------

export const RFQ_STATUS_STEPS = ['draft', 'published', 'closed', 'awarded'] as const;
export type RfqStatus = (typeof RFQ_STATUS_STEPS)[number];

export const RFQ_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  published: 'Published',
  closed: 'Closed',
  awarded: 'Awarded',
  cancelled: 'Cancelled',
};

export function rfqStatusStepIndex(status: string): number {
  const idx = (RFQ_STATUS_STEPS as readonly string[]).indexOf(status);
  return idx >= 0 ? idx : 0;
}
