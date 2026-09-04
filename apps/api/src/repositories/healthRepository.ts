import { prisma } from '../config/prisma.js';

/**
 * The only layer permitted to import Prisma (docs/architecture/01 §5,
 * enforced by the `no-restricted-imports` ESLint rule and verified by
 * scripts/verify-lint-rules.mjs). Even a one-line liveness check goes
 * through a repository so the boundary has no ad-hoc exceptions.
 *
 * Deliberately queries a real application table (`users`) rather than a
 * bare `SELECT 1`. A literal `SELECT 1` succeeds against ANY valid SQLite
 * file, migrated or not, since it never touches a table; that shape of
 * check was caught in Phase 2 testing letting the server boot "ready"
 * against a completely empty database file.
 *
 * `users` was chosen over Prisma's own `_prisma_migrations` bookkeeping
 * table on purpose: `_prisma_migrations` is created only when schema is
 * applied through the `prisma migrate` CLI specifically, not when the same
 * SQL is replayed by any other means (exactly how the test suite's
 * `tests/helpers/testDb.ts` builds a test database, and how a disaster
 * -recovery restore might reasonably work too) — so depending on it would
 * make "ready" mean "was migrated by this specific tool" rather than
 * "the schema this app depends on actually exists," which is what
 * readiness should mean.
 */
export async function ping(): Promise<void> {
  await prisma.$queryRaw`SELECT 1 FROM "users" LIMIT 1`;
}
