import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb.js';

describe('database pragmas (docs/architecture/02 §1)', () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await createTestDatabase();
  });

  afterAll(async () => {
    await db.cleanup();
  });

  it('runs in WAL mode', async () => {
    const [row] =
      await db.prisma.$queryRawUnsafe<{ journal_mode: string }[]>('PRAGMA journal_mode;');
    expect(row?.journal_mode).toBe('wal');
  });

  it('enforces foreign keys', async () => {
    // foreign_keys is OFF by default in SQLite — this is the single easiest
    // mistake to make in this stack, and every FK constraint in the schema
    // is decorative without it.
    const [row] =
      await db.prisma.$queryRawUnsafe<{ foreign_keys: bigint }[]>('PRAGMA foreign_keys;');
    expect(row?.foreign_keys).toBe(1n);
  });

  it('has a non-zero busy timeout', async () => {
    const [row] = await db.prisma.$queryRawUnsafe<{ timeout: number }[]>('PRAGMA busy_timeout;');
    expect(row?.timeout).toBeGreaterThan(0);
  });
});
