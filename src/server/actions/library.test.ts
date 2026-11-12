// T10: zod validation on the library schemas (the Accept example is the
// size-range base-size rule). Imports the real schemas from the server
// action module — no copies.
import { describe, expect, it } from 'vitest';
import { licenseSchema, materialSchema, seasonSchema, sizeRangeSchema } from './library';

describe('library schemas (T10 zod validation)', () => {
  it('rejects a size range whose base size is not in sizes, on base_size', () => {
    const res = sizeRangeSchema.safeParse({
      name: 'Unisex XS-XL',
      sizes: ['XS', 'S', 'M', 'L', 'XL'],
      base_size: 'XXL',
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.some((i) => i.path.join('.') === 'base_size')).toBe(true);
      expect(res.error.issues.map((i) => i.message)).toContain(
        'Base size must be one of the sizes in the range',
      );
    }
  });

  it('accepts a size range whose base size is in sizes', () => {
    expect(
      sizeRangeSchema.safeParse({
        name: 'Unisex XS-XL',
        sizes: ['XS', 'S', 'M', 'L', 'XL'],
        base_size: 'M',
      }).success,
    ).toBe(true);
  });

  it('rejects a season whose end date is before its start date, on ends_on', () => {
    const res = seasonSchema.safeParse({
      code: 'SS27',
      name: 'Spring Summer 27',
      starts_on: '2027-03-01',
      ends_on: '2027-01-01',
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.some((i) => i.path.join('.') === 'ends_on')).toBe(true);
    }
  });

  it('rejects a material with an unknown kind and a vendor-restricted license with no vendor', () => {
    expect(materialSchema.safeParse({ kind: 'unobtainium', code: 'X', name: 'X' }).success).toBe(
      false,
    );
    const res = licenseSchema.safeParse({
      source: 'printful',
      license_type: 'vendor_restricted',
      license_url: 'https://example.com/license',
      allow_supplier_view: false,
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.some((i) => i.path.join('.') === 'restricted_to_vendor_id')).toBe(
        true,
      );
    }
  });
});
