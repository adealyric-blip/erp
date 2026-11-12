import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WEIGHTS,
  landedCostLine,
  normalizeWeights,
  scaleLowerIsBetter,
  scoreFactors,
  top3PerLine,
  weightedTotal,
} from './scoring';

describe('evaluation weights (T19)', () => {
  it('normalizes weights to sum 1', () => {
    const w = normalizeWeights({ price: 2, lead_time: 1, quality: 1, compliance: 1 });
    expect(w.price + w.lead_time + w.quality + w.compliance).toBeCloseTo(1);
    expect(w.price).toBeCloseTo(0.4);
  });
  it('falls back to the S600 default for missing/invalid weights', () => {
    // A zero weight is invalid and falls back to its default, so the
    // normalized result is the default (up to float error).
    for (const input of [null, {}, { price: -1 }]) {
      const w = normalizeWeights(input);
      expect(w.price).toBeCloseTo(DEFAULT_WEIGHTS.price);
      expect(w.lead_time).toBeCloseTo(DEFAULT_WEIGHTS.lead_time);
      expect(w.quality).toBeCloseTo(DEFAULT_WEIGHTS.quality);
      expect(w.compliance).toBeCloseTo(DEFAULT_WEIGHTS.compliance);
    }
  });
});

describe('factor scoring (T19 — 4 weighted factors)', () => {
  it('cheapest / fastest scores 5, most expensive / slowest scores 0', () => {
    expect(scaleLowerIsBetter(10, 10, 20)).toBe(5);
    expect(scaleLowerIsBetter(20, 10, 20)).toBe(0);
    expect(scaleLowerIsBetter(15, 10, 20)).toBe(2.5);
    expect(scaleLowerIsBetter(10, 10, 10)).toBe(5); // single bid: no spread
  });
  it('weighted total uses all four factors and re-normalizes when one is unscored', () => {
    const full = weightedTotal({ price: 5, lead_time: 4, quality: 3, compliance: 2 }, DEFAULT_WEIGHTS);
    expect(full.total).toBeCloseTo(5 * 0.5 + 4 * 0.2 + 3 * 0.2 + 2 * 0.1);
    expect(full.scored).toHaveLength(4);
    // Missing quality/compliance: re-normalized over price + lead_time only.
    const partial = weightedTotal({ price: 5, lead_time: 4, quality: null, compliance: null }, DEFAULT_WEIGHTS);
    expect(partial.total).toBeCloseTo((5 * 0.5 + 4 * 0.2) / 0.7);
    expect(partial.scored).toEqual(['price', 'lead_time']);
  });
  it('scoreFactors keeps nulls for unscored factors (never silent 0)', () => {
    const s = scoreFactors(
      { bid_id: 'b1', vendor_id: 'v1', landed_total: 100, lead_time_days: null, quality: null, compliance: 4 },
      { min: 100, max: 200 },
      { min: 30, max: 60 },
    );
    expect(s.price).toBe(5);
    expect(s.lead_time).toBeNull();
    expect(s.quality).toBeNull();
    expect(s.compliance).toBe(4);
  });
});

describe('landed cost (T19 — price + tooling + samples)', () => {
  it('sums unit price x quantity plus tooling and samples', () => {
    expect(landedCostLine({ rfq_line_id: 'l1', quantity: 100, unit_price: 12.5, tooling_cost: 200, sample_cost: 40 })).toBe(1490);
    expect(landedCostLine({ rfq_line_id: 'l1', quantity: 10, unit_price: 5 })).toBe(50);
  });
});

describe('top-3 per PO row (T19)', () => {
  const ranked = [
    { bid_id: 'b1', vendor_id: 'v1', total: 4.8, landed_total: 1000 },
    { bid_id: 'b2', vendor_id: 'v2', total: 4.2, landed_total: 900 },
    { bid_id: 'b3', vendor_id: 'v3', total: 4.2, landed_total: 800 },
    { bid_id: 'b4', vendor_id: 'v4', total: 3.0, landed_total: 700 },
  ];
  it('shows at most 3 per line, ranked by total then lower landed cost', () => {
    const out = top3PerLine(ranked, { line1: ['b1', 'b2', 'b3', 'b4'] });
    expect(out.line1.map((r) => r.bid_id)).toEqual(['b1', 'b3', 'b2']); // b3 beats b2 on the tie
    expect(out.line1).toHaveLength(3);
  });
  it('shows fewer than 3 when fewer bids priced the line', () => {
    const out = top3PerLine(ranked, { line1: ['b4'] });
    expect(out.line1.map((r) => r.bid_id)).toEqual(['b4']);
  });
});
