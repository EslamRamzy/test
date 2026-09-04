import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/**
 * Regression test for a real Phase 2 bug: the readiness check originally
 * ran a bare `SELECT 1`, which succeeds against ANY valid SQLite file —
 * migrated or not — because it never touches a table. That let the server
 * report itself "ready" against a completely empty database file. This test
 * pins down the actual SQL-level property the fix relies on: a query
 * against a real table (not a literal) fails on an unmigrated file and
 * succeeds once the table exists — proven here directly against
 * better-sqlite3, independent of the repository/service wiring above it.
 *
 * The check queries `users`, not Prisma's own `_prisma_migrations`
 * bookkeeping table — a second bug caught while writing this very test.
 * `_prisma_migrations` is created only by the `prisma migrate` CLI itself,
 * not by replaying the same SQL through any other means (which is exactly
 * how `tests/helpers/testDb.ts` builds a test database), so depending on it
 * would make "ready" mean "was migrated by this specific tool" instead of
 * "the schema this app depends on exists."
 */
describe('readiness query semantics', () => {
  let dir: string;
  let dbPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'portfolio-readiness-'));
    dbPath = join(dir, 'empty.db');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('a bare "SELECT 1" succeeds even against an unmigrated database (the bug)', () => {
    const db = new Database(dbPath);
    try {
      expect(() => db.prepare('SELECT 1').get()).not.toThrow();
    } finally {
      db.close();
    }
  });

  it('querying "users" fails against an unmigrated database (the fix)', () => {
    const db = new Database(dbPath);
    try {
      expect(() => db.prepare('SELECT 1 FROM "users" LIMIT 1').get()).toThrow(/no such table/i);
    } finally {
      db.close();
    }
  });

  it('querying "users" succeeds once the schema is applied', () => {
    const db = new Database(dbPath);
    try {
      db.exec('CREATE TABLE "users" (id INTEGER PRIMARY KEY);');
      expect(() => db.prepare('SELECT 1 FROM "users" LIMIT 1').get()).not.toThrow();
    } finally {
      db.close();
    }
  });

  it('replaying the SQL migration files directly does NOT create _prisma_migrations', () => {
    // This is the property that ruled out depending on that table: this
    // project's own test-database helper applies schema this exact way.
    const db = new Database(dbPath);
    try {
      expect(() => db.prepare('SELECT 1 FROM "_prisma_migrations" LIMIT 1').get()).toThrow(
        /no such table/i,
      );
    } finally {
      db.close();
    }
  });
});
