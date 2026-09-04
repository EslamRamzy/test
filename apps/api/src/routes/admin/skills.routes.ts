import {
  idParamSchema,
  reorderSchema,
  skillCreateSchema,
  skillListQuerySchema,
  skillUpdateSchema,
} from '@portfolio/shared';
import { Router } from 'express';
import { skillController } from '../../controllers/admin/skillController.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { adminLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';

export const skillsRouter: Router = Router();

skillsRouter.use(authenticate, adminLimiter);

skillsRouter.get(
  '/',
  authorize('skill:read'),
  validate({ query: skillListQuerySchema }),
  skillController.list,
);
skillsRouter.post(
  '/',
  authorize('skill:create'),
  validate({ body: skillCreateSchema }),
  skillController.create,
);
skillsRouter.patch(
  '/reorder',
  authorize('skill:reorder'),
  validate({ body: reorderSchema }),
  skillController.reorder!,
);
skillsRouter.get(
  '/:id',
  authorize('skill:read'),
  validate({ params: idParamSchema }),
  skillController.read,
);
skillsRouter.patch(
  '/:id',
  authorize('skill:update'),
  validate({ params: idParamSchema, body: skillUpdateSchema }),
  skillController.update,
);
skillsRouter.delete(
  '/:id',
  authorize('skill:delete'),
  validate({ params: idParamSchema }),
  skillController.remove,
);
