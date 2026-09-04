import { prisma } from '../config/prisma.js';
import type { PrismaClientOrTx } from '../config/prisma.js';

/**
 * `passwordHash` is excluded from every default select (docs/architecture/04
 * §4: "excluded from every Prisma select via an explicit field list, no
 * `select: *` on users"). The one function that needs it —
 * `findByEmailWithPasswordHash`, used only by the login and change-password
 * flows — says so in its name, mirroring the `*ForAdmin` convention already
 * used for draft visibility (docs/architecture/05 §5): a reader should never
 * have to open this file to know whether a hash might be sitting in the
 * object they were handed.
 */
const SAFE_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  mustChangePassword: true,
  tokenVersion: true,
  failedLoginCount: true,
  lockedUntil: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export function findByEmailWithPasswordHash(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

/** Same exception as above, keyed by id — used by the change-password flow, which already has the actor's id from the verified access token and has no reason to look the email back up. */
export function findByIdWithPasswordHash(id: number) {
  return prisma.user.findUnique({ where: { id } });
}

export function findByIdSafe(id: number) {
  return prisma.user.findUnique({ where: { id }, select: SAFE_USER_SELECT });
}

export function findByEmailSafe(email: string) {
  return prisma.user.findUnique({ where: { email }, select: SAFE_USER_SELECT });
}

export function countActiveAdmins() {
  return prisma.user.count({ where: { role: 'ADMIN', isActive: true } });
}

/** Called on every failed login: increments the counter and locks the account at the 10th. */
export function recordFailedLogin(
  id: number,
  lockedUntil: Date | null,
  client: PrismaClientOrTx = prisma,
) {
  return client.user.update({
    where: { id },
    data: {
      failedLoginCount: { increment: 1 },
      ...(lockedUntil ? { lockedUntil } : {}),
    },
    select: SAFE_USER_SELECT,
  });
}

/** Called on every successful login: clears the failure counter and any lock. */
export function recordSuccessfulLogin(id: number, client: PrismaClientOrTx = prisma) {
  return client.user.update({
    where: { id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    select: SAFE_USER_SELECT,
  });
}

/**
 * Bumps `tokenVersion`, which invalidates every outstanding access token
 * immediately (docs/architecture/04 §4) — the JWT carries the version it was
 * issued with, and `authenticate` middleware compares it against the
 * current value on every request.
 */
export function bumpTokenVersionAndSetPassword(
  id: number,
  passwordHash: string,
  client: PrismaClientOrTx = prisma,
) {
  return client.user.update({
    where: { id },
    data: {
      passwordHash,
      tokenVersion: { increment: 1 },
      mustChangePassword: false,
    },
    select: SAFE_USER_SELECT,
  });
}

export function unlockAndResetFailures(id: number, client: PrismaClientOrTx = prisma) {
  return client.user.update({
    where: { id },
    data: { failedLoginCount: 0, lockedUntil: null },
    select: SAFE_USER_SELECT,
  });
}
