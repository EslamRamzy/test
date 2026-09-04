import type { AuthUser } from '@portfolio/shared';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { UnauthenticatedError } from '../errors/AppError.js';
import { parseDurationMs } from '../lib/duration.js';
import { signAccessToken } from '../lib/jwt.js';
import { DUMMY_PASSWORD_HASH, hashPassword, verifyPassword } from '../lib/password.js';
import * as auditLogRepository from '../repositories/auditLogRepository.js';
import * as refreshTokenRepository from '../repositories/refreshTokenRepository.js';
import * as userRepository from '../repositories/userRepository.js';

/**
 * Auth business logic (docs/architecture/04). HTTP-agnostic like every
 * other service (docs/architecture/01 §5): no cookies, no status codes, no
 * `req`/`res` — `controllers/authController.ts` is the only place those
 * exist. Every function here that mutates state also writes its audit
 * entry inside the same `prisma.$transaction`, per doc 05 §7.
 */

export interface RequestContext {
  ipHash: string | undefined;
  userAgent: string | undefined;
}

export interface AuthResult {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

const LOCK_THRESHOLD = 10;
const BASE_LOCK_MINUTES = 15;
const MAX_LOCK_MINUTES = 24 * 60;

/**
 * Doc 04 §2: "10 consecutive failures → locked_until = now + 15 min,
 * exponential on repeat." There is no separate "lock count" column, so the
 * exponent is derived from how many multiples of the threshold
 * `failedLoginCount` has crossed — the 10th failure locks for 15 minutes,
 * the 20th (10 more failures, whether during or after the first lock) for
 * 30, the 30th for 60, capped at 24h.
 *
 * Returns `null` for any count that isn't exactly a new threshold crossing
 * — the caller only needs a value the moment a lock is (re-)triggered, to
 * decide whether to also emit `ACCOUNT_LOCKED`.
 */
function computeNewLockout(failedLoginCount: number): Date | null {
  if (failedLoginCount < LOCK_THRESHOLD || failedLoginCount % LOCK_THRESHOLD !== 0) {
    return null;
  }
  const lockNumber = failedLoginCount / LOCK_THRESHOLD;
  const minutes = Math.min(BASE_LOCK_MINUTES * 2 ** (lockNumber - 1), MAX_LOCK_MINUTES);
  return new Date(Date.now() + minutes * 60_000);
}

export function toAuthUser(user: {
  id: number;
  email: string;
  name: string;
  role: string;
  mustChangePassword: boolean;
}): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as AuthUser['role'],
    mustChangePassword: user.mustChangePassword,
  };
}

function newRefreshExpiry(): Date {
  return new Date(Date.now() + parseDurationMs(env.JWT_REFRESH_TTL));
}

/**
 * Doc 04 §2's login sequence, including the constant-time defence against
 * user enumeration: an unknown email still runs a full Argon2 verification
 * (against `DUMMY_PASSWORD_HASH`) so the response takes the same time either
 * way, and every failure path — unknown email, wrong password, locked,
 * inactive — returns the exact same error message. The reason is recorded
 * in the audit log only, never in the response.
 */
