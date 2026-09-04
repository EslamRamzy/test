import { Router } from 'express';
import type { Request, Response } from 'express';
import { isDatabaseReady } from '../services/healthService.js';

export const healthRouter: Router = Router();

/**
 * Liveness: the process is up and serving.
 *
 * Deliberately reports no version, dependency or build information — an
 * unauthenticated endpoint should not help fingerprint the deployment
 * (docs/architecture/09 §11).
 */
healthRouter.get('/health', (_req: Request, res: Response) => {
  res.json({ success: true, data: { status: 'ok' } });
});

/**
 * Readiness: the process can serve real traffic — the database is reachable
 * and migrations have been applied. A container that fails this should not
 * be put into rotation behind the reverse proxy (docs/architecture/01 §8).
 */
healthRouter.get('/health/ready', (_req: Request, res: Response) => {
  isDatabaseReady()
    .then((ready) => {
      if (ready) {
        res.json({ success: true, data: { status: 'ready' } });
        return;
      }
      // Deliberately generic: a readiness probe is unauthenticated and must
      // not leak connection strings or driver error detail.
      res.status(503).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Service is not ready' },
      });
    })
    .catch(() => {
      res.status(503).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Service is not ready' },
      });
    });
});
