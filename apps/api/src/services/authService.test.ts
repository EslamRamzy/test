import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../config/prisma.js';
import { hashPassword } from '../lib/password.js';
import * as authService from './authService.js';

/**
 * Business-logic integration tests for the highest-risk phase in the
 * project (docs/architecture/11): these call `authService` functions
 * directly against the real (migrated, shared) test database — not through
 * HTTP — specifically to test the security properties doc 04 describes
 * (lockout, rotation, reuse detection) without the login rate limiter
 * (5 attempts / 15 min per IP and per email, middleware/rateLimit.ts)
 * getting in the way. `tests/auth.test.ts` covers the HTTP-layer wiring
 * (cookies, CSRF, Origin, authenticate gating, the rate limiter itself)
 * that this file deliberately bypasses.
 */

const CTX = { ipHash: 'test-ip-hash', userAgent: 'vitest' };
const PASSWORD = 'a-perfectly-fine-test-password-000';

const createdUserIds: number[] = [];

async function createUser(overrides: Partial<{ isActive: boolean }> = {}) {
  const email = `svc-${randomUUID()}@eslamramzy.test`;
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(PASSWORD),
      name: 'Service Test User',
      role: 'ADMIN',
      isActive: overrides.isActive ?? true,
    },
  });
  createdUserIds.push(user.id);
  return { user, email };
}

afterAll(async () => {
  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
});

describe('login', () => {
  it('succeeds with correct credentials and never returns the password hash', async () => {
    const { email } = await createUser();
    const result = await authService.login(email, PASSWORD, CTX);

    expect(result.user.email).toBe(email);
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(typeof result.accessToken).toBe('string');
    expect(typeof result.refreshToken).toBe('string');
  });

  it('persists a refresh token row hashed, never the plaintext', async () => {
    const { email, user } = await createUser();
    const result = await authService.login(email, PASSWORD, CTX);

    const rows = await prisma.refreshToken.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.tokenHash).not.toBe(result.refreshToken);
    expect(rows[0]?.revokedAt).toBeNull();
  });

  it('records a LOGIN_SUCCESS audit entry and resets counters', async () => {
    const { email, user } = await createUser();
    await authService.login(email, PASSWORD, CTX);

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.failedLoginCount).toBe(0);
    expect(updated.lastLoginAt).not.toBeNull();

    const audit = await prisma.auditLog.findFirst({
      where: { userId: user.id, action: 'LOGIN_SUCCESS' },
    });
    expect(audit).not.toBeNull();
  });

  it('rejects the wrong password with the generic message, and records the failure', async () => {
    const { email, user } = await createUser();

    await expect(authService.login(email, 'totally-the-wrong-password', CTX)).rejects.toThrow(
      'Invalid email or password',
    );

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.failedLoginCount).toBe(1);

    const audit = await prisma.auditLog.findFirst({
      where: { userId: user.id, action: 'LOGIN_FAILURE' },
    });
    expect(audit).not.toBeNull();
    expect(JSON.parse(audit?.metadataJson ?? '{}')).toMatchObject({ reason: 'bad_password' });
  });

  it('rejects an unknown email with the IDENTICAL message a wrong password gets (no user enumeration)', async () => {
    await expect(
      authService.login('no-such-account@eslamramzy.test', PASSWORD, CTX),
    ).rejects.toThrow('Invalid email or password');
  });

  it('records an unknown-email failure with no user id, keyed by the attempted email', async () => {
    const attempted = `ghost-${randomUUID()}@eslamramzy.test`;
    await expect(authService.login(attempted, PASSWORD, CTX)).rejects.toThrow();

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'LOGIN_FAILURE', userId: null },
      orderBy: { id: 'desc' },
    });
    expect(audit).not.toBeNull();
    expect(JSON.parse(audit?.metadataJson ?? '{}')).toMatchObject({
      reason: 'unknown_email',
      emailAttempted: attempted,
    });
  });

  it('rejects a correct password for a deactivated account with the generic message', async () => {
    const { email, user } = await createUser({ isActive: false });
    await expect(authService.login(email, PASSWORD, CTX)).rejects.toThrow(
      'Invalid email or password',
    );

    const audit = await prisma.auditLog.findFirst({
      where: { userId: user.id, action: 'LOGIN_FAILURE' },
    });
    expect(JSON.parse(audit?.metadataJson ?? '{}')).toMatchObject({ reason: 'account_inactive' });
  });

  it('locks the account on the 10th consecutive failure, and rejects even a correct password while locked', async () => {
    const { email, user } = await createUser();

    for (let i = 0; i < 10; i++) {
      await expect(authService.login(email, 'wrong-password', CTX)).rejects.toThrow();
    }

    const locked = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(locked.failedLoginCount).toBe(10);
    expect(locked.lockedUntil).not.toBeNull();
    expect(locked.lockedUntil!.getTime()).toBeGreaterThan(Date.now());

    const lockedAudit = await prisma.auditLog.findFirst({
      where: { userId: user.id, action: 'ACCOUNT_LOCKED' },
    });
    expect(lockedAudit).not.toBeNull();

    // The account is now locked — even the RIGHT password is rejected, with
    // the same generic message, while it is locked.
    await expect(authService.login(email, PASSWORD, CTX)).rejects.toThrow(
      'Invalid email or password',
    );
    const reAudit = await prisma.auditLog.findFirst({
      where: { userId: user.id, action: 'LOGIN_FAILURE' },
      orderBy: { id: 'desc' },
    });
    expect(JSON.parse(reAudit?.metadataJson ?? '{}')).toMatchObject({ reason: 'account_locked' });
  }, 15_000);

  it('locks for longer the second time (exponential, doc 04 §2)', async () => {
    const { email, user } = await createUser();

    // First threshold crossing: failures 1..10.
    for (let i = 0; i < 10; i++) {
      await expect(authService.login(email, 'wrong-password', CTX)).rejects.toThrow();
    }
    const firstLock = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const firstDurationMs = firstLock.lockedUntil!.getTime() - Date.now();

    // Second threshold crossing: failures 11..20 (still locked throughout,
    // but recordFailedLogin still runs on every attempt — see doc 04 §2's
    // sequence diagram, "locked or inactive or wrong password" is one branch).
    for (let i = 0; i < 10; i++) {
      await expect(authService.login(email, 'wrong-password', CTX)).rejects.toThrow();
    }
    const secondLock = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(secondLock.failedLoginCount).toBe(20);
    const secondDurationMs = secondLock.lockedUntil!.getTime() - Date.now();

    expect(secondDurationMs).toBeGreaterThan(firstDurationMs);
  }, 25_000);
});

