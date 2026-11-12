import { describe, expect, it } from 'vitest';
import { compareDays, dayBefore, dayPassed, isDayString, toDay, toDayString } from './dates';

// T19 accept: the bid board uses wall-clock Y-m-d only — no timestamp
// PIVOT drift. These tests pin that: no helper ever emits a time component.
describe('wall-clock dates (Y-m-d only)', () => {
  it('toDayString emits YYYY-MM-DD with no time component', () => {
    const out = toDayString(new Date('2026-11-12T23:59:59.999Z'));
    expect(out).toBe('2026-11-12');
    expect(isDayString(out)).toBe(true);
  });

  it('toDay truncates a timestamp to its calendar day', () => {
    expect(toDay('2026-11-12T04:30:00+02:00')).toBe('2026-11-12');
    expect(toDay('2026-11-12')).toBe('2026-11-12');
    expect(toDay(null)).toBe('');
    expect(toDay(undefined)).toBe('');
  });

  it('isDayString rejects anything with a time component', () => {
    expect(isDayString('2026-11-12')).toBe(true);
    expect(isDayString('2026-11-12T00:00:00Z')).toBe(false);
    expect(isDayString('12 Nov 2026')).toBe(false);
    expect(isDayString('')).toBe(false);
  });

  it('compareDays ignores time components', () => {
    expect(compareDays('2026-11-12T23:59:59Z', '2026-11-12T00:00:01Z')).toBe(0);
    expect(compareDays('2026-11-11', '2026-11-12')).toBe(-1);
    expect(compareDays('2026-11-13', '2026-11-12')).toBe(1);
  });

  it('dayBefore / dayPassed work on calendar days', () => {
    expect(dayBefore('2026-11-11', '2026-11-12')).toBe(true);
    expect(dayBefore('2026-11-12', '2026-11-12')).toBe(false);
    expect(dayPassed('2026-11-11', '2026-11-12')).toBe(true);
    expect(dayPassed('2026-11-12', '2026-11-12')).toBe(false);
    expect(dayPassed(null)).toBe(false);
  });
});
