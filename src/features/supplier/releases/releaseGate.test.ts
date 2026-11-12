import { describe, expect, it } from 'vitest';
import { canReleaseAny, isReleasable } from './releaseGate';
import { watermarkSvg } from './Watermark';
import { BidPayload } from '@/lib/db/schemas';

// T20 release gate: at least one APPROVED tech pack WITH an attached PDF.
describe('release gate (T20)', () => {
  it('approved + PDF is releasable', () => {
    expect(isReleasable('approved', '00000000-0000-0000-0000-000000000001')).toBe(true);
  });
  it('approved without a PDF is NOT releasable', () => {
    expect(isReleasable('approved', null)).toBe(false);
    expect(isReleasable('approved', '')).toBe(false);
  });
  it('a non-approved pack is NOT releasable even with a PDF', () => {
    expect(isReleasable('in_review', '00000000-0000-0000-0000-000000000001')).toBe(false);
    expect(isReleasable('draft', '00000000-0000-0000-0000-000000000001')).toBe(false);
    expect(isReleasable('released', '00000000-0000-0000-0000-000000000001')).toBe(false);
    expect(isReleasable(null, '00000000-0000-0000-0000-000000000001')).toBe(false);
  });
  it('canReleaseAny needs at least one passing line', () => {
    expect(canReleaseAny([])).toBe(false);
    expect(
      canReleaseAny([
        { status: 'in_review', pdf_asset_id: '00000000-0000-0000-0000-000000000001' },
        { status: 'approved', pdf_asset_id: null },
      ]),
    ).toBe(false);
    expect(
      canReleaseAny([
        { status: 'approved', pdf_asset_id: null },
        { status: 'approved', pdf_asset_id: '00000000-0000-0000-0000-000000000001' },
      ]),
    ).toBe(true);
  });
});

// Watermark SVG the asset proxy burns into raster previews.
describe('watermarkSvg', () => {
  it('embeds the viewer text and tiles it diagonally', () => {
    const svg = watermarkSvg('Vendor · user@example.com · 2026-11-12', 800, 600);
    expect(svg).toContain('Vendor · user@example.com · 2026-11-12');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('rotate(-24');
    expect((svg.match(/<text/g) ?? []).length).toBeGreaterThan(1);
  });
  it('escapes markup in the watermark text', () => {
    const svg = watermarkSvg('<script>alert(1)</script>', 100, 100);
    expect(svg).not.toContain('<script>alert');
    expect(svg).toContain('&lt;script&gt;');
  });
});

// BidPayload (plan/04) — the shape supplier_save_bid accepts.
describe('BidPayload', () => {
  const line = { rfq_line_id: '123e4567-e89b-42d3-a456-426614174000', unit_price: 12.5 };
  it('accepts a minimal valid bid', () => {
    expect(BidPayload.safeParse({ lines: [line] }).success).toBe(true);
  });
  it('accepts full bid fields with a date-only valid_until (wall-clock Y-m-d)', () => {
    expect(
      BidPayload.safeParse({
        valid_until: '2027-01-31',
        lead_time_days: 60,
        payment_terms: '30% deposit',
        incoterm: 'FOB',
        notes: 'ok',
        lines: [{ ...line, moq: 300, sample_cost: 40, tooling_cost: 0 }],
      }).success,
    ).toBe(true);
  });
  it('rejects a timestamp valid_until, a negative price and a bad incoterm', () => {
    expect(BidPayload.safeParse({ valid_until: '2027-01-31T00:00:00Z', lines: [line] }).success).toBe(false);
    expect(BidPayload.safeParse({ lines: [{ ...line, unit_price: -1 }] }).success).toBe(false);
    expect(BidPayload.safeParse({ incoterm: 'XXX', lines: [line] }).success).toBe(false);
    expect(BidPayload.safeParse({ lines: [{ ...line, rfq_line_id: 'not-a-uuid' }] }).success).toBe(false);
  });
});
