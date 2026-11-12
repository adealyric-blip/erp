// Tech pack editor — validation unit tests (T13 accept: grid rejects
// sizes outside the range via the DB error map; grade rule; UPC; fibre).
import { describe, expect, it } from 'vitest';
import { barcodeValid, fibreTotal, fibreValid, gradeValues, mapDbErrorToCell, sizeRatioError } from './validation';

describe('barcodeValid (UPC/EAN check digit)', () => {
  it('accepts a valid UPC-A and rejects a bad check digit', () => {
    expect(barcodeValid('upc_a', '036000291452')).toBe(true);
    expect(barcodeValid('upc_a', '036000291453')).toBe(false);
  });
  it('accepts a valid EAN-13 and rejects a bad one', () => {
    expect(barcodeValid('ean_13', '4006381333931')).toBe(true);
    expect(barcodeValid('ean_13', '4006381333932')).toBe(false);
  });
  it('passes through nulls and free-text barcode types', () => {
    expect(barcodeValid('upc_a', null)).toBe(true);
    expect(barcodeValid('code_128', 'ABC-123')).toBe(true);
  });
});

describe('fibreValid', () => {
  it('requires exactly 100', () => {
    expect(fibreTotal([{ fibre: 'cotton', pct: 60 }, { fibre: 'polyester', pct: 40 }])).toBe(100);
    expect(fibreValid([{ fibre: 'cotton', pct: 60 }, { fibre: 'polyester', pct: 40 }])).toBe(true);
    expect(fibreValid([{ fibre: 'cotton', pct: 60 }, { fibre: 'polyester', pct: 30 }])).toBe(false);
    expect(fibreValid(null)).toBe(true);
  });
});

describe('gradeValues', () => {
  it('grades base + increment per size step from the base size', () => {
    expect(gradeValues(68, 2, ['XS', 'S', 'M', 'L', 'XL'], 'M')).toEqual({
      XS: 64, S: 66, M: 68, L: 70, XL: 72,
    });
  });
});

describe('sizeRatioError', () => {
  it('rejects unknown sizes and wrong sums', () => {
    expect(sizeRatioError({ S: 4, M: 4, L: 4 }, ['XS', 'S', 'M', 'L', 'XL'], 12)).toBe(null);
    expect(sizeRatioError({ XXXL: 12 }, ['XS', 'S', 'M', 'L', 'XL'], 12)).toMatch(/not in the size range/);
    expect(sizeRatioError({ S: 2, M: 2, L: 2 }, ['XS', 'S', 'M', 'L', 'XL'], 12)).toMatch(/sums to 6/);
  });
});

describe('mapDbErrorToCell', () => {
  it('maps the size-range DB error to the offending cell', () => {
    const r = mapDbErrorToCell('size XXXL is not in the tech pack size range {XS,S,M,L,XL}');
    expect(r.cell).toBe('XXXL');
  });
  it('maps the approved-lock error to a lock message', () => {
    const r = mapDbErrorToCell('tech pack is approved and cannot be edited; create a new revision');
    expect(r.cell).toBe(null);
    expect(r.message).toMatch(/locked/);
  });
});
