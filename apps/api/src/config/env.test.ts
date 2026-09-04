import { describe, expect, it } from 'vitest';
import { envSchema, isPlaceholderSecret } from './env.js';

const VALID_SECRET = 'a-genuinely-random-secret-value-not-a-placeholder-at-all';

function baseEnv(overrides: Record<string, string> = {}) {
  return {
    JWT_SECRET: VALID_SECRET,
    CSRF_SECRET: VALID_SECRET,
    IP_HASH_SALT: VALID_SECRET,
    ...overrides,
  };
}

describe('envSchema', () => {
  it('accepts a minimal valid configuration, applying defaults', () => {
    const result = envSchema.safeParse(baseEnv());

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.NODE_ENV).toBe('development');
      expect(result.data.PORT).toBe(4000);
      expect(result.data.JWT_ACCESS_TTL).toBe('15m');
      expect(result.data.JWT_REFRESH_TTL).toBe('7d');
    }
  });

  it('rejects a missing JWT_SECRET', () => {
    const result = envSchema.safeParse({ CSRF_SECRET: VALID_SECRET, IP_HASH_SALT: VALID_SECRET });
    expect(result.success).toBe(false);
  });

  it('rejects a missing CSRF_SECRET', () => {
    const result = envSchema.safeParse({ JWT_SECRET: VALID_SECRET, IP_HASH_SALT: VALID_SECRET });
    expect(result.success).toBe(false);
  });

  it('rejects a missing IP_HASH_SALT', () => {
    const result = envSchema.safeParse({ JWT_SECRET: VALID_SECRET, CSRF_SECRET: VALID_SECRET });
    expect(result.success).toBe(false);
  });

  it('rejects a JWT_SECRET under 32 characters', () => {
    const result = envSchema.safeParse(baseEnv({ JWT_SECRET: 'too-short' }));
    expect(result.success).toBe(false);
  });

  it('accepts a JWT_SECRET of exactly 32 characters', () => {
    const result = envSchema.safeParse(baseEnv({ JWT_SECRET: 'a'.repeat(32) }));
    expect(result.success).toBe(true);
  });

  it('rejects a placeholder secret in production', () => {
    const result = envSchema.safeParse(
      baseEnv({ NODE_ENV: 'production', JWT_SECRET: 'changeme'.repeat(4) }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects a placeholder IP_HASH_SALT in production', () => {
    const result = envSchema.safeParse(
      baseEnv({ NODE_ENV: 'production', IP_HASH_SALT: 'placeholder'.repeat(3) }),
    );
    expect(result.success).toBe(false);
  });

  it('accepts the SAME placeholder-shaped value outside production', () => {
    // The placeholder check is production-only by design — development and
    // test environments are allowed to use an obviously-fake secret (the
    // whole test suite does exactly this via vitest.config.ts).
    const result = envSchema.safeParse(
      baseEnv({ NODE_ENV: 'development', JWT_SECRET: 'changeme'.repeat(4) }),
    );
    expect(result.success).toBe(true);
  });

  it('rejects an empty CORS_ORIGIN', () => {
    const result = envSchema.safeParse(baseEnv({ CORS_ORIGIN: '' }));
    expect(result.success).toBe(false);
  });

  it('splits and trims a comma-separated CORS_ORIGIN', () => {
    const result = envSchema.safeParse(
      baseEnv({ CORS_ORIGIN: 'https://a.dev, https://b.dev ,https://c.dev' }),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.CORS_ORIGIN).toEqual(['https://a.dev', 'https://b.dev', 'https://c.dev']);
    }
  });
});

describe('isPlaceholderSecret', () => {
  it.each([
    'changeme',
    'CHANGEME',
    'changemechangemechangeme',
    'secret'.repeat(6),
    'placeholder-placeholder',
    'your-secret-here-your-secret-here',
  ])('flags %s as a placeholder', (value) => {
    expect(isPlaceholderSecret(value)).toBe(true);
  });

  it.each([
    'a-genuinely-random-secret-value-not-a-placeholder-at-all',
    'k3x9zQ2vL8mR5tY7wA1bC4dE6fG0hJ',
    '',
  ])('does not flag a real-looking secret: %s', (value) => {
    expect(isPlaceholderSecret(value)).toBe(false);
  });
});
