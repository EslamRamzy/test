import {
  adminListQuerySchema,
  idParamSchema,
  reorderSchema,
  timelineEntryCreateSchema,
  timelineEntryUpdateSchema,
} from '@portfolio/shared';
import { Router } from 'express';
import { timelineController } from '../../controllers/admin/timelineController.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { adminLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';

export const timelineRouter: Router = Router();

timelineRouter.use(authenticate, adminLimiter);

timelineRouter.get(
  '/',
  authorize('timeline:read'),
  validate({ query: adminListQuerySchema }),
  timelineController.list,
);
timelineRouter.post(
  '/',
  csrfProtection,
  authorize('timeline:create'),
  validate({ body: timelineEntryCreateSchema }),
  timelineController.create,
);
timelineRouter.patch(
  '/reorder',
  csrfProtection,
  authorize('timeline:reorder'),
  validate({ body: reorderSchema }),
  timelineController.reorder!,
);
timelineRouter.get(
  '/:id',
  authorize('timeline:read'),
  validate({ params: idParamSchema }),
  timelineController.read,
);
timelineRouter.patch(
  '/:id',
  csrfProtection,
  authorize('timeline:update'),
  validate({ params: idParamSchema, body: timelineEntryUpdateSchema }),
  timelineController.update,
);
timelineRouter.delete(
  '/:id',
  csrfProtection,
  authorize('timeline:delete'),
  validate({ params: idParamSchema }),
  timelineController.remove,
);
