import * as argon2 from 'argon2';

/**
 * Password hashing — docs/architecture/04 §4.
 *
 * Argon2id with the OWASP Password Storage Cheat Sheet minimum parameters.
 * Rejected alternatives and why: bcrypt truncates at 72 bytes and is weaker
 * against GPU attacks; PBKDF2 is the weakest of the three; a hand-rolled salt
 * is unnecessary because Argon2 embeds its own.
 *
 * This module is introduced in Phase 2 because `prisma/bootstrap.ts` needs to
 * hash the initial admin password immediately — it does not wait for Phase 4.
 * Phase 4 (login, JWT, sessions) is built on top of this same module rather
 * than introducing a second hashing path.
 */

const HASH_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456, // KiB (19 MiB) — OWASP minimum.
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(plaintext: string): Promise<string> {
  return argon2.hash(plaintext, HASH_OPTIONS);
}

export async function verifyPassword(hash: string, plaintext: string): Promise<boolean> {
  return argon2.verify(hash, plaintext);
}

/**
 * A pre-computed Argon2id hash of a random, never-used value, verified
 * against on a login attempt for an email that does not exist.
 *
 * Without this, verifying against "no hash at all" returns near-instantly
 * while a real wrong-password attempt takes as long as a full Argon2
 * verification — the timing difference is a user-enumeration oracle
 * (docs/architecture/04 §2). This constant makes both paths cost the same.
 *
 * Generated once with `hashPassword(crypto.randomUUID())` and frozen here —
 * it does not need to be secret, only expensive to verify against.
 */
export const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=19456,p=1,t=2$9YlM/6QF29fcghNvbPVtaQ$acDK1PQT21piTDccW1bh7K5Yh8MJqBhoFhvJ1GJGmMU';
