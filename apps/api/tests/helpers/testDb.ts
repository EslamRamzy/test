import { readFileSync, readdirSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import Database from 'better-sqlite3';
import { PrismaClient } from '../../generated/prisma/client.js';

/**
 * Test database factory (docs/architecture/10 §2): a fresh SQLite FILE per
 * test file — not `:memory:`, because in-memory mode does not exercise WAL,
 * busy_timeout, or file permissions, which is exactly where SQLite-specific
 * bugs live. Migrated once per call by replaying the real migration SQL
 * files, so the test schema is byte-for-byte what production runs, not a
 * parallel definition that could drift from it.
 *
 * Migrations are applied with a plain `better-sqlite3` connection (via
 * `.exec()`, which — unlike Prisma's raw-query methods — runs a whole
 * multi-statement script, including `CREATE TRIGGER ... BEGIN ... END;`
 * blocks with their own internal semicolons) and then closed. Prisma opens
 * its own connection afterwards for the actual test queries.
 */

const MIGRATIONS_DIR = fileURLToPath(new URL('../../prisma/migrations', import.meta.url));

/**
 * Exported separately from `createTestDatabase` so a test that exercises the
 * real `app.ts`/`config/prisma.ts` singleton (which is bound to
 * `env.DATABASE_URL` at module-load time, and so cannot be pointed at a
 * per-test temp file after the fact) can still migrate the one shared file
 * that singleton uses — see `vitest.config.ts`'s `test.env.DATABASE_URL` and
 * `tests/health.test.ts`.
 */
export function applyMigrations(dbPath: string): void {
  const db = new Database(dbPath);
  try {
    const entries = readdirSync(MIGRATIONS_DIR)
      .filter((name) => statSync(join(MIGRATIONS_DIR, name)).isDirectory())
      .sort();

    for (const entry of entries) {
      const sql = readFileSync(join(MIGRATIONS_DIR, entry, 'migration.sql'), 'utf8');
      db.exec(sql);
    }
  } finally {
    db.close();
  }
}

export interface TestDatabase {
  prisma: PrismaClient;
  /** Deletes the temp directory and disconnects. Call in `afterAll`. */
  cleanup: () => Promise<void>;
}

export async function createTestDatabase(): Promise<TestDatabase> {
  const dir = mkdtempSync(join(tmpdir(), 'portfolio-test-'));
  const dbPath = join(dir, 'test.db');

  applyMigrations(dbPath);

  const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
  const prisma = new PrismaClient({ adapter });

  // Same per-connection PRAGMAs as production (docs/architecture/02 §1) — a
  // test that doesn't set these would silently test a different database
  // configuration than the one that actually runs.
  await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON;');
  await prisma.$executeRawUnsafe('PRAGMA journal_mode = WAL;');
  await prisma.$executeRawUnsafe('PRAGMA busy_timeout = 5000;');

  return {
    prisma,
    cleanup: async () => {
      await prisma.$disconnect();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
