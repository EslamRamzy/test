import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hashIp } from './hashIp.js';

describe('hashIp', () => {
  it('is deterministic for the same inputs on the same day', () => {
    expect(hashIp('1.2.3.4', 'Mozilla/5.0')).toBe(hashIp('1.2.3.4', 'Mozilla/5.0'));
  });

  it('produces a 64-character hex digest (sha256)', () => {
    expect(hashIp('1.2.3.4', 'Mozilla/5.0')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('differs for different IPs', () => {
    expect(hashIp('1.2.3.4', 'Mozilla/5.0')).not.toBe(hashIp('5.6.7.8', 'Mozilla/5.0'));
  });

  it('differs for different user agents', () => {
    expect(hashIp('1.2.3.4', 'Mozilla/5.0')).not.toBe(hashIp('1.2.3.4', 'curl/8.0'));
  });

  it('treats an undefined user agent the same as an empty string', () => {
    expect(() => hashIp('1.2.3.4', undefined)).not.toThrow();
    expect(hashIp('1.2.3.4', undefined)).toBe(hashIp('1.2.3.4', ''));
  });

  describe('daily salt rotation', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('produces a different hash on a different UTC calendar day', () => {
      vi.setSystemTime(new Date('2026-01-01T23:59:59.000Z'));
      const day1 = hashIp('1.2.3.4', 'Mozilla/5.0');

      vi.setSystemTime(new Date('2026-01-02T00:00:01.000Z'));
      const day2 = hashIp('1.2.3.4', 'Mozilla/5.0');

      expect(day1).not.toBe(day2);
    });

    it('produces the same hash at two different times on the same UTC day', () => {
      vi.setSystemTime(new Date('2026-01-01T00:00:01.000Z'));
      const morning = hashIp('1.2.3.4', 'Mozilla/5.0');

      vi.setSystemTime(new Date('2026-01-01T23:59:59.000Z'));
      const night = hashIp('1.2.3.4', 'Mozilla/5.0');

      expect(morning).toBe(night);
    });
  });
});
