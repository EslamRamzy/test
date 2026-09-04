import {
  adminListQuerySchema,
  experienceCreateSchema,
  experienceUpdateSchema,
  idParamSchema,
  reorderSchema,
} from '@portfolio/shared';
import { Router } from 'express';
import { experienceController } from '../../controllers/admin/experienceController.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { adminLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';

export const experienceRouter: Router = Router();

experienceRouter.use(authenticate, adminLimiter);

experienceRouter.get(
  '/',
  authorize('experience:read'),
  validate({ query: adminListQuerySchema }),
  experienceController.list,
);
experienceRouter.post(
  '/',
  csrfProtection,
  authorize('experience:create'),
  validate({ body: experienceCreateSchema }),
  experienceController.create,
);
experienceRouter.patch(
  '/reorder',
  csrfProtection,
  authorize('experience:reorder'),
  validate({ body: reorderSchema }),
  experienceController.reorder!,
);
experienceRouter.get(
  '/:id',
  authorize('experience:read'),
  validate({ params: idParamSchema }),
  experienceController.read,
);
experienceRouter.patch(
  '/:id',
  csrfProtection,
  authorize('experience:update'),
  validate({ params: idParamSchema, body: experienceUpdateSchema }),
  experienceController.update,
);
experienceRouter.delete(
  '/:id',
  csrfProtection,
  authorize('experience:delete'),
  validate({ params: idParamSchema }),
  experienceController.remove,
);
