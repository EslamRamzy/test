import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    // Applied before any test file is imported, so it is set before
    // config/prisma.ts's module-level PrismaClient singleton is constructed.
    // This keeps app-level integration tests (tests/health.test.ts) off the
    // developer's own dev database (prisma/portfolio.db) — every other test
    // file gets its own fully isolated temp file via
    // tests/helpers/testDb.ts's createTestDatabase() regardless of this.
    env: { DATABASE_URL: 'file:./.tmp/vitest-app.db' },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/server.ts'],
      // Raised to the docs/architecture/10 §4 targets as each layer lands.
      thresholds: { lines: 0, branches: 0, functions: 0, statements: 0 },
    },
  },
});
