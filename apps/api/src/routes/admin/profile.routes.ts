import { profileUpdateSchema } from '@portfolio/shared';
import { Router } from 'express';
import { profileController } from '../../controllers/admin/profileController.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { adminLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';

/** `/api/v1/admin/profile` (doc03 §5). Singleton — no `:id` in either route. */
export const profileRouter: Router = Router();

profileRouter.use(authenticate, adminLimiter);

profileRouter.get('/', authorize('profile:read'), profileController.read);

profileRouter.patch(
  '/',
  csrfProtection,
  authorize('profile:update'),
  validate({ body: profileUpdateSchema }),
  profileController.update,
);
