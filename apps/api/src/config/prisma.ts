import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../../generated/prisma/client.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { env } from './env.js';

/**
 * The single shared Prisma client for the whole application.
 *
 * Prisma 7 removed the bundled Rust query engine for most providers in favour
 * of "driver adapters" — a JS SQL driver wrapped in a thin Prisma-facing
 * shim. `adapter` is a required constructor argument now, not an opt-in
 * preview feature; there is no other way to construct `PrismaClient` for
 * SQLite. This was verified empirically against the installed
 * prisma@7.10.0 / @prisma/client@7.10.0 before writing this file — it is not
 * how earlier Prisma versions worked, and it is easy to get wrong from
 * memory alone.
 *
 * better-sqlite3 is a single synchronous native connection (SQLite itself has
 * no server to pool connections to), so the PRAGMAs below are set exactly
 * once, immediately, and hold for the lifetime of the process — this is the
 * "per-connection" startup sequence docs/architecture/02 §1 calls for.
 *
 * IMPORTANT: only this file and modules under `repositories/` may import
 * `@prisma/client`, `@prisma/adapter-better-sqlite3`, `better-sqlite3`, or
 * the generated client — enforced by the `no-restricted-imports` ESLint rule
 * in eslint.config.mjs and checked by scripts/verify-lint-rules.mjs.
 */

const adapter = new PrismaBetterSqlite3({ url: env.DATABASE_URL });

export const prisma = new PrismaClient({
  adapter,
  // Prisma's own query/info/warn logs are noisy in normal operation; errors
  // still surface through the thrown exceptions the caller already handles.
  log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

/**
 * A repository function that must be callable both standalone (against the
 * shared singleton) and from inside `prisma.$transaction(async (tx) => ...)`
 * (docs/architecture/05 §7 — audit coupling: a mutation and its audit-log
 * write commit or roll back together) takes this as its client parameter,
 * defaulted to `prisma`. `Prisma.TransactionClient` is the same shape minus
 * the handful of methods (`$transaction`, `$connect`, ...) that are not
 * valid to call on a client already inside one.
 */
export type PrismaClientOrTx = PrismaClient | Prisma.TransactionClient;

let pragmasApplied = false;

/**
 * Applies the startup PRAGMAs. Called once from server.ts before the API
 * starts accepting requests, and from test setup before any test touches the
 * database. Idempotent, so it is safe to call defensively.
 */
export async function applyDatabasePragmas(): Promise<void> {
  if (pragmasApplied) return;

  // WAL: concurrent readers during a write.
  await prisma.$executeRawUnsafe('PRAGMA journal_mode = WAL;');
  // OFF by default in SQLite — without this every foreign key in the schema
  // is decorative. This is the single easiest mistake to make in this stack.
  await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON;');
  // Wait instead of throwing SQLITE_BUSY under light write contention.
  await prisma.$executeRawUnsafe('PRAGMA busy_timeout = 5000;');
  // Safe with WAL, meaningfully faster than the FULL default.
  await prisma.$executeRawUnsafe('PRAGMA synchronous = NORMAL;');

  pragmasApplied = true;
}

/** Closes the underlying connection. Used by tests and graceful shutdown. */
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  pragmasApplied = false;
}
