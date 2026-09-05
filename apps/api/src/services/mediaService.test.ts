import { describe, expect, it } from 'vitest';
import { MAX_TOTAL_STORAGE_BYTES, wouldExceedStorageCap } from './mediaService.js';

/**
 * `wouldExceedStorageCap` in isolation — actually driving the real 5 GiB
 * cap end-to-end (`adminMedia.test.ts`) would mean writing several
 * gigabytes of fixture data in CI for no extra confidence: the arithmetic
 * itself is what needs proving, and it is cheap to prove directly.
 */
describe('wouldExceedStorageCap', () => {
  it('is false when comfortably under the cap', () => {
    expect(wouldExceedStorageCap(0, 1000, 10_000)).toBe(false);
  });

  it('is false exactly at the cap (boundary is inclusive of the limit)', () => {
    expect(wouldExceedStorageCap(9_000, 1_000, 10_000)).toBe(false);
  });

  it('is true one byte over the cap', () => {
    expect(wouldExceedStorageCap(9_000, 1_001, 10_000)).toBe(true);
  });

  it('is true when already over the cap before the new upload', () => {
    expect(wouldExceedStorageCap(10_001, 1, 10_000)).toBe(true);
  });

  it('defaults to the real MAX_TOTAL_STORAGE_BYTES when no cap is given', () => {
    expect(wouldExceedStorageCap(0, 1024)).toBe(false);
    expect(wouldExceedStorageCap(MAX_TOTAL_STORAGE_BYTES, 1)).toBe(true);
  });
});
