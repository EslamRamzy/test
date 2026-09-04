import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { prisma } from '../config/prisma.js';
import type { PrismaClientOrTx } from '../config/prisma.js';

/**
 * Refresh tokens (docs/architecture/04 §1, §3). The plaintext token is 32
 * random bytes, base64url-encoded, handed to the client exactly once (in the
 * `__Secure-rt` cookie) and never stored — only its SHA-256 hash is. SHA-256
 * rather than Argon2 is correct here (unlike passwords): the token is 256
 * bits of server-generated entropy, not a human-memorable secret, so it is
 * not brute-forceable, and refresh runs on a hot path where Argon2's
 * deliberate slowness would be pure cost with no security benefit.
 *
 * Every token belongs to a `familyId` — all tokens descended from one login
 * share it, so reuse of a rotated (already-used) token can revoke the whole
 * lineage in one query (§3, "reuse detection").
 */

export interface IssuedRefreshToken {
  /** The plaintext token — only ever returned here, never persisted. */
  plaintext: string;
  familyId: string;
  tokenHash: string;
}

function hashToken(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex');
}

/** Generates a brand-new plaintext token and its hash, without persisting anything. */
export function generateTokenValue(): { plaintext: string; tokenHash: string } {
  const plaintext = randomBytes(32).toString('base64url');
  return { plaintext, tokenHash: hashToken(plaintext) };
}

interface CreateRefreshTokenInput {
  userId: number;
  familyId: string;
  expiresAt: Date;
  userAgent: string | undefined;
  ipHash: string | undefined;
}

/**
 * Persists a new refresh token row. Called both at login (fresh `familyId`,
 * via `randomUUID()`) and at rotation (same `familyId` as the token being
 * replaced) — the caller decides which, this function just writes the row.
 */
export async function create(
  input: CreateRefreshTokenInput,
  client: PrismaClientOrTx = prisma,
): Promise<IssuedRefreshToken> {
  const { plaintext, tokenHash } = generateTokenValue();
  await client.refreshToken.create({
    data: {
      userId: input.userId,
      tokenHash,
      familyId: input.familyId,
      expiresAt: input.expiresAt,
      userAgent: input.userAgent ?? null,
      ipHash: input.ipHash ?? null,
    },
  });
  return { plaintext, familyId: input.familyId, tokenHash };
}

/** A fresh, unrelated family id for a brand-new login (not a rotation). */
export function newFamilyId(): string {
  return randomUUID();
}

/** Looks up a presented plaintext refresh token by its hash. Never queries by plaintext. */
export function findByPlaintext(plaintext: string, client: PrismaClientOrTx = prisma) {
  return client.refreshToken.findUnique({ where: { tokenHash: hashToken(plaintext) } });
}

/**
 * Marks one token revoked, pointing at the token that replaced it (rotation)
 * or `null` (a plain revoke — logout, reuse-detected family kill).
 */
export function revoke(
  id: number,
  replacedByHash: string | null,
  client: PrismaClientOrTx = prisma,
) {
  return client.refreshToken.update({
    where: { id },
    data: { revokedAt: new Date(), replacedByHash },
  });
}

/**
 * Revokes every currently-unrevoked token in a family in one statement — the
 * reuse-detection response (docs/architecture/04 §3: "revoke EVERY token in
 * family_id") and also what "log out everywhere" uses per-family for.
 */
export function revokeFamily(familyId: string, client: PrismaClientOrTx = prisma) {
  return client.refreshToken.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * Revokes every unrevoked token across every family for a user — "log out
 * everywhere" (docs/architecture/04 §6), as opposed to `revokeFamily`, which
 * kills only the one session/lineage a reuse was detected on.
 */
export function revokeAllForUser(userId: number, client: PrismaClientOrTx = prisma) {
  return client.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
