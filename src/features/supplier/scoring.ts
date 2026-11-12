// Bid scoring — T19, pure logic (unit-tested).
//
// Four weighted factors, weights from rfqs.evaluation_weights
// (S600 default {"price":0.5,"lead_time":0.2,"quality":0.2,"compliance":0.1}).
// Scores are 0..5 per factor; the weighted total is 0..5.
//  - price: cheapest landed total = 5, linear scale down to 0 at the max.
//  - lead_time: shortest lead time = 5, linear scale to 0 at the max.
//  - quality / compliance: staff scores from bid_evaluations (0..5 scale),
//    latest evaluation per bid; missing => null (shown as "not scored",
//    excluded from that factor, never defaulted to 0 silently).
// Landed cost per line = unit_price * quantity + tooling_cost + sample_cost
// (plan/06: price + tooling + samples).
// Top-3 per PO row: a PO row is one RFQ line; the matrix shows at most the
// three best suppliers per line, ranked by weighted total, ties broken by
// lower landed cost.

export interface EvaluationWeights {
  price: number;
  lead_time: number;
  quality: number;
  compliance: number;
}

export const DEFAULT_WEIGHTS: EvaluationWeights = { price: 0.5, lead_time: 0.2, quality: 0.2, compliance: 0.1 };

export function normalizeWeights(raw: Record<string, unknown> | null | undefined): EvaluationWeights {
  const w: EvaluationWeights = {
    price: typeof raw?.price === 'number' && raw.price > 0 ? raw.price : DEFAULT_WEIGHTS.price,
    lead_time: typeof raw?.lead_time === 'number' && raw.lead_time > 0 ? raw.lead_time : DEFAULT_WEIGHTS.lead_time,
    quality: typeof raw?.quality === 'number' && raw.quality > 0 ? raw.quality : DEFAULT_WEIGHTS.quality,
    compliance: typeof raw?.compliance === 'number' && raw.compliance > 0 ? raw.compliance : DEFAULT_WEIGHTS.compliance,
  };
  const sum = w.price + w.lead_time + w.quality + w.compliance;
  if (sum <= 0) return DEFAULT_WEIGHTS;
  return { price: w.price / sum, lead_time: w.lead_time / sum, quality: w.quality / sum, compliance: w.compliance / sum };
}

export interface ScoredBidInput {
  bid_id: string;
  vendor_id: string;
  /** Total landed cost across the bid's priced lines (see landedCost). */
  landed_total: number;
  lead_time_days: number | null;
  quality: number | null;
  compliance: number | null;
}

export interface FactorScores {
  price: number;
  lead_time: number | null;
  quality: number | null;
  compliance: number | null;
}

/** 5 for the best value, 0 for the worst, linear in between. Lower is better. */
export function scaleLowerIsBetter(value: number, best: number, worst: number): number {
  if (worst <= best) return 5;
  const s = 5 * (1 - (value - best) / (worst - best));
  return Math.max(0, Math.min(5, s));
}

/** Per-factor 0..5 scores for one bid, given the field's best/worst across bids. */
export function scoreFactors(
  bid: ScoredBidInput,
  priceRange: { min: number; max: number },
  leadRange: { min: number; max: number },
): FactorScores {
  return {
    price: scaleLowerIsBetter(bid.landed_total, priceRange.min, priceRange.max),
    lead_time: bid.lead_time_days == null ? null : scaleLowerIsBetter(bid.lead_time_days, leadRange.min, leadRange.max),
    quality: bid.quality,
    compliance: bid.compliance,
  };
}

/** Weighted total 0..5. Factors with no score are excluded and the
 *  remaining weights re-normalized, so an unscored factor never drags a
 *  bid to zero — it is shown as "not scored". */
export function weightedTotal(scores: FactorScores, weights: EvaluationWeights): { total: number; scored: Array<keyof FactorScores> } {
  const entries: Array<[keyof FactorScores, number, number]> = [
    ['price', scores.price, weights.price],
    ['lead_time', scores.lead_time ?? NaN, weights.lead_time],
    ['quality', scores.quality ?? NaN, weights.quality],
    ['compliance', scores.compliance ?? NaN, weights.compliance],
  ];
  const scored = entries.filter(([, v]) => Number.isFinite(v));
  const wSum = scored.reduce((s, [, , w]) => s + w, 0);
  if (wSum <= 0) return { total: 0, scored: [] };
  const total = scored.reduce((s, [, v, w]) => s + v * (w / wSum), 0);
  return { total, scored: scored.map(([k]) => k) };
}

export interface BidLinePrice {
  rfq_line_id: string;
  quantity: number;
  unit_price: number;
  tooling_cost?: number | null;
  sample_cost?: number | null;
}

/** Landed cost for one line: price + tooling + samples. */
export function landedCostLine(l: BidLinePrice): number {
  return l.unit_price * l.quantity + (l.tooling_cost ?? 0) + (l.sample_cost ?? 0);
}

export interface RankedBid {
  bid_id: string;
  vendor_id: string;
  total: number;
  landed_total: number;
}

/** Top-3 suppliers per RFQ line (PO row): rank by weighted total desc,
 *  ties by lower landed cost. At most 3 per line, never more. */
export function top3PerLine(
  ranked: RankedBid[],
  bidsByLine: Record<string, string[]>, // rfq_line_id -> bid_ids that priced it
): Record<string, RankedBid[]> {
  const byId = new Map(ranked.map((r) => [r.bid_id, r]));
  const out: Record<string, RankedBid[]> = {};
  for (const [lineId, bidIds] of Object.entries(bidsByLine)) {
    const rows = bidIds
      .map((id) => byId.get(id))
      .filter((r): r is RankedBid => r !== undefined)
      .sort((a, b) => b.total - a.total || a.landed_total - b.landed_total);
    out[lineId] = rows.slice(0, 3);
  }
  return out;
}
