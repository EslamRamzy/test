import { mkdirSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import { applyMigrations } from './helpers/testDb.js';

/**
 * Vitest global setup — runs exactly once before any test file, regardless
 * of how many files run in parallel, and its teardown runs exactly once
 * after all of them finish (see vitest's `globalSetup` option in
 * vitest.config.ts).
 *
 * This is the ONE place that migrates `./.tmp/vitest-app.db` — the file
 * `config/prisma.ts`'s singleton is permanently bound to via
 * `vitest.config.ts`'s `test.env.DATABASE_URL` (see that file's comment for
 * why the singleton can't be pointed at a per-test temp file the way
 * `tests/helpers/testDb.ts`'s `createTestDatabase()` works for everything
 * else). Originally this lived in `tests/health.test.ts`'s own
 * `beforeAll`/`afterAll` — correct when it was the only test file touching
 * that shared path, but Phase 4 added a second (`tests/auth.test.ts`), and
 * two files each independently creating, migrating, and deleting the SAME
 * physical file in their own `beforeAll`/`afterAll` is a real race across
 * vitest's parallel workers (create-while-deleting, migrate-twice-onto-the-
 * same-file). Centralising it here removes the race instead of hoping the
 * two files never overlap.
 */
const DB_PATH = './.tmp/vitest-app.db';

export default function setup(): () => void {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  applyMigrations(DB_PATH);

  return () => {
    rmSync(dirname(DB_PATH), { recursive: true, force: true });
  };
}
