import cors from 'cors';
import express from 'express';
import type { Express, NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { healthRouter } from './routes/health.routes.js';

/**
 * Builds the Express application without binding a port, so integration tests
 * can drive it through supertest with no sockets involved (docs/architecture/10 §2).
 *
 * Middleware order matters and is specified in docs/architecture/03 §6. Phase 1
 * installs only the pieces that exist so far; Phase 3 fills in requestId,
 * logging, rate limiting, validation and the typed error handler, and Phase 4
 * adds CSRF, authentication and authorization.
 */
export function createApp(): Express {
  const app = express();

  // Behind exactly one reverse proxy (Caddy). Never `true`: that would trust a
  // client-supplied X-Forwarded-For and let anyone evade every rate limit.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // frameguard defaults to SAMEORIGIN; the API is never framed, so DENY.
  // The full header set (CSP, HSTS, COOP/CORP) lands in Phase 3.
  app.use(helmet({ frameguard: { action: 'deny' } }));

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

  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Resource not found' },
    });
  });

  // Express identifies an error handler by its four-parameter signature, so
  // `next` must stay in the list even though it is unused here.
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    // eslint-disable-next-line no-console -- replaced by the pino logger in Phase 3
    console.error(error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
  });

  return app;
}
