import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    // Every test that drives `createApp()` over real HTTP (auth.test.ts,
    // adminOverview.test.ts, and Phase 8's growing set of admin CRUD
    // integration tests) necessarily shares the one physical
    // `vitest-app.db` file below — `config/prisma.ts`'s singleton binds to
    // `env.DATABASE_URL` once at module load, so it cannot be pointed at a
    // per-file temp database the way `tests/helpers/testDb.ts`'s isolated
    // tests are (that file's own comment says so). Running those files
    // CONCURRENTLY (Vitest's default) against one shared database is a
    // real, not theoretical, race: confirmed by two genuinely flaky
    // failures once Phase 8 grew the file count enough to trigger
    // interleaving — adminOverview.test.ts's live-count assertion drifted
    // against a directly-queried "before" snapshot because a concurrently
    // running file inserted/deleted rows in the same window. Serializing
    // FILE execution (not per-test isolation within a file, which each
    // file's own `afterAll` cleanup still handles) removes the whole class
    // of cross-file races at the cost of some wall-clock time — the right
    // trade for correctness over a speed-up that was never real to begin
    // with (each of these files does real network + real SQLite I/O
    // regardless of how many run "in parallel").
    fileParallelism: false,
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
      // Pinned for the same reason as the secrets below: a developer's own
      // apps/api/.env (gitignored, used for local manual/browser testing)
      // may set this to something else entirely (e.g. http://localhost:3000
      // for a local Next.js dev server) — Node's loadEnvFile() never
      // overrides a variable already present in process.env, so fixing it
      // here is what keeps the test suite's expectations independent of
      // whatever a given machine's .env happens to contain.
      PUBLIC_SITE_URL: 'https://local.eslamramzy.dev',
      // Fixed, obviously-fake test secrets — 32+ chars to satisfy env.ts's
      // own length check, applied globally so no test file needs to stub
      // them individually. Never used outside this test run.
      JWT_SECRET: 'test-jwt-secret-value-not-for-real-use-000000',
      CSRF_SECRET: 'test-csrf-secret-value-not-for-real-use-00000',
      IP_HASH_SALT: 'test-ip-hash-salt-value-not-for-real-use-0000',
      REVALIDATE_SECRET: 'test-revalidate-secret-value-not-for-real-use',
      COOKIE_DOMAIN: '.local.eslamramzy.test',
      // Its own temp directory, same reasoning as DATABASE_URL above — a
      // real upload test writes real files, and those must never land in
      // apps/api/uploads/ (a developer's own local dev store) or drift
      // between test runs. `.tmp/` is already gitignored.
      UPLOAD_DIR: './.tmp/vitest-uploads',
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
