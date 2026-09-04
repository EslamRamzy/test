import { analyticsAdminQuerySchema } from '@portfolio/shared';
import { Router } from 'express';
import { analyticsController } from '../../controllers/admin/analyticsController.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { adminLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';

/** `/api/v1/admin/analytics` (doc03 §5) — read-only. */
export const analyticsAdminRouter: Router = Router();

analyticsAdminRouter.use(authenticate, adminLimiter);

analyticsAdminRouter.get(
  '/',
  authorize('analytics:read'),
  validate({ query: analyticsAdminQuerySchema }),
  analyticsController.overview,
);
