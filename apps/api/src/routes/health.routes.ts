import type { ApiFailure } from '@portfolio/shared';
import { Router } from 'express';
import type { Request, Response } from 'express';
import { sendSuccess } from '../lib/httpResponse.js';
import { isDatabaseReady } from '../services/healthService.js';

export const healthRouter: Router = Router();

/** A generic, unauthenticated-safe failure body — no connection strings or driver detail. */
const NOT_READY: ApiFailure = {
  success: false,
  error: { code: 'INTERNAL_ERROR', message: 'Service is not ready' },
};

/**
 * Liveness: the process is up and serving.
 *
 * Deliberately reports no version, dependency or build information — an
 * unauthenticated endpoint should not help fingerprint the deployment
 * (docs/architecture/09 §11).
 */
healthRouter.get('/health', (_req: Request, res: Response) => {
  sendSuccess(res, { status: 'ok' });
});

/**
 * Readiness: the process can serve real traffic — the database is reachable
 * and migrations have been applied. A container that fails this should not
 * be put into rotation behind the reverse proxy (docs/architecture/01 §8).
 *
 * `503` here is deliberately handled locally rather than routed through
 * `errorHandler`/`AppError`: it is an infrastructure signal for a load
 * balancer, not one of the API's documented error codes (docs/architecture/03
 * §1's table has no "service unavailable" entry), and `InternalError` is
 * hardcoded to `500`, not `503`.
 */
healthRouter.get('/health/ready', (_req: Request, res: Response) => {
  isDatabaseReady()
    .then((ready) => {
      if (ready) {
        sendSuccess(res, { status: 'ready' });
      } else {
        res.status(503).json(NOT_READY);
      }
    })
    .catch(() => {
      res.status(503).json(NOT_READY);
    });
});
