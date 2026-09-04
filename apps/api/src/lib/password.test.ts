import { describe, expect, it } from 'vitest';
import { DUMMY_PASSWORD_HASH, hashPassword, verifyPassword } from './password.js';

describe('hashPassword / verifyPassword', () => {
  it('produces an Argon2id hash', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    expect(hash).toMatch(/^\$argon2id\$/);
  });

  it('verifies the correct password', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    await expect(verifyPassword(hash, 'correct-horse-battery-staple')).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    await expect(verifyPassword(hash, 'wrong-password')).resolves.toBe(false);
  });

  it('salts every hash differently even for the same input', async () => {
    const [a, b] = await Promise.all([hashPassword('same-input'), hashPassword('same-input')]);
    expect(a).not.toBe(b);
  });
});

describe('DUMMY_PASSWORD_HASH', () => {
  it('is a well-formed Argon2id hash', () => {
    expect(DUMMY_PASSWORD_HASH).toMatch(/^\$argon2id\$/);
  });

  // This is the load-bearing property (docs/architecture/04 §2): verifying
  // against it must resolve to `false`, never throw — a login handler that
  // falls back to this constant on an unknown email must behave exactly like
  // a real wrong-password check, or the user-enumeration timing gap reopens.
  it('verify() resolves to false rather than throwing, for any input', async () => {
    await expect(verifyPassword(DUMMY_PASSWORD_HASH, 'anything')).resolves.toBe(false);
    await expect(verifyPassword(DUMMY_PASSWORD_HASH, '')).resolves.toBe(false);
  });
});
