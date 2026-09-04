import { idParamSchema, securityFindingUpdateSchema } from '@portfolio/shared';
import { Router } from 'express';
import { findingController } from '../../controllers/admin/findingController.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { adminLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';

/** `/api/v1/admin/findings` — `PATCH|DELETE` only (doc03 §5); create/list are `assessments.routes.ts`'s `/admin/assessments/:id/findings`. Same `security:*` gating as `assessments.routes.ts`. */
export const findingsRouter: Router = Router();

findingsRouter.use(authenticate, adminLimiter);

findingsRouter.patch(
  '/:id',
  csrfProtection,
  authorize('security:update'),
  validate({ params: idParamSchema, body: securityFindingUpdateSchema }),
  findingController.update,
);

findingsRouter.delete(
  '/:id',
  csrfProtection,
  authorize('security:delete'),
  validate({ params: idParamSchema }),
  findingController.remove,
);
