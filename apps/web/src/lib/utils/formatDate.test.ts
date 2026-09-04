import { describe, expect, it } from 'vitest';
import { formatDate } from './formatDate';

describe('formatDate', () => {
  it('formats an ISO date string', () => {
    expect(formatDate('2026-09-04T10:00:00.000Z')).toBe('Sep 4, 2026');
  });

  it('uses UTC regardless of the runtime timezone (server/client hydration must match)', () => {
    // A time close to local-midnight in many timezones — the point is that
    // this must render the SAME calendar date everywhere this test runs,
    // not shift by a day depending on the machine's local timezone.
    expect(formatDate('2026-01-01T00:30:00.000Z')).toBe('Jan 1, 2026');
    expect(formatDate('2026-12-31T23:30:00.000Z')).toBe('Dec 31, 2026');
  });
});
