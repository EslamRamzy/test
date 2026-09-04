import { siteSettingBulkUpdateSchema } from '@portfolio/shared';
import { Router } from 'express';
import { settingsController } from '../../controllers/admin/settingsController.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { adminLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';

/** `/api/v1/admin/settings` (doc03 §5: "GET grouped", "PATCH bulk"). */
export const settingsRouter: Router = Router();

settingsRouter.use(authenticate, adminLimiter);

settingsRouter.get('/', authorize('settings:read'), settingsController.list);

settingsRouter.patch(
  '/',
  csrfProtection,
  authorize('settings:update'),
  validate({ body: siteSettingBulkUpdateSchema }),
  settingsController.bulkUpdate,
);
