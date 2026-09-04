/**
 * Configuration for the Prisma CLI only (`prisma migrate`, `prisma generate`,
 * `prisma studio`) — never imported by the running application.
 *
 * The app's own PrismaClient is constructed in src/config/prisma.ts using
 * `env.DATABASE_URL`, which comes from our own Zod-validated env.ts
 * (docs/architecture/09 §9: config fails fast on invalid input, and never
 * relies on a stray .env file winning in production). This file exists only
 * because the Prisma CLI needs a DATABASE_URL of its own to run migrations
 * locally, and Prisma 7 does not load .env files automatically — that is
 * what the `dotenv/config` import below does, and only for CLI invocations.
 */
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env['DATABASE_URL'],
  },
});
