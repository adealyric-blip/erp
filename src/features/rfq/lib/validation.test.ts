// T17 unit tests — RFQ lines, carve-out, PO draft, publish checklist, pins.
import { describe, expect, it } from 'vitest';
import {
  buildPoDraft,
  checkCarveOut,
  computePublishChecklist,
  estimatedRfqTotal,
  pinTechPackVersion,
  poDraftByteLength,
  poDraftFitsEmbed,
  publishChecklistMet,
  rfqStatusStepIndex,
  sizeBreakdownError,
  validateRfqLine,
  RFQ_LINE_CAP,
  type PublishChecklistInput,
} from './validation';

describe('size breakdown sums to quantity (T17)', () => {
  it('passes when the breakdown sums exactly', () => {
    expect(sizeBreakdownError({ techPackId: 'tp', quantity: 120, sizeBreakdown: { S: 40, M: 80 } })).toBeNull();
  });
  it('fails when the breakdown is short', () => {
    expect(sizeBreakdownError({ techPackId: 'tp', quantity: 120, sizeBreakdown: { S: 40, M: 70 } })).toMatch(/sums to 110/);
  });
  it('fails with no breakdown at all', () => {
    expect(sizeBreakdownError({ techPackId: 'tp', quantity: 10, sizeBreakdown: {} })).toMatch(/size breakdown/);
  });
});

describe('validateRfqLine — lines only from approved/released packs', () => {
  it('rejects a draft pack', () => {
    const errs = validateRfqLine({ techPackId: 'tp', techPackTitle: 'Boxy Tee', techPackStatus: 'draft', quantity: 50, sizeBreakdown: { M: 50 } });
    expect(errs.join(' ')).toMatch(/only come from approved or released/);
  });
  it('accepts an approved pack with a costed breakdown', () => {
    expect(validateRfqLine({ techPackId: 'tp', techPackStatus: 'approved', quantity: 50, sizeBreakdown: { M: 50 }, targetUnitCost: 12.5 })).toEqual([]);
  });
  it('rejects a negative estimated unit cost', () => {
    expect(validateRfqLine({ techPackId: 'tp', techPackStatus: 'released', quantity: 50, sizeBreakdown: { M: 50 }, targetUnitCost: -1 }).length).toBeGreaterThan(0);
  });
  it('estimated total is qty × unit cost', () => {
    expect(estimatedRfqTotal([{ techPackId: 'tp', quantity: 100, sizeBreakdown: { M: 100 }, targetUnitCost: 12.5 }])).toBe(1250);
  });
});

describe('RFQ2 carve-out — cap is 100 (T17)', () => {
  it('no banner at exactly the cap', () => {
    expect(checkCarveOut([100]).needsCarveOut).toBe(false);
  });
  it('banner when a line exceeds the cap', () => {
    const c = checkCarveOut([150]);
    expect(c.needsCarveOut).toBe(true);
    expect(c.overCapLines).toEqual([1]);
    expect(RFQ_LINE_CAP).toBe(100);
  });
  it('banner when the total exceeds the cap across lines', () => {
    expect(checkCarveOut([60, 60]).needsCarveOut).toBe(true);
    expect(checkCarveOut([60, 60]).totalQuantity).toBe(120);
  });
});

describe('PO draft — JSONB array inside the embed budget (T17)', () => {
  it('builds a JSONB array of PO rows', () => {
    const draft = buildPoDraft([{ id: 'line-1', techPackId: 'tp-1', quantity: 100, targetUnitCost: 12.5 }]);
    expect(draft).toEqual([{ rfq_line_id: 'line-1', tech_pack_id: 'tp-1', quantity: 100, unit_price: 12.5, line_total: 1250 }]);
    expect(poDraftFitsEmbed(draft)).toBe(true);
  });
  it('an oversized draft does not fit the embed', () => {
    const many = Array.from({ length: 400 }, (_, i) => ({ id: `line-${i}`, techPackId: `tp-${i}`, quantity: 100, targetUnitCost: 12.5 }));
    const draft = buildPoDraft(many);
    expect(poDraftByteLength(draft)).toBeGreaterThan(8 * 1024);
    expect(poDraftFitsEmbed(draft)).toBe(false);
  });
});

describe('computePublishChecklist — mirrors ds_publish_rfq (T17)', () => {
  const good: PublishChecklistInput = {
    status: 'draft',
    bidDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    ndaId: 'nda-1',
    lines: [{ techPackId: 'tp-1', techPackStatus: 'approved', hasPreview: true }],
    inviteCount: 2,
    pins: [pinTechPackVersion('tp-1', 3, 'a'.repeat(64))],
  };
  it('all met when every precondition holds', () => {
    const items = computePublishChecklist(good);
    expect(items.every((i) => i.met)).toBe(true);
    expect(publishChecklistMet(items)).toBe(true);
  });
  it('each unmet precondition shows its exact checklist item', () => {
    const cases: [Partial<PublishChecklistInput>, string][] = [
      [{ bidDeadline: new Date(Date.now() + 30 * 60 * 1000).toISOString() }, 'deadline'],
      [{ ndaId: null }, 'nda'],
      [{ lines: [] }, 'lines'],
      [{ lines: [{ techPackId: 'tp-1', techPackStatus: 'draft', hasPreview: false }] }, 'packs'],
      [{ inviteCount: 0 }, 'invites'],
      [{ pins: [] }, 'pins'],
      [{ status: 'published' }, 'draft'],
    ];
    for (const [patch, id] of cases) {
      const items = computePublishChecklist({ ...good, ...patch });
      expect(items.find((i) => i.id === id)?.met).toBe(false);
      expect(publishChecklistMet(items)).toBe(false);
    }
  });
  it('pins carry revision + snapshot hash', () => {
    const pin = pinTechPackVersion('tp-1', 3, 'b'.repeat(64));
    expect(pin.revision).toBe(3);
    expect(pin.snapshotSha256).toHaveLength(64);
  });
});

describe('rfqStatusStepIndex', () => {
  it('draft=0, published=1, closed=2, awarded=3; unknown=0', () => {
    expect(rfqStatusStepIndex('draft')).toBe(0);
    expect(rfqStatusStepIndex('published')).toBe(1);
    expect(rfqStatusStepIndex('closed')).toBe(2);
    expect(rfqStatusStepIndex('awarded')).toBe(3);
    expect(rfqStatusStepIndex('cancelled')).toBe(0);
  });
});
