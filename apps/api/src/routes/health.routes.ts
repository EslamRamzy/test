import { Router } from 'express';
import type { Request, Response } from 'express';

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
 * Readiness: the process can serve real traffic.
 *
 * Phase 2 extends this to check the database connection and that migrations
 * have been applied, so the container is not put into rotation before the
 * schema is ready.
 */
healthRouter.get('/health/ready', (_req: Request, res: Response) => {
  res.json({ success: true, data: { status: 'ready' } });
});