export async function login(
  email: string,
  password: string,
  ctx: RequestContext,
): Promise<AuthResult> {
  const normalizedEmail = email.toLowerCase();
  const user = await userRepository.findByEmailWithPasswordHash(normalizedEmail);

  const passwordValid = await verifyPassword(user?.passwordHash ?? DUMMY_PASSWORD_HASH, password);
  const isLocked = user?.lockedUntil != null && user.lockedUntil.getTime() > Date.now();
  const isInactive = user != null && !user.isActive;

  if (!user || !passwordValid || isLocked || isInactive) {
    if (user) {
      const failedCount = user.failedLoginCount + 1;
      const newLockout = computeNewLockout(failedCount);
      await prisma.$transaction(async (tx) => {
        await userRepository.recordFailedLogin(user.id, newLockout, tx);
        await auditLogRepository.record(
          {
            userId: user.id,
            action: 'LOGIN_FAILURE',
            metadata: {
              reason: isLocked
                ? 'account_locked'
                : isInactive
                  ? 'account_inactive'
                  : 'bad_password',
            },
            ...(ctx.ipHash !== undefined ? { ipHash: ctx.ipHash } : {}),
            ...(ctx.userAgent !== undefined ? { userAgent: ctx.userAgent } : {}),
          },
          tx,
        );
        if (newLockout) {
          await auditLogRepository.record(
            {
              userId: user.id,
              action: 'ACCOUNT_LOCKED',
              metadata: { lockedUntil: newLockout.toISOString(), failedLoginCount: failedCount },
              ...(ctx.ipHash !== undefined ? { ipHash: ctx.ipHash } : {}),
              ...(ctx.userAgent !== undefined ? { userAgent: ctx.userAgent } : {}),
            },
            tx,
          );
        }
      });
    } else {
      // No user row to attach this to — audit the attempted email instead
      // of the password (never the password).
      await auditLogRepository.record({
        userId: null,
        action: 'LOGIN_FAILURE',
        metadata: { reason: 'unknown_email', emailAttempted: normalizedEmail },
        ...(ctx.ipHash !== undefined ? { ipHash: ctx.ipHash } : {}),
        ...(ctx.userAgent !== undefined ? { userAgent: ctx.userAgent } : {}),
      });
    }
    throw new UnauthenticatedError('Invalid email or password');
  }

  const familyId = refreshTokenRepository.newFamilyId();
  const issued = await prisma.$transaction(async (tx) => {
    await userRepository.recordSuccessfulLogin(user.id, tx);
    const created = await refreshTokenRepository.create(
      {
        userId: user.id,
        familyId,
        expiresAt: newRefreshExpiry(),
        userAgent: ctx.userAgent,
        ipHash: ctx.ipHash,
      },
      tx,
    );
    await auditLogRepository.record(
      {
        userId: user.id,
        action: 'LOGIN_SUCCESS',
        ...(ctx.ipHash !== undefined ? { ipHash: ctx.ipHash } : {}),
        ...(ctx.userAgent !== undefined ? { userAgent: ctx.userAgent } : {}),
      },
      tx,
    );
    return created;
  });

  const accessToken = signAccessToken({
    sub: String(user.id),
    role: user.role,
    tokenVersion: user.tokenVersion,
  });

  return {
    user: toAuthUser(user),
    accessToken,
    refreshToken: issued.plaintext,
  };
}

/**
 * Doc 04 §3: rotation with reuse detection. A presented token that is
 * already revoked means someone is replaying a token the legitimate client
 * already rotated past — the entire family is killed, ending every session
 * descended from that login, not just this one token.
 */
export async function refresh(presentedToken: string, ctx: RequestContext): Promise<AuthResult> {
  const existing = await refreshTokenRepository.findByPlaintext(presentedToken);

  if (!existing) {
    throw new UnauthenticatedError('Invalid session');
  }

  if (existing.revokedAt) {
    await prisma.$transaction(async (tx) => {
      await refreshTokenRepository.revokeFamily(existing.familyId, tx);
      await auditLogRepository.record(
        {
          userId: existing.userId,
          action: 'TOKEN_REUSE_DETECTED',
          metadata: { severity: 'high', familyId: existing.familyId },
          ...(ctx.ipHash !== undefined ? { ipHash: ctx.ipHash } : {}),
          ...(ctx.userAgent !== undefined ? { userAgent: ctx.userAgent } : {}),
        },
        tx,
      );
    });
    throw new UnauthenticatedError('Invalid session');
  }

  if (existing.expiresAt.getTime() <= Date.now()) {
    throw new UnauthenticatedError('Session expired');
  }

  const user = await userRepository.findByIdSafe(existing.userId);
  if (!user || !user.isActive) {
    throw new UnauthenticatedError('Invalid session');
  }

  const issued = await prisma.$transaction(async (tx) => {
    const created = await refreshTokenRepository.create(
      {
        userId: user.id,
        familyId: existing.familyId,
        expiresAt: newRefreshExpiry(),
        userAgent: ctx.userAgent,
        ipHash: ctx.ipHash,
      },
      tx,
    );
    await refreshTokenRepository.revoke(existing.id, created.tokenHash, tx);
    await auditLogRepository.record(
      {
        userId: user.id,
        action: 'TOKEN_REFRESHED',
        ...(ctx.ipHash !== undefined ? { ipHash: ctx.ipHash } : {}),
        ...(ctx.userAgent !== undefined ? { userAgent: ctx.userAgent } : {}),
      },
      tx,
    );
    return created;
  });

  const accessToken = signAccessToken({
    sub: String(user.id),
    role: user.role,
    tokenVersion: user.tokenVersion,
  });

  return {
    user: toAuthUser(user),
    accessToken,
    refreshToken: issued.plaintext,
  };
}