describe('refresh', () => {
  it('rotates the token: issues a new one and revokes the old, pointing at its replacement', async () => {
    const { email, user } = await createUser();
    const loginResult = await authService.login(email, PASSWORD, CTX);

    const refreshResult = await authService.refresh(loginResult.refreshToken, CTX);
    expect(refreshResult.refreshToken).not.toBe(loginResult.refreshToken);

    const rows = await prisma.refreshToken.findMany({
      where: { userId: user.id },
      orderBy: { id: 'asc' },
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]?.revokedAt).not.toBeNull();
    expect(rows[1]?.revokedAt).toBeNull();
    // Both rows share the same family — rotation, not a new session.
    expect(rows[0]?.familyId).toBe(rows[1]?.familyId);

    const audit = await prisma.auditLog.findFirst({
      where: { userId: user.id, action: 'TOKEN_REFRESHED' },
    });
    expect(audit).not.toBeNull();
  });

  it('rejects an unrecognised token', async () => {
    await expect(authService.refresh('not-a-real-token-value', CTX)).rejects.toThrow(
      'Invalid session',
    );
  });

  it('rejects an expired token', async () => {
    const { email, user } = await createUser();
    await authService.login(email, PASSWORD, CTX);
    // Force-expire the row directly rather than waiting 7 days.
    await prisma.refreshToken.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const row = await prisma.refreshToken.findFirstOrThrow({ where: { userId: user.id } });

    // We don't have the plaintext for the row we just force-expired (never
    // stored) — issue a fresh one at that already-past expiry directly to
    // exercise the expiry branch specifically, independent of rotation.
    const { generateTokenValue } = await import('../repositories/refreshTokenRepository.js');
    const { plaintext, tokenHash } = generateTokenValue();
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        familyId: row.familyId,
        expiresAt: new Date(Date.now() - 1000),
      },
    });

    await expect(authService.refresh(plaintext, CTX)).rejects.toThrow('Session expired');
  });

  it('rejects refresh for a deactivated user', async () => {
    const { email, user } = await createUser();
    const loginResult = await authService.login(email, PASSWORD, CTX);
    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });

    await expect(authService.refresh(loginResult.refreshToken, CTX)).rejects.toThrow(
      'Invalid session',
    );
  });

  it('detects reuse of an already-rotated token and kills the whole family', async () => {
    const { email, user } = await createUser();
    const loginResult = await authService.login(email, PASSWORD, CTX);
    const rotated = await authService.refresh(loginResult.refreshToken, CTX);

    // Replay the OLD (already-rotated) token — this is the theft scenario.
    await expect(authService.refresh(loginResult.refreshToken, CTX)).rejects.toThrow(
      'Invalid session',
    );

    const reuseAudit = await prisma.auditLog.findFirst({
      where: { userId: user.id, action: 'TOKEN_REUSE_DETECTED' },
    });
    expect(reuseAudit).not.toBeNull();
    expect(JSON.parse(reuseAudit?.metadataJson ?? '{}')).toMatchObject({ severity: 'high' });

    // The legitimate client's own rotated token is now dead too — the whole
    // family was killed, not just the replayed one.
    await expect(authService.refresh(rotated.refreshToken, CTX)).rejects.toThrow('Invalid session');

    const rows = await prisma.refreshToken.findMany({ where: { userId: user.id } });
    expect(rows.every((row) => row.revokedAt !== null)).toBe(true);
  });
});

