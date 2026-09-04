import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateCsrfToken, verifyCsrfPair, verifyCsrfToken } from './csrf.js';

describe('generateCsrfToken / verifyCsrfToken', () => {
  it('produces a token that verifies', () => {
    const token = generateCsrfToken();
    expect(verifyCsrfToken(token)).toBe(true);
  });

  it('produces a different token on every call', () => {
    expect(generateCsrfToken()).not.toBe(generateCsrfToken());
  });

  it('rejects a token with a tampered signature', () => {
    const token = generateCsrfToken();
    const parts = token.split('.');
    const tampered = `${parts[0]}.${parts[1]}.${'a'.repeat(43)}`;
    expect(verifyCsrfToken(tampered)).toBe(false);
  });

  it('rejects a token with a tampered nonce (signature no longer matches)', () => {
    const token = generateCsrfToken();
    const parts = token.split('.');
    const tampered = `different-nonce-value.${parts[1]}.${parts[2]}`;
    expect(verifyCsrfToken(tampered)).toBe(false);
  });

  it('rejects malformed input', () => {
    expect(verifyCsrfToken('')).toBe(false);
    expect(verifyCsrfToken('only-one-part')).toBe(false);
    expect(verifyCsrfToken('two.parts')).toBe(false);
    expect(verifyCsrfToken('way.too.many.parts.here')).toBe(false);
  });

  it('rejects a non-numeric timestamp', () => {
    const token = generateCsrfToken();
    const parts = token.split('.');
    expect(verifyCsrfToken(`${parts[0]}.not-a-number.${parts[2]}`)).toBe(false);
  });

  describe('TTL expiry', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('rejects a token older than 24 hours', () => {
      const token = generateCsrfToken();
      vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 1);
      expect(verifyCsrfToken(token)).toBe(false);
    });

    it('accepts a token just under 24 hours old', () => {
      const token = generateCsrfToken();
      vi.advanceTimersByTime(24 * 60 * 60 * 1000 - 1000);
      expect(verifyCsrfToken(token)).toBe(true);
    });

    it('rejects a token whose timestamp is in the future', () => {
      vi.setSystemTime(new Date('2026-01-01T00:00:10.000Z'));
      const token = generateCsrfToken();

      // Move the clock backward relative to the token's own issuedAt — the
      // shape of "in the future" this token's own verifier can observe.
      vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
      expect(verifyCsrfToken(token)).toBe(false);
    });
  });
});

describe('verifyCsrfPair', () => {
  it('accepts matching, valid cookie and header values', () => {
    const token = generateCsrfToken();
    expect(verifyCsrfPair(token, token)).toBe(true);
  });

  it('rejects when cookie and header differ, even if both are independently valid', () => {
    const a = generateCsrfToken();
    const b = generateCsrfToken();
    expect(verifyCsrfPair(a, b)).toBe(false);
  });

  it('rejects when either half is missing', () => {
    const token = generateCsrfToken();
    expect(verifyCsrfPair(undefined, token)).toBe(false);
    expect(verifyCsrfPair(token, undefined)).toBe(false);
    expect(verifyCsrfPair(undefined, undefined)).toBe(false);
  });

  it('rejects a matching pair that is not validly signed', () => {
    const forged = 'nonce.1234567890.not-a-real-signature';
    expect(verifyCsrfPair(forged, forged)).toBe(false);
  });
});