/**
 * Ends the one session the presented refresh token belongs to (its whole
 * family, so a rotated-but-not-yet-used descendant of it is also killed) —
 * as opposed to `logoutAll`, which ends every session for the user.
 *
 * Deliberately identifies the actor from the refresh token row rather than
 * requiring a still-valid access token: the access token is short-lived
 * (15 min) and may well have already expired by the time an idle admin
 * clicks "log out," and logout must not depend on a passing
 * `authenticate` check to do its job. A missing, already-revoked, or
 * unrecognised token is treated as an idempotent no-op — there is nothing
 * left to end, and no audit entry is written, mirroring the identical
 * "either way, nothing observable happens" shape doc 04 §2 uses for login
 * failures (here for the opposite reason: nothing to reveal, not something
 * to hide).
 */
export async function logout(
  presentedToken: string | undefined,
  ctx: RequestContext,
): Promise<void> {
  if (!presentedToken) return;

  const existing = await refreshTokenRepository.findByPlaintext(presentedToken);
  if (!existing || existing.revokedAt) return;

  await prisma.$transaction(async (tx) => {
    await refreshTokenRepository.revokeFamily(existing.familyId, tx);
    await auditLogRepository.record(
      {
        userId: existing.userId,
        action: 'LOGOUT',
        ...(ctx.ipHash !== undefined ? { ipHash: ctx.ipHash } : {}),
        ...(ctx.userAgent !== undefined ? { userAgent: ctx.userAgent } : {}),
      },
      tx,
    );
  });
}

/** Revokes every refresh token for the user, across every family — "log out everywhere" (doc 04 §6). */
export async function logoutAll(actorId: number, ctx: RequestContext): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await refreshTokenRepository.revokeAllForUser(actorId, tx);
    await auditLogRepository.record(
      {
        userId: actorId,
        action: 'LOGOUT_ALL',
        ...(ctx.ipHash !== undefined ? { ipHash: ctx.ipHash } : {}),
        ...(ctx.userAgent !== undefined ? { userAgent: ctx.userAgent } : {}),
      },
      tx,
    );
  });
}

/**
 * Doc 04 §4: changing the password bumps `tokenVersion` (kills every
 * outstanding access token immediately — the next request each one makes
 * fails the `authenticate` middleware's version check) and, since refresh
 * tokens are opaque and carry no version claim of their own, this also
 * explicitly revokes every one of them — otherwise a stolen or shared
 * session could keep silently refreshing past a password change meant to
 * end it.
 */
export async function changePassword(
  actorId: number,
  currentPassword: string,
  newPassword: string,
  ctx: RequestContext,
): Promise<void> {
  const user = await userRepository.findByIdWithPasswordHash(actorId);
  if (!user) {
    throw new UnauthenticatedError('Invalid session');
  }

  const valid = await verifyPassword(user.passwordHash, currentPassword);
  if (!valid) {
    throw new UnauthenticatedError('Current password is incorrect');
  }

  const newHash = await hashPassword(newPassword);

  await prisma.$transaction(async (tx) => {
    await userRepository.bumpTokenVersionAndSetPassword(actorId, newHash, tx);
    await refreshTokenRepository.revokeAllForUser(actorId, tx);
    await auditLogRepository.record(
      {
        userId: actorId,
        action: 'PASSWORD_CHANGED',
        ...(ctx.ipHash !== undefined ? { ipHash: ctx.ipHash } : {}),
        ...(ctx.userAgent !== undefined ? { userAgent: ctx.userAgent } : {}),
      },
      tx,
    );
  });
}

/** GET /auth/me. */
export async function getCurrentUser(actorId: number): Promise<AuthUser | null> {
  const user = await userRepository.findByIdSafe(actorId);
  return user ? toAuthUser(user) : null;
}
