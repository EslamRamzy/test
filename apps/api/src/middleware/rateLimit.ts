import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';
import * as auditLogRepository from '../repositories/auditLogRepository.js';
import { hashIp } from '../utils/hashIp.js';

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
function createRateLimiter(options: {
  windowMs: number;
  limit: number;
  keyGenerator?: (req: Request) => string;
  /**
   * When set, a 429 from this limiter also writes an audit entry (docs/
   * architecture/09 §4: "429 responses ... are audited when they hit an
   * auth bucket"). Fire-and-forget — a failure to write the audit row must
   * never be why a client's 429 response is delayed or itself fails.
   */
  auditAction?: string;
}) {
  const { windowMs, limit, keyGenerator, auditAction } = options;

  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    ...(keyGenerator ? { keyGenerator } : {}),
    // express-rate-limit's own `standardHeaders` mode does not set
    // `Retry-After` reliably across versions; set it explicitly so a client
    // can always act on it regardless of that detail.
    handler: (req: Request, res: Response) => {
      res.setHeader('Retry-After', Math.ceil(windowMs / 1000));
      res.status(429).json({
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many requests' },
      });

      if (auditAction) {
        const userAgent = req.get('user-agent') ?? undefined;
        void auditLogRepository.record({
          userId: null,
          action: auditAction,
          ipHash: hashIp(req.ip ?? 'unknown', userAgent),
          ...(userAgent !== undefined ? { userAgent } : {}),
        });
      }
    },
  });
}

/** `public:read` — docs/architecture/09 §4: 300 requests / 15 minutes / IP. */
export const publicReadLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, limit: 300 });

/**
 * `auth:login` is a DUAL bucket (docs/architecture/09 §4, docs/architecture/04
 * §2): 5 requests / 15 minutes per IP AND, independently, 5 / 15 minutes per
 * attempted email. Both must be mounted on the login route — the IP bucket
 * alone lets a distributed attack spray one account from many IPs; the email
 * bucket alone lets one IP spray many accounts. Keyed off `req.body.email`,
 * which by the time this runs has already been through the login schema's
 * `emailSchema` (trimmed, lower-cased) — see routes/auth.routes.ts for the
 * required middleware order.
 */
export const authLoginByIpLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  auditAction: 'LOGIN_RATE_LIMITED',
});

export const authLoginByEmailLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  auditAction: 'LOGIN_RATE_LIMITED',
  keyGenerator: (req: Request) => {
    const body = req.body as { email?: unknown } | undefined;
    return typeof body?.email === 'string' ? body.email : 'unknown';
  },
});

/** `auth:refresh` — docs/architecture/09 §4: 30 requests / 15 minutes / IP. */
export const authRefreshLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, limit: 30 });

/** `search` — docs/architecture/09 §4: 30 / minute / IP. FTS queries are the most expensive public read. */
export const searchLimiter = createRateLimiter({ windowMs: 60 * 1000, limit: 30 });

/** `contact` — docs/architecture/09 §4: 3 / hour / IP. The 10/day GLOBAL cap is a DB count in `contactService.ts`, not a per-key bucket this factory can express. */
export const contactLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, limit: 3 });

/** `analytics` — docs/architecture/09 §4: 60 / minute / IP. Cheap endpoint, still capped. */
export const analyticsLimiter = createRateLimiter({ windowMs: 60 * 1000, limit: 60 });

/**
 * `admin` — docs/architecture/09 §4: 600 requests / 15 minutes, PER USER
 * (not per IP — a single admin legitimately working from several devices
 * or behind a NAT shouldn't share one IP-keyed bucket with itself). One
 * bucket for every admin route regardless of method (doc09 §4's table has
 * no separate read/write admin bucket) — mounted after `authenticate` on
 * every admin route (see routes/admin/**), so `req.user` is always
 * populated by the time this runs; the `'unknown'` fallback exists only so
 * the type-checker doesn't need `req.user` proven non-null here — it is
 * never actually reached given that mount order.
 *
 * Named `adminLimiter`, not `adminReadLimiter` — Phase 7 introduced this
 * bucket for the one admin route that existed then (`GET /admin/overview`,
 * a read), and the name reflected that single call site rather than doc09's
 * actual bucket definition. Phase 8 mounts it on writes too, which is what
 * the doc always specified; renamed here rather than carrying a misleading
 * name into a dozen more route files.
 *
 */
export const adminLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  keyGenerator: (req: Request) => String(req.user?.id ?? 'unknown'),
});

/** `upload` — docs/architecture/09 §4: 20 / hour. Keyed by IP, like every other bucket except `admin` (the table has no "per user" note on this row). Mounted only on `POST /admin/media` — every other admin route keeps using the general `adminLimiter` bucket above it. */
export const uploadLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, limit: 20 });

export { createRateLimiter };
