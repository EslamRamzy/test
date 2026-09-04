import { createApp } from './app.js';
import { env } from './config/env.js';
import { applyDatabasePragmas, disconnectDatabase } from './config/prisma.js';
import { ping } from './repositories/healthRepository.js';

async function main(): Promise<void> {
  await applyDatabasePragmas();

  // Fail fast and clearly if migrations have not been applied yet, rather
  // than letting the first real request hit a cryptic "no such table" error.
  // Reuses the same `ping()` the /health/ready route calls — a startup check
  // and a runtime readiness check that used two different queries is exactly
  // how this repository ended up with a bare `SELECT 1` (which passes
  // against ANY valid SQLite file, migrated or not) surviving in one place
  // after being fixed in the other. See healthRepository.ts for why it
  // queries `users` rather than Prisma's own `_prisma_migrations` table.
  try {
    await ping();
  } catch (error) {
    // eslint-disable-next-line no-console -- replaced by the pino logger in Phase 3
    console.error(
      'Database is not reachable or migrations have not been applied.\n' +
        'Run: npm run db:migrate:deploy -w @portfolio/api\n',
      error,
    );
    process.exit(1);
  }

  const app = createApp();

  const server = app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console -- replaced by the pino logger in Phase 3
    console.log(`API listening on http://localhost:${String(env.PORT)} [${env.NODE_ENV}]`);
  });

  function shutdown(signal: string): void {
    // eslint-disable-next-line no-console -- replaced by the pino logger in Phase 3
    console.log(`${signal} received, closing server`);
    server.close(() => {
      void disconnectDatabase().finally(() => {
        process.exit(0);
      });
    });
  }

  process.on('SIGTERM', () => {
    shutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    shutdown('SIGINT');
  });
}

void main();
