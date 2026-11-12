// T09 storage unit tests: MIME sniff, path conventions, migration selection.
import { describe, expect, it } from 'vitest';
import {
  DESIGN_PRIVATE_BUCKET,
  designVersionPath,
  libraryFlatPath,
  pathTenantId,
  sanitizeFileName,
} from './paths';
import { MAX_UPLOAD_BYTES, UPLOAD_MIME_ALLOWLIST, sniffMime } from './sniff';
import { planMigration, privatePathFor, shouldMigrateToPrivate } from './migrate';
import type { LegacyAsset } from './migrate';

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>');
const exe = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0, 0, 0]);

describe('storage sniff', () => {
  it('sniffs PNG, JPEG, PDF and SVG from magic bytes', () => {
    expect(sniffMime(png)).toEqual({ mime: 'image/png', ext: 'png' });
    expect(sniffMime(jpeg)).toEqual({ mime: 'image/jpeg', ext: 'jpg' });
    expect(sniffMime(pdf)).toEqual({ mime: 'application/pdf', ext: 'pdf' });
    expect(sniffMime(svg)).toEqual({ mime: 'image/svg+xml', ext: 'svg' });
  });

  it('rejects unrecognised bytes and non-allowlisted types', () => {
    expect(sniffMime(exe)).toBeNull();
    expect(sniffMime(new Uint8Array([1, 2, 3]))).toBeNull();
    expect(UPLOAD_MIME_ALLOWLIST.has('image/png')).toBe(true);
    expect(UPLOAD_MIME_ALLOWLIST.has('application/x-msdownload')).toBe(false);
    expect(MAX_UPLOAD_BYTES).toBe(100 * 1024 * 1024);
  });
});

describe('storage paths', () => {
  it('builds the plan/02 design path and flat path', () => {
    const t = '11111111-1111-4111-8111-111111111111';
    expect(designVersionPath(t, 'd1', 2, 'front.png')).toBe(`${t}/designs/d1/2/front.png`);
    expect(libraryFlatPath(t, 'classic-tee', 'front')).toBe(`${t}/library/flats/classic-tee/front.svg`);
    expect(pathTenantId(`${t}/designs/d1/2/front.png`)).toBe(t);
    expect(pathTenantId('not-a-uuid/x.png')).toBeNull();
    expect(sanitizeFileName('../../etc/passwd')).toBe('etc_passwd');
  });
});

describe('migration selection', () => {
  const base: LegacyAsset = {
    id: 'a1',
    tenant_id: '11111111-1111-4111-8111-111111111111',
    design_id: 'd1',
    kind: 'mockup',
    bucket: 'design-assets',
    storage_path: 'old/master.png',
    classification: 'internal',
  };
  it('migrates design-linked internal assets out of the legacy bucket', () => {
    expect(shouldMigrateToPrivate(base)).toBe(true);
    expect(privatePathFor(base)).toBe('11111111-1111-4111-8111-111111111111/designs/d1/1/master.png');
  });
  it('migrates sensitive kinds even without a design link', () => {
    expect(shouldMigrateToPrivate({ ...base, design_id: null, kind: 'flat_sketch' })).toBe(true);
    expect(privatePathFor({ ...base, design_id: null, kind: 'flat_sketch' })).toBe(
      '11111111-1111-4111-8111-111111111111/library/flats/migrated/master.png',
    );
  });
  it('leaves supplier-facing and already-private assets alone', () => {
    expect(shouldMigrateToPrivate({ ...base, classification: 'supplier_preview' })).toBe(false);
    expect(shouldMigrateToPrivate({ ...base, bucket: DESIGN_PRIVATE_BUCKET })).toBe(false);
    expect(shouldMigrateToPrivate({ ...base, design_id: null, kind: 'avatar' })).toBe(false);
    expect(planMigration([base, { ...base, id: 'a2', classification: 'supplier_preview' }])).toHaveLength(1);
  });
});
