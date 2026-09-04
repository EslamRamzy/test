import cors from 'cors';
import express from 'express';
import type { Express } from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';
import { permissionsPolicy } from './middleware/securityHeaders.js';
import { requestId } from './middleware/requestId.js';
import { requestLogger } from './middleware/requestLogger.js';
import { healthRouter } from './routes/health.routes.js';

/**
 * Builds the Express application without binding a port, so integration tests
 * can drive it through supertest with no sockets involved (docs/architecture/10 §2).
 *
 * Middleware order matters and follows docs/architecture/03 §6 exactly, minus
 * the pieces that don't exist until Phase 4 (cookies, CSRF, authenticate,
 * authorize) and Phase 5 (`validate`, which is per-route and mounted by the
 * routes that need it, not globally here):
 *
 *   requestId → requestLogger (pino-http) → helmet → permissionsPolicy →
 *   cors → express.json(limit) → routes → notFoundHandler → errorHandler
 */
export function createApp(): Express {
  const app = express();

  // Behind exactly one reverse proxy (Caddy). Never `true`: that would trust a
  // client-supplied X-Forwarded-For and let anyone evade every rate limit.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(requestId);
  app.use(requestLogger);

  app.use(
    helmet({
      // frameguard defaults to SAMEORIGIN; the API is never framed, so DENY.
      frameguard: { action: 'deny' },
      // doc09 §2 wants 2 years + preload; helmet's own default is 1 year
      // with no preload flag.
      strictTransportSecurity: { maxAge: 63_072_000, includeSubDomains: true, preload: true },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      // CSP is deliberately left at helmet's built-in default here, not
      // disabled and not the final policy either: doc09 §2's real,
      // nonce-based CSP is a Phase 11 rollout (report-only first, then
      // enforced) — helmet's default self-only policy is a reasonable
      // interim baseline, not a placeholder to remove without replacing.
    }),
  );
  app.use(permissionsPolicy);

  // Exact-match allow-list. `origin: true` would reflect any origin, which
  // combined with credentials is equivalent to disabling the same-origin policy.
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
      maxAge: 600,
    }),
  );

  // Body limit is applied before parsing, not after.
  app.use(express.json({ limit: '1mb' }));

  app.use('/api/v1', healthRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
