/**
 * Server-side password recovery (docs/architecture/04 §8, decision D7).
 * There is no public "forgot password" endpoint — with a single admin and
 * no public registration, a password-reset email flow is pure attack
 * surface for zero benefit (a lost password is recovered by whoever already
 * has shell access to the server, not by anyone who can receive an email).
 *
 * Generates a fresh random password (or accepts one explicitly via
 * `--password=`), sets it, flags the account `must_change_password`, bumps
 * `token_version` (kills every outstanding access token immediately), and
 * revokes every refresh token (kills every session, not just access
 * tokens — mirrors `authService.changePassword`, since this IS a password
 * change, just one the admin didn't initiate from the UI). Every run is
 * audited as `ADMIN_PASSWORD_RESET`.
 *
 * Usage:
 *   npm run admin:reset-password -w @portfolio/api -- --email=admin@example.com
 *   npm run admin:reset-password -w @portfolio/api -- --email=admin@example.com --password=...
 */
import { randomBytes } from 'node:crypto';
import { hashPassword } from '../src/lib/password.js';
import { applyDatabasePragmas, disconnectDatabase, prisma } from '../src/config/prisma.js';

function readFlag(name: string): string | undefined {
  const prefix = `--${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg?.slice(prefix.length);
}

/** 24 random bytes, base64url — well over the 12-character minimum, never a dictionary word. */
function generateRandomPassword(): string {
  return randomBytes(24).toString('base64url');
}

async function main(): Promise<void> {
  const email = readFlag('email')?.trim().toLowerCase();
  if (!email) {
    console.error(
      'Usage: npm run admin:reset-password -w @portfolio/api -- --email=admin@example.com',
    );
    process.exitCode = 1;
    return;
  }

  await applyDatabasePragmas();

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No user found with email "${email}".`);
    process.exitCode = 1;
    return;
  }

  const newPassword = readFlag('password') ?? generateRandomPassword();
  if (newPassword.length < 12) {
    console.error('--password must be at least 12 characters (docs/architecture/04 §4).');
    process.exitCode = 1;
    return;
  }
  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        tokenVersion: { increment: 1 },
        mustChangePassword: true,
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });
    await tx.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: 'ADMIN_PASSWORD_RESET',
        metadataJson: JSON.stringify({ triggeredBy: 'cli' }),
      },
    });
  });

  console.log(`✓ Password reset for ${email}. Every existing session was signed out.`);
  if (!readFlag('password')) {
    console.log(`\n  New temporary password: ${newPassword}\n`);
    console.log('  The account must change this password on next login.');
  }
}

main()
  .catch((error: unknown) => {
    console.error('admin:reset-password failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void disconnectDatabase();
  });
