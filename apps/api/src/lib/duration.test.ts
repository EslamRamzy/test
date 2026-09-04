import { describe, expect, it } from 'vitest';
import { parseDurationMs } from './duration.js';

describe('parseDurationMs', () => {
  it.each([
    ['15m', 15 * 60_000],
    ['7d', 7 * 86_400_000],
    ['30s', 30 * 1000],
    ['2h', 2 * 3_600_000],
    ['1d', 86_400_000],
    ['0s', 0],
  ])('parses "%s" as %i ms', (input, expected) => {
    expect(parseDurationMs(input)).toBe(expected);
  });

  it('trims surrounding whitespace', () => {
    expect(parseDurationMs('  15m  ')).toBe(15 * 60_000);
  });

  it.each(['', '15', 'm', '15 m', '15mm', '-5m', '15.5m', '15w', '15M'])(
    'rejects invalid input: %j',
    (input) => {
      expect(() => parseDurationMs(input)).toThrow(/Invalid duration string/);
    },
  );
});
