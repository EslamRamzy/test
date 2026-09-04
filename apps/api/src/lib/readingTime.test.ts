import { describe, expect, it } from 'vitest';
import { computeReadingTimeMinutes } from './readingTime.js';

describe('computeReadingTimeMinutes', () => {
  it('rounds up to at least 1 minute for very short content', () => {
    expect(computeReadingTimeMinutes('a few words only')).toBe(1);
  });

  it('computes 1 minute for exactly 200 words', () => {
    expect(computeReadingTimeMinutes('word '.repeat(200).trim())).toBe(1);
  });

  it('rounds up a partial minute rather than truncating', () => {
    // 201 words -> 1.005 minutes -> rounds up to 2, not down to 1.
    expect(computeReadingTimeMinutes('word '.repeat(201).trim())).toBe(2);
  });

  it('computes multiple minutes for longer content', () => {
    expect(computeReadingTimeMinutes('word '.repeat(1000).trim())).toBe(5);
  });

  it('collapses runs of whitespace and newlines when counting words', () => {
    const content = 'first  second\n\nthird\tfourth';
    expect(computeReadingTimeMinutes(content)).toBe(1);
  });

  it('treats an empty or whitespace-only string as 1 minute, not 0', () => {
    expect(computeReadingTimeMinutes('')).toBe(1);
    expect(computeReadingTimeMinutes('   \n\t  ')).toBe(1);
  });
});
