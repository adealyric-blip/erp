// Tech pack editor — client validation (T13/T13b). Pure functions, mirrored
// by the S615 DB guards (fibre sum, UPC check digit, size ratio, grade
// rule); the DB is the final authority, these give immediate feedback.
import type { TechPackSnapshot } from '@/lib/techpack-render/types';

/** UPC-A (12 digits) / EAN-13 (13 digits) check digit (mirrors ds__barcode_valid). */
export function barcodeValid(type: string | null | undefined, value: string | null | undefined): boolean {
  if (!value || !type) return true;
  if (type !== 'upc_a' && type !== 'ean_13') return true;
  const len = type === 'upc_a' ? 12 : 13;
  if (!new RegExp(`^[0-9]{${len}}$`).test(value)) return false;
  let total = 0;
  for (let i = 0; i < len - 1; i++) {
    const d = Number(value[i]);
    total += d * ((len - (i + 1)) % 2 === 1 ? 3 : 1);
  }
  return (10 - (total % 10)) % 10 === Number(value[len - 1]);
}

/** Fibre content [{fibre, pct}] must total 100 when present (S615). */
export function fibreTotal(fibreContent: { fibre: string; pct: number }[] | null | undefined): number | null {
  if (!fibreContent || fibreContent.length === 0) return null;
  return fibreContent.reduce((n, f) => n + (Number(f.pct) || 0), 0);
}

export function fibreValid(fibreContent: { fibre: string; pct: number }[] | null | undefined): boolean {
  const total = fibreTotal(fibreContent);
  return total === null || total === 100;
}

/**
 * Grade rule (T13): base value + increment per size step away from the
 * base size. sizes are ordered; steps = index distance from base index.
 */
export function gradeValues(
  baseValue: number,
  increment: number,
  sizes: string[],
  baseSize: string,
): Record<string, number> {
  const baseIdx = sizes.indexOf(baseSize);
  const out: Record<string, number> = {};
  sizes.forEach((s, i) => {
    out[s] = baseValue + increment * (baseIdx < 0 ? 0 : i - baseIdx);
  });
  return out;
}

/** Carton size ratio: sizes must exist in the range and sum to units_per_carton. */
export function sizeRatioError(
  ratio: Record<string, number> | null | undefined,
  sizes: string[],
  unitsPerCarton: number | null | undefined,
): string | null {
  if (!ratio || Object.keys(ratio).length === 0) return null;
  for (const size of Object.keys(ratio)) {
    if (!sizes.includes(size)) return `Size ${size} is not in the size range`;
  }
  const sum = Object.values(ratio).reduce((n, v) => n + (Number(v) || 0), 0);
  if (unitsPerCarton !== null && unitsPerCarton !== undefined && sum !== unitsPerCarton) {
    return `Size ratio sums to ${sum} but the carton holds ${unitsPerCarton}`;
  }
  return null;
}

/**
 * Map a DB error to a cell error (T13 accept): a measurement insert for a
 * size outside the range comes back from ds__measurement_size_guard as
 * "size XXXL is not in the tech pack size range ..." — show it on the cell.
 */
export function mapDbErrorToCell(message: string): { cell: string | null; message: string } {
  const sizeMatch = message.match(/size (\S+) is not in the tech pack size range/i);
  if (sizeMatch) return { cell: sizeMatch[1], message };
  if (/tech pack is (approved|released|superseded)/i.test(message)) {
    return { cell: null, message: 'This tech pack is locked — create a new revision to edit it.' };
  }
  return { cell: null, message };
}

/** Snapshot helpers for the editor shell. */
export function snapshotSizes(snapshot: TechPackSnapshot): string[] {
  const header = (snapshot.header ?? {}) as Record<string, unknown>;
  if (Array.isArray(header.size_range)) return header.size_range as string[];
  const sr = (snapshot.size_range ?? {}) as Record<string, unknown>;
  if (Array.isArray(sr.sizes)) return sr.sizes as string[];
  return [];
}

export function snapshotStatus(snapshot: TechPackSnapshot): string {
  return String((snapshot.tech_pack as Record<string, unknown>)?.status ?? 'draft');
}
