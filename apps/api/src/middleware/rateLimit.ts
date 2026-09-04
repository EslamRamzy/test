import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';

/**
 * Rate limiting (docs/architecture/09 §4). An in-memory store is correct for
 * a single instance — the comment marking the Redis swap point is this one:
 * if this API ever runs as more than one process, replace the default store
 * with `rate-limit-redis` here and nowhere else.
 *
 * Keyed by IP by default, which is only meaningful because `app.ts` sets
 * `trust proxy` to exactly `1` (one hop — Caddy), never `true`. `true` would
 * let a client forge `X-Forwarded-For` and pick its own rate-limit identity,
 * defeating every bucket below.
 *
 * Each bucket in docs/architecture/09 §4's table gets its own limiter
 * instance from this factory as the routes that need them are built
 * (`auth:login`, `contact`, `analytics`, `search`, `upload`, `admin` land in
 * the phases that introduce those routes). `publicReadLimiter` is the one
 * bucket with nothing route-specific to attach to yet, so it is exported
 * ready to mount in Phase 5.
 */
function createRateLimiter(options: { windowMs: number; limit: number }) {
  const { windowMs, limit } = options;

  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    // express-rate-limit's own `standardHeaders` mode does not set
    // `Retry-After` reliably across versions; set it explicitly so a client
    // can always act on it regardless of that detail.
    handler: (_req: Request, res: Response) => {
      res.setHeader('Retry-After', Math.ceil(windowMs / 1000));
      res.status(429).json({
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many requests' },
      });
    },
  });
}

/** `public:read` — docs/architecture/09 §4: 300 requests / 15 minutes / IP. */
export const publicReadLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, limit: 300 });

export { createRateLimiter };
