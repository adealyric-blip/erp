// T14 render station — unit tests (node-safe; the browser-only handlers
// are covered by the Playwright spec against the running app).
import { describe, expect, it } from 'vitest';
import { BROWSER_JOB_KINDS, outputTarget } from './jobs';
import { newSessionId } from './station';

describe('BROWSER_JOB_KINDS', () => {
  it('claims the four browser kinds and never virus_scan', () => {
    expect([...BROWSER_JOB_KINDS]).toEqual(['thumbnail', 'bg_remove', 'techpack_pdf', 'techpack_preview_pdf']);
    expect(BROWSER_JOB_KINDS).not.toContain('virus_scan');
  });
});

describe('outputTarget', () => {
  it('supplier previews go to supplier-previews as supplier_preview', () => {
    expect(outputTarget('techpack_preview_pdf')).toEqual({ bucket: 'supplier-previews', classification: 'supplier_preview' });
  });
  it('internal master PDF, thumbnails and bg_remove are internal in design-private', () => {
    expect(outputTarget('techpack_pdf')).toEqual({ bucket: 'design-private', classification: 'internal' });
    expect(outputTarget('thumbnail')).toEqual({ bucket: 'design-private', classification: 'internal' });
    expect(outputTarget('bg_remove')).toEqual({ bucket: 'design-private', classification: 'internal' });
  });
});

describe('newSessionId', () => {
  it('is crypto.randomUUID without dashes (ds__browser_tag format)', () => {
    expect(newSessionId()).toMatch(/^[0-9a-f]{32}$/);
    expect(newSessionId()).not.toBe(newSessionId());
  });
});
