/**
 * Server-side lockout recovery (docs/architecture/04 §2, §8, decision D7).
 * With a single admin account, the 10-failure lockout (`users.locked_until`)
 * is a self-inflicted denial of service if it is ever hit for real — this
 * is the only way out of it besides waiting for `locked_until` to pass.
 * Clears the failure counter and the lock; does NOT touch the password or
 * any session. Every run is audited as `ADMIN_ACCOUNT_UNLOCKED`.
 *
 * Usage:
 *   npm run admin:unlock -w @portfolio/api -- --email=admin@example.com
 */
import { applyDatabasePragmas, disconnectDatabase, prisma } from '../src/config/prisma.js';

function readFlag(name: string): string | undefined {
  const prefix = `--${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg?.slice(prefix.length);
}

async function main(): Promise<void> {
  const email = readFlag('email')?.trim().toLowerCase();
  if (!email) {
    console.error('Usage: npm run admin:unlock -w @portfolio/api -- --email=admin@example.com');
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

  if (user.failedLoginCount === 0 && user.lockedUntil === null) {
    console.log(`✓ ${email} is not locked — nothing to do.`);
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null },
    });
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: 'ADMIN_ACCOUNT_UNLOCKED',
        metadataJson: JSON.stringify({ triggeredBy: 'cli' }),
      },
    });
  });

  console.log(`✓ Unlocked ${email}. Failed-login counter reset.`);
}

main()
  .catch((error: unknown) => {
    console.error('admin:unlock failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void disconnectDatabase();
  });
