// T16 unit tests — supplier validation, duplicates, zones, filtering.
import { describe, expect, it } from 'vitest';
import {
  canUnbanSupplier,
  filterSuppliers,
  findDuplicateWarnings,
  isApprovedSupplier,
  isIsoCountryCode,
  metadataWithZones,
  validateSupplierForm,
  zonesFromMetadata,
  type SupplierFormInput,
} from './validation';

const base: SupplierFormInput = {
  legalName: 'Guangzhou Cut & Sew Ltd',
  email: 'ops@gzcutsew.example',
  phone: '+86 20 1234 5678',
  whatsapp: null,
  website: 'https://gzcutsew.example',
  zones: ['CN'],
  capabilities: [{ category: 'cut&sew', techniques: ['overlock'], certifications: [] }],
};

describe('validateSupplierForm — contact channel required (T16)', () => {
  it('passes with email alone', () => {
    expect(validateSupplierForm({ ...base, phone: null, whatsapp: null })).toEqual({});
  });
  it('passes with WhatsApp alone', () => {
    expect(validateSupplierForm({ ...base, email: null, phone: null, whatsapp: '+86 138 0000 0000' })).toEqual({});
  });
  it('fails with no contact channel at all', () => {
    const errs = validateSupplierForm({ ...base, email: null, phone: null, whatsapp: null });
    expect(errs.contact).toMatch(/at least one contact channel/i);
  });
  it('fails on a bad email and a bad zone', () => {
    const errs = validateSupplierForm({ ...base, email: 'not-an-email', zones: ['XX', 'CN'] });
    expect(errs.email).toMatch(/valid email/);
    expect(errs.zones).toMatch(/ISO-3166/);
  });
  it('fails on a website without a scheme', () => {
    expect(validateSupplierForm({ ...base, website: 'gzcutsew.example' }).website).toMatch(/http/);
  });
  it('fails when a capability has no category', () => {
    expect(
      validateSupplierForm({ ...base, capabilities: [{ category: '', techniques: [], certifications: [] }] }).capabilities,
    ).toMatch(/category/);
  });
});

describe('findDuplicateWarnings — duplicate email/website warns (T16)', () => {
  const existing = [
    { id: 'v-1', legalName: 'Porto Knit Mill', email: 'ops@portoknit.example', website: 'https://portoknit.example' },
  ];
  it('warns on a duplicate email (case-insensitive)', () => {
    const w = findDuplicateWarnings(existing, { ...base, email: 'OPS@portoknit.example', website: null });
    expect(w).toHaveLength(1);
    expect(w[0]).toMatch(/already used by “Porto Knit Mill”/);
  });
  it('warns on a duplicate website', () => {
    const w = findDuplicateWarnings(existing, { ...base, email: 'new@example.com', website: 'https://portoknit.example/' });
    expect(w).toHaveLength(1);
    expect(w[0]).toMatch(/Website/);
  });
  it('does not warn about the row being edited', () => {
    expect(findDuplicateWarnings(existing, { ...base, email: 'ops@portoknit.example' }, 'v-1')).toEqual([]);
  });
  it('is silent when nothing collides', () => {
    expect(findDuplicateWarnings(existing, base)).toEqual([]);
  });
});

describe('zones — ISO-3166 in metadata (T16)', () => {
  it('accepts real codes and rejects XX', () => {
    expect(isIsoCountryCode('cn')).toBe(true);
    expect(isIsoCountryCode('XX')).toBe(false);
  });
  it('reads zones + whatsapp back out of metadata', () => {
    expect(zonesFromMetadata({ zones: ['cn', 'PT'], whatsapp: '+351 912 000 000' })).toEqual(['CN', 'PT']);
    expect(zonesFromMetadata(null)).toEqual([]);
  });
  it('writes zones upper-cased and deduped', () => {
    expect(metadataWithZones({ keep: 1 }, ['cn', 'CN', 'PT'], '+351 1')).toEqual({ keep: 1, zones: ['CN', 'PT'], whatsapp: '+351 1' });
  });
});

describe('filterSuppliers — zone/capability (T17 selection)', () => {
  const rows = [
    { id: 'a', legalName: 'Guangzhou', email: null, website: null, isActive: true, zones: ['CN'], capabilities: [{ category: 'cut&sew', techniques: [] }], memberStatus: 'active' },
    { id: 'b', legalName: 'Porto', email: null, website: null, isActive: true, zones: ['PT'], capabilities: [{ category: 'knitwear', techniques: [] }], memberStatus: 'active' },
    { id: 'c', legalName: 'Unzoned', email: null, website: null, isActive: true, zones: [], capabilities: [{ category: 'cut&sew', techniques: [] }], memberStatus: 'active' },
  ];
  it('zone filter matches only declared zones; unzoned never matches', () => {
    expect(filterSuppliers(rows, { zone: 'CN' }).map((r) => r.id)).toEqual(['a']);
  });
  it('capability filter narrows within the zone', () => {
    expect(filterSuppliers(rows, { zone: 'CN', capability: 'knitwear' })).toEqual([]);
    expect(filterSuppliers(rows, { capability: 'cut&sew' }).map((r) => r.id)).toEqual(['a', 'c']);
  });
});

describe('gates', () => {
  it('approved = active and not revoked/suspended', () => {
    expect(isApprovedSupplier({ isActive: true, memberStatus: 'active' })).toBe(true);
    expect(isApprovedSupplier({ isActive: false, memberStatus: 'active' })).toBe(false);
    expect(isApprovedSupplier({ isActive: true, memberStatus: 'revoked' })).toBe(false);
    expect(isApprovedSupplier({ isActive: true, memberStatus: 'suspended' })).toBe(false);
  });
  it('unban is owner-only', () => {
    expect(canUnbanSupplier('owner')).toBe(true);
    expect(canUnbanSupplier('admin')).toBe(false);
    expect(canUnbanSupplier(null)).toBe(false);
  });
});
