import { z } from 'zod';

/**
 * Environment configuration, parsed once at boot.
 *
 * The contract (docs/architecture/09 §9) is that a misconfigured deploy fails
 * loudly at startup rather than silently signing tokens with `undefined`. This
 * module therefore calls `process.exit(1)` on invalid input — it is the one
 * place in the codebase allowed to do so.
 *
 * Phase 1 validates only what is needed to boot. Auth, database, upload and
 * mail variables are added in the phases that introduce them, so the API never
 * demands a secret it does not yet use.
 */

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(4000),

  /**
   * Exact-match CORS allow-list (decision D1). Comma-separated.
   * Never a regex and never a suffix match: `endsWith('.eslamramzy.dev')`
   * also matches `evil-eslamramzy.dev`. See docs/architecture/09 §3.
   */
  CORS_ORIGIN: z
    .string()
    .default('https://local.eslamramzy.dev')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    )
    .pipe(z.array(z.string()).min(1, 'At least one allowed origin is required')),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Load `.env` outside production. In production the environment comes from the
 * container, and a stray `.env` file on the server should not silently win.
 */
function loadDotEnv(): void {
  if (process.env['NODE_ENV'] === 'production') return;
  try {
    process.loadEnvFile();
  } catch {
    // No .env file — fine, defaults and real environment variables apply.
  }
}

function parseEnv(): Env {
  loadDotEnv();
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    // eslint-disable-next-line no-console -- this runs before the logger exists
    console.error(`Invalid environment configuration:\n${issues}`);
    process.exit(1);
  }

  return result.data;
}

export const env = parseEnv();

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
