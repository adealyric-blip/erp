// T15 — "New revision" availability (mirrors the ds_create_tech_pack guard:
// the latest revision must not still be draft/in_review).
import { describe, expect, it } from 'vitest';
import { newRevisionAvailability } from './RevisionsClient';

describe('newRevisionAvailability', () => {
  it('blocks a new revision while the pack is still draft or in review', () => {
    for (const status of ['draft', 'in_review'] as const) {
      const r = newRevisionAvailability(status);
      expect(r.enabled).toBe(false);
      expect(r.reason).toContain('finish or archive it first');
    }
  });

  it('allows a new revision once the pack is approved, released, superseded or archived', () => {
    for (const status of ['approved', 'released', 'superseded', 'archived'] as const) {
      expect(newRevisionAvailability(status).enabled).toBe(true);
    }
  });
});
