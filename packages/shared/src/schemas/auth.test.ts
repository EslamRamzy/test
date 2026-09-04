import { describe, expect, it } from 'vitest';
import { changePasswordSchema, loginSchema, newPasswordSchema } from './auth.js';

describe('newPasswordSchema', () => {
  it('accepts a password of 12+ characters with no composition rules', () => {
    // No uppercase, no digit, no symbol — the policy deliberately has none.
    // (Not "correct horse battery staple" — that famous XKCD example is
    // common enough in practice to be deliberately on the blocklist itself,
    // exercised separately below.)
    expect(newPasswordSchema.safeParse('a quiet afternoon by the sea').success).toBe(true);
  });

  it('rejects the well-known "correct horse battery staple" passphrase, spaces and all', () => {
    expect(newPasswordSchema.safeParse('correct horse battery staple').success).toBe(false);
  });

  it.each(['short', 'eleven-char', '1234567890a'.slice(0, 11)])(
    'rejects a password under 12 characters: %s',
    (password) => {
      expect(newPasswordSchema.safeParse(password).success).toBe(false);
    },
  );

  it('rejects a password over 128 characters', () => {
    expect(newPasswordSchema.safeParse('a'.repeat(129)).success).toBe(false);
  });

  it('accepts exactly 128 characters', () => {
    expect(newPasswordSchema.safeParse('a'.repeat(128)).success).toBe(true);
  });

  it.each(['password1234', 'PASSWORD1234', 'Password1234', 'administrator'])(
    'rejects a common password regardless of case: %s',
    (password) => {
      expect(newPasswordSchema.safeParse(password).success).toBe(false);
    },
  );

  it('rejects a common password padded with whitespace', () => {
    expect(newPasswordSchema.safeParse('  password1234  ').success).toBe(false);
  });

  it('never truncates — a long, non-common password of valid length is accepted whole', () => {
    const password = 'a-genuinely-unpredictable-passphrase-of-real-length';
    const result = newPasswordSchema.safeParse(password);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe(password);
  });
});

describe('loginSchema', () => {
  it('accepts a valid email + password pair', () => {
    const result = loginSchema.safeParse({ email: 'Admin@Example.com', password: 'anything' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe('admin@example.com');
  });

  it('rejects an unknown field (mass-assignment defence)', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'x', role: 'ADMIN' }).success).toBe(
      false,
    );
  });

  it('rejects a missing password', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com' }).success).toBe(false);
  });

  it('does NOT apply the common-password or length policy to a login attempt', () => {
    // The login password is checked against a stored hash, not this policy —
    // a short/common password here just means the login attempt (correctly)
    // fails authentication, not that the request itself is malformed.
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true);
  });
});

describe('changePasswordSchema', () => {
  it('accepts a valid current + new password pair', () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: 'whatever-it-was',
        newPassword: 'a-brand-new-passphrase',
      }).success,
    ).toBe(true);
  });

  it('rejects a new password that fails the policy', () => {
    expect(
      changePasswordSchema.safeParse({ currentPassword: 'old', newPassword: 'short' }).success,
    ).toBe(false);
  });

  it('rejects an unknown field', () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: 'old',
        newPassword: 'a-brand-new-passphrase',
        tokenVersion: 0,
      }).success,
    ).toBe(false);
  });
});
