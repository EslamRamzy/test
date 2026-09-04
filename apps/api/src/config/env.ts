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

/**
 * Words that must never make up a production secret, even padded or repeated
 * to satisfy the length check (docs/architecture/09 §9: "refuses to boot in
 * production with... a known placeholder value") — exactly the shape a
 * placeholder pasted from documentation and stretched to pass validation
 * tends to take, e.g. `changemechangemechangemechangeme`.
 */
const KNOWN_PLACEHOLDER_WORDS = ['changeme', 'secret', 'placeholder', 'your-secret-here'];

/**
 * Exported for env.test.ts to exercise directly. `envSchema.safeParse(...)`
 * is pure — the side-effecting `process.exit(1)` lives only in `parseEnv()`
 * below, which the test suite never calls with bad input for exactly that
 * reason (it would kill the worker process).
 */
export function isPlaceholderSecret(value: string): boolean {
  // Letters only, lowercased — strips whatever padding/punctuation someone
  // used to reach the minimum length, leaving just the repeated word itself.
  const lettersOnly = value.toLowerCase().replace(/[^a-z]/g, '');
  return KNOWN_PLACEHOLDER_WORDS.some((word) => {
    const wordLettersOnly = word.replace(/[^a-z]/g, '');
    return lettersOnly.length > 0 && new RegExp(`^(${wordLettersOnly})+$`).test(lettersOnly);
  });
}

export const envSchema = z
  .object({
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

    /**
     * SQLite file path, as a Prisma-style `file:` URL. Consumed directly by
     * @prisma/adapter-better-sqlite3 in config/prisma.ts — see that file for
     * why a driver adapter is required at all in Prisma 7, and why the WAL/
     * foreign_keys/busy_timeout/synchronous PRAGMAs live there rather than here
     * (docs/architecture/02 §1).
     */
    DATABASE_URL: z.string().min(1).default('file:./prisma/portfolio.db'),

    // -------------------------------------------------------------------------
    // Auth (docs/architecture/04) — Phase 4. Secrets have NO default, in any
    // environment: "never demand a secret it does not yet use" cuts both ways
    // — once a secret IS in use, every environment (including local dev) must
    // set it explicitly, never silently fall back to a shared placeholder.
    // -------------------------------------------------------------------------

    /** Signs and verifies the HS256 access-token JWT (docs/architecture/04 §1). */
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),

    /** Signs the double-submit CSRF token (docs/architecture/04 §5). */
    CSRF_SECRET: z.string().min(32, 'CSRF_SECRET must be at least 32 characters'),

    /**
     * Combined with a rotating UTC calendar day to derive the
     * privacy-preserving `ip_hash`/`visitor_hash` values doc 09 §10
     * describes (`sha256(ip + userAgent + dailySalt)` — see
     * utils/hashIp.ts) — audit logs, contact messages, and page-view
     * analytics all use it. Already present in `.env.example` and
     * `docker-compose.yml` since Phase 1 (docs/architecture/08 §2's sample
     * env file), which anticipated this correctly before Phase 4 actually
     * added the schema entry.
     */
    IP_HASH_SALT: z.string().min(32, 'IP_HASH_SALT must be at least 32 characters'),

    JWT_ACCESS_TTL: z.string().min(1).default('15m'),
    JWT_REFRESH_TTL: z.string().min(1).default('7d'),

    /**
     * Cookie `Domain` attribute (decision D1) — required so the same cookie
     * reaches both `eslamramzy.dev` and `api.eslamramzy.dev`. Leading dot,
     * apex domain. This is also why cookies use the `__Secure-` prefix rather
     * than `__Host-`, which forbids a `Domain` attribute entirely
     * (docs/architecture/04 §1).
     */
    COOKIE_DOMAIN: z.string().min(1).default('.local.eslamramzy.dev'),

    /**
     * Gates the Swagger UI at `/api/v1/docs` (docs/architecture/03 §8) —
     * disabled by default, and behind admin auth when enabled, per that
     * section: exposing the full API surface (including admin routes) is
     * reconnaissance information an attacker should not get for free.
     */
    ENABLE_API_DOCS: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV !== 'production') return;

    for (const field of ['JWT_SECRET', 'CSRF_SECRET', 'IP_HASH_SALT'] as const) {
      if (isPlaceholderSecret(value[field])) {
        ctx.addIssue({
          code: 'custom',
          path: [field],
          message: `${field} looks like a placeholder value — refusing to start in production with it`,
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

/**
 * Load `.env` outside production. In production the environment comes from the
 * container, and a stray `.env` file on the server should not silently win.
 *
 * `process.loadEnvFile()` with no argument reads `.env` from `process.cwd()`
 * — which is `apps/api/`, not the repo root, whenever this runs through an
 * npm workspace script (`npm run dev -w @portfolio/api`, verified: npm sets
 * the workspace's own directory as CWD). The file to fill in for local
 * development is therefore `apps/api/.env.example` → `apps/api/.env`, not a
 * `.env` at the repo root — see that file's own header for the full
 * explanation and how this differs from the Docker Compose path.
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
