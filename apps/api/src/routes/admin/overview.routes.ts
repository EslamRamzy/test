import { Router } from 'express';
import * as overviewController from '../../controllers/admin/overviewController.js';
import { authenticate } from '../../middleware/authenticate.js';
import { adminLimiter } from '../../middleware/rateLimit.js';

/**
 * `/api/v1/admin/overview` (docs/architecture/03 §5, docs/architecture/07
 * §3). `authenticate` before `adminLimiter` here, not the public-route
 * order (rate-limit before auth) doc 03 §6 otherwise specifies — that
 * ordering exists so an anonymous IP-keyed bucket rejects cheaply before
 * any auth work runs; this bucket is keyed per USER (`middleware/
 * rateLimit.ts`'s `adminLimiter`), which needs `req.user` populated
 * first.
 *
 * No `authorize(permission)` — viewing the dashboard's own aggregate
 * counters doesn't correspond to any single resource permission in
 * `PERMISSIONS` (packages/shared/src/constants/rbac.ts), and every
 * authenticated admin session should see it, the same reasoning `GET
 * /auth/me` already uses.
 */
export const overviewRouter: Router = Router();

overviewRouter.get('/', authenticate, adminLimiter, overviewController.show);
