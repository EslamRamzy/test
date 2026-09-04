import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    // Runs once before any test file, not per-file — see that file's own
    // header for why this replaced two test files independently managing
    // the same shared database's lifecycle in their own beforeAll/afterAll.
    globalSetup: ['./tests/globalSetup.ts'],
    // Applied before any test file is imported, so it is set before
    // config/prisma.ts's module-level PrismaClient singleton is constructed.
    // This keeps app-level integration tests (tests/health.test.ts) off the
    // developer's own dev database (prisma/portfolio.db) — every other test
    // file gets its own fully isolated temp file via
    // tests/helpers/testDb.ts's createTestDatabase() regardless of this.
    env: {
      DATABASE_URL: 'file:./.tmp/vitest-app.db',
      // Fixed, obviously-fake test secrets — 32+ chars to satisfy env.ts's
      // own length check, applied globally so no test file needs to stub
      // them individually. Never used outside this test run.
      JWT_SECRET: 'test-jwt-secret-value-not-for-real-use-000000',
      CSRF_SECRET: 'test-csrf-secret-value-not-for-real-use-00000',
      IP_HASH_SALT: 'test-ip-hash-salt-value-not-for-real-use-0000',
      COOKIE_DOMAIN: '.local.eslamramzy.test',
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/server.ts'],
      // Raised to the docs/architecture/10 §4 targets as each layer lands.
      thresholds: { lines: 0, branches: 0, functions: 0, statements: 0 },
    },
  },
});