describe('logout', () => {
  it('is a no-op that does not throw when no token is presented', async () => {
    await expect(authService.logout(undefined, CTX)).resolves.toBeUndefined();
  });

  it('revokes the session and records LOGOUT', async () => {
    const { email, user } = await createUser();
    const loginResult = await authService.login(email, PASSWORD, CTX);

    await authService.logout(loginResult.refreshToken, CTX);

    const row = await prisma.refreshToken.findFirstOrThrow({ where: { userId: user.id } });
    expect(row.revokedAt).not.toBeNull();

    const audit = await prisma.auditLog.findFirst({ where: { userId: user.id, action: 'LOGOUT' } });
    expect(audit).not.toBeNull();

    // Refreshing the now-logged-out token is a reuse-of-a-revoked-token —
    // same defence, same outcome.
    await expect(authService.refresh(loginResult.refreshToken, CTX)).rejects.toThrow(
      'Invalid session',
    );
  });

  it('is idempotent — a second logout with the same token writes no second audit entry', async () => {
    const { email, user } = await createUser();
    const loginResult = await authService.login(email, PASSWORD, CTX);
    await authService.logout(loginResult.refreshToken, CTX);
    await authService.logout(loginResult.refreshToken, CTX);

    const audits = await prisma.auditLog.findMany({ where: { userId: user.id, action: 'LOGOUT' } });
    expect(audits).toHaveLength(1);
  });
});

describe('logoutAll', () => {
  it('revokes every session across every family for the user', async () => {
    const { email, user } = await createUser();
    await authService.login(email, PASSWORD, CTX); // session/family 1
    await authService.login(email, PASSWORD, CTX); // session/family 2

    await authService.logoutAll(user.id, CTX);

    const rows = await prisma.refreshToken.findMany({ where: { userId: user.id } });
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows.every((row) => row.revokedAt !== null)).toBe(true);

    const audit = await prisma.auditLog.findFirst({
      where: { userId: user.id, action: 'LOGOUT_ALL' },
    });
    expect(audit).not.toBeNull();
  });
});

describe('changePassword', () => {
  it('rejects the wrong current password and changes nothing', async () => {
    const { user } = await createUser();
    const before = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });

    await expect(
      authService.changePassword(
        user.id,
        'not-the-current-password',
        'a-brand-new-password-000',
        CTX,
      ),
    ).rejects.toThrow('Current password is incorrect');

    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.tokenVersion).toBe(before.tokenVersion);
    expect(after.passwordHash).toBe(before.passwordHash);
  });

  it('bumps tokenVersion, revokes every session, and the new password works while the old one no longer does', async () => {
    const { email, user } = await createUser();
    const loginResult = await authService.login(email, PASSWORD, CTX);
    const NEW_PASSWORD = 'a-brand-new-password-000';

    await authService.changePassword(user.id, PASSWORD, NEW_PASSWORD, CTX);

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.tokenVersion).toBeGreaterThan(0);
    expect(updated.mustChangePassword).toBe(false);

    const rows = await prisma.refreshToken.findMany({ where: { userId: user.id } });
    expect(rows.every((row) => row.revokedAt !== null)).toBe(true);
    // The session that was active when the password changed is dead too.
    await expect(authService.refresh(loginResult.refreshToken, CTX)).rejects.toThrow(
      'Invalid session',
    );

    await expect(authService.login(email, PASSWORD, CTX)).rejects.toThrow(
      'Invalid email or password',
    );
    await expect(authService.login(email, NEW_PASSWORD, CTX)).resolves.toBeDefined();

    const audit = await prisma.auditLog.findFirst({
      where: { userId: user.id, action: 'PASSWORD_CHANGED' },
    });
    expect(audit).not.toBeNull();
  });
});

describe('getCurrentUser', () => {
  it('returns the safe shape for an existing user', async () => {
    const { user } = await createUser();
    const result = await authService.getCurrentUser(user.id);

    expect(result).not.toBeNull();
    expect(result).not.toHaveProperty('passwordHash');
    expect(result?.id).toBe(user.id);
  });

  it('returns null for a nonexistent id', async () => {
    await expect(authService.getCurrentUser(-1)).resolves.toBeNull();
  });
});
