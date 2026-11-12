// Wall-clock dates — T19 bid board rule, shared by T18/T20 surfaces.
//
// The bid board uses wall-clock Y-m-d ONLY (no timestamp PIVOT drift):
// deadlines and award dates are compared and displayed as calendar days.
// Every helper here returns or parses `YYYY-MM-DD` and nothing else; a
// timestamp that slips in is truncated to its UTC calendar day, never
// rendered with a time component.

/** `2026-11-12` — the wall-clock day of a Date, in UTC. */
export function toDayString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Truncate any ISO timestamp / date string to its `YYYY-MM-DD` day. */
export function toDay(value: string | null | undefined): string {
  if (!value) return '';
  return value.slice(0, 10);
}

/** True when the value is exactly a `YYYY-MM-DD` wall-clock day. */
export function isDayString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Day-only comparison: -1 / 0 / 1, ignoring any time component. */
export function compareDays(a: string, b: string): number {
  const da = toDay(a);
  const db = toDay(b);
  if (da < db) return -1;
  if (da > db) return 1;
  return 0;
}

/** True when wall-clock day `a` is strictly before day `b`. */
export function dayBefore(a: string, b: string): boolean {
  return compareDays(a, b) < 0;
}

/** True when the wall-clock day of `deadline` has passed (today is past it). */
export function dayPassed(deadline: string | null | undefined, today = toDayString(new Date())): boolean {
  if (!deadline) return false;
  return compareDays(deadline, today) < 0;
}
